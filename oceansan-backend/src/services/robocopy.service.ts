import { EventEmitter } from "events";
import { spawn } from "child_process";
import os from "os";
import { walkDir } from "../utils/fileWalker";

export default class RobocopyService extends EventEmitter {
  private ensureWindows() {
    console.log("[robocopy] checking OS...");
    if (os.platform() !== "win32") {
      throw new Error("Robocopy is only supported on Windows");
    }
    console.log("[robocopy] Windows OK");
  }

  /* ============================
     ARCHIVE (copy only)
     ============================ */
  async archive(src: string, dest: string): Promise<void> {
    this.ensureWindows();

    console.log("[robocopy][archive] SRC :", src);
    console.log("[robocopy][archive] DEST:", dest);

    const files = walkDir(src);
    const totalSize = files.reduce((s, f) => s + f.size, 0);

    console.log("[robocopy][archive] total files:", files.length);
    console.log("[robocopy][archive] total size :", totalSize);

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
      "/TEE",
      "/BYTES",
      "/FP",
    ];

    console.log("[robocopy][archive] CMD:");
    console.log("robocopy", args.join(" "));

    await this.runRobocopy("archive", args, totalSize);
  }

  /* ============================
     SYNC / MIRROR
     ============================ */
  async sync(src: string, dest: string): Promise<void> {
    this.ensureWindows();

    console.log("[robocopy][sync] SRC :", src);
    console.log("[robocopy][sync] DEST:", dest);

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

    console.log("[robocopy][sync] CMD:");
    console.log("robocopy", args.join(" "));

    await this.runRobocopy("sync", args, 0);
  }

  /* ============================
     CORE RUNNER
     ============================ */
  private runRobocopy(
    mode: "archive" | "sync",
    args: string[],
    totalSize: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[robocopy][${mode}] spawning process...`);
      const proc = spawn("robocopy", args, { shell: false });

      let copiedSize = 0;

      const FILE_RE = /^(New File|Updated)\s+(\d+)\s+(.+)$/i;
      const SPEED_RE = /Speed\s+:\s+([\d,]+)\s+Bytes\/sec/i;

      proc.stdout.on("data", (data: Buffer) => {
        console.log("========== RAW STDOUT ==========");
        console.log(data.toString());
        console.log("================================");

        const lines = data.toString().split(/\r?\n/);

        for (const line of lines) {
          const text = line.trim();
          if (!text) continue;

          console.log(`[robocopy][${mode}][line]:`, text);

          // --- FILE COPIED / UPDATED ---
          const fileMatch = text.match(FILE_RE);
          if (fileMatch) {
            const size = parseInt(fileMatch[2], 10);
            const file = fileMatch[3];

            copiedSize += size;

            console.log(`[robocopy][${mode}] FILE:`, file);
            console.log(`[robocopy][${mode}] SIZE:`, size);
            console.log(`[robocopy][${mode}] COPIED:`, copiedSize);

            this.emit("progress", {
              copiedSize,
              totalSize,
              currentFile: file,
            });

            this.emit("file-copied", { file, size });
            continue;
          }

          // --- SPEED ---
          const speedMatch = text.match(SPEED_RE);
          if (speedMatch) {
            const bytesPerSec = parseInt(speedMatch[1].replace(/,/g, ""), 10);

            console.log(`[robocopy][${mode}] SPEED B/s:`, bytesPerSec);

            this.emit("speed", {
              kbps: bytesPerSec / 1024,
              mbps: bytesPerSec / 1024 / 1024,
            });
          }

          // --- DELETE (sync) ---
          if (mode === "sync" && /^\*EXTRA File/i.test(text)) {
            const file = text.replace(/^\*EXTRA File\s+/i, "");
            console.log(`[robocopy][sync] DELETED:`, file);
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
        console.log(`[robocopy][${mode}] EXIT CODE:`, code);
        console.log(`[robocopy][${mode}] COPIED:`, copiedSize);
        console.log(`[robocopy][${mode}] TOTAL:`, totalSize);

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
