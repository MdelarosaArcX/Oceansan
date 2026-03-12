import cron from "node-cron";
import os from "os";
import { Repository } from "typeorm";

import { Schedule } from "../entities/Schedule";
import { ScheduleLogs } from "../entities/ScheduleLogs";
import { CopyRunnerService } from "./copy-runner.service";
import { AppDataSource } from "../config/typeorm.config";

type Broadcaster = (data: unknown) => void;

class SchedulerService {
  private broadcaster?: Broadcaster;
  private running = new Set<number>();

  setBroadcaster(fn: Broadcaster) {
    this.broadcaster = fn;
  }

  start() {
    if (os.platform() !== "win32") {
      throw new Error("Scheduler requires Windows (Robocopy)");
    }

    const scheduleRepo = AppDataSource.getRepository(Schedule);
    const scheduleLogsRepo = AppDataSource.getRepository(ScheduleLogs);

    cron.schedule("* * * * *", async () => {
      const now = new Date();
      const hhmm = now.toTimeString().slice(0, 5);
      const today = now.getDay();

      const schedules = await scheduleRepo.find({
        where: {
          active: true,
          time: hhmm,
        },
      });

      for (const schedule of schedules) {
        if (!schedule.days.includes(today)) continue;

        const id = schedule.id;

        if (this.running.has(id)) continue;

        this.runSchedule(schedule, scheduleRepo, scheduleLogsRepo);
      }
    });

    console.log("Scheduler running (robocopy-based)");
  }

  private async runSchedule(
    schedule: Schedule,
    scheduleRepo: Repository<Schedule>,
    scheduleLogsRepo: Repository<ScheduleLogs>
  ) {
    const id = schedule.id;

    this.running.add(id);

    const runner = new CopyRunnerService(scheduleLogsRepo, this.broadcaster);

    try {
      await runner.run({
        scheduleId: schedule.id,
        type: schedule.type,
        name: schedule.sched_name,
        source: schedule.src_path,
        destination: schedule.dest_path,
        engine: schedule.engine,
        option: {
          recycle: schedule.recycle,
          recycle_path: schedule.recycle_path,
        },
      });
    } catch (err) {
      console.error("Schedule execution failed:", err);
    } finally {
      this.running.delete(id);
    }

    if (schedule.type === "archive") {
      schedule.last_archived = new Date();
    } else {
      schedule.last_sync = new Date();
    }

    await scheduleRepo.save(schedule);
  }
}

export default new SchedulerService();