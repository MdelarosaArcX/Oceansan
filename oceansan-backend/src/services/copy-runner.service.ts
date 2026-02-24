import fs from "fs-extra";
import path from "path";

// import RobocopyService from "./robocopy.service";
// import XcopyService from "./xcopy.service";
// import RsyncService from "./rsync.service";
import { createCopyEngine } from "./copy.factory";
import ScheduleLogs, { ILogsFile } from "../models/ScheduleLogs";
import Schedule from "../models/Schedule";
import { walkDir } from "../utils/fileWalker";
import { ScheduleLogger } from "../utils/scheduler.logger";
import { Types } from "mongoose";

type Broadcaster = (data: unknown) => void;

//SPEEDEMA
class SpeedEMA {
  private value = 0;
  constructor(private alpha = 0.15) { }
  update(sample: number) {
    if (this.value === 0) this.value = sample;
    else this.value = this.alpha * sample + (1 - this.alpha) * this.value;
    return this.value;
  }
}

// Helper: sum file sizes recursively
function sumFileSizes(dir: string) {
  const files = walkDir(dir);
  return files.reduce((s, f) => s + f.size, 0);
}

// Helper: find the largest growing file since last check
function findLargestGrowingFile(
  dir: string,
  previousSizes: Map<string, number>,
): string | null {
  const files = walkDir(dir);
  let largestDelta = 0;
  let currentFile: string | null = null;

  for (const f of files) {
    const prev = previousSizes.get(f.path) || 0;
    const delta = f.size - prev;
    if (delta > largestDelta) {
      largestDelta = delta;
      currentFile = f.path;
    }
    previousSizes.set(f.path, f.size);
  }
  return currentFile;
}
export class CopyRunnerService {
  constructor(private ws?: Broadcaster) { }

  async run({
    scheduleId,
    type,
    name,
    source,
    destination,
    engine,
    option,
    existingLogId
  }: {
    scheduleId: Types.ObjectId;
    type: "archive" | "sync";
    name: string;
    source: string;
    destination: string;
    engine: "robocopy" | "xcopy" | "rclone";
    option?: { recycle: boolean; recycle_path: string };
    existingLogId?: Types.ObjectId;
  }) {
    const copier = createCopyEngine(engine, this.ws);

    const sourceFiles = walkDir(source);
    const totalBytes = sourceFiles.reduce((s, f) => s + f.size, 0);
    const totalFiles = sourceFiles.length;

    // const logDoc = await ScheduleLogs.create({
    //   scheduleId,
    //   type,
    //   source,
    //   destination,
    //   startTime: new Date(),
    //   totalFiles,
    //   totalSize: totalBytes,
    //   files: [],
    // });

    let logDoc;

    if (existingLogId) {
      logDoc = await ScheduleLogs.findById(existingLogId);
      if (!logDoc) throw new Error("Log not found");
    } else {
      logDoc = await ScheduleLogs.create({
        scheduleId,
        type,
        source,
        destination,
        startTime: new Date(),
        totalFiles,
        totalSize: totalBytes,
        files: [],
      });
    }

    logDoc.status = "running";
    logDoc.engine = engine;
    await logDoc.save();

    const pendingFiles: ILogsFile[] = [];
    let copiedBytes = 0;

    const ema = new SpeedEMA();
    let lastTime = Date.now();
    const startedAt = Date.now();

    // --- SNAPSHOT DIFF ---
    const sourceSnapshot = new Map<string, number>();
    const destSnapshot = new Map<string, number>();

    sourceFiles.forEach((f) => sourceSnapshot.set(f.path, f.size));
    walkDir(destination).forEach((f) => destSnapshot.set(f.path, f.size));

    // Handle files deleted in destination (restore from source)
    for (const [srcPath, size] of sourceSnapshot.entries()) {
      const destPath = path.join(destination, path.basename(srcPath));
      if (!destSnapshot.has(destPath)) {
        pendingFiles.push({ path: destPath, size, status: "copied" });
      } else if (destSnapshot.get(destPath) !== size) {
        pendingFiles.push({ path: destPath, size, status: "copied" });
      } else {
        pendingFiles.push({ path: destPath, size, status: "updated" });
      }
    }

    // Handle files deleted in source (move to recycle if enabled)
    for (const [destPath, size] of destSnapshot.entries()) {
      const srcPath = path.join(source, path.basename(destPath));
      if (!sourceSnapshot.has(srcPath)) {
        if (option?.recycle && option.recycle_path) {
          // Move deleted file to recycle folder
          const recycleDest = path.join(
            option.recycle_path,
            path.basename(destPath),
          );
          fs.ensureDirSync(option.recycle_path);
          fs.moveSync(destPath, recycleDest, { overwrite: true });
          pendingFiles.push({
            path: destPath,
            size,
            status: "deleted",
          });
        } else {
          pendingFiles.push({ path: destPath, size, status: "deleted" });
        }
      }
    }

    const flushLogs = async () => {
      if (pendingFiles.length === 0) return;
      logDoc.files.push(...pendingFiles);
      logDoc.totalFiles = logDoc.files.length;
      logDoc.totalSize = logDoc.files.reduce((s, f) => s + f.size, 0);
      pendingFiles.length = 0;
      await logDoc.save();
    };

    this.ws?.({
      type: "start",
      totalFiles,
      totalBytes,
      startedAt,
    });

    // --- Start copy/sync ---
    const runPromise =
      type === "archive"
        ?  copier.archive(source, destination)
        :  copier.sync(source, destination, option);

    // --- Monitor progress ---
    const monitorInterval = setInterval(() => {
      let deltaBytes = 0;
      let currentFile: string | null = null;
      const destFiles = walkDir(destination);

      for (const f of destFiles) {
        const prev = destSnapshot.get(f.path) || 0;
        const change = f.size - prev;
        if (change > 0) {
          deltaBytes += change;
          destSnapshot.set(f.path, f.size);
          if (!currentFile || change > (destSnapshot.get(currentFile) || 0)) {
            currentFile = f.path;
          }
        }
      }

      copiedBytes += deltaBytes;

      const percent = totalBytes
        ? Math.min(100, (copiedBytes / totalBytes) * 100)
        : 0;

      const now = Date.now();
      const deltaTime = (now - lastTime) / 1000 || 1;
      const smoothSpeed = ema.update(deltaBytes / deltaTime);
      lastTime = now;

      const speedStr =
        smoothSpeed >= 1024 ** 3
          ? { value: smoothSpeed / 1024 ** 3, unit: "GB/s" }
          : smoothSpeed >= 1024 ** 2
            ? { value: smoothSpeed / 1024 ** 2, unit: "MB/s" }
            : smoothSpeed >= 1024
              ? { value: smoothSpeed / 1024, unit: "KB/s" }
              : { value: smoothSpeed, unit: "B/s" };

      this.ws?.({
        type: "progress",
        currentFile: currentFile ? path.basename(currentFile) : null,
        speed: speedStr.value.toFixed(2) + " " + speedStr.unit,
        percent: engine === "rclone" ? percent : 0,
        copiedBytes,
        totalBytes,
        scheduleId,
      });
    }, 500);

    // --- Wait for copy to finish ---
    try {
      await runPromise;
      clearInterval(monitorInterval);
      await flushLogs();

      logDoc.endTime = new Date();
      logDoc.status = "completed";
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
    } catch (err: any) {
      clearInterval(monitorInterval);
      logDoc.status = "interrupted";
      await logDoc.save();
      this.ws?.({
        type: "error",
        message: err.message,
      });
    }
  }
}
