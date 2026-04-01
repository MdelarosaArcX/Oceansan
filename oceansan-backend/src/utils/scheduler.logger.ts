import fs from "fs";
import path from "path";

export class ScheduleLogger {
  private stream: fs.WriteStream;

  constructor(scheduleId?: string) {
    const logsDir = path.join(process.cwd(), "logs", "schedules");
    fs.mkdirSync(logsDir, { recursive: true });

    const filename = scheduleId
      ? `${scheduleId}.log`
      : `manual-${Date.now()}.log`;

    const filePath = path.join(logsDir, filename);

    this.stream = fs.createWriteStream(filePath, { flags: "a" });
  }

  log(message: string) {
    const ts = new Date().toISOString().replace("T", " ").split(".")[0];
    this.stream.write(`[${ts}] ${message}\n`);
  }

  close() {
    this.stream.end();
  }
}
