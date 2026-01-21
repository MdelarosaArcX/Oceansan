// models/ScheduleExecution.ts
import { Schema, model, Types } from "mongoose";

export type FileStatus =
  | "copied"
  | "updated"
  | "deleted"
  | "error";

export interface IExecutionFile {
  path: string;
  size: number;
  status: FileStatus;
  error?: string;
}

export interface IScheduleExecution {
  scheduleId: Types.ObjectId;
  type: "archive" | "sync";
  source: string;
  destination: string;

  startTime: Date;
  endTime?: Date;

  totalFiles: number;
  totalSize: number;

  files: IExecutionFile[];
}

const ExecutionFileSchema = new Schema<IExecutionFile>({
  path: String,
  size: Number,
  status: {
    type: String,
    enum: ["copied", "updated", "deleted", "error"]
  },
  error: String
});

const ScheduleExecutionSchema = new Schema<IScheduleExecution>({
  scheduleId: { type: Schema.Types.ObjectId, ref: "Schedule" },
  type: String,
  source: String,
  destination: String,

  startTime: Date,
  endTime: Date,

  totalFiles: Number,
  totalSize: Number,

  files: [ExecutionFileSchema]
});

export default model<IScheduleExecution>(
  "ScheduleExecution",
  ScheduleExecutionSchema
);
