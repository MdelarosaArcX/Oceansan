import cron, { ScheduledTask } from "node-cron";
import CopyService from "./copy.service";
import { writeLog } from "./logger.service";
import { CopyJob } from "../types/scheduler.types";

export default class SchedulerService {
  private tasks = new Map<string, ScheduledTask>();

  start(job: CopyJob) {
    if (this.tasks.has(job.id)) return;

    const task = cron.schedule(job.cron, async () => {
      const copier = new CopyService();

      writeLog({
        type: "scheduled",
        jobId: job.id,
        status: "started"
      });

      copier.on("complete", () => {
        writeLog({
          type: "scheduled",
          jobId: job.id,
          status: "completed"
        });
      });

      try {
        await copier.copyFolder(job.from, job.to);
      } catch (err) {
        writeLog({
          type: "scheduled",
          jobId: job.id,
          status: "failed",
          error: (err as Error).message
        });
      }
    });

    this.tasks.set(job.id, task);
  }

  stop(jobId: string) {
    this.tasks.get(jobId)?.stop();
    this.tasks.delete(jobId);
  }
}
