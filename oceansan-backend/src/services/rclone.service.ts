import { spawn } from "child_process";
import { CopyEngine, CopyOptions } from "./copy.engine";

type Broadcaster = (data: unknown) => void;

export default class RcloneService extends CopyEngine {
  constructor(private ws?: Broadcaster) {
    super();
  }

  async archive(src: string, dest: string): Promise<void> {
    await this.runCopy(src, dest);
  }

  async sync(src: string, dest: string, opts?: CopyOptions): Promise<void> {
    await this.runCopy(src, dest, opts?.recycle_path);
  }

  private runCopy(src: string, dest: string, backupDir?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ["copy", src, dest, "--stats=1s", "--stats-one-line"]; 

      if (backupDir) {
        args.push(`--backup-dir=${backupDir}`);
      }

      const proc = spawn("rclone", args, { shell: false });

      proc.stdout.on("data", (data: Buffer) => {
        const raw = data.toString();
        this.emit("log", raw);

        const chunks = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
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

      proc.stderr.on("data", (data: Buffer) => {
        const msg = data.toString();
        this.emit("log", msg);
      });

      proc.on("error", (err) => {
        reject(new Error(`Failed to start rclone: ${err.message}`));
      });

      proc.on("close", (code) => {
        if (code === 0) {
          this.emit("complete", { engine: "rclone" });
          resolve();
          return;
        }

        reject(new Error(`rclone failed (${code})`));
      });
    });
  }
}
