import fs from "fs-extra";
import path from "path";

import RobocopyService from "./robocopy.service";
import ScheduleLogs, { ILogsFile } from "../models/ScheduleLogs";
import Schedule from "../models/Schedule";
import { walkDir } from "../utils/fileWalker";
import { ScheduleLogger } from "../utils/scheduler.logger";

type Broadcaster = (data: unknown) => void;

//SPEEDEMA
class SpeedEMA {
  private value = 0;
  constructor(private alpha = 0.2) {}

  update(sample: number) {
    if (this.value === 0) {
      this.value = sample;
    } else {
      this.value = this.alpha * sample + (1 - this.alpha) * this.value;
    }
    return this.value;
  }
}
export class CopyRunnerService {
  constructor(private ws?: Broadcaster) {}

  async run({
    scheduleId,
    type,
    name,
    source,
    destination,
    option,
  }: {
    scheduleId: string;
    type: "archive" | "sync";
    name: string;
    source: string;
    destination: string;
    option?: { recycle: boolean; recycle_path: string };
  }) {
    let currentFile = "";
    let currentStatus: "copying" | "deleted" | "idle" = "idle";

    const copier = new RobocopyService(this.ws);

    const files = walkDir(source);
    const fileQueue = files.map((f) => f.path);
    const totalFiles = files.length;
    const totalBytes = files.reduce((s, f) => s + f.size, 0);

    const logDoc = await ScheduleLogs.create({
      scheduleId,
      type,
      source,
      destination,
      startTime: new Date(),
      totalFiles,
      totalSize: totalBytes,
      files: [],
    });

    let copiedFiles = 0;
    let copiedBytes = 0;

    let lastBytes = 0;
    let lastTime = Date.now();

    const ema = new SpeedEMA(0.15);
    const startedAt = Date.now();

    // --- Real-time speed emitter ---
    const emitSpeed = () => {
      if (!currentFile) return;
      const now = Date.now();
      const deltaBytes = copiedBytes - lastBytes;
      const deltaTime = (now - lastTime) / 1000 || 1;
      const rawSpeed = deltaBytes / deltaTime;
      const smoothSpeed = ema.update(rawSpeed);

      lastBytes = copiedBytes;
      lastTime = now;

      const percent = totalBytes
        ? Math.min(100, Math.floor((copiedBytes / totalBytes) * 100))
        : 0;

      const speed = formatSpeed(smoothSpeed);

      this.ws?.({
        type: "progress",
        currentFile,
        speed: speed.value.toFixed(2) + " " + speed.unit,
        scheduleId,
      });
    };
    currentFile = fileQueue.length ? path.basename(fileQueue[0]) : "";

    const speedInterval = setInterval(emitSpeed, 500);

    // Buffer to batch save
    const pendingFiles: ILogsFile[] = [];
    let saveTimeout: NodeJS.Timeout | null = null;

    const flushLogs = async () => {
      if (pendingFiles.length === 0) return;
      logDoc.files.push(...pendingFiles);
      logDoc.totalFiles = logDoc.files.length;
      logDoc.totalSize = logDoc.files.reduce((s, f) => s + f.size, 0);
      pendingFiles.length = 0;
      await logDoc.save();
      saveTimeout = null;
    };

    this.ws?.({
      type: "start",
      totalFiles,
      totalBytes,
      startedAt,
    });

    copier.on("file-copied", ({ file, size }) => {
      // remove finished file
      fileQueue.shift();

      // set next file immediately
      currentFile = fileQueue.length ? path.basename(fileQueue[0]) : "";

      currentStatus = "copying";

      copiedFiles++;
      copiedBytes += size;

      // speed calculation
      const now = Date.now();
      const deltaBytes = copiedBytes - lastBytes;
      const deltaTime = (now - lastTime) / 1000 || 1;
      const rawSpeed = deltaBytes / deltaTime;
      const smoothSpeed = ema.update(rawSpeed);
      lastBytes = copiedBytes;
      lastTime = now;

      // percent
      const percent = totalBytes
        ? Math.min(100, Math.floor((copiedBytes / totalBytes) * 100))
        : 0;

      const speed = formatSpeed(smoothSpeed);

      // send a single progress websocket event
      // this.ws?.({
      //   type: "progress",
      //   currentFile: file,
      //   status: "copying",
      //   percent,
      //   speed: speed.value.toFixed(2) + " " + speed.unit,
      //   bytesCopied: copiedBytes,
      //   totalBytes,
      //   filesCopied: copiedFiles,
      //   totalFiles,
      // });

      this.ws?.({
        type: "progress 123",
        currentFile: file,
        speed: speed.value.toFixed(2) + " " + speed.unit,
        scheduleId,
      });

      pendingFiles.push({ path: file, size, status: "copied" });

      if (!saveTimeout) {
        saveTimeout = setTimeout(flushLogs, 200);
      }
    });

    //FROM HERE
    const moveToDeletePath = async (file: string) => {
      const relative = path.relative(destination, file);
      const target = path.join(option?.recycle_path!, relative);
      await fs.ensureDir(path.dirname(target));
      await fs.move(file, target, { overwrite: true });
    };

    // SOFT DELETE
    if (type === "sync" && option?.recycle) {
      copier.on("file-extra", async ({ file }) => {
        await moveToDeletePath(file);
        this.ws?.({
          type: "deleted",
          mode: "soft",
          file,
        });
      });
    }
    // last here

    copier.on("file-deleted", ({ file }) => {
      if (option?.recycle) return; // skip, already handled in soft-delete
      currentFile = path.basename(file);
      currentStatus = "deleted";

      pendingFiles.push({ path: file, size: 0, status: "deleted" });
      // percent
      const percent = totalBytes
        ? Math.min(100, Math.floor((copiedBytes / totalBytes) * 100))
        : 0;

      if (!saveTimeout) {
        saveTimeout = setTimeout(flushLogs, 200);
      }
    });

    copier.on("complete", async () => {
      clearInterval(speedInterval);
      if (saveTimeout) clearTimeout(saveTimeout);
      await flushLogs();

      logDoc.endTime = new Date();
      await logDoc.save();

      const durationSeconds = Math.floor((Date.now() - startedAt) / 1000);
      const avgSpeed = durationSeconds > 0 ? totalBytes / durationSeconds : 0;

      this.ws?.({
        type: "complete",
        totalFiles,
        totalBytes,
        scheduleId,
        averageSpeedBps: Math.floor(avgSpeed),
        durationSeconds,
      });
    });

    copier.on("error", (err) => {
      clearInterval(speedInterval);
      this.ws?.({
        type: "error",
        message: err.message,
      });
    });

    if (type === "archive") {
      await copier.archive(source, destination);
    } else {
      await copier.sync(source, destination);
    }

    function formatSpeed(bytesPerSec: number) {
      if (bytesPerSec >= 1024 ** 3) {
        return { value: bytesPerSec / 1024 ** 3, unit: "GB/s" };
      }
      if (bytesPerSec >= 1024 ** 2) {
        return { value: bytesPerSec / 1024 ** 2, unit: "MB/s" };
      }
      if (bytesPerSec >= 1024) {
        return { value: bytesPerSec / 1024, unit: "KB/s" };
      }
      return { value: bytesPerSec, unit: "B/s" };
    }
  }
}
