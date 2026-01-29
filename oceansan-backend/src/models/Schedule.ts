import mongoose, { Schema, Document } from "mongoose";

export interface ISchedule extends Document {
    sched_name:string;
    src_path: string;
  dest_path: string;
  recycle_path:string;
  type: "sync" | "archive";
  time: string;           // HH:mm
  days: number[];         // 0-6 (Sun-Sat)
  active: boolean;
  recycle: boolean;
  last_archived?: Date;
  last_sync?: Date;
}

const ScheduleSchema = new Schema<ISchedule>(
  {
    sched_name: { type: String, required: true },
    src_path: { type: String, required: true },
    dest_path: { type: String, required: true },
    recycle_path: { type: String},

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

    days: {
      type: [Number],
      required: true,
      validate: {
        validator: (days: number[]) =>
          days.every(d => d >= 0 && d <= 6),
        message: "Days must be between 0 (Sun) and 6 (Sat)"
      }
    },

    active: { type: Boolean, default: true },
    recycle: { type: Boolean, default: true },
    last_archived: { type: Date },
    last_sync: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model<ISchedule>("Schedule", ScheduleSchema);
