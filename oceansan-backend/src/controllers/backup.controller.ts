import { Request, Response } from "express";
import { AppDataSource } from "../config/typeorm.config";
import { BackupRun } from "../entities/BackupRun";
import { BackupSettings } from "../entities/BackupSettings";
import { executeBackupSync } from "../services/backup-runner.service";
import {
  computeNextAutomaticSyncAt,
  isSupportedBackupSchedule,
} from "../services/backup-schedule.service";
import { ensureBackupSettingsSchema } from "../services/backup-settings-schema.service";
import {
  validateCloudSyncKey,
} from "../services/cloud-sync.service";

const settingsRepo = AppDataSource.getRepository(BackupSettings);
const runsRepo = AppDataSource.getRepository(BackupRun);

function getConfiguredCloudBaseUrl() {
  return process.env.OCEANSAN_CLOUD_URL ?? process.env.CLOUD_WORKSPACE_URL ?? null;
}

const DEFAULT_SETTINGS = {
  documentsPath: "",
  includeSubfolders: true,
  syncMode: "One-way backup",
  schedule: "Daily",
  syncTime: "02:00",
  syncDayOfMonth: 1,
  encryptBackup: true,
  archivePassword: null as string | null,
  nextcloudUrl: null as string | null,
  nextcloudUsername: null as string | null,
  nextcloudAppPassword: null as string | null,
  cloudBaseUrl: getConfiguredCloudBaseUrl(),
  cloudRepository: null as string | null,
  cloudUsername: null as string | null,
  cloudPassword: null as string | null,
  cloudAccessToken: null as string | null,
  cloudSyncToken: null as string | null,
  cloudSyncValidatedAt: null as Date | null,
  cloudSyncEnabled: false,
};

function serializeBackupSettings(settings?: Partial<BackupSettings> | null) {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(settings ?? {}),
    cloudBaseUrl: getConfiguredCloudBaseUrl(),
  };

  return {
    documentsPath: merged.documentsPath,
    includeSubfolders: merged.includeSubfolders,
    schedule: merged.schedule,
    syncTime: merged.syncTime,
    syncDayOfMonth: merged.syncDayOfMonth,
    encryptBackup: merged.encryptBackup,
    hasArchivePassword: Boolean(merged.archivePassword),
    nextcloudUrl: merged.nextcloudUrl,
    nextcloudUsername: merged.nextcloudUsername,
    cloudRepository: merged.cloudRepository,
    cloudAuthenticated: Boolean(merged.cloudSyncValidatedAt),
    hasCloudSyncToken: Boolean(merged.cloudSyncToken),
    cloudWorkspaceConfigured: Boolean(merged.cloudBaseUrl),
    cloudSyncEnabled: Boolean(merged.cloudSyncEnabled),
    lastSuccessfulSyncAt: merged.lastSuccessfulSyncAt,
    nextAutomaticSyncAt: computeNextAutomaticSyncAt(merged),
  };
}

export const getBackupSettings = async (_req: Request, res: Response) => {
  await ensureBackupSettingsSchema();

  const current = await settingsRepo.findOne({
    where: { id: 1 },
    order: { id: "ASC" },
  });
  if (!current) {
    return res.json(serializeBackupSettings());
  }

  return res.json(serializeBackupSettings(current));
};

