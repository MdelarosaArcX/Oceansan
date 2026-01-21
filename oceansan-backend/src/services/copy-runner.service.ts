import fs from "fs-extra";
import path from "path";
import CopyService from "./copy.service";
import ScheduleLogs from "../models/ScheduleLogs";

type Broadcaster = (data: unknown) => void;

export class CopyRunnerService {
  constructor(private broadcaster?: Broadcaster) { }

  async run({
    scheduleId,
    type,
    name,
    source,
    destination,
  }: {
    scheduleId?: string;
    type: "archive" | "sync";
    name: string;
    source: string;
    destination: string;
  }) {
    const copier = new CopyService();
    let finished = false;
    let lastPercent = 0;

    /* ---------- DB LOG ---------- */
    const execution = await ScheduleLogs.create({
      scheduleId,
      type,
      source,
      destination,
      startTime: new Date(),
      totalFiles: 0,
      totalSize: 0,
      files: []
    });

    /* ---------- FILE LOG ---------- */
    const logsDir = path.join(process.cwd(), "logs");
    await fs.ensureDir(logsDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logFile = path.join(
      logsDir,
      `log_${type}_${name}_${timestamp}.txt`
    );

    const appendLog = (line: string) =>
      fs.appendFile(logFile, line + "\n");

    await appendLog(`${type.toUpperCase()} STARTED`);
    await appendLog(`ID: ${scheduleId}`);
    await appendLog(`Name: ${name}`);
    await appendLog(`Source: ${source}`);
    await appendLog(`Destination: ${destination}`);

    /* ---------- PROGRESS ---------- */
    copier.on("progress", (progress) => {
      lastPercent = progress.percent;
      this.broadcaster?.({
        type: "progress",
        jobId: scheduleId,
        payload: {
          percent: progress.percent,
          currentFile: progress.currentFile,
        },
      });
    });

    /* ---------- FILE EVENTS ---------- */
    const recordFile = async (
      status: "copied" | "updated" | "deleted" | "error",
      file: string,
      size = 0,
      error?: string
    ) => {
      execution.files.push({ path: file, size, status, error });
      execution.totalFiles++;
      if (status !== "deleted") execution.totalSize += size;
    };

    copier.on("file-copied", async ({ file, size }) => {
      await recordFile("copied", file, size);
      await appendLog(`[${lastPercent}%] ✔ copied: ${file}`);
    });

    copier.on("file-updated", async ({ file, size }) => {
      await recordFile("updated", file, size);
      await appendLog(`[${lastPercent}%] 🔄 updated: ${file}`);
    });

    copier.on("file-deleted", async ({ file }) => {
      await recordFile("deleted", file);
      await appendLog(`[${lastPercent}%] 🗑 deleted: ${file}`);
    });

    copier.on("file-error", async ({ file, error }) => {
      await recordFile("error", file, 0, error);
      await appendLog(`[${lastPercent}%] ❌ ${file} - ${error}`);
    });

    /* ---------- COMPLETE ---------- */
    copier.on("complete", async () => {
      if (finished) return;
      finished = true;

      execution.endTime = new Date();
      await execution.save();

      this.broadcaster?.({
        type: "complete",
        jobId: scheduleId,
        summary: {
          totalFiles: execution.totalFiles,
          totalSize: execution.totalSize,
        },
      });

      await appendLog("Completed");
      await appendLog(`End Time: ${new Date().toISOString()}`);
    });

    copier.on("error", async (err: Error) => {
      if (finished) return;
      finished = true;

      execution.endTime = new Date();
      await execution.save();

      await appendLog(`ERROR: ${err.message}`);
    });

    /* ---------- EXECUTE ---------- */
    if (type === "archive") {
      await copier._archive(source, destination);
    } else {
      await copier._sync(source, destination);
    }

    return logFile;
  }
}
