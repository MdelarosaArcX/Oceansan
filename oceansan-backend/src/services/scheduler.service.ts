import cron from "node-cron";
import fs from "fs-extra";
import path from "path";
import Schedule, { ISchedule } from "../models/Schedule";
import ScheduleLogs from "../models/ScheduleLogs";
import CopyService from "./copy.service";
import mongoose from "mongoose";

type Broadcaster = (data: unknown) => void;

class SchedulerService {
  private broadcaster?: Broadcaster;
  private running = new Set<string>();

  setBroadcaster(fn: Broadcaster) {
    this.broadcaster = fn;
  }

  start() {
    cron.schedule("* * * * *", async () => {
      const now = new Date();
      const hhmm = now.toTimeString().slice(0, 5); // HH:mm
      const today = now.getDay(); // 0–6

      const schedules = await Schedule.find({
        active: true,
        time: hhmm,
        days: today,
      });

      for (const schedule of schedules) {
        const id = schedule._id.toString();
        if (this.running.has(id)) continue;
        this.runSchedule(schedule);
      }
    });

    console.log("Scheduler running (day + time based)");
  }

  private async runSchedule(schedule: ISchedule) {
    const scheduleId = schedule._id.toString();
    this.running.add(scheduleId);

    const copier = new CopyService();
    let finished = false;
    let lastPercent = 0;

    /* -------------------- Execution Record -------------------- */
    const execution = await ScheduleLogs.create({
      scheduleId: schedule._id,
      type: schedule.type,
      source: schedule.src_path,
      destination: schedule.dest_path,
      startTime: new Date(),
      totalFiles: 0,
      totalSize: 0,
      files: [],
    });

    /* -------------------- Log File -------------------- */
    const logsDir = path.join(process.cwd(), "logs");
    await fs.ensureDir(logsDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logFile = path.join(
      logsDir,
      `log_${schedule.type}_${schedule.sched_name}_${timestamp}.txt`,
    );

    const appendLog = async (line: string) => {
      await fs.appendFile(logFile, line + "\n");
    };

    await appendLog(`Schedule ${schedule.type.toUpperCase()} started`);
    await appendLog(`Source: ${schedule.src_path}`);
    await appendLog(`Destination: ${schedule.dest_path}`);
    await appendLog(`Start Time: ${new Date().toISOString()}`);
    await appendLog("------ FILES ------");

    //  Broadcast start
    // this.broadcaster?.({
    //   type: "schedule-start",
    //   scheduleId: schedule._id.toString(),
    //   mode: schedule.type,
    // });
    this.broadcaster?.({
      type: "start",
      jobId: schedule._id.toString(),
      mode: schedule.type,
    });

    /* -------------------- Batched DB Save -------------------- */
    let pendingWrites = 0;
    const flushExecution = async () => {
      if (pendingWrites > 0) {
        await execution.save();
        pendingWrites = 0;
      }
    };

    /* -------------------- Progress -------------------- */
    copier.on("progress", (progress) => {
      lastPercent = progress.percent;

      // this.broadcaster?.({
      //   type: "schedule-progress",
      //   scheduleId: schedule._id.toString(),
      //   payload: progress,
      // });

      this.broadcaster?.({
        type: "progress",
        jobId: schedule._id.toString(),
        payload: {
          percent: progress.percent,
          currentFile: progress.currentFile,
        },
      });
    });

    /* -------------------- File Events -------------------- */

    const recordFile = async (
      status: "copied" | "updated" | "deleted" | "error",
      file: string,
      size = 0,
      error?: string,
    ) => {
      execution.files.push({
        path: file,
        size,
        status,
        error,
      });

      execution.totalFiles++;

      if (status === "copied" || status === "updated") {
        execution.totalSize += size;
      }

      pendingWrites++;

      if (pendingWrites >= 20) {
        await flushExecution();
      }
    };

    copier.on("file-copied", async ({ file, size }) => {
      await recordFile("copied", file, size);
      await appendLog(`[${lastPercent}%] ✔ copied: ${file}`);
    });

    copier.on("file-updated", async ({ file, size }) => {
      await recordFile("updated", file, size);
      await appendLog(`[${lastPercent}%] 🔄 updated: ${file}`);
    });

    copier.on("file-deleted", async ({ file }) => {
      await recordFile("deleted", file);
      await appendLog(`[${lastPercent}%] 🗑 deleted: ${file}`);
    });

    copier.on("file-error", async ({ file, error }) => {
      await recordFile("error", file, 0, error);
      await appendLog(`[${lastPercent}%]  error: ${file} - ${error}`);
    });

    /* -------------------- Complete -------------------- */
    copier.on("complete", async () => {
      if (finished) return;
      finished = true;

      await flushExecution();

      execution.endTime = new Date();
      await execution.save();

      await Schedule.updateOne(
        { _id: schedule._id },
        {
          $set:
            schedule.type === "archive"
              ? { last_archived: new Date() }
              : { last_sync: new Date() },
        },
      );

      this.running.delete(scheduleId);

      // this.broadcaster?.({
      //   type: "schedule-complete",
      //   scheduleId: schedule._id.toString(),
      // });
      this.broadcaster?.({
        type: "complete",
        jobId: schedule._id.toString(),
        summary: {
          totalFiles: execution.totalFiles,
          totalSize: execution.totalSize,
        },
      });

      await appendLog("Schedule complete");
      await appendLog(`End Time: ${new Date().toISOString()}`);
      await appendLog("------ END ------");

      console.log(
        `[${schedule.type.toUpperCase()}] Completed. Log: ${logFile}`,
      );
    });

    /* -------------------- Error -------------------- */
    copier.on("error", async (err: Error) => {
      if (finished) return;
      finished = true;

      await flushExecution();

      execution.endTime = new Date();
      await execution.save();

      this.running.delete(scheduleId);

      this.broadcaster?.({
        type: "schedule-error",
        scheduleId,
        message: err.message,
      });

      await appendLog(`ERROR: ${err.message}`);
      console.error(`[${schedule.type.toUpperCase()}] Error: ${err.message}`);
    });

    /* -------------------- Execute -------------------- */
    try {
      if (schedule.type === "archive") {
        await copier._archive(schedule.src_path, schedule.dest_path);
      } else {
        await copier._sync(schedule.src_path, schedule.dest_path);
      }
    } catch (err) {
      copier.emit("error", err as Error);
    }
  }

  /**
   * Run a schedule manually without it being in DB
   */
  async runManualSchedule(params: {
    src_path: string;
    dest_path: string;
    type: "sync" | "archive";
    sched_name?: string;
    _id?: string; // optional, if you want to generate logs against a jobId
  }) {
    // Create a real Mongoose document
    const scheduleDoc: ISchedule = new Schedule({
      _id: params._id ? new mongoose.Types.ObjectId(params._id) : undefined,
      src_path: params.src_path,
      dest_path: params.dest_path,
      type: params.type,
      sched_name: params.sched_name ?? "manual",
      active: true,
      days: [], // not relevant for manual run
      time: "00:00", // required field by schema
      last_archived: null,
      last_sync: null,
    });

    // Pass it to the existing runSchedule
    await this.runSchedule(scheduleDoc);
  }
}

export default new SchedulerService();