export const saveBackupSettings = async (req: Request, res: Response) => {
  await ensureBackupSettingsSchema();

  const payload = req.body ?? {};

  if (typeof payload.documentsPath !== "string") {
    return res.status(400).json({ error: "documentsPath must be a string" });
  }

  const schedule =
    typeof payload.schedule === "string" ? payload.schedule : DEFAULT_SETTINGS.schedule;

  if (!isSupportedBackupSchedule(schedule)) {
    return res.status(400).json({ error: "schedule must be Hourly, Daily, or Monthly" });
  }

  const syncTime =
    typeof payload.syncTime === "string" ? payload.syncTime : DEFAULT_SETTINGS.syncTime;

  if (schedule !== "Hourly" && !/^\d{2}:\d{2}$/.test(syncTime)) {
    return res.status(400).json({ error: "syncTime must be in HH:mm format" });
  }

  const rawSyncDayOfMonth =
    payload.syncDayOfMonth === undefined || payload.syncDayOfMonth === null
      ? DEFAULT_SETTINGS.syncDayOfMonth
      : Number(payload.syncDayOfMonth);

  if (
    schedule === "Monthly" &&
    (!Number.isInteger(rawSyncDayOfMonth) || rawSyncDayOfMonth < 1 || rawSyncDayOfMonth > 31)
  ) {
    return res
      .status(400)
      .json({ error: "syncDayOfMonth must be an integer between 1 and 31" });
  }

  const data = {
    documentsPath: payload.documentsPath,
    includeSubfolders: Boolean(payload.includeSubfolders),
    syncMode: String(payload.syncMode || DEFAULT_SETTINGS.syncMode),
    schedule,
    syncTime: schedule === "Hourly" ? DEFAULT_SETTINGS.syncTime : syncTime,
    syncDayOfMonth:
      schedule === "Monthly" ? rawSyncDayOfMonth : DEFAULT_SETTINGS.syncDayOfMonth,
    encryptBackup: Boolean(payload.encryptBackup),
    cloudBaseUrl: getConfiguredCloudBaseUrl(),
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
    cloudSyncEnabled: Boolean(payload.cloudSyncEnabled),
    cloudRepository:
      payload.cloudRepository === null || payload.cloudRepository === undefined
        ? null
        : String(payload.cloudRepository),
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

  if (payload.cloudSyncToken !== undefined) {
    current.cloudSyncToken =
      payload.cloudSyncToken === null || payload.cloudSyncToken === ""
        ? null
        : String(payload.cloudSyncToken);
    current.cloudSyncValidatedAt = null;
  }

  if (payload.archivePassword !== undefined) {
    current.archivePassword =
      payload.archivePassword === null || payload.archivePassword === ""
        ? null
        : String(payload.archivePassword);
  }

  const saved = await settingsRepo.save(current);
  return res.json(serializeBackupSettings(saved));
};

export const authenticateBackupCloud = async (req: Request, res: Response) => {
  await ensureBackupSettingsSchema();

  const current = await settingsRepo.findOne({
    where: { id: 1 },
    order: { id: "ASC" },
  });

  if (!current) {
    return res.status(400).json({ error: "Save backup settings before authenticating." });
  }

  try {
    const overrides = req.body ?? {};
    const authSettings = settingsRepo.merge(current, {
      ...overrides,
      cloudBaseUrl: getConfiguredCloudBaseUrl(),
    });
    if (overrides.cloudSyncToken !== undefined) {
      current.cloudSyncToken =
        overrides.cloudSyncToken === null || overrides.cloudSyncToken === ""
          ? null
          : String(overrides.cloudSyncToken);
    }

    await validateCloudSyncKey(authSettings);
    current.cloudSyncValidatedAt = new Date();
    await settingsRepo.save(current);

    return res.json({
      authenticated: true,
      repository: current.cloudRepository,
      cloudAuthenticated: true,
      hasCloudSyncToken: Boolean(current.cloudSyncToken),
      cloudSyncEnabled: Boolean(current.cloudSyncEnabled),
    });
  } catch (error: any) {
    return res.status(400).json({
      authenticated: false,
      error: error?.message ?? "Cloud authentication failed.",
    });
  }
};

export const deactivateBackupCloud = async (_req: Request, res: Response) => {
  await ensureBackupSettingsSchema();

  const current = await settingsRepo.findOne({
    where: { id: 1 },
    order: { id: "ASC" },
  });

  if (!current) {
    return res.json(serializeBackupSettings());
  }

  current.cloudRepository = null;
  current.cloudSyncToken = null;
  current.cloudSyncValidatedAt = null;
  current.cloudSyncEnabled = false;

  const saved = await settingsRepo.save(current);
  return res.json(serializeBackupSettings(saved));
};

export const runBackup = async (_req: Request, res: Response) => {
  try {
    const run = await executeBackupSync("manual");
    return res.status(202).json(run);
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message ?? "Cloud sync failed.",
    });
  }
};

export const listBackupRuns = async (req: Request, res: Response) => {
  await ensureBackupSettingsSchema();

  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 5));

  const [runs, total] = await runsRepo.findAndCount({
    order: {
      createdAt: "DESC",
      id: "DESC",
    },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return res.json({
    items: runs.map((run) => ({
      id: run.id,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      message: run.message,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
};
