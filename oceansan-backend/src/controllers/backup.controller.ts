import { Request, Response } from "express";
import { AppDataSource } from "../config/typeorm.config";
import { BackupRun } from "../entities/BackupRun";
import { BackupSettings } from "../entities/BackupSettings";

const settingsRepo = AppDataSource.getRepository(BackupSettings);
const runsRepo = AppDataSource.getRepository(BackupRun);

const DEFAULT_SETTINGS = {
  documentsPath: "",
  includeSubfolders: true,
  syncMode: "One-way backup",
  schedule: "Daily",
  encryptBackup: true,
  nextcloudUrl: null as string | null,
  nextcloudUsername: null as string | null,
  nextcloudAppPassword: null as string | null,
};

export const getBackupSettings = async (_req: Request, res: Response) => {
  const current = await settingsRepo.findOne({
    where: { id: 1 },
    order: { id: "ASC" },
  });
  if (!current) {
    return res.json(DEFAULT_SETTINGS);
  }

  return res.json({
    ...DEFAULT_SETTINGS,
    ...current,
  });
};

export const saveBackupSettings = async (req: Request, res: Response) => {
  const payload = req.body ?? {};

  if (typeof payload.documentsPath !== "string") {
    return res.status(400).json({ error: "documentsPath must be a string" });
  }

  const data = {
    documentsPath: payload.documentsPath,
    includeSubfolders: Boolean(payload.includeSubfolders),
    syncMode: String(payload.syncMode || DEFAULT_SETTINGS.syncMode),
    schedule: String(payload.schedule || DEFAULT_SETTINGS.schedule),
    encryptBackup: Boolean(payload.encryptBackup),
    nextcloudUrl:
      payload.nextcloudUrl === null || payload.nextcloudUrl === undefined
        ? null
        : String(payload.nextcloudUrl),
    nextcloudUsername:
      payload.nextcloudUsername === null || payload.nextcloudUsername === undefined
        ? null
        : String(payload.nextcloudUsername),
    nextcloudAppPassword:
      payload.nextcloudAppPassword === null || payload.nextcloudAppPassword === undefined
        ? null
        : String(payload.nextcloudAppPassword),
  };

  let current = await settingsRepo.findOne({
    where: { id: 1 },
    order: { id: "ASC" },
  });
  if (!current) {
    current = settingsRepo.create({ id: 1, ...data });
  } else {
    settingsRepo.merge(current, data);
  }

  const saved = await settingsRepo.save(current);
  return res.json(saved);
};

export const runBackup = async (_req: Request, res: Response) => {
  const run = runsRepo.create({
    status: "queued",
    startedAt: null,
    completedAt: null,
    message: "Backup queued. Processing will be wired in the next backend step.",
  });

  const saved = await runsRepo.save(run);
  return res.status(202).json(saved);
};
