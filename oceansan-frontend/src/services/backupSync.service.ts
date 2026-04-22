import { api } from "src/boot/axios";

export type BackupSettings = {
  documentsPath: string;
  includeSubfolders: boolean;
  schedule: string;
  syncTime: string;
  syncDayOfMonth: number;
  encryptBackup: boolean;
  hasArchivePassword: boolean;
  nextcloudUrl: string | null;
  nextcloudUsername: string | null;
  cloudRepository: string | null;
  cloudAuthenticated: boolean;
  hasCloudSyncToken: boolean;
  cloudWorkspaceConfigured: boolean;
  cloudSyncEnabled: boolean;
  lastSuccessfulSyncAt: string | null;
  nextAutomaticSyncAt: string | null;
};

export function getBackupSettings() {
  return api.get<BackupSettings>("/api/backup/settings");
}

export type SaveBackupSettingsPayload = {
  documentsPath: string;
  includeSubfolders: boolean;
  schedule: string;
  syncTime: string;
  syncDayOfMonth: number;
  encryptBackup: boolean;
  archivePassword?: string | null;
  nextcloudUrl?: string | null;
  nextcloudUsername?: string | null;
  nextcloudAppPassword?: string | null;
  cloudSyncEnabled?: boolean;
  cloudRepository?: string | null;
  cloudSyncToken?: string | null;
};

export function saveBackupSettings(payload: SaveBackupSettingsPayload) {
  return api.put<BackupSettings>("/api/backup/settings", payload);
}

export type AuthenticateCloudPayload = {
  cloudRepository?: string | null;
  cloudSyncToken?: string | null;
};

export function authenticateCloud(payload?: AuthenticateCloudPayload) {
  return api.post<{
    authenticated: boolean;
    repository: string | null;
    cloudAuthenticated: boolean;
    hasCloudSyncToken: boolean;
  }>(
    "/api/backup/auth",
    payload ?? {},
  );
}

export function runBackup() {
  return api.post("/api/backup/run");
}

export function deactivateCloudAccount() {
  return api.post<BackupSettings>("/api/backup/deactivate");
}

export type BackupRun = {
  id: number;
  status: "queued" | "running" | "completed" | "failed";
  startedAt: string | null;
  completedAt: string | null;
  message: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BackupRunPage = {
  items: BackupRun[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function getBackupRuns(page = 1, pageSize = 5) {
  return api.get<BackupRunPage>("/api/backup/runs", {
    params: {
      page,
      pageSize,
    },
  });
}
