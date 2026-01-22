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

    this.emit("start", {
      totalFiles: files.length,
      totalSize
    });

    for (const file of files) {
      const relative = path.relative(from, file.path);
      const destination = path.join(to, relative);

      try {
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

          read.on("error", reject);
          write.on("error", reject);

          write.on("finish", resolve);
          read.pipe(write);
        });

        //  FILE SUCCESS
        this.emit("file-copied", {
          file: relative,
          size: file.size
        });

      } catch (err: any) {
        //  FILE ERROR
        this.emit("file-error", {
          file: relative,
          error: err.message
        });
      }
    }

    this.emit("complete", { copiedSize, totalSize });
  }


  async _sync(src: string, dest: string): Promise<void> {
  const srcFiles = walkDir(src);
  const srcMap = new Map(srcFiles.map(f => [path.relative(src, f.path), f]));

  const destExists = await fs.pathExists(dest);
  const oldDestFiles = destExists ? walkDir(dest) : [];
  const oldDestSet = new Set(oldDestFiles.map(f =>
    path.relative(dest, f.path)
  ));

  const totalSize = srcFiles.reduce((s, f) => s + f.size, 0);
  let copiedSize = 0;

  // Mirror delete
  await fs.remove(dest);
  await fs.ensureDir(dest);

  for (const file of srcFiles) {
    const relative = path.relative(src, file.path);
    const destination = path.join(dest, relative);

    try {
      await fs.ensureDir(path.dirname(destination));
      await fs.copy(file.path, destination);

      copiedSize += file.size;

      this.emit("progress", {
        copiedSize,
        totalSize,
        percent: Math.floor((copiedSize / totalSize) * 100),
        currentFile: relative
      });

      const status = oldDestSet.has(relative) ? "updated" : "copied";

      this.emit(`file-${status}`, {
        file: relative,
        size: file.size
      });

      oldDestSet.delete(relative);

    } catch (err: any) {
      this.emit("file-error", {
        file: relative,
        error: err.message
      });
    }
  }

  // Remaining files were deleted
  for (const deletedFile of oldDestSet) {
    this.emit("file-deleted", {
      file: deletedFile,
      size: 0
    });
  }

  this.emit("complete", { copiedSize, totalSize });
}



}
