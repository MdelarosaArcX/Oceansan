import cron from "node-cron";
import fs from "fs-extra";
import path from "path";
import Schedule, { ISchedule } from "../models/Schedule";
import ScheduleLogs from "../models/ScheduleLogs";
import CopyService from "./copy.service";
import { CopyRunnerService } from "./copy-runner.service";

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
    const runner = new CopyRunnerService(this.broadcaster);

    await runner.run({
      scheduleId: schedule._id.toString(),
      type: schedule.type,
      name: schedule.sched_name,
      source: schedule.src_path,
      destination: schedule.dest_path,
      mode: schedule.type
    });

    await Schedule.updateOne(
      { _id: schedule._id },
      {
        $set:
          schedule.type === "archive"
            ? { last_archived: new Date() }
            : { last_sync: new Date() }
      }
    );
  }
}

export default new SchedulerService();
