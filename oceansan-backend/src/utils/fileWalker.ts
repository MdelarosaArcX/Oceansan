import fs from "fs";
import path from "path";
import { FileEntry } from "../types/copy.types";

export function walkDir(dir: string, files: FileEntry[] = []): FileEntry[] {
  let entries: string[];

  try {
    if (!fs.existsSync(dir)) {
      return files;
    }

    entries = fs.readdirSync(dir);
  } catch (error) {
    console.warn(`[walkDir] Failed to read directory: ${dir}`, error);
    return files;
  }

  for (const file of entries) {
    const fullPath = path.join(dir, file);

    try {
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walkDir(fullPath, files);
      } else {
        files.push({
          path: fullPath,
          size: stat.size
        });
      }
    } catch (error) {
      console.warn(`[walkDir] Failed to inspect path: ${fullPath}`, error);
    }
  }

  return files;
}
