import { Router } from "express";
import {
  authenticateBackupCloud,
  deactivateBackupCloud,
  getBackupSettings,
  listBackupRuns,
  saveBackupSettings,
  runBackup,
} from "../controllers/backup.controller";

const router = Router();

router.get("/settings", getBackupSettings);
router.get("/runs", listBackupRuns);
router.put("/settings", saveBackupSettings);
router.post("/auth", authenticateBackupCloud);
router.post("/deactivate", deactivateBackupCloud);
router.post("/run", runBackup);

export default router;
