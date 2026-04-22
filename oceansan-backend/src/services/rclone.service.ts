import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { CopyEngine, CopyOptions } from "./copy.engine";
import path from "path";
import { killProcessTree, resumeProcess, suspendProcess } from "../utils/process-control";

const rclonePath = path.join(process.cwd(), "rclone", "rclone.exe");

type Broadcaster = (data: unknown) => void;

export default class RcloneService extends CopyEngine {
  private proc: ChildProcessWithoutNullStreams | null = null;

  constructor(private ws?: Broadcaster) {
    super();
  }

  async archive(src: string, dest: string): Promise<void> {
    await this.runCopy(src, dest);
  }

  async sync(src: string, dest: string, opts?: CopyOptions): Promise<void> {
    await this.runCopy(
      src,
      dest,
      opts?.recycle ? opts.recycle_path : undefined,
    );
  }

  private runCopy(
    src: string,
    dest: string,
    backupDir?: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = backupDir ? "sync" : "copy";

      // const args = [command, src, dest, "--stats=1s", "--stats-one-line"];
     const args = [
  command,
  src,
  dest,
  "--stats=1s",
  "--stats-one-line",

  "--retries=10",
  "--low-level-retries=20",

  "--checksum",

  "--partial-suffix=.part",

  "--transfers=8",
  "--checkers=16",
  "--fast-list",
];

      // const args = ["copy", src, dest, "--stats=1s", "--stats-one-line"];

      if (backupDir) {
        args.push(`--backup-dir=${backupDir}`);
      }
      args.push("--transfers=8", "--checkers=16", "--fast-list");
      this.proc = spawn(rclonePath, args, { shell: false });
      const proc = this.proc;
      // const proc = spawn("rclone", args, { shell: false });

      proc.stdout.on("data", (data: Buffer) => {
        const raw = data.toString();
        this.emit("log", raw);

        const chunks = raw
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        for (const line of chunks) {
          const percentMatch = line.match(/,\s*(\d+)%/);
          const speedMatch = line.match(/,\s*([\d.]+\s*[kMGT]?i?B\/s)/i);

          if (percentMatch) {
            this.emit("progress", {
              percent: Number(percentMatch[1]),
            });
          }

          if (speedMatch) {
            this.emit("speed", {
              speed: speedMatch[1],
            });
          }
        }
      });

      let lastError = "";

      proc.stderr.on("data", (data: Buffer) => {
        const msg = data.toString();
        lastError += msg;
        this.emit("log", msg);
      });

      proc.on("error", (err) => {
        reject(new Error(`Failed to start rclone: ${err.message}`));
      });

      // proc.on("close", (code) => {
      //   if (code === 0) {
      //     this.emit("complete", { engine: "rclone" });
      //     resolve();
      //     return;
      //   }

      //   reject(new Error(`rclone failed (${code})`));
      // });

      proc.on("close", (code) => {
        this.proc = null;
        if (code === 0) {
          this.emit("complete", { engine: "rclone" });
          resolve();
          return;
        }

        reject(new Error(`rclone failed (${code}): ${lastError}`));
      });
    });
  }

  async pause(): Promise<void> {
    if (!this.proc?.pid) {
      throw new Error("Rclone job is not running.");
    }
    await suspendProcess(this.proc.pid);
  }

  async resume(): Promise<void> {
    if (!this.proc?.pid) {
      throw new Error("Rclone job is not running.");
    }
    await resumeProcess(this.proc.pid);
  }

  async stop(): Promise<void> {
    if (!this.proc?.pid) {
      throw new Error("Rclone job is not running.");
    }
    await killProcessTree(this.proc.pid);
  }
}
