import { AppDataSource } from "../config/typeorm.config";
import { BackupRun } from "../entities/BackupRun";
import { BackupSettings } from "../entities/BackupSettings";
import { ensureBackupSettingsSchema } from "./backup-settings-schema.service";
import { syncDirectoryToCloud } from "./cloud-sync.service";

export type BackupRunTrigger = "manual" | "scheduled";

function getConfiguredCloudBaseUrl() {
  return process.env.OCEANSAN_CLOUD_URL ?? process.env.CLOUD_WORKSPACE_URL ?? null;
}

export async function executeBackupSync(trigger: BackupRunTrigger) {
  await ensureBackupSettingsSchema();

  const settingsRepo = AppDataSource.getRepository(BackupSettings);
  const runsRepo = AppDataSource.getRepository(BackupRun);

  const current = await settingsRepo.findOne({
    where: { id: 1 },
    order: { id: "ASC" },
  });

  if (!current) {
    throw new Error("Save backup settings before starting sync.");
  }

  if (!current.cloudSyncEnabled) {
    throw new Error("Cloud sync is disabled for this device.");
  }

  if (!current.cloudSyncValidatedAt) {
    throw new Error("Validate the sync key before starting cloud sync.");
  }

  current.cloudBaseUrl = getConfiguredCloudBaseUrl();

  if (current.encryptBackup && !current.archivePassword) {
    throw new Error("Set an archive passphrase before enabling encrypted archiving.");
  }

  const run = runsRepo.create({
    status: "running",
    startedAt: new Date(),
    completedAt: null,
    message:
      trigger === "scheduled"
        ? "Running scheduled cloud sync."
        : "Syncing selected folder to OceanSAN Cloud.",
  });

  current.lastSyncAttemptAt = run.startedAt;
  await settingsRepo.save(current);

  const saved = await runsRepo.save(run);

  try {
    const result = await syncDirectoryToCloud(current);
    saved.status = "completed";
    saved.completedAt = new Date();
    saved.message = result.message;
    await runsRepo.save(saved);

    current.lastSuccessfulSyncAt = saved.completedAt;
    await settingsRepo.save(current);

    return saved;
  } catch (error: any) {
    saved.status = "failed";
    saved.completedAt = new Date();
    saved.message = error?.message ?? "Cloud sync failed.";
    await runsRepo.save(saved);
    throw error;
  }
}
