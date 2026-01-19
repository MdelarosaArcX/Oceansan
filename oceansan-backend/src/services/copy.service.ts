import fs from "fs";
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
  async copyFolder(from: string, to: string): Promise<void> {
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

      await fse.ensureDir(path.dirname(destination));

      await new Promise<void>((resolve, reject) => {
        const read = fs.createReadStream(file.path);
        const write = fs.createWriteStream(destination);

        read.on("data", (chunk: Buffer) => {
          copiedSize += chunk.length;

          const progress: CopyProgress = {
            copiedSize,
            totalSize,
            percent: Math.floor((copiedSize / totalSize) * 100),
            currentFile: relative
          };

          this.emit("progress", progress);
        });

        read.on("error", reject);
        write.on("error", reject);
        write.on("finish", resolve);

        read.pipe(write);
      });
    }

    const completePayload: CopyComplete = {
      copiedSize,
      totalSize
    };

    this.emit("complete", completePayload);
  }
}
