import fs from "fs";
import path from "path";
import { FileEntry } from "../types/copy.types";

export function walkDir(dir: string, files: FileEntry[] = []): FileEntry[] {
  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      walkDir(fullPath, files);
    } else {
      files.push({
        path: fullPath,
        size: stat.size
      });
    }
  }

  return files;
}
