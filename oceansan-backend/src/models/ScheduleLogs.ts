// models/ScheduleLogs.ts
import { Schema, model, Types } from "mongoose";

export type FileStatus =
  | "copied"
  | "updated"
  | "deleted"
  | "error";

export interface ILogsFile {
  path: string;
  size: number;
  status: FileStatus;
  error?: string;
}

export interface IScheduleLogs {
  scheduleId: Types.ObjectId;
  type: "archive" | "sync";
  source: string;
  destination: string;

  startTime: Date;
  endTime?: Date;

  totalFiles: number;
  totalSize: number;

  files: ILogsFile[];
}

const LogsFileSchema = new Schema<ILogsFile>({
  path: String,
  size: Number,
  status: {
    type: String,
    enum: ["copied", "updated", "deleted", "error"]
  },
  error: String
});

const ScheduleLogsSchema = new Schema<IScheduleLogs>({
  scheduleId: { type: Schema.Types.ObjectId, ref: "Schedule" },
  type: String,
  source: String,
  destination: String,

  startTime: Date,
  endTime: Date,

  totalFiles: Number,
  totalSize: Number,

  files: [LogsFileSchema]
});

export default model<IScheduleLogs>(
  "ScheduleLogs",
  ScheduleLogsSchema
);
