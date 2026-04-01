import { Router } from "express";
import {
  getBackupSettings,
  saveBackupSettings,
  runBackup,
} from "../controllers/backup.controller";

const router = Router();

router.get("/settings", getBackupSettings);
router.put("/settings", saveBackupSettings);
router.post("/run", runBackup);

export default router;
