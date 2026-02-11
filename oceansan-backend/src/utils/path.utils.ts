// path.utils.ts
import path from "path";

export function normalizeWindowsPath(input: string): string {
  return path.win32.normalize(
    input
      .replace(/\//g, "\\")   // convert forward slashes
      .replace(/\\+$/, "")    // remove trailing slashes
  );
}
