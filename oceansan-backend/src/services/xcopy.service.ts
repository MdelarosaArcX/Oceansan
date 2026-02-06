// xcopy.service.ts
import { spawn } from "child_process";
import os from "os";
import { CopyEngine } from "./copy.engine";

export default class XcopyService extends CopyEngine {
  private ensureWindows() {
    if (os.platform() !== "win32") {
      throw new Error("XCopy is Windows-only");
    }
  }

  async archive(src: string, dest: string): Promise<void> {
    this.ensureWindows();

    const args = [
      src,
      dest,
      "/E",
      "/I",
      "/Y",
      "/H",
      "/C"
    ];

    this.emit("start", {});
    await this.run("archive", args);
  }

  async sync(src: string, dest: string): Promise<void> {
    // XCOPY cannot safely mirror → treat as archive
    return this.archive(src, dest);
  }

  private run(mode: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn("xcopy", args, { shell: true });

      proc.stdout.on("data", (d) => {
        this.emit("log", d.toString());
      });

      proc.on("close", (code) => {
        if (code === 0) {
          this.emit("complete", {});
          resolve();
        } else {
          reject(new Error(`Xcopy failed (${code})`));
        }
      });
    });
  }
}
