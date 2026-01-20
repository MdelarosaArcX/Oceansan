import mongoose, { Schema, Document } from "mongoose";

export interface ISchedule extends Document {
  src_path: string;
  dest_path: string;
  sched: number;
  type: "sync" | "archive";
  time: string; // HH:mm
  active: boolean;
  last_archived?: Date;
}

const ScheduleSchema = new Schema<ISchedule>(
  {
    src_path: { type: String, required: true },
    dest_path: { type: String, required: true },
    sched: { type: Number, required: true },
    type: {
      type: String,
      enum: ["sync", "archive"],
      required: true,
    },
    time: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },
    active: { type: Boolean, default: true },
    last_archived: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model<ISchedule>("Schedule", ScheduleSchema);
