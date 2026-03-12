import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import chokidar from "chokidar";
import { DataSource } from "typeorm";
import { Directories } from "../entities/Directories";
import { FileMetadata } from "../entities/FileMetadata";

import ffmpeg from "fluent-ffmpeg";
import { exiftool } from "exiftool-vendored";
import mammoth from "mammoth";

ffmpeg.setFfmpegPath(process.env.FFMPEG || "ffmpeg");
ffmpeg.setFfprobePath(process.env.FFPROBE || "ffprobe");

const saveQueue = new Map<string, NodeJS.Timeout>();

export class FileWatcherService {
  private watcher?: chokidar.FSWatcher;

  private directoriesRepo;
  private fileMetadataRepo;

  // 🚀 Batch queue
  private metadataQueue: any[] = [];

  constructor(private dataSource: DataSource) {
    this.directoriesRepo = dataSource.getRepository(Directories);
    this.fileMetadataRepo = dataSource.getRepository(FileMetadata);

    // flush queue every 2 seconds
    setInterval(() => this.flushQueue(), 2000);
  }

  async watchPath(dirPath: string) {
    const normalizedPath = this.normalizePath(dirPath);

    console.log("Watching folder:", normalizedPath);

    this.watcher = chokidar.watch(normalizedPath, {
      persistent: true,
      ignoreInitial: false,
      depth: 99,
    });

    this.watcher
      .on("add", (filePath) => this.debounceSave(filePath))
      .on("change", (filePath) => this.debounceSave(filePath))
      .on("unlink", (filePath) => this.deleteFile(filePath))
      .on("error", (err) => console.error("Watcher error:", err));
  }

  private debounceSave(filePath: string, delay = 300) {
    if (saveQueue.has(filePath)) {
      clearTimeout(saveQueue.get(filePath)!);
    }

    const timeout = setTimeout(() => {
      saveQueue.delete(filePath);
      this.saveFile(filePath);
    }, delay);

    saveQueue.set(filePath, timeout);
  }

  private async saveFile(filePath: string) {
    const normalizedFilePath = this.normalizePath(filePath);
    const folderPath = this.normalizePath(path.dirname(filePath));

    try {
      await this.waitForFile(normalizedFilePath);

      const stats = await fsp.stat(normalizedFilePath);
      if (!stats.isFile()) return;

      const ext = path.extname(normalizedFilePath).toLowerCase();

      const metadata = await this.extractMetadata(normalizedFilePath, ext);

      // --- find directory ---
      let directory = await this.directoriesRepo.findOne({
        where: { path: folderPath },
      });

      // --- create directory if missing ---
      if (!directory) {
        directory = await this.directoriesRepo.save({
          path: folderPath,
        });
      }

      // 🚀 push into queue instead of saving immediately
      this.metadataQueue.push({
        fileName: path.basename(normalizedFilePath),
        extension: ext,
        size: stats.size,
        createdAt: stats.birthtime,
        updatedAt: stats.mtime,
        metadata: metadata,
        directoryId: directory.id
      });

      console.log("Queued file:", normalizedFilePath);
    } catch (err) {
      console.error("Failed to index file:", normalizedFilePath, err);
    }
  }

  // 🚀 batch insert
  private async flushQueue() {
    if (this.metadataQueue.length === 0) return;

    const batch = this.metadataQueue.splice(0, 100);

    try {
      await this.fileMetadataRepo
        .createQueryBuilder()
        .insert()
        .into(FileMetadata)
        .values(batch)
        .orIgnore()
        .orUpdate(
          ["size", "updatedAt", "metadata"],
          ["fileName", "directoryId"]
        )
        .updateEntity(false)
        .execute();

      console.log(`Inserted/Updated ${batch.length} files`);
    } catch (err) {
      console.error("Batch insert error:", err);
    }
  }

  private async deleteFile(filePath: string) {
    const folderPath = this.normalizePath(path.dirname(filePath));
    const fileName = path.basename(filePath);

    try {
      const directory = await this.directoriesRepo.findOne({
        where: { path: folderPath },
      });

      if (!directory) return;

      await this.fileMetadataRepo.delete({
        fileName,
        directory: { id: directory.id },
      });

      console.log("Deleted file:", filePath);
    } catch (err) {
      console.error("Failed to delete file:", filePath, err);
    }
  }

  private normalizePath(p: string) {
    return p.replace(/\\/g, "/").toLowerCase();
  }

  private waitForFile(filePath: string, retries = 30, delay = 500) {
    return new Promise<void>((resolve, reject) => {
      let attempt = 0;

      const check = () => {
        fs.open(filePath, "r", (err, fd) => {
          if (!err) {
            fs.close(fd, () => { });
            return resolve();
          }

          attempt++;

          if (attempt <= retries) setTimeout(check, delay);
          else reject(err || new Error("File not readable"));
        });
      };

      check();
    });
  }

  private async extractMetadata(filePath: string, ext: string) {
    try {
      if ([".jpg", ".jpeg", ".png", ".gif", ".tiff", ".heic", ".webp"].includes(ext)) {
        const info = await exiftool.read(filePath);
        return { type: "image", raw: info };
      }

      if ([".mp4", ".mkv", ".avi", ".mov", ".flac", ".mp3", ".wav"].includes(ext)) {
        return new Promise((resolve) => {
          ffmpeg.ffprobe(filePath, (err, data) => {
            if (err) return resolve({ type: "media", raw: null, error: err.message });
            resolve({ type: "media", raw: data });
          });
        });
      }

      if (ext === ".docx") {
        const buffer = await fsp.readFile(filePath);
        const result = await mammoth.extractRawText({ buffer });
        return { type: "docx", raw: result };
      }

      return { type: "other", raw: null };
    } catch (err: any) {
      return { type: "error", raw: null, error: err.message };
    }
  }

  async close() {
    if (this.watcher) await this.watcher.close();
  }
}