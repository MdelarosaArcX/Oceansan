import { EventEmitter } from "events";
import { spawn } from "child_process";
import os from "os";
import path from "path";
import { walkDir } from "../utils/fileWalker";



export default class RobocopyService extends EventEmitter {

  private ensureWindows() {
    if (os.platform() !== "win32") {
      throw new Error("Robocopy is only supported on Windows");
    }
  }

  /* ============================
     ARCHIVE (copy only)
     ============================ */
  async archive(src: string, dest: string): Promise<void> {
    this.ensureWindows();

    const files = walkDir(src);
    const totalSize = files.reduce((s, f) => s + f.size, 0);

    const fileSizeMap = new Map(
      files.map(f => [
        path.normalize(path.resolve(f.path)).toLowerCase(),
        f.size
      ])
    );

    this.emit("start", {
      totalFiles: files.length,
      totalSize
    });
    const args = [
      src,
      dest,
      "/E",
      "/Z",
      "/R:2",
      "/W:1",
      "/MT:8",
      "/TEE"
    ];
    console.log("running robo copy?")
    await this.runRobocopy(src, args, fileSizeMap);
  }

  /* ============================
     SYNC / MIRROR
     ============================ */

  async sync(src: string, dest: string): Promise<void> {
    this.ensureWindows();

    const args = [
      src,
      dest,
      "/E",
      "/Z",
      "/R:2",
      "/W:1",
      "/MT:8",   // lower threads = cleaner output
      "/TEE"
    ];

    this.emit("start", {
      totalFiles: 0,
      totalSize: 0
    });

    await this.runRobocopy(src, args, new Map());
  }

  /* ============================
     CORE RUNNER
     ============================ */
  private runRobocopy(
    src: string,
    args: string[],
    fileSizeMap: Map<string, number>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn("robocopy", args, { shell: true });

      // console.log(proc,"proc")
      let copiedSize = 0;

      proc.stdout.on("data", (data: Buffer) => {
        const lines = data.toString().split(/\r?\n/);
        console.log("data", data)
        for (const line of lines) {

          const text = line.trim();
          if (!text) continue;

          console.log(text, "text")
         


          // const FILE_RE = /New File\s+.+?\s+(?:[kKmMgG])\s+(.+)$/;

          // New / Updated file
          if (/^(New File|Updated)/i.test(text)) {
            // const match = text.match(FILE_RE);
            // if (!match) return;
             const file = text.split(/\s+/).slice(2).join(" ");

            const fullPath = text[1].trim();
            const absPath = path.normalize(path.resolve(fullPath)).toLowerCase();
            const size = fileSizeMap.get(absPath) ?? 0;


            console.log(size, "size")

            copiedSize += size;
            this.emit("progress", {
              copiedSize,
              totalSize: Array.from(fileSizeMap.values()).reduce((a, b) => a + b, 0),
              currentFile: fullPath
            });

            this.emit("file-copied", {
              file: absPath,
              size
            });
          }

          if (/^\*EXTRA File/i.test(text)) {
            const file = text.replace(/^\*EXTRA File\s+/i, "");
            this.emit("file-deleted", { file, size: 0 });
          }
        }
      });


      proc.on("close", (code) => {
        if (code !== null && code <= 7) {
          this.emit("complete", {
            copiedSize,
            totalSize: Array.from(fileSizeMap.values()).reduce((a, b) => a + b, 0)
          });
          resolve();
        } else {
          reject(new Error(`Robocopy failed with exit code ${code}`));
        }
      });
    });
  }

}

