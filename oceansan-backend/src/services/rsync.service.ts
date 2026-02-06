// rsync.service.ts
import { spawn } from "child_process";
import os from "os";
import { CopyEngine, CopyOptions } from "./copy.engine";

export default class RsyncService extends CopyEngine {
  private ensureUnix() {
    if (os.platform() === "win32") {
      throw new Error("Rsync requires WSL or Unix OS");
    }
  }

  async archive(src: string, dest: string): Promise<void> {
    this.ensureUnix();

    const args = [
      "-a",
      "--progress",
      src + "/",
      dest + "/"
    ];

    this.emit("start", {});
    await this.run("archive", args);
  }

  async sync(src: string, dest: string, opts?: CopyOptions): Promise<void> {
    this.ensureUnix();

    const args = [
      "-a",
      "--delete"
    ];

    if (opts?.recycle && opts.recycle_path) {
      args.push(`--backup`, `--backup-dir=${opts.recycle_path}`);
    }

    args.push(src + "/", dest + "/");

    this.emit("start", {});
    await this.run("sync", args);
  }

  private run(mode: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn("rsync", args);

      proc.stdout.on("data", (d) => {
        this.emit("log", d.toString());
      });

      proc.on("close", (code) => {
        if (code === 0) {
          this.emit("complete", {});
          resolve();
        } else {
          reject(new Error(`rsync failed (${code})`));
        }
      });
    });
  }
}
