import { Request, Response } from "express";
import Schedule from "../models/Schedule";

/** CREATE */
const normalizeDays = (days: number[]) =>
  [...new Set(days)].sort((a, b) => a - b);

export const createSchedule = async (req: Request, res: Response) => {
  try {
    const { src_path, dest_path, time, days } = req.body;

    const normalizedDays = normalizeDays(days);

    // Check for existing schedule
    const existing = await Schedule.findOne({
      src_path,
      dest_path,
      time,
      days: normalizedDays
    });

    if (existing) {
      return res.status(409).json({
        error: "Schedule already exists for the same source, destination, days, and time"
      });
    }

    //  Create if not exists
    const schedule = await Schedule.create({
      ...req.body,
      days: normalizedDays
    });

    res.status(201).json(schedule);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
};


/** READ ALL */
export const getSchedules = async (_req: Request, res: Response) => {
  const schedules = await Schedule.find().sort({ createdAt: -1 });
  res.json(schedules);
};

/** READ ONE */
export const getScheduleById = async (req: Request, res: Response) => {
  const schedule = await Schedule.findById(req.params.id);
  if (!schedule) return res.status(404).json({ message: "Not found" });
  res.json(schedule);
};

/** UPDATE */
export const updateSchedule = async (req: Request, res: Response) => {
  const schedule = await Schedule.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  if (!schedule) return res.status(404).json({ message: "Not found" });
  res.json(schedule);
};

/** DELETE */
export const deleteSchedule = async (req: Request, res: Response) => {
  const schedule = await Schedule.findByIdAndDelete(req.params.id);
  if (!schedule) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Deleted successfully" });
};
