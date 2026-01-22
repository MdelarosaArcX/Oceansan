import { Request, Response } from "express";
import ScheduleLogs from "../models/ScheduleLogs";


/** READ ALL */
export const getScheduleLogs = async (req: Request, res: Response) => {
    try {
        const {
            page = 1,
            rowsPerPage = 10,
            sortBy = 'createdAt',
            descending = false,
        } = req.query;

        const pageNumber = Number(page);
        const limit = Number(rowsPerPage);
        const skip = (pageNumber - 1) * limit;

        const sortOrder = descending === 'true' || Boolean(descending) === true ? -1 : 1;

        const [data, total] = await Promise.all([
            ScheduleLogs.find()
                .sort({ [String(sortBy)]: sortOrder })
                .skip(skip)
                .limit(limit),
            ScheduleLogs.countDocuments(),
        ]);

        res.json({
            data,
            pagination: {
                page: pageNumber,
                rowsPerPage: limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch schedules', error });
    }
};

/** READ ONE */
export const getScheduleLogsById = async (req: Request, res: Response) => {
    const Logs = await ScheduleLogs.findById(req.params.id);
    if (!Logs) return res.status(404).json({ message: "Not found" });
    res.json(Logs);
};

