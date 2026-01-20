import fs from "fs-extra";
import path from "path";
import fse from "fs-extra";
import { EventEmitter } from "events";
import { walkDir } from "../utils/fileWalker";
import {
  CopyProgress,
  CopyStart,
  CopyComplete
} from "../types/copy.types";

export default class CopyService extends EventEmitter {
  async _archive(from: string, to: string): Promise<void> {
    const files = walkDir(from);
    const totalSize = files.reduce((s, f) => s + f.size, 0);

    let copiedSize = 0;

    const startPayload: CopyStart = {
      totalFiles: files.length,
      totalSize
    };

    this.emit("start", startPayload);

    for (const file of files) {
      const relative = path.relative(from, file.path);
      const destination = path.join(to, relative);

      this.emit("file-start", { file: relative });

      await fse.ensureDir(path.dirname(destination));

      await new Promise<void>((resolve, reject) => {
        const read = fs.createReadStream(file.path);
        const write = fs.createWriteStream(destination);

        read.on("data", (chunk: Buffer) => {
          copiedSize += chunk.length;

          this.emit("progress", {
            copiedSize,
            totalSize,
            percent: Math.floor((copiedSize / totalSize) * 100),
            currentFile: relative
          });
        });

        read.on("error", (err) => {
          this.emit("file-error", {
            file: relative,
            error: err.message
          });
          reject(err);
        });

        write.on("error", (err) => {
          this.emit("file-error", {
            file: relative,
            error: err.message
          });
          reject(err);
        });

        write.on("finish", () => {
          this.emit("file-success", {
            file: relative,
            copiedSize,
            totalSize
          });
          resolve();
        });

        read.pipe(write);
      });
    }

    const completePayload: CopyComplete = {
      copiedSize,
      totalSize
    };

    this.emit("complete", completePayload);
  }

  async _sync(src: string, dest: string): Promise<void> {
    this.emit("start", { type: "sync" });

    // Delete destination first (mirror)
    await fs.remove(dest);
    await fs.ensureDir(dest);

    // Walk all files in src
    const files = walkDir(src);
    const totalSize = files.reduce((s, f) => s + f.size, 0);
    let copiedSize = 0;

    for (const file of files) {
      const relative = path.relative(src, file.path);
      const destination = path.join(dest, relative);

      await fs.ensureDir(path.dirname(destination));

      await new Promise<void>((resolve, reject) => {
        const read = fs.createReadStream(file.path);
        const write = fs.createWriteStream(destination);

        read.on("data", (chunk: Buffer) => {
          copiedSize += chunk.length;

          this.emit("progress", {
            copiedSize,
            totalSize,
            percent: Math.floor((copiedSize / totalSize) * 100),
            currentFile: relative
          });
        });

        read.on("error", (err) => {
          this.emit("file-error", {
            file: relative,
            error: err.message
          });
          reject(err);
        });

        write.on("error", (err) => {
          this.emit("file-error", {
            file: relative,
            error: err.message
          });
          reject(err);
        });

        write.on("finish", () => {
          this.emit("file-success", {
            file: relative,
            copiedSize,
            totalSize
          });
          resolve();
        });

        read.pipe(write);
      });
    }

    this.emit("complete", { copiedSize, totalSize });
  }

}
