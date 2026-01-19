import fs from "fs";
import path from "path";

const LOG_DIR = path.join(__dirname, "../../logs");
const LOG_FILE = path.join(LOG_DIR, "copy-log.json");

export interface LogEntry {
  type: "manual" | "scheduled";
  from?: string;
  to?: string;
  jobId?: string;
  status: "started" | "completed" | "failed";
  error?: string;
  timestamp?: string;
}

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function readLogs(): LogEntry[] {
  if (!fs.existsSync(LOG_FILE)) return [];
  return JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"));
}

export function writeLog(entry: LogEntry): void {
  const logs = readLogs();

  logs.push({
    ...entry,
    timestamp: new Date().toISOString()
  });

  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}
