import axios from "axios";
const API_URL = "http://localhost:3000";

export type BackupSettings = {
  documentsPath: string;
  includeSubfolders: boolean;
  syncMode: string;
  schedule: string;
  encryptBackup: boolean;
  nextcloudUrl: string | null;
  nextcloudUsername: string | null;
  nextcloudAppPassword: string | null;
};

export function getBackupSettings() {
  return axios.get<BackupSettings>(`${API_URL}/api/backup/settings`);
}

export function saveBackupSettings(payload: BackupSettings) {
  return axios.put<BackupSettings>(`${API_URL}/api/backup/settings`, payload);
}

export function runBackup() {
  return axios.post(`${API_URL}/api/backup/run`);
}
