import fs from "fs-extra";
import path from "path";

// import RobocopyService from "./robocopy.service";
// import XcopyService from "./xcopy.service";
// import RsyncService from "./rsync.service";
import { createCopyEngine } from "./copy.factory"
import ScheduleLogs, { ILogsFile } from "../models/ScheduleLogs";
import Schedule from "../models/Schedule";
import { walkDir } from "../utils/fileWalker";
import { ScheduleLogger } from "../utils/scheduler.logger";

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
  }: {
    scheduleId: string;
    type: "archive" | "sync";
    name: string;
    source: string;
    destination: string;
    engine: "robocopy" | "xcopy" | "rsync";
    option?: { recycle: boolean; recycle_path: string };
  }) {
    // const copier = new RobocopyService(this.ws);
    const copier = createCopyEngine(engine, this.ws);



    const files = walkDir(source);
    const totalBytes = files.reduce((s, f) => s + f.size, 0);
    const totalFiles = files.length;

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

    const previousSizes = new Map<string, number>();
    files.forEach((f) =>
      previousSizes.set(path.join(destination, path.basename(f.path)), 0),
    );
    const pendingFiles: ILogsFile[] = [];
    let saveTimeout: NodeJS.Timeout | null = null;
    let copiedBytes = 0;

    const ema = new SpeedEMA();
    let lastBytes = 0;
    let lastTime = Date.now();
    const startedAt = Date.now();

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

    // --- Start robocopy ---
    const runPromise =
      type === "archive"
        ? copier.archive(source, destination)
        : copier.sync(source, destination, option);

    // --- Destination monitor ---

    const monitorInterval = setInterval(() => {
      let deltaBytes = 0;
      let currentFile: string | null = null;
      const destFiles = walkDir(destination);

      for (const f of destFiles) {
        const prev = previousSizes.get(f.path) || 0;
        const change = f.size - prev;
        if (change > 0) {
          deltaBytes += change;
          previousSizes.set(f.path, f.size);

          // pick largest growing file
          if (!currentFile || change > (previousSizes.get(currentFile) || 0)) {
            currentFile = f.path;
          }
        }
      }

      copiedBytes += deltaBytes;

      const percent = totalBytes
        ? Math.min(100, (copiedBytes / totalBytes) * 100)
        : 0;

      // Speed calculation
      const now = Date.now();
      const deltaTime = (now - lastTime) / 1000 || 1;
      const rawSpeed = deltaBytes / deltaTime;
      const smoothSpeed = ema.update(rawSpeed);
      lastTime = now;

      const speedStr = formatSpeed(smoothSpeed);

      this.ws?.({
        type: "progress",
        currentFile: currentFile ? path.basename(currentFile) : null,
        speed: speedStr.value.toFixed(2) + " " + speedStr.unit,
        percent,
        copiedBytes,
        totalBytes,
        scheduleId,
      });
    }, 500);

    // Wait for Robocopy to finish
    try {
      await runPromise;
      clearInterval(monitorInterval);

      // flush final state
      for (const f of walkDir(destination)) {
        pendingFiles.push({ path: f.path, size: f.size, status: "copied" });
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
        scheduleId,
        averageSpeedBps: Math.floor(avgSpeed),
        durationSeconds,
      });
    } catch (err: any) {
      clearInterval(monitorInterval);
      this.ws?.({
        type: "error",
        message: err.message,
      });
    }

    function formatSpeed(bytesPerSec: number) {
      if (bytesPerSec >= 1024 ** 3)
        return { value: bytesPerSec / 1024 ** 3, unit: "GB/s" };
      if (bytesPerSec >= 1024 ** 2)
        return { value: bytesPerSec / 1024 ** 2, unit: "MB/s" };
      if (bytesPerSec >= 1024)
        return { value: bytesPerSec / 1024, unit: "KB/s" };
      return { value: bytesPerSec, unit: "B/s" };
    }
  }
}
