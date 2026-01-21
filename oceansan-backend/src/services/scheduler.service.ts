import cron from "node-cron";
import fs from "fs-extra";
import path from "path";
import Schedule, { ISchedule } from "../models/Schedule";
import ScheduleLogs from "../models/ScheduleLogs";
import CopyService from "./copy.service";

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
        days: today
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
      files: []
    });

    /* -------------------- Log File -------------------- */
    const logsDir = path.join(process.cwd(), "logs");
    await fs.ensureDir(logsDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logFile = path.join(
      logsDir,
      `log_${schedule.type}_${schedule.sched_name}_${timestamp}.txt`
    );

    const appendLog = async (line: string) => {
      await fs.appendFile(logFile, line + "\n");
    };

    await appendLog(`Schedule ${schedule.type.toUpperCase()} started`);
    await appendLog(`Source: ${schedule.src_path}`);
    await appendLog(`Destination: ${schedule.dest_path}`);
    await appendLog(`Start Time: ${new Date().toISOString()}`);
    await appendLog("------ FILES ------");

    /* -------------------- WebSocket Start -------------------- */
    this.broadcaster?.({
      type: "schedule-start",
      scheduleId,
      mode: schedule.type
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

      this.broadcaster?.({
        type: "schedule-progress",
        scheduleId,
        payload: progress
      });
    });

    /* -------------------- File Events -------------------- */

    const recordFile = async (
      status: "copied" | "updated" | "deleted" | "error",
      file: string,
      size = 0,
      error?: string
    ) => {
      execution.files.push({
        path: file,
        size,
        status,
        error
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
              : { last_sync: new Date() }
        }
      );

      this.running.delete(scheduleId);

      this.broadcaster?.({
        type: "schedule-complete",
        scheduleId,
        summary: {
          totalFiles: execution.totalFiles,
          totalSize: execution.totalSize
        }
      });

      await appendLog("Schedule complete");
      await appendLog(`End Time: ${new Date().toISOString()}`);
      await appendLog("------ END ------");

      console.log(
        `[${schedule.type.toUpperCase()}] Completed. Log: ${logFile}`
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
        message: err.message
      });

      await appendLog(`ERROR: ${err.message}`);
      console.error(
        `[${schedule.type.toUpperCase()}] Error: ${err.message}`
      );
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
}

export default new SchedulerService();
