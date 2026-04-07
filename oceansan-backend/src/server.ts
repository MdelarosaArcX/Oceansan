#!/usr/bin/env node

// import "./config/mongo";

import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
// import CopyService from "./services/copy.service";
import scheduleRoutes from "./routes/schedule.routes";
import scheduleLogsRoutes from "./routes/scheduleLogs.routes";
import licenseRoutes from "./routes/license.routes";
import backupRoutes from "./routes/backup.routes";
import schedulerService from "./services/scheduler.service";
// import Schedule from "./models/Schedule";
import { CopyRunnerService } from "./services/copy-runner.service";
import RamMonitorService from "./services/ram-monitor.service";
import { seedLicensesIfNeeded } from "./services/license-seed.service";
// import ScheduleLogs from "./models/ScheduleLogs";
// import { Types } from "mongoose";
import { AppDataSource } from "./config/typeorm.config";
import { ScheduleLogs } from "./entities/ScheduleLogs";
// import { DeepPartial } from "typeorm";
import "reflect-metadata";

const app = express();

AppDataSource.initialize()
  .then(async () => {
    console.log("MySQL connected with TypeORM");

    await seedLicensesIfNeeded();
    await resumeInterruptedJobs();

    app.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("TypeORM connection error:", err);
  });

const allowedOrigins = new Set([
  "http://localhost:9000",
  "http://localhost:5173",
]);

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        origin === "null" ||
        origin.startsWith("file://") ||
        origin.startsWith("app://")
      ) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);
app.use(express.json());

const PORT = 3000;
let httpServerStarted = false;

/* ---------------- WebSocket ---------------- */

const wss = new WebSocketServer({ port: 3001 });

function broadcast(data: unknown) {
  try {
    const payload = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        try {
          client.send(payload);
        } catch (error) {
          console.error("WebSocket send failed:", error);
        }
      }
    });
  } catch (error) {
    console.error("Broadcast failed:", error);
  }
}

async function resumeInterruptedJobs() {
  try {
    const scheduleLogsRepo = AppDataSource.getRepository(ScheduleLogs);

    const jobs = await scheduleLogsRepo.find({
      where: { status: "interrupted" },
      relations: ["schedule"],
      order: { startTime: "ASC" },
    });

    for (const job of jobs) {
      try {
        if (!job.schedule?.id) {
          console.warn(`Skipping interrupted job ${job.id}: missing schedule relation`);
          continue;
        }

        console.log("Resuming:", job.id);

        const runner = new CopyRunnerService(scheduleLogsRepo, broadcast);

        void runner.run({
          scheduleId: job.schedule.id,
          type: job.type,
          name: "Recovered Job",
          source: job.source,
          destination: job.destination,
          engine: job.engine,
          existingLogId: job.id,
        }).catch((error) => {
          console.error(`Failed to resume interrupted job ${job.id}:`, error);
        });
      } catch (error) {
        console.error(`Error while scheduling interrupted job ${job.id}:`, error);
      }
    }
  } catch (error) {
    console.error("Failed to resume interrupted jobs:", error);
  }
}
// resumeInterruptedJobs();

wss.on("connection", (ws) => {
  console.log(" Client connected");

  const ramMonitor = new RamMonitorService(broadcast, 1000);
  ramMonitor.start();

  ws.on("close", () => {
    ramMonitor.stop();
    console.log("client disconeccted");
  });
});
console.log("WebSocket running on ws://localhost:3001");

/* ---------------- Scheduler ---------------- */

schedulerService.setBroadcaster(broadcast); // optional but useful
try {
  schedulerService.start(); //  REQUIRED
} catch (error) {
  console.error("Scheduler failed to start:", error);
}

/* ---------------- REST APIs ---------------- */
app.post("/copy/start", async (req, res) => {
  const { from, to, type, jobId, name, recycle, recycle_path, engine } = req.body;

  if (!from || !to) {
    return res.status(400).json({ error: "Missing from/to paths" });
  }

  try {
    const scheduleLogsRepo = AppDataSource.getRepository(ScheduleLogs);
    const runner = new CopyRunnerService(
      scheduleLogsRepo,
      broadcast
    );


    // Update resumedFromCrash using TypeORM
    await scheduleLogsRepo.update(
      { id: jobId },
      { resumedFromCrash: true } as any
    );

    // const log = await scheduleLogsRepo.findOne({ where: { id: jobId } });
    // if (!log) return res.status(404).json({ error: "Job not found" });

    // log.resumedFromCrash = true; 
    // await scheduleLogsRepo.save(log);

    // Run the copy job
    await runner.run({
      scheduleId: jobId, // or new Types.ObjectId(jobId) if id is still string
      type,
      name,
      source: from,
      destination: to,
      option: { recycle, recycle_path },
      engine,
    });


    res.json({ status: "started" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function markRunningJobsInterrupted() {
  if (!AppDataSource.isInitialized) {
    return;
  }

  const repo = AppDataSource.getRepository(ScheduleLogs);

  await repo
    .createQueryBuilder()
    .update(ScheduleLogs)
    .set({ status: "interrupted" })
    .where("status = :status", { status: "running" })
    .execute();
}

process.on("SIGINT", async () => {
  console.log("Server shutting down...");

  try {
    await markRunningJobsInterrupted();
  } catch (error) {
    console.error("Failed to update running jobs during SIGINT:", error);
  } finally {
    process.exit();
  }
});

process.on("SIGTERM", async () => {
  try {
    await markRunningJobsInterrupted();
    console.log("All running jobs marked as interrupted.");
  } catch (err) {
    console.error("Failed to update running jobs:", err);
  } finally {
    process.exit();
  }
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

app.use("/api/schedules", scheduleRoutes);
app.use("/api/schedulesLogs", scheduleLogsRoutes);
app.use("/license", licenseRoutes);
app.use("/api/backup", backupRoutes);

/* ---------------- Start Server ---------------- */
