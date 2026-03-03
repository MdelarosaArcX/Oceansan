import { spawn } from "child_process";
import { CopyEngine, CopyOptions } from "./copy.engine";
import path from "path";

const rclonePath = path.join(process.cwd(), "rclone", "rclone.exe");

type Broadcaster = (data: unknown) => void;

export default class RcloneService extends CopyEngine {
  constructor(private ws?: Broadcaster) {
    super();
  }

  private currentProcess?: ReturnType<typeof spawn>;

  async archive(src: string, dest: string): Promise<void> {
    await this.runCopy(src, dest);
  }

  async sync(src: string, dest: string, opts?: CopyOptions): Promise<void> {
    await this.runCopy(src, dest, opts?.recycle ? opts.recycle_path : undefined);
  }

  private runCopy(
    src: string,
    dest: string,
    backupDir?: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = backupDir ? "sync" : "copy";

      const args = [
        command,
        src,
        dest,
        "--stats=1s",
        "--stats-one-line",
        "--transfers=8",
        "--checkers=16",
        "--fast-list",
      ];

      if (backupDir) {
        args.push(`--backup-dir=${backupDir}`);
      }

      console.log("[rclone] CMD:", rclonePath, args.join(" "));

      const proc = spawn(rclonePath, args, { shell: false });
      this.currentProcess = proc;

      let lastPercent = 0;

      /* =========================
         STDOUT (PROGRESS)
      ========================= */
      proc.stdout.on("data", (data: Buffer) => {
        const raw = data.toString();
        this.emit("log", raw);

        const lines = raw
          .split(/\r?\n/)
          .map(l => l.trim())
          .filter(Boolean);

        for (const line of lines) {

          // Example stats line:
          // Transferred:   1.234 GiB / 5.678 GiB, 21%, 12.3 MiB/s, ETA 1m23s

          const percentMatch = line.match(/,\s*(\d+)%/);
          const speedMatch = line.match(/,\s*([\d.]+\s*[kMGT]?i?B\/s)/i);

          if (percentMatch) {
            const percent = Number(percentMatch[1]);
            lastPercent = percent;

            this.emit("progress", { percent });

            this.ws?.({
              type: "progress",
              engine: "rclone",
              percent,
            });
          }

          if (speedMatch) {
            const speed = speedMatch[1];

            this.emit("speed", { speed });

            this.ws?.({
              type: "speed",
              engine: "rclone",
              speed,
            });
          }
        }
      });

      /* =========================
         STDERR (WARNINGS/ERRORS)
      ========================= */
      proc.stderr.on("data", (data: Buffer) => {
        const msg = data.toString();
        console.log("[rclone][stderr]", msg);

        this.emit("log", msg);

        this.ws?.({
          type: "error-log",
          engine: "rclone",
          message: msg,
        });
      });

      /* =========================
         SPAWN ERROR
      ========================= */
      proc.on("error", (err) => {
        console.error("[rclone] spawn error:", err);

        this.ws?.({
          type: "error",
          engine: "rclone",
          message: "Failed to start rclone process",
          details: err.message,
        });

        reject(new Error(`Failed to start rclone: ${err.message}`));
      });

      /* =========================
         PROCESS CLOSED
      ========================= */
      proc.on("close", (code) => {
        console.log("[rclone] exit code:", code);

        if (code === 0) {
          this.emit("complete", { engine: "rclone" });

          this.ws?.({
            type: "complete",
            engine: "rclone",
          });

          resolve();
        } else {
          this.ws?.({
            type: "error",
            engine: "rclone",
            code,
            message: `rclone failed (${code})`,
            percent: lastPercent,
          });

          reject(new Error(`rclone failed (${code})`));
        }
      });
    });
  }
}
