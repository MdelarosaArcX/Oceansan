import { spawn } from "child_process";
import os from "os";
import path from "path";
import { CopyEngine } from "./copy.engine";
import { normalizeWindowsPath } from "../utils/path.utils";

type Broadcaster = (data: unknown) => void;

export default class XcopyService extends CopyEngine {
  constructor(private ws?: Broadcaster) {
    super();
  }

  private ensureWindows() {
    if (os.platform() !== "win32") {
      throw new Error("XCopy is Windows-only");
    }
  }


  async archive(src: string, dest: string): Promise<void> {
    this.ensureWindows();

    // Normalize paths (CRITICAL)
    const srcPath = normalizeWindowsPath(src);
    const destPath = normalizeWindowsPath(dest);

    const args = [
      srcPath,
      destPath,
      "/E",
      "/I",
      "/Y",
      "/H",
      "/C",
      "/Q",
    ];

    // console.log("[xcopy] CMD:", "cmd", args.join(" "));

    this.emit("start", {});
    await this.run(args);
  }

  async sync(src: string, dest: string): Promise<void> {
    // XCOPY has no true sync
    return this.archive(src, dest);
  }

  private run(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn("xcopy", args, {
        shell: false,
        windowsHide: true,
      });

      proc.stdout.on("data", (d) => {
        // console.log("[xcopy][stdout]", d.toString());
        this.emit("log", d.toString());
      });

      proc.stderr.on("data", (d) => {
        // console.log("[xcopy][stderr]", d.toString());
        this.emit("log", d.toString());
      });

      proc.on("close", (code) => {
        // console.log("[xcopy] exit code:", code);

        // XCOPY success: 0 or 1
        if (code === 0 || code === 1) {
          this.emit("complete", { engine: "xcopy" });
          resolve();
        } else {
          reject(new Error(`Xcopy failed (${code})`));
        }
      });
    });
  }
}
