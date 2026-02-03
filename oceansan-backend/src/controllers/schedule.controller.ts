import { Request, Response } from "express";
import path from "path";
import Schedule from "../models/Schedule";
// import { normalizeDays } from "../utils/normalizedays";

/** CREATE */
const normalizeDays = (days: number[]) =>
  [...new Set(days)].sort((a, b) => a - b);

const VALID_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const createSchedule = async (req: Request, res: Response) => {
  try {
    const { sched_name, src_path, dest_path, time, days, type } = req.body;

    /* =========================
       BASIC VALIDATION
    ========================= */

    if (!src_path || !dest_path || !time || !days || !type) {
      return res.status(400).json({
        error: "src_path, dest_path, time, days, and type are required"
      });
    }

    if (!["archive", "sync"].includes(type)) {
      return res.status(400).json({
        error: "type must be either 'archive' or 'sync'"
      });
    }

    if (!Array.isArray(days)) {
      return res.status(400).json({
        error: "days must be an array of numbers"
      });
    }

    if (!days.every(d => Number.isInteger(d))) {
      return res.status(400).json({
        error: "days must contain only integers"
      });
    }

    /* =========================
       DAYS RANGE VALIDATION
    ========================= */

    if (days.some(d => d < 0 || d > 6)) {
      return res.status(400).json({
        error: "days must be between 0 (Sunday) and 6 (Saturday)"
      });
    }

    const normalizedDays = normalizeDays(days);

    if (!normalizedDays.length) {
      return res.status(400).json({
        error: "days must not be empty"
      });
    }

    /* =========================
       PATH VALIDATION
    ========================= */

    if (typeof src_path !== "string" || typeof dest_path !== "string") {
      return res.status(400).json({
        error: "src_path and dest_path must be strings"
      });
    }

    const normalizedSrc = path.resolve(src_path).toLowerCase();
    const normalizedDest = path.resolve(dest_path).toLowerCase();

    if (normalizedSrc === normalizedDest) {
      return res.status(400).json({
        error: "Source and destination paths cannot be the same"
      });
    }

    /* =========================
       TIME VALIDATION
    ========================= */

    if (!VALID_TIME_REGEX.test(time)) {
      return res.status(400).json({
        error: "Invalid time format. Expected HH:mm"
      });
    }

    /* =========================
       CONFLICT CHECKS
    ========================= */

    //  Exact duplicate
    const exactDuplicate = await Schedule.findOne({
      src_path: normalizedSrc,
      dest_path: normalizedDest,
      time,
      days: normalizedDays,
      type
    });

    if (exactDuplicate) {
      return res.status(409).json({
        error: "Exact schedule already exists"
      });
    }
    // DESTINATION OWNERSHIP RULE
    const existingAtDestination = await Schedule.findOne({
      dest_path: normalizedDest
    });

    if (existingAtDestination) {
      // If ANY sync exists on this destination
      if (existingAtDestination.type === "sync") {
        return res.status(409).json({
          error:
            "Destination is already used by a sync schedule and cannot be reused"
        });
      }

      // If new schedule is sync but destination already has archive from another source
      if (
        type === "sync" &&
        existingAtDestination.src_path !== normalizedSrc
      ) {
        return res.status(409).json({
          error:
            "Destination is already used by an archive schedule from another source and cannot be synced"
        });
      }
    }

    //  DESTINATION + TIME + OVERLAPPING DAYS (ARCHIVE vs SYNC INCLUDED)
    const destinationConflict = await Schedule.findOne({
      dest_path: normalizedDest,
      time,
      days: { $in: normalizedDays }
    });

    if (destinationConflict) {
      return res.status(409).json({
        error:
          "Schedule conflict: destination already in use at this time on overlapping days"
      });
    }

    /* =========================
       CREATE
    ========================= */

    const schedule = await Schedule.create({
      sched_name,
      src_path: normalizedSrc,
      dest_path: normalizedDest,
      time,
      days: normalizedDays,
      type,
      active: true
    });

    return res.status(201).json(schedule);

  } catch (err: any) {
    /* =========================
       DB-LEVEL SAFETY
    ========================= */

    if (
      err.code === 11000 ||
      err.name === "SequelizeUniqueConstraintError"
    ) {
      return res.status(409).json({
        error: "Schedule conflict detected"
      });
    }

    return res.status(500).json({
      error: err.message
    });

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
