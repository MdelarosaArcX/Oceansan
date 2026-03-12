#!/usr/bin/env node

// import "./config/mongo";

import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
// import CopyService from "./services/copy.service";
import scheduleRoutes from "./routes/schedule.routes";
import scheduleLogsRoutes from "./routes/scheduleLogs.routes";
import schedulerService from "./services/scheduler.service";
// import Schedule from "./models/Schedule";
import { CopyRunnerService } from "./services/copy-runner.service";
import RamMonitorService from "./services/ram-monitor.service";
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

    await resumeInterruptedJobs();

    app.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("TypeORM connection error:", err);
  });

app.use(
  cors({
    origin: ["http://localhost:9000", "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);
app.use(express.json());

const PORT = 3000;

/* ---------------- WebSocket ---------------- */

const wss = new WebSocketServer({ port: 3001 });

function broadcast(data: unknown) {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

async function resumeInterruptedJobs() {
  const scheduleLogsRepo = AppDataSource.getRepository(ScheduleLogs);

  const jobs = await scheduleLogsRepo.find({
    where: { status: "interrupted" },
    order: { startTime: "ASC" },
  });

  for (const job of jobs) {
    console.log("Resuming:", job.id);

    const runner = new CopyRunnerService(scheduleLogsRepo, broadcast);

    runner
      .run({
        scheduleId: job.schedule.id,
        type: job.type,
        name: "Recovered Job",
        source: job.source,
        destination: job.destination,
        engine: job.engine,
        existingLogId: job.id,
      })
      .catch(console.error);
  }
}
// resumeInterruptedJobs();

wss.on("connection", (ws) => {
  console.log("🔌 Client connected");

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
schedulerService.start(); //  REQUIRED

/* ---------------- REST APIs ---------------- */
app.post("/copy/start", async (req, res) => {
  const { from, to, type, jobId, name, recycle, recycle_path, engine } = req.body;

   console.log("req.body ==>",req.body)
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

    console.log("doest it go here?")

    res.json({ status: "started" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

process.on("SIGINT", async () => {
  console.log("Server shutting down...");

  const repo = AppDataSource.getRepository(ScheduleLogs);

  await repo
    .createQueryBuilder()
    .update(ScheduleLogs)
    .set({ status: "interrupted" })
    .where("status = :status", { status: "running" })
    .execute();

  process.exit();
});

process.on("SIGTERM", async () => {
  try {
    const repo = AppDataSource.getRepository(ScheduleLogs);

    await repo
      .createQueryBuilder()
      .update(ScheduleLogs)
      .set({ status: "interrupted" })
      .where("status = :status", { status: "running" })
      .execute();

    console.log("All running jobs marked as interrupted.");
  } catch (err) {
    console.error("Failed to update running jobs:", err);
  } finally {
    process.exit();
  }
});

app.use("/api/schedules", scheduleRoutes);
app.use("/api/schedulesLogs", scheduleLogsRoutes);

/* ---------------- Start Server ---------------- */

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
