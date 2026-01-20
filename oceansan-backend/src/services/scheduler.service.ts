import cron from "node-cron";
import fs from "fs-extra";
import path from "path";
import Schedule, { ISchedule } from "../models/Schedule";
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
      const today = now.getDay();

      const schedules = await Schedule.find({
        active: true,
        time: hhmm,
        days: today
      });

      for (const schedule of schedules) {
        if (this.running.has(schedule._id.toString())) continue;
        this.runSchedule(schedule);
      }
    });

    console.log("Scheduler running (day + time based)");
  }

  private async runSchedule(schedule: ISchedule) {
    this.running.add(schedule._id.toString());

    const copier = new CopyService();
     let lastPercent = 0;

    //  Prepare log file
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

    //  Broadcast start
    this.broadcaster?.({
      type: "schedule-start",
      scheduleId: schedule._id.toString(),
      mode: schedule.type
    });

    //  Log progress
    copier.on("progress", (progress) => {
      lastPercent = progress.percent;

      this.broadcaster?.({
        type: "schedule-progress",
        scheduleId: schedule._id.toString(),
        payload: progress
      });
    });

    // File success
    copier.on("file-success", async ({ file, copiedSize, totalSize }) => {
      const percent = Math.floor((copiedSize / totalSize) * 100);
      lastPercent = percent;

      await appendLog(`[${percent}%] copied: ${file}`);
    });

    // File error
    copier.on("file-error", async ({ file, error }) => {
      await appendLog(
        `[${lastPercent}%] error: ${file} - ${error}`
      );
    });


    //  Complete handler
    copier.on("complete", async () => {
      // update last_archived only
      await Schedule.updateOne(
        { _id: schedule._id.toString() },
        { $set: schedule.type === "archive" ? { last_archived: new Date() } : { last_sync: new Date() } }
      );

      this.running.delete(schedule._id.toString());

      this.broadcaster?.({
        type: "schedule-complete",
        scheduleId: schedule._id.toString()
      });

      await appendLog("Schedule complete");
      await appendLog(`End Time: ${new Date().toISOString()}`);
      await appendLog("------ END ------");
      console.log(`[${schedule.type.toUpperCase()}] Completed. Log: ${logFile}`);
    });

    //  Error handler
    copier.on("error", async (err: Error) => {
      this.running.delete(schedule._id.toString());

      this.broadcaster?.({
        type: "schedule-error",
        scheduleId: schedule._id,
        message: err.message
      });

      await appendLog(`ERROR: ${err.message}`);
      console.error(`[${schedule.type.toUpperCase()}] Error: ${err.message}`);
    });

    //  Execute proper method

    try {
      if (schedule.type === "archive") {
        await copier._archive(schedule.src_path, schedule.dest_path);
      } else if (schedule.type === "sync") {
        await copier._sync(schedule.src_path, schedule.dest_path);
      }
    } catch (err) {
      copier.emit("error", err);
    }
  }
}

export default new SchedulerService();
