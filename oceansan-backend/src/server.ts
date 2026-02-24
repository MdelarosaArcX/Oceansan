#!/usr/bin/env node

import "./config/mongo";

import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import CopyService from "./services/copy.service";
import scheduleRoutes from "./routes/schedule.routes";
import scheduleLogsRoutes from "./routes/scheduleLogs.routes";
import schedulerService from "./services/scheduler.service";
import Schedule from "./models/Schedule";
import { CopyRunnerService } from "./services/copy-runner.service";
import RamMonitorService from "./services/ram-monitor.service";
import ScheduleLogs from "./models/ScheduleLogs";
import { Types } from "mongoose";

const app = express();
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
  const jobs = await ScheduleLogs.find({
    status: "interrupted",
  }).sort({ startTime: 1 });

  for (const job of jobs) {
    console.log("Resuming:", job._id);

    // Mark it running again
    // await ScheduleLogs.updateOne({ _id: job._id }, { status: "running" });

    const runner = new CopyRunnerService(broadcast);

    runner
      .run({
        scheduleId: job.scheduleId,
        type: job.type,
        name: "Recovered Job",
        source: job.source,
        destination: job.destination,
        engine: job.engine as any,
        existingLogId: job._id, // 👈 IMPORTANT
      })
      .catch(console.error);
  }
}
resumeInterruptedJobs();

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
  const { from, to, type, jobId, name, recycle, recycle_path, engine } =
    req.body;
  if (!from || !to) {
    return res.status(400).json({ error: "Missing from/to paths" });
  }

  try {
    const runner = new CopyRunnerService(broadcast);

    await ScheduleLogs.updateOne({ _id: jobId }, { resumedFromCrash: true });

    await runner.run({
      scheduleId: new Types.ObjectId(jobId),
      type,
      name: name,
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

process.on("SIGINT", async () => {
  console.log("Server shutting down...");
  await ScheduleLogs.updateMany(
    { status: "running" },
    { status: "interrupted" },
  );
  process.exit();
});

process.on("SIGTERM", async () => {
  await ScheduleLogs.updateMany(
    { status: "running" },
    { status: "interrupted" },
  );
  process.exit();
});

app.use("/api/schedules", scheduleRoutes);
app.use("/api/schedulesLogs", scheduleLogsRoutes);

/* ---------------- Start Server ---------------- */

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
