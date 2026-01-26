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
  }: {
    scheduleId: string;
    type: "archive" | "sync";
    name: string;
    source: string;
    destination: string;
  }) {
    const copier = new RobocopyService();
    const files = walkDir(source);
    const totalFiles = files.length;
    const totalBytes = files.reduce((s, f) => s + f.size, 0);

    // const logDoc = await ScheduleLogs.create({
    //   scheduleId,
    //   type,
    //   source,
    //   destination,
    //   startTime: new Date(),
    //   totalFiles: 0,
    //   totalSize: 0,
    //   files: []
    // });
    const logDoc = await ScheduleLogs.create({
      scheduleId,
      type,
      source,
      destination,
      startTime: new Date(),
      totalFiles, // ✅ use computed value
      totalSize: totalBytes,
      files: [],
    });

    let copiedFiles = 0;
    let copiedBytes = 0;
    let lastBytes = 0;
    let lastTime = Date.now();
    const ema = new SpeedEMA(0.15);
    const startedAt = Date.now();

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

    for (const f of files) {
      // copier.on("file-copied", ({ file, size }) => {
      copiedFiles++;
      copiedBytes += f.size;

      const now = Date.now();
      const deltaBytes = copiedBytes - lastBytes;
      const deltaTime = (now - lastTime) / 1000 || 1;
      const rawSpeed = deltaBytes / deltaTime;
      const smoothSpeed = ema.update(rawSpeed);
      lastBytes = copiedBytes;
      lastTime = now;

      const percent = totalFiles
        ? Math.min(100, Math.floor((copiedFiles / totalFiles) * 100))
        : 0;
      const remainingBytes = totalBytes - copiedBytes;
      const etaSeconds =
        smoothSpeed > 0 ? Math.floor(remainingBytes / smoothSpeed) : null;

      // WS progress
      this.ws?.({
        type: "progress",
        currentFile: f, // full path
        filesCopied: copiedFiles,
        totalFiles,
        bytesCopied: copiedBytes,
        totalBytes,
        percent,
        speedBps: Math.floor(smoothSpeed),
        rawSpeedBps: Math.floor(rawSpeed),
        etaSeconds,
      });

      // buffer the file log
      // pendingFiles.push({ path: file, size, status: "copied" });
      pendingFiles.push({
        path: f.path,
        size: f.size,
        status: "copied",
      });

      // schedule flush
      if (!saveTimeout) {
        saveTimeout = setTimeout(flushLogs, 200); // batch save every 200ms
      }
    }
    copier.on("file-deleted", ({ file }) => {
      pendingFiles.push({ path: file, size: 0, status: "deleted" });
      if (!saveTimeout) {
        saveTimeout = setTimeout(flushLogs, 200);
      }
    });

    copier.on("complete", async () => {
      // flush remaining logs
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      await flushLogs();

      logDoc.endTime = new Date();
      await logDoc.save();

      const durationSeconds = Math.floor((Date.now() - startedAt) / 1000);
      const avgSpeed = durationSeconds > 0 ? totalBytes / durationSeconds : 0;

      this.ws?.({
        type: "complete",
        totalFiles,
        totalBytes,
        averageSpeedBps: Math.floor(avgSpeed),
        durationSeconds,
      });
    });

    copier.on("error", (err) => {
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
  }
}
