import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import chokidar from "chokidar";
// import crypto from "crypto";
import fileMetadata from "../models/FileMetadata";
import Schedule from "../models/Schedule";

import ffmpeg from "fluent-ffmpeg";
import { exiftool } from "exiftool-vendored";
// import * as pdfParse from "pdf-parse";
import mammoth from "mammoth";

ffmpeg.setFfmpegPath(process.env.FFMPEG || "ffmpeg");
ffmpeg.setFfprobePath(process.env.FFPROBE || "ffprobe");

// Debounce map
const saveQueue = new Map();

export default class FileWatcherService {
  private watcher?: chokidar.FSWatcher;

  async watchPath(dirPath: string) {
    const normalizedPath = this.normalizePath(dirPath);

    console.log("Watching folder:", normalizedPath);

    this.watcher = chokidar.watch(normalizedPath, {
      persistent: true,
      ignoreInitial: false, // index existing files
      depth: 99,
    });

    this.watcher
      .on("add", (filePath) => this.debounceSave(filePath))
      .on("change", (filePath) => this.debounceSave(filePath))
      .on("unlink", (filePath) => this.deleteFile(filePath))
      .on("error", (err) => console.error("Watcher error:", err));
  }

  // --- DEBOUNCED SAVE ---
  private debounceSave(filePath: string, delay = 300) {
    if (saveQueue.has(filePath)) clearTimeout(saveQueue.get(filePath));
    const timeout = setTimeout(() => {
      saveQueue.delete(filePath);
      this.saveFile(filePath);
    }, delay);
    saveQueue.set(filePath, timeout);
  }

  // --- SAVE FILE METADATA ---
  private async saveFile(filePath: string) {
    const normalizedFilePath = this.normalizePath(filePath);
    const folderPath = this.normalizePath(path.dirname(normalizedFilePath));

    try {
      await this.waitForFile(normalizedFilePath);

      const stats = await fsp.stat(normalizedFilePath);
      if (!stats.isFile()) return;

      const ext = path.extname(normalizedFilePath).toLowerCase();
      // const fileHash = await this.getFileHash(normalizedFilePath);
      const metadata = await this.extractMetadata(normalizedFilePath, ext);

      const fileDoc = {
        file_name: path.basename(normalizedFilePath),
        extension: ext,
        size: stats.size,
        created_at: stats.birthtime,
        modified_at: stats.mtime,
        metadata: {
          ...(metadata || {}),
          // hash: fileHash,
        },
      };

      // Remove old entry if exists
      await fileMetadata.updateOne(
        { path: folderPath },
        { $pull: { files: { file_name: fileDoc.file_name } } }
      );

      // Push new entry
      await fileMetadata.updateOne(
        { path: folderPath },
        { $push: { files: fileDoc } },
        { upsert: true }
      );

      console.log("Indexed file:", normalizedFilePath);
    } catch (err) {
      console.error("Failed to index file:", normalizedFilePath, err);
    }
  }

  // --- DELETE FILE METADATA ---
  private async deleteFile(filePath: string) {
    const folderPath = this.normalizePath(path.dirname(filePath));
    const fileName = path.basename(filePath);

    try {
      await fileMetadata.updateOne(
        { path: folderPath },
        { $pull: { files: { file_name: fileName } } }
      );
      console.log("Deleted file from folder:", filePath);
    } catch (err) {
      console.error("Failed to delete file:", filePath, err);
    }
  }

  // --- HELPERS ---
  private normalizePath(p: string) {
    return p.replace(/\\/g, "/").toLowerCase();
  }

  private waitForFile(filePath: string, retries = 30, delay = 500) {
    return new Promise<void>((resolve, reject) => {
      let attempt = 0;
      const check = () => {
        fs.open(filePath, "r", (err, fd) => {
          if (!err) {
            fs.close(fd, () => {});
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
      // IMAGE
      if ([".jpg", ".jpeg", ".png", ".gif", ".tiff", ".heic", ".webp"].includes(ext)) {
        const info = await exiftool.read(filePath);
        return { type: "image", raw: info };
      }

      // MEDIA
      if ([".mp4", ".mkv", ".avi", ".mov", ".flac", ".mp3", ".wav"].includes(ext)) {
        return new Promise((resolve) => {
          ffmpeg.ffprobe(filePath, (err, data) => {
            if (err) return resolve({ type: "media", raw: null, error: err.message });
            resolve({ type: "media", raw: data });
          });
        });
      }

      // // PDF
      // if (ext === ".pdf") {
      //   const buffer = await fsp.readFile(filePath);
      //   const data = await pdfParse(buffer);
      //   return { type: "pdf", raw: data };
      // }

      // DOCX
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
