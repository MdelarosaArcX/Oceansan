// controllers/schedule.controller.ts
import { Request, Response } from "express";
import path from "path";
import { AppDataSource } from "../config/typeorm.config";
import { Schedule } from "../entities/Schedule";

const scheduleRepo = AppDataSource.getRepository(Schedule);

const VALID_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const normalizeDays = (days: number[]) => [...new Set(days)].sort((a, b) => a - b);

/** CREATE SCHEDULE */
export const createSchedule = async (req: Request, res: Response) => {
  try {
    const { sched_name, src_path, dest_path, time, days, type, engine } = req.body;

    if (!src_path || !dest_path || !time || !days || !type || !engine) {
      return res.status(400).json({ error: "src_path, dest_path, time, days, type, and engine are required" });
    }

    if (!["archive", "sync"].includes(type)) {
      return res.status(400).json({ error: "type must be either 'archive' or 'sync'" });
    }

    if (!Array.isArray(days) || !days.every(d => Number.isInteger(d))) {
      return res.status(400).json({ error: "days must be an array of integers" });
    }

    if (days.some(d => d < 0 || d > 6)) {
      return res.status(400).json({ error: "days must be between 0 (Sunday) and 6 (Saturday)" });
    }

    const normalizedDays = normalizeDays(days);
    if (!normalizedDays.length) return res.status(400).json({ error: "days must not be empty" });

    if (typeof src_path !== "string" || typeof dest_path !== "string") {
      return res.status(400).json({ error: "src_path and dest_path must be strings" });
    }

    const normalizedSrc = path.resolve(src_path);
    const normalizedDest = path.resolve(dest_path);
    if (normalizedSrc === normalizedDest) return res.status(400).json({ error: "Source and destination paths cannot be the same" });

    if (!VALID_TIME_REGEX.test(time)) {
      return res.status(400).json({ error: "Invalid time format. Expected HH:mm" });
    }

    /* =========================
       CONFLICT CHECKS
    ========================= */

    // const exactDuplicate = await scheduleRepo.findOne({
    //   where: {
    //     src_path: normalizedSrc,
    //     dest_path: normalizedDest,
    //     time,
    //     days: JSON.stringify(normalizedDays), // JSON column comparison
    //     type,
    //   },
    // });
    const exactDuplicate = await scheduleRepo
      .createQueryBuilder("schedule")
      .where("schedule.src_path = :src", { src: normalizedSrc })
      .andWhere("schedule.dest_path = :dest", { dest: normalizedDest })
      .andWhere("schedule.time = :time", { time })
      .andWhere("schedule.type = :type", { type })
      .andWhere("schedule.days = :days", { days: JSON.stringify(normalizedDays) })
      .getOne();

    if (exactDuplicate) return res.status(409).json({ error: "Exact schedule already exists" });

    const existingAtDestination = await scheduleRepo.findOne({ where: { dest_path: normalizedDest } });
    if (existingAtDestination) {
      if (existingAtDestination.type === "sync") {
        return res.status(409).json({ error: "Destination is already used by a sync schedule and cannot be reused" });
      }
      if (type === "sync" && existingAtDestination.src_path !== normalizedSrc) {
        return res.status(409).json({ error: "Destination is already used by an archive schedule from another source and cannot be synced" });
      }
    }

    const destinationConflict = await scheduleRepo
      .createQueryBuilder("schedule")
      .where("schedule.dest_path = :dest", { dest: normalizedDest })
      .andWhere("schedule.time = :time", { time })
      .andWhere("schedule.days = :days", { days: JSON.stringify(normalizedDays) })
      .getOne();

    if (destinationConflict) return res.status(409).json({ error: "Schedule conflict: destination already in use at this time on overlapping days" });

    /* =========================
       CREATE SCHEDULE
    ========================= */

    const schedule = scheduleRepo.create({
      sched_name,
      src_path: normalizedSrc,
      dest_path: normalizedDest,
      time,
      days: normalizedDays,
      type,
      engine,
      active: true,
    });

    await scheduleRepo.save(schedule);

    return res.status(201).json(schedule);

  } catch (err: any) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Schedule conflict detected" });
    }
    return res.status(500).json({ error: err.message });
  }
};

/** READ ALL SCHEDULES */
export const getSchedules = async (_req: Request, res: Response) => {
  const schedules = await scheduleRepo.find({ order: { createdAt: "DESC" } });
  res.json(schedules);
};

/** READ ONE SCHEDULE */
export const getScheduleById = async (req: Request, res: Response) => {
  const schedule = await scheduleRepo.findOne({ where: { id: Number(req.params.id) } });
  if (!schedule) return res.status(404).json({ message: "Not found" });
  res.json(schedule);
};

/** UPDATE SCHEDULE */
export const updateSchedule = async (req: Request, res: Response) => {
  const schedule = await scheduleRepo.findOne({ where: { id: Number(req.params.id) } });
  if (!schedule) return res.status(404).json({ message: "Not found" });

  scheduleRepo.merge(schedule, req.body);
  const updated = await scheduleRepo.save(schedule);
  res.json(updated);
};

/** DELETE SCHEDULE */
export const deleteSchedule = async (req: Request, res: Response) => {
  const schedule = await scheduleRepo.findOne({ where: { id: Number(req.params.id) } });
  if (!schedule) return res.status(404).json({ message: "Not found" });

  await scheduleRepo.remove(schedule);
  res.json({ message: "Deleted successfully" });
};