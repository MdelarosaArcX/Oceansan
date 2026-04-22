// rsync.service.ts
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import os from "os";
import { CopyEngine, CopyOptions } from "./copy.engine";
import { killProcessTree, resumeProcess, suspendProcess } from "../utils/process-control";

type Broadcaster = (data: unknown) => void;
export default class RsyncService extends CopyEngine {
  private proc: ChildProcessWithoutNullStreams | null = null;

  constructor(private ws?: Broadcaster) {
    super();
    console.log("WS injected:", !!ws);
  }
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
      this.proc = spawn("rsync", args);
      const proc = this.proc;

      proc.stdout.on("data", (d) => {
        this.emit("log", d.toString());
      });

      proc.on("close", (code) => {
        this.proc = null;
        if (code === 0) {
          this.emit("complete", {});
          resolve();
        } else {
          reject(new Error(`rsync failed (${code})`));
        }
      });
    });
  }

  async pause(): Promise<void> {
    if (!this.proc?.pid) {
      throw new Error("Rsync job is not running.");
    }
    await suspendProcess(this.proc.pid);
  }

  async resume(): Promise<void> {
    if (!this.proc?.pid) {
      throw new Error("Rsync job is not running.");
    }
    await resumeProcess(this.proc.pid);
  }

  async stop(): Promise<void> {
    if (!this.proc?.pid) {
      throw new Error("Rsync job is not running.");
    }
    await killProcessTree(this.proc.pid);
  }
}
