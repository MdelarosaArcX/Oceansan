import fs from "fs-extra";
import path from "path";

// import RobocopyService from "./robocopy.service";
// import XcopyService from "./xcopy.service";
// import RsyncService from "./rsync.service";
import { createCopyEngine } from "./copy.factory";
// import ScheduleLogs, { ILogsFile } from "../models/ScheduleLogs";
// import Schedule from "../models/Schedule";
import { walkDir } from "../utils/fileWalker";
// import { ScheduleLogger } from "../utils/scheduler.logger";
// import { Types } from "mongoose";
import { Repository } from "typeorm";
import { ScheduleLogs } from "../entities/ScheduleLogs";
import { ScheduleLogFile } from "../entities/ScheduleLogFile";
import { AppDataSource } from "../config/typeorm.config";
import { Schedule } from "../entities/Schedule";

type Broadcaster = (data: unknown) => void;
type PendingFile = {
  path: string;
  size: number;
  status: "copied" | "updated" | "deleted";
};
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
  constructor(
    private scheduleLogsRepo: Repository<ScheduleLogs>,
    private ws?: Broadcaster
  ) { }

  private broadcast(data: unknown) {
    try {
      this.ws?.(data);
    } catch (error) {
      console.error("CopyRunner broadcast failed:", error);
    }
  }

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
    scheduleId: number;
    type: "archive" | "sync";
    name: string;
    source: string;
    destination: string;
    engine: "robocopy" | "xcopy" | "rclone";
    option?: { recycle: boolean; recycle_path: string };
    existingLogId?: number;
  }) {
    const copier = createCopyEngine(engine, this.ws);
    if (!fs.existsSync(source)) {
      throw new Error(`Source path does not exist: ${source}`);
    }
    fs.ensureDirSync(destination);

    const sourceFiles = walkDir(source);
    let totalBytes = 0;
    let totalFiles = 0;

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
      logDoc = await this.scheduleLogsRepo.findOne({
        where: { id: existingLogId },
        relations: ["files"],
      });
      if (!logDoc) throw new Error("Log not found");
    } else {
      logDoc = this.scheduleLogsRepo.create({
        schedule: { id: scheduleId } as any,
        type,
        source,
        destination,
        startTime: new Date(),
        totalFiles: 0,
        totalSize: 0,
        files: [],
      });
    }

    logDoc.status = "running";
    logDoc.engine = engine;
    await this.scheduleLogsRepo.save(logDoc);

    const pendingFiles: PendingFile[] = [];
    if (!logDoc.id) {
      // new log
      logDoc = await this.scheduleLogsRepo.save(logDoc);
    }

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

    totalFiles = pendingFiles.length;
    totalBytes = pendingFiles.reduce((s, f) => s + f.size, 0);
    logDoc.totalFiles = totalFiles;
    logDoc.totalSize = totalBytes;
    await this.scheduleLogsRepo.save(logDoc);


    
    const flushLogs = async () => {
      if (pendingFiles.length === 0) return;

      // Map pending files to ScheduleLogFile entities
      
      const newFiles: ScheduleLogFile[] = pendingFiles.map((f) => {
        const file = new ScheduleLogFile();
        file.path = f.path;
        file.size = f.size;
        file.status = f.status;

        // Important: attach the ScheduleLogs relation
        file.log = logDoc;  // this sets log_id automatically due to the relation
        return file;
      });

      logDoc.files.push(...newFiles);

      // Save files in bulk
      const fileRepo = this.scheduleLogsRepo.manager.getRepository(ScheduleLogFile);
      await fileRepo.save(newFiles);

      pendingFiles.length = 0;

      // Save the updated log
      await this.scheduleLogsRepo.save(logDoc);
    };

    this.broadcast({
      type: "start",
      totalFiles,
      totalBytes,
      startedAt,
    });

    // --- Start copy/sync ---
    const runPromise =
      type === "archive"
        ? copier.archive(source, destination)
        : copier.sync(source, destination, option);

    // --- Monitor progress ---
    const monitorInterval = setInterval(() => {
      try {
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

        this.broadcast({
          type: "progress",
          currentFile: currentFile ? path.basename(currentFile) : null,
          speed: speedStr.value.toFixed(2) + " " + speedStr.unit,
          percent: engine === "rclone" ? percent : 0,
          copiedBytes,
          totalBytes,
          scheduleId,
        });
      } catch (error) {
        console.error(`CopyRunner monitor failed for schedule ${scheduleId}:`, error);
      }
    }, 500);

    // --- Wait for copy to finish ---
    try {
      await runPromise;
      clearInterval(monitorInterval);
      await flushLogs();

      logDoc.endTime = new Date();
      logDoc.status = "completed";
      await this.scheduleLogsRepo.save(logDoc);

      if (AppDataSource.isInitialized) {
        const scheduleRepo = AppDataSource.getRepository(Schedule);
        const update =
          type === "archive"
            ? { last_archived: new Date() }
            : { last_sync: new Date() };
        await scheduleRepo.update({ id: scheduleId }, update);
      }

      const durationSeconds = Math.floor((Date.now() - startedAt) / 1000);
      const avgSpeed = durationSeconds > 0 ? totalBytes / durationSeconds : 0;

      this.broadcast({
        type: "complete",
        totalFiles,
        totalBytes,
        scheduleId,
        averageSpeedBps: Math.floor(avgSpeed),
        durationSeconds,
      });
    } catch (err: any) {
      clearInterval(monitorInterval);
      try {
        logDoc.status = "interrupted";
        await this.scheduleLogsRepo.save(logDoc);
      } catch (saveError) {
        console.error(`Failed to persist interrupted status for schedule ${scheduleId}:`, saveError);
      }
      this.broadcast({
        type: "error",
        message: err?.message ?? "Unknown copy runner error",
      });
      throw err;
    }
  }
}
