// controllers/scheduleLogs.controller.ts
import { Request, Response } from "express";
import { AppDataSource } from "../config/typeorm.config";
import { ScheduleLogs } from "../entities/ScheduleLogs";

const scheduleLogsRepo = AppDataSource.getRepository(ScheduleLogs);

/** READ ALL WITH PAGINATION & SORTING */
export const getScheduleLogs = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      rowsPerPage = 10,
      sortBy = 'createdAt',
      descending = 'false',
    } = req.query;

    const pageNumber = Number(page);
    const limit = Number(rowsPerPage);
    const skip = (pageNumber - 1) * limit;
    const descendingStr = String(descending);
    const order = (descendingStr.toLowerCase() === 'true') ? 'DESC' : 'ASC';

    const [data, total] = await scheduleLogsRepo.findAndCount({
      relations: ["files"],
      order: { [String(sortBy)]: order as "ASC" | "DESC" },
      skip,
      take: limit,
    });

    res.json({
      data,
      pagination: {
        page: pageNumber,
        rowsPerPage: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch schedule logs', error: error.message });
  }
};

/** READ ONE BY ID */
export const getScheduleLogsById = async (req: Request, res: Response) => {
  try {
    const log = await scheduleLogsRepo.findOne({ where: { id: Number(req.params.id) } });
    if (!log) return res.status(404).json({ message: "Not found" });

    res.json(log);
  } catch (error: any) {
    res.status(500).json({ message: "Failed to fetch log", error: error.message });
  }
};