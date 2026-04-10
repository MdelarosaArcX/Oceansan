import { AppDataSource } from "../config/typeorm.config";

const REQUIRED_COLUMNS: Array<{ name: string; type: string }> = [
  { name: "syncTime", type: "TEXT DEFAULT '02:00'" },
  { name: "syncDayOfMonth", type: "INTEGER DEFAULT 1" },
  { name: "archivePassword", type: "TEXT" },
  { name: "cloudBaseUrl", type: "TEXT" },
  { name: "cloudAuthPath", type: "TEXT" },
  { name: "cloudUploadPath", type: "TEXT" },
  { name: "cloudRepository", type: "TEXT" },
  { name: "cloudUsername", type: "TEXT" },
  { name: "cloudPassword", type: "TEXT" },
  { name: "cloudAccessToken", type: "TEXT" },
  { name: "cloudSyncToken", type: "TEXT" },
  { name: "cloudSyncValidatedAt", type: "DATETIME" },
  { name: "cloudSyncEnabled", type: "INTEGER DEFAULT 0" },
  { name: "lastSyncAttemptAt", type: "DATETIME" },
  { name: "lastSuccessfulSyncAt", type: "DATETIME" },
];

let schemaEnsured = false;

export async function ensureBackupSettingsSchema() {
  if (schemaEnsured || !AppDataSource.isInitialized) {
    return;
  }

  const queryRunner = AppDataSource.createQueryRunner();

  try {
    const rows = await queryRunner.query(`PRAGMA table_info('backup_settings')`);
    const existing = new Set(
      Array.isArray(rows)
        ? rows.map((row: { name?: string }) => row.name).filter(Boolean)
        : [],
    );

    for (const column of REQUIRED_COLUMNS) {
      if (existing.has(column.name)) {
        continue;
      }

      await queryRunner.query(
        `ALTER TABLE backup_settings ADD COLUMN ${column.name} ${column.type} NULL`,
      );
    }

    schemaEnsured = true;
  } finally {
    await queryRunner.release();
  }
}
