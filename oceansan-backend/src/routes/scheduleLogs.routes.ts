import { Router } from "express";
import {
  getScheduleLogs,
  getScheduleLogsById,

} from "../controllers/scheduleLogs.controller";

const router = Router();

router.get("/", getScheduleLogs);
router.get("/:id", getScheduleLogsById);

export default router;
