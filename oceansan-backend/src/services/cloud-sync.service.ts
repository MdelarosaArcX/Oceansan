import fs from "fs";
import os from "os";
import path from "path";
import { BackupSettings } from "../entities/BackupSettings";
import { walkDir } from "../utils/fileWalker";
import {
  cleanupArchiveUpload,
  createEncryptedArchiveForUpload,
} from "./backup-archive.service";

type SyncResult = {
  totalFiles: number;
  uploadedFiles: number;
  skippedFiles: number;
  repository: string;
  message: string;
};

type CloudFileEntry = {
  path?: string;
  type?: "file" | "folder";
};

function joinUrl(baseUrl: string, endpointPath: string) {
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const trimmedPath = endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`;
  return `${trimmedBase}${trimmedPath}`;
}

function normalizeRelativePath(value: string) {
  return value.split(path.sep).join("/").replace(/^\/+/, "");
}

function getDeviceInfo() {
  const hostname = os.hostname();
  const username = process.env.USERNAME || process.env.USER || "user";

  return {
    deviceId: `${hostname}-${username}`.toLowerCase(),
    deviceName: hostname,
    platform: `${os.platform()}-${os.arch()}`,
  };
}

function getSyncHeaders(settings: BackupSettings) {
  if (!settings.cloudSyncToken) {
    throw new Error("OceanSAN Cloud sync key is required.");
  }

  const deviceInfo = getDeviceInfo();

  return {
    Authorization: `Bearer ${settings.cloudSyncToken}`,
    "X-Sync-Repository": settings.cloudRepository!,
    "X-Sync-Device-Id": deviceInfo.deviceId,
    "X-Sync-Device-Name": deviceInfo.deviceName,
    "X-Sync-Platform": deviceInfo.platform,
  };
}

function assertCloudSettings(settings: BackupSettings) {
  if (!settings.documentsPath) {
    throw new Error("Documents path is required before starting cloud sync.");
  }

  if (!settings.cloudBaseUrl) {
    throw new Error("OceanSAN Cloud base URL is required.");
  }

  if (!settings.cloudRepository) {
    throw new Error("OceanSAN Cloud repository is required.");
  }

  if (!settings.cloudSyncToken) {
    throw new Error("OceanSAN Cloud sync key is required.");
  }

  if (!fs.existsSync(settings.documentsPath)) {
    throw new Error(`Documents path does not exist: ${settings.documentsPath}`);
  }
}

export async function validateCloudSyncKey(settings: BackupSettings) {
  assertCloudSettings(settings);

  const response = await fetch(joinUrl(settings.cloudBaseUrl!, "/api/files?repositoryId=" + encodeURIComponent(settings.cloudRepository!)), {
    method: "GET",
    headers: getSyncHeaders(settings),
  });

  const payload = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(
      `Cloud sync key validation failed (${response.status}): ${payload || "Unknown error"}`,
    );
  }

  return true;
}

export async function syncDirectoryToCloud(
  settings: BackupSettings,
): Promise<SyncResult> {
  assertCloudSettings(settings);

  if (settings.encryptBackup) {
    return syncEncryptedArchiveToCloud(settings);
  }

  const baseUrl = settings.cloudBaseUrl!;
  const repository = settings.cloudRepository!;
  const documentsPath = path.resolve(settings.documentsPath);
  const files = walkDir(documentsPath);
  const headers = getSyncHeaders(settings);

  let uploadedFiles = 0;
  let skippedFiles = 0;

  const listResponse = await fetch(
    joinUrl(baseUrl, `/api/files?repositoryId=${encodeURIComponent(repository)}`),
    {
      method: "GET",
      headers,
    },
  );

  if (!listResponse.ok) {
    const payload = await listResponse.text().catch(() => "");
    throw new Error(
      `Failed to load existing cloud files (${listResponse.status}): ${payload || "Unknown error"}`,
    );
  }

  const existingPayload = (await listResponse.json().catch(() => ({ files: [] }))) as {
    files?: CloudFileEntry[];
  };
  const existingFilePaths = new Set(
    (existingPayload.files ?? [])
      .filter((entry) => entry.type === "file" && typeof entry.path === "string")
      .map((entry) => normalizeRelativePath(entry.path!)),
  );

  for (const file of files) {
    const relativePath = normalizeRelativePath(path.relative(documentsPath, file.path));

    if (existingFilePaths.has(relativePath)) {
      skippedFiles += 1;
      continue;
    }

    const content = await fs.promises.readFile(file.path);
    const formData = new FormData();

    formData.append("repositoryId", repository);
    formData.append("paths", relativePath);
    formData.append("syncMode", settings.syncMode);
    formData.append("encryptBackup", String(settings.encryptBackup));
    formData.append("file", new Blob([content]), path.basename(file.path));

    const response = await fetch(joinUrl(baseUrl, "/api/files/upload"), {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const payload = await response.text().catch(() => "");
      throw new Error(
        `Failed to upload ${relativePath} to OceanSAN Cloud (${response.status}): ${payload || "Unknown error"}`,
      );
    }

    uploadedFiles += 1;
    existingFilePaths.add(relativePath);
  }

  return {
    totalFiles: files.length,
    uploadedFiles,
    skippedFiles,
    repository,
    message: `Uploaded ${uploadedFiles} file(s) to repository ${repository}. Skipped ${skippedFiles} existing file(s).`,
  };
}

async function syncEncryptedArchiveToCloud(
  settings: BackupSettings,
): Promise<SyncResult> {
  const baseUrl = settings.cloudBaseUrl!;
  const repository = settings.cloudRepository!;
  const headers = getSyncHeaders(settings);
  const documentsPath = path.resolve(settings.documentsPath);

  if (!settings.archivePassword) {
    throw new Error("Archive passphrase is required for encrypted archiving.");
  }

  const archive = await createEncryptedArchiveForUpload(
    documentsPath,
    settings.archivePassword,
  );

  try {
    const content = await fs.promises.readFile(archive.filePath);
    const formData = new FormData();

    formData.append("repositoryId", repository);
    formData.append("paths", archive.cloudPath);
    formData.append("syncMode", settings.syncMode);
    formData.append("encryptBackup", "true");
    formData.append("file", new Blob([content]), archive.fileName);

    const response = await fetch(joinUrl(baseUrl, "/api/files/upload"), {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const payload = await response.text().catch(() => "");
      throw new Error(
        `Failed to upload encrypted archive to OceanSAN Cloud (${response.status}): ${payload || "Unknown error"}`,
      );
    }

    return {
      totalFiles: 1,
      uploadedFiles: 1,
      skippedFiles: 0,
      repository,
      message: `Uploaded encrypted archive ${archive.fileName} to repository ${repository}.`,
    };
  } finally {
    await cleanupArchiveUpload(archive.tempDir);
  }
}
