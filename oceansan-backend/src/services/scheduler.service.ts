import cron from "node-cron";
import fs from "fs-extra";
import path from "path";
import Schedule, { ISchedule } from "../models/Schedule";
import ScheduleLogs from "../models/ScheduleLogs";
import CopyService from "./copy.service";
import { CopyRunnerService } from "./copy-runner.service";
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
