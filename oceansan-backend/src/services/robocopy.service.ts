import { EventEmitter } from "events";
import { spawn } from "child_process";
import os from "os";
import { walkDir } from "../utils/fileWalker";

type Broadcaster = (data: unknown) => void;

export default class RobocopyService extends EventEmitter {
  constructor(private ws?: Broadcaster) {
    super();
    // console.log("WS injected:", !!ws);
  }
  private ensureWindows() {
    // console.log("[robocopy] checking OS...");
    if (os.platform() !== "win32") {
      throw new Error("Robocopy is only supported on Windows");
    }
    // console.log("[robocopy] Windows OK");
  }

  /* ============================
     ARCHIVE (copy only)
     ============================ */
  async archive(src: string, dest: string): Promise<void> {
    this.ensureWindows();

    const PERCENT_RE = /^(\d+)%$/;

    const files = walkDir(src);
    const totalSize = files.reduce((s, f) => s + f.size, 0);

    this.emit("start", {
      totalFiles: files.length,
      totalSize,
    });

    const args = [
      src,
      dest,
      "/E",
      "/Z",
      "/R:2",
      "/W:1",
      "/MT:8",
      // "/MT:8", This means multiple files copy in parallel. There is no such thing as “current file” anymore — there are 8 files copying.
      "/TEE",
      "/BYTES",
      "/FP",
    ];

    // await this.runRobocopy("archive", args, totalSize);
    await this.runRobocopy("archive", args, totalSize, files.length);
  }

  /* ============================
     SYNC / MIRROR
     ============================ */
  async sync(src: string, dest: string): Promise<void> {
    this.ensureWindows();

    this.emit("start", {
      totalFiles: 0,
      totalSize: 0,
    });

    const args = [
      src,
      dest,
      "/MIR",
      "/Z",
      "/R:2",
      "/W:1",
      "/MT:8",
      "/TEE",
      "/BYTES",
      "/FP",
    ];


    // await this.runRobocopy("sync", args, 0);
    const files = walkDir(src);
    await this.runRobocopy("sync", args, 0, files.length);
  }

  /* ============================
     CORE RUNNER
     ============================ */
  private runRobocopy(
    mode: "archive" | "sync",
    args: string[],
    totalSize: number,
    totalFiles: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let copiedFiles = 1;
      // let totalFiles = 0;

      const proc = spawn("robocopy", args, { shell: false });

      let copiedSize = 0;

      const FILE_RE = /^(New File|Updated)\s+(\d+)\s+(.+)$/i;
      const SPEED_RE = /Speed\s+:\s+([\d,]+)\s+Bytes\/sec/i;

      proc.stdout.on("data", (data: Buffer) => {
        const raw = data.toString();
        const percentMatch = raw.match(/(\d+)%/);

        if (percentMatch) {
          const percent = parseInt(percentMatch[1], 10);
          this.ws?.({
            type: "percentage",
            percent, // number only
          });
        }

        const lines = data.toString().split(/\r?\n/);

        for (const line of lines) {
          const text = line.trim();
          if (!text) continue;


          // --- FILE COPIED / UPDATED ---
          const fileMatch = text.match(FILE_RE);
          if (fileMatch) {
            const size = parseInt(fileMatch[2], 10);
            const file = fileMatch[3];

            copiedSize += size;

            const percent = totalSize
              ? Math.min(100, Math.floor((copiedSize / totalSize) * 100))
              : 0;

            this.emit("progress", {
              copiedSize,
              totalSize,
              currentFile: file,
              percent,
            });
            copiedFiles++;

            this.ws?.({
              type: "ratio",
              ratio: `${copiedFiles}/${totalFiles}`,
            });
            // SEND WS PROGRESS
            

            this.emit("file-copied", { file, size });
            continue;
          }

          // --- SPEED ---
          const speedMatch = text.match(SPEED_RE);
          if (speedMatch) {
            const bytesPerSec = parseInt(speedMatch[1].replace(/,/g, ""), 10);


            this.emit("speed", {
              kbps: bytesPerSec / 1024,
              mbps: bytesPerSec / 1024 / 1024,
            });
          }

          // --- DELETE (sync) ---
          if (mode === "sync" && /^\*EXTRA File/i.test(text)) {
            const file = text.replace(/^\*EXTRA File\s+/i, "");
            this.emit("file-deleted", { file, size: 0 });
          }
        }
      });

      proc.stderr.on("data", (data: Buffer) => {
        console.error("========== STDERR ==========");
        console.error(data.toString());
        console.error("============================");
      });

      proc.on("close", (code) => {
        if (code !== null && code <= 7) {
          this.emit("complete", {
            copiedSize,
            totalSize,
          });
          resolve();
        } else {
          reject(new Error(`Robocopy failed with exit code ${code}`));
        }
      });
    });
  }
}
