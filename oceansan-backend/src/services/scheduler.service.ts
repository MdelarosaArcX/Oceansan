import cron from "node-cron";
import os from "os";

import Schedule, { ISchedule } from "../models/Schedule";
import { CopyRunnerService } from "./copy-runner.service";

type Broadcaster = (data: unknown) => void;

class SchedulerService {
  private broadcaster?: Broadcaster;
  private running = new Set<string>();

  setBroadcaster(fn: Broadcaster) {
    this.broadcaster = fn;
  }

  start() {
    if (os.platform() !== "win32") {
      throw new Error("Scheduler requires Windows (Robocopy)");
    }

    cron.schedule("* * * * *", async () => {
      const now = new Date();
      const hhmm = now.toTimeString().slice(0, 5);
      const today = now.getDay();

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

    console.log("Scheduler running (robocopy-based)");
  }

  private async runSchedule(schedule: ISchedule) {
    const id = schedule._id.toString();
    this.running.add(id);

    const runner = new CopyRunnerService(this.broadcaster);

    try {
      await runner.run({
        scheduleId: id,
        type: schedule.type,
        name: schedule.sched_name,
        source: schedule.src_path,
        destination: schedule.dest_path,
      });
    } catch (err) {
      console.error("Schedule execution failed:", err);
    } finally {
      this.running.delete(id);
    }

    await Schedule.updateOne(
      { _id: schedule._id },
      {
        $set:
          schedule.type === "archive"
            ? { last_archived: new Date() }
            : { last_sync: new Date() },
      }
    );
  }
}

export default new SchedulerService();
