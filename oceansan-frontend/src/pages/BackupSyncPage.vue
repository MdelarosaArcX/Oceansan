<template>
  <q-page :class="$q.dark.isActive ? 'bg-base-dark-3' : 'bg-base-light-1'">
    <div class="q-pa-lg">
      <div class="row q-col-gutter-lg">
        <div class="col-12">
          <q-banner class="section-card info-banner" rounded>
            <template #avatar>
              <q-icon name="cloud_sync" size="26px" />
            </template>
            <div class="text-subtitle1 text-weight-medium">Backup & Sync</div>
            <div class="text-body2 q-mt-xs">
              Configure your Documents folder, sign in to OceanSAN Cloud, then sync the folder into your cloud repository.
            </div>
          </q-banner>
        </div>

        <div class="col-12 col-md-6">
          <q-card class="section-card">
            <q-card-section class="row items-center q-gutter-sm">
              <q-icon name="folder_open" color="primary" size="20px" />
              <div class="text-subtitle1 text-weight-medium">Documents Folder</div>
            </q-card-section>

            <q-separator />

            <q-card-section class="q-gutter-md">
              <q-input
                v-model="documentsPath"
                label="Documents path"
                outlined
                dense
                :hint="canPickFolder ? 'Use Browse to select a folder' : 'Type the folder path'"
              >
                <template #append>
                  <q-btn
                    flat
                    dense
                    icon="folder_open"
                    :disable="!canPickFolder"
                    @click="pickFolder"
                  />
                </template>
              </q-input>

              <q-toggle
                :model-value="true"
                label="Include subfolders"
                disable
              />

              <div class="row items-center q-gutter-sm">
                <q-btn
                  color="primary"
                  icon="play_arrow"
                  label="Start cloud sync"
                  :disable="!documentsPath || !cloudConfigured || runningBackup"
                  :loading="runningBackup"
                  @click="runBackupNow"
                />
                <div class="text-caption text-grey-6">Authenticates and uploads the selected folder with all nested subfolders to OceanSAN Cloud.</div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-md-6">
          <q-card class="section-card">
            <q-card-section class="row items-center q-gutter-sm">
              <q-icon name="cloud" color="primary" size="20px" />
              <div class="text-subtitle1 text-weight-medium">Cloud Sync</div>
            </q-card-section>

            <q-separator />

            <q-card-section class="q-gutter-md">
              <q-select
                v-model="schedule"
                :options="schedules"
                label="Automatic sync schedule"
                outlined
                dense
              />

              <q-input
                v-if="schedule === 'Daily'"
                v-model="syncTime"
                label="Time to sync"
                type="time"
                outlined
                dense
                :hint="syncTimeHint"
              />

              <div v-if="schedule === 'Monthly'" class="row q-col-gutter-sm">
                <div class="col-12 col-sm-5">
                  <q-input
                    v-model.number="syncDayOfMonth"
                    label="Date of month"
                    type="number"
                    outlined
                    dense
                    min="1"
                    max="31"
                    :hint="monthlyDayHint"
                  />
                </div>
                <div class="col-12 col-sm-7">
                  <q-input
                    v-model="syncTime"
                    label="Time to sync"
                    type="time"
                    outlined
                    dense
                    :hint="syncTimeHint"
                  />
                </div>
              </div>

              <q-toggle v-model="cloudSyncEnabled" label="Enable cloud sync" />
              <q-toggle v-model="encryptBackup" label="Upload as encrypted archive" />

              <q-input
                v-if="encryptBackup"
                v-model="archivePassword"
                :label="hasStoredArchivePassword ? 'Replace archive passphrase' : 'Archive passphrase'"
                type="password"
                outlined
                dense
                :hint="hasStoredArchivePassword
                  ? 'Leave blank to keep the saved passphrase used for scheduled encrypted archives.'
                  : 'Required for encrypted archive uploads and scheduled encrypted syncs.'"
              />

              <div class="text-caption text-grey-6">
                {{ encryptBackup
                  ? "Encryption mode compresses the selected folder into one local archive, encrypts it on this device, then uploads the encrypted file to the cloud."
                  : "Standard mode uploads files individually to the cloud repository." }}
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12">
          <q-card class="section-card">
            <q-card-section class="row items-center q-gutter-sm">
              <q-icon name="cloud" color="primary" size="20px" />
              <div class="text-subtitle1 text-weight-medium">Oceansan Cloud</div>
              <q-chip
                dense
                :color="cloudAuthenticated ? 'positive' : 'grey-5'"
                text-color="white"
                :icon="cloudAuthenticated ? 'verified' : 'cloud_off'"
              >
                {{ cloudAuthenticated ? "Authenticated" : "Not authenticated" }}
              </q-chip>
            </q-card-section>

            <q-separator />

            <q-card-section class="q-gutter-md">
              <q-input
                v-model="cloudRepository"
                label="Repository ID"
                outlined
                dense
                placeholder="oceansan-cloud"
              />
              <q-input
                v-model="cloudSyncToken"
                :label="hasStoredCloudSyncToken ? 'Replace sync key' : 'Sync key'"
                outlined
                dense
                :hint="hasStoredCloudSyncToken ? 'Leave blank to keep the saved sync key on this device.' : 'Generate this in the OceanSAN Cloud web app and paste it once here.'"
              >
                <!-- <template #append>
                  <q-btn
                    flat
                    dense
                    round
                    :icon="showCloudSyncToken ? 'visibility_off' : 'visibility'"
                    @click="showCloudSyncToken = !showCloudSyncToken"
                  />
                </template> -->
              </q-input>
              <div class="row items-center q-gutter-sm">
                <q-btn
                  color="secondary"
                  icon="verified_user"
                  :label="cloudAuthenticated ? 'Re-validate sync key' : 'Validate sync key'"
                  :loading="authenticatingCloud"
                  :disable="!cloudConfigured || authenticatingCloud"
                  @click="authenticateCloudNow"
                />
                <div class="text-caption text-grey-6">
                  {{ cloudAuthenticated
                    ? "Sync key validated successfully. This device can connect to your cloud repository."
                    : "The desktop app stores only the sync key, never your cloud account password." }}
                </div>
              </div>
              <div class="row items-center q-gutter-sm">
                <q-btn
                  flat
                  color="negative"
                  icon="link_off"
                  label="Deactivate cloud account"
                  @click="deactivateCloudNow"
                />
                <div class="text-caption text-grey-6">
                  Removes the saved repository and sync key from this device.
                </div>
              </div>
              <div class="text-caption text-grey-6">
                {{ cloudWorkspaceConfigured
                  ? "The cloud workspace URL is managed from backend environment settings."
                  : "Cloud workspace URL is not configured on the backend yet." }}
              </div>
              <div class="text-caption text-grey-6">
                {{ cloudAuthenticated
                  ? "A sync key is already saved on this device for cloud sync."
                  : hasStoredCloudSyncToken
                    ? "A saved sync key is available. Validate it any time before syncing."
                    : "Generate a sync key in OceanSAN Cloud, then save it here to enable syncing." }}
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12">
          <q-card class="section-card">
            <q-card-section class="row items-center q-gutter-sm">
              <q-icon name="history" color="primary" size="20px" />
              <div class="text-subtitle1 text-weight-medium">Sync Logs</div>
            </q-card-section>

            <q-separator />

            <q-card-section class="q-gutter-md">
              <div class="row q-col-gutter-md">
                <div class="col-12 col-md-4">
                  <div class="text-caption text-grey-6">Next automatic sync</div>
                  <div class="text-body2">{{ nextAutomaticSyncLabel }}</div>
                </div>
                <div class="col-12 col-md-4">
                  <div class="text-caption text-grey-6">Last successful sync</div>
                  <div class="text-body2">{{ lastSuccessfulSyncLabel }}</div>
                </div>
                <div class="col-12 col-md-4">
                  <div class="text-caption text-grey-6">Local folder</div>
                  <div class="text-body2 path-pill">{{ documentsPath || 'Not set' }}</div>
                </div>
              </div>

              <div class="text-subtitle2 text-weight-medium q-mt-sm">
                Previous Run History
              </div>

              <div class="logs-table-wrap">
                <q-markup-table
                  flat
                  bordered
                  separator="horizontal"
                  class="logs-table"
                >
                  <thead>
                    <tr>
                      <th class="text-left">Status</th>
                      <th class="text-left">Started</th>
                      <th class="text-left">Finished</th>
                      <th class="text-left">Message</th>
                    </tr>
                  </thead>
                  <tbody v-if="backupRuns.length">
                    <tr v-for="run in backupRuns" :key="run.id">
                      <td class="text-left">
                        <div class="row items-center q-gutter-xs no-wrap">
                          <q-icon
                            :name="statusIcon(run.status)"
                            :color="statusColor(run.status)"
                            size="18px"
                          />
                          <span>{{ statusLabel(run.status) }}</span>
                        </div>
                      </td>
                      <td class="text-left">{{ formatRunDate(run.startedAt || run.createdAt) }}</td>
                      <td class="text-left">
                        {{ run.completedAt ? formatRunDate(run.completedAt) : "Still running" }}
                      </td>
                      <td class="text-left message-cell">
                        {{ run.message || "No message recorded." }}
                      </td>
                    </tr>
                  </tbody>
                  <tbody v-else>
                    <tr>
                      <td colspan="4" class="text-center text-grey-6 empty-history-cell">
                        No sync runs yet. Your next manual or automatic sync will appear here.
                      </td>
                    </tr>
                  </tbody>
                </q-markup-table>
              </div>

              <div class="row items-center justify-between q-gutter-sm">
                <div class="text-caption text-grey-6">
                  Showing {{ paginationLabel }}
                </div>
                <q-pagination
                  v-model="backupRunsPage"
                  :max="backupRunsTotalPages"
                  :max-pages="5"
                  direction-links
                  boundary-links
                  color="primary"
                  @update:model-value="handleBackupRunsPageChange"
                />
              </div>
            </q-card-section>

            <q-separator />

            <q-card-section class="row items-center q-gutter-sm">
              <q-btn
                color="primary"
                icon="save"
                label="Save settings"
                :loading="saving"
                :disable="saving"
                @click="saveSettings"
              />
              <div class="text-caption text-grey-6">
                Saved settings are used for scheduled backups.
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import axios from "axios";
import { computed, onMounted, ref } from "vue";
import { useQuasar } from "quasar";
import {
  authenticateCloud,
  deactivateCloudAccount,
  getBackupRuns,
  getBackupSettings,
  saveBackupSettings,
  type BackupRun,
  runBackup,
} from "src/services/backupSync.service";

const $q = useQuasar();

const documentsPath = ref("");
const includeSubfolders = ref(true);
const schedule = ref("Daily");
const syncTime = ref("02:00");
const syncDayOfMonth = ref(1);
const encryptBackup = ref(true);
const archivePassword = ref("");
const hasStoredArchivePassword = ref(false);
const nextcloudUrl = ref<string | null>(null);
const nextcloudUsername = ref<string | null>(null);
const cloudRepository = ref<string | null>(null);
const cloudSyncToken = ref("");
const hasStoredCloudSyncToken = ref(false);
const cloudAuthenticated = ref(false);
const cloudWorkspaceConfigured = ref(false);
const cloudSyncEnabled = ref(false);
const lastSuccessfulSyncAt = ref<string | null>(null);
const nextAutomaticSyncAt = ref<string | null>(null);
const backupRuns = ref<BackupRun[]>([]);
const backupRunsPage = ref(1);
const backupRunsPageSize = 5;
const backupRunsTotal = ref(0);
const backupRunsTotalPages = ref(1);

const schedules = ["Hourly", "Daily", "Monthly"] as const;

const saving = ref(false);
const runningBackup = ref(false);
const authenticatingCloud = ref(false);

const canPickFolder = computed(() => Boolean(window.oceansan?.openDirectory));
const syncTimeHint = computed(() => {
  if (schedule.value === "Monthly") {
    return `Runs every month at ${syncTime.value}.`;
  }

  return `Runs every day at ${syncTime.value}.`;
});

const monthlyDayHint = computed(() => {
  return "Choose a date from 1 to 31. Shorter months use the last available day.";
});

const cloudConfigured = computed(() => {
  return Boolean(
    cloudWorkspaceConfigured.value &&
      cloudSyncEnabled.value &&
      cloudRepository.value &&
      (cloudSyncToken.value || hasStoredCloudSyncToken.value),
  );
});

const nextAutomaticSyncLabel = computed(() => {
  if (!cloudSyncEnabled.value) return "Disabled";
  if (!nextAutomaticSyncAt.value) {
    if (schedule.value === "Hourly") {
      return "Every hour";
    }

    if (schedule.value === "Monthly") {
      return `Day ${syncDayOfMonth.value} at ${syncTime.value}`;
    }

    return `Daily at ${syncTime.value}`;
  }
  return formatDateTime(nextAutomaticSyncAt.value);
});

const lastSuccessfulSyncLabel = computed(() => {
  return lastSuccessfulSyncAt.value
    ? formatDateTime(lastSuccessfulSyncAt.value)
    : "No completed sync yet";
});

const paginationLabel = computed(() => {
  if (!backupRunsTotal.value || !backupRuns.value.length) {
    return "0 runs";
  }

  const start = (backupRunsPage.value - 1) * backupRunsPageSize + 1;
  const end = start + backupRuns.value.length - 1;
  return `${start}-${end} of ${backupRunsTotal.value} runs`;
});

async function loadSettings() {
  const { data } = await getBackupSettings();
  includeSubfolders.value = true;
  applySettingsResponse(data);
  await loadBackupRuns();
}

async function pickFolder() {
  if (!window.oceansan?.openDirectory) return;
  const path = await window.oceansan.openDirectory();
  if (path) documentsPath.value = path;
}

function buildSettingsPayload() {
  return {
    documentsPath: documentsPath.value,
    includeSubfolders: true,
    schedule: schedule.value,
    syncTime: syncTime.value,
    syncDayOfMonth: syncDayOfMonth.value,
    encryptBackup: encryptBackup.value,
    ...(archivePassword.value ? { archivePassword: archivePassword.value } : {}),
    cloudSyncEnabled: cloudSyncEnabled.value,
    nextcloudUrl: nextcloudUrl.value,
    nextcloudUsername: nextcloudUsername.value,
    cloudRepository: cloudRepository.value,
    ...(cloudSyncToken.value ? { cloudSyncToken: cloudSyncToken.value } : {}),
  };
}

function applySettingsResponse(data: Awaited<ReturnType<typeof getBackupSettings>>["data"]) {
  documentsPath.value = data.documentsPath || "";
  schedule.value = data.schedule || schedules[1] || "Daily";
  syncTime.value = data.syncTime || "02:00";
  syncDayOfMonth.value = data.syncDayOfMonth || 1;
  encryptBackup.value = data.encryptBackup ?? true;
  archivePassword.value = "";
  hasStoredArchivePassword.value = data.hasArchivePassword ?? false;
  nextcloudUrl.value = data.nextcloudUrl ?? null;
  nextcloudUsername.value = data.nextcloudUsername ?? null;
  cloudRepository.value = data.cloudRepository ?? null;
  cloudSyncToken.value = "";
  hasStoredCloudSyncToken.value = data.hasCloudSyncToken ?? false;
  cloudAuthenticated.value = data.cloudAuthenticated ?? false;
  cloudWorkspaceConfigured.value = data.cloudWorkspaceConfigured ?? false;
  cloudSyncEnabled.value = data.cloudSyncEnabled ?? false;
  lastSuccessfulSyncAt.value = data.lastSuccessfulSyncAt ?? null;
  nextAutomaticSyncAt.value = data.nextAutomaticSyncAt ?? null;
}

async function persistSettings(showSuccess = true) {
  const { data } = await saveBackupSettings(buildSettingsPayload());
  applySettingsResponse(data);
  if (showSuccess) {
    $q.notify({ type: "positive", message: "Backup settings saved." });
  }
}

async function loadBackupRuns() {
  const { data } = await getBackupRuns(backupRunsPage.value, backupRunsPageSize);
  backupRuns.value = data.items;
  backupRunsTotal.value = data.total;
  backupRunsTotalPages.value = data.totalPages;
  if (backupRunsPage.value > data.totalPages) {
    backupRunsPage.value = data.totalPages;
    if (data.totalPages > 0) {
      await loadBackupRuns();
    }
  }
}

async function handleBackupRunsPageChange() {
  await loadBackupRuns();
}

async function saveSettings() {
  saving.value = true;
  try {
    await persistSettings(true);
  } catch (err: unknown) {
    $q.notify({ type: "negative", message: getErrorMessage(err, "Failed to save settings.") });
  } finally {
    saving.value = false;
  }
}

async function authenticateCloudNow() {
  authenticatingCloud.value = true;
  try {
    if (!cloudSyncEnabled.value) {
      throw new Error("Enable cloud sync before validating the sync key.");
    }
    await persistSettings(false);
    const { data } = await authenticateCloud({
      cloudRepository: cloudRepository.value,
      ...(cloudSyncToken.value ? { cloudSyncToken: cloudSyncToken.value } : {}),
    });
    cloudAuthenticated.value = data.cloudAuthenticated;
    hasStoredCloudSyncToken.value = data.hasCloudSyncToken;
    cloudSyncToken.value = "";
    $q.notify({
      type: "positive",
      message: data.authenticated
        ? `Sync key validated for ${data.repository || "repository"}.`
        : "Sync key validation failed.",
    });
  } catch (err: unknown) {
    $q.notify({
      type: "negative",
      message: getErrorMessage(err, "Failed to validate the OceanSAN Cloud sync key."),
    });
  } finally {
    authenticatingCloud.value = false;
  }
}

async function deactivateCloudNow() {
  try {
    const { data } = await deactivateCloudAccount();
    applySettingsResponse(data);
    await loadBackupRuns();
    $q.notify({ type: "positive", message: "Cloud account deactivated on this device." });
  } catch (err: unknown) {
    $q.notify({
      type: "negative",
      message: getErrorMessage(err, "Failed to deactivate the cloud account."),
    });
  }
}

async function runBackupNow() {
  runningBackup.value = true;
  try {
    await persistSettings(false);
    if (!cloudAuthenticated.value) {
      const { data } = await authenticateCloud({
        cloudRepository: cloudRepository.value,
        ...(cloudSyncToken.value ? { cloudSyncToken: cloudSyncToken.value } : {}),
      });
      cloudAuthenticated.value = data.cloudAuthenticated;
      hasStoredCloudSyncToken.value = data.hasCloudSyncToken;
      cloudSyncToken.value = "";
    }
    await runBackup();
    backupRunsPage.value = 1;
    await loadBackupRuns();
    $q.notify({ type: "positive", message: "Cloud sync completed." });
  } catch (err: unknown) {
    $q.notify({ type: "negative", message: getErrorMessage(err, "Failed to start cloud sync.") });
  } finally {
    runningBackup.value = false;
  }
}

function getErrorMessage(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    const apiMessage =
      (err.response?.data as { error?: string; message?: string } | undefined)?.error ||
      (err.response?.data as { error?: string; message?: string } | undefined)?.message;
    if (apiMessage) return apiMessage;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatRunDate(value: string) {
  return formatDateTime(value);
}

function statusIcon(status: BackupRun["status"]) {
  if (status === "completed") return "check_circle";
  if (status === "failed") return "error";
  if (status === "running") return "sync";
  return "schedule";
}

function statusColor(status: BackupRun["status"]) {
  if (status === "completed") return "positive";
  if (status === "failed") return "negative";
  if (status === "running") return "primary";
  return "grey-6";
}

function statusLabel(status: BackupRun["status"]) {
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "running") return "Running";
  return "Queued";
}

onMounted(async () => {
  await loadSettings();
});
</script>

<style scoped>
.section-card {
  border-radius: 16px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.06);
}

.info-banner {
  background: rgba(0, 0, 0, 0.02);
}

.body--dark .info-banner {
  background: rgba(255, 255, 255, 0.06);
}

.path-pill {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 10px;
  padding: 6px 10px;
  display: inline-block;
  word-break: break-all;
}

.body--dark .path-pill {
  background: rgba(255, 255, 255, 0.08);
}

.logs-table :deep(th) {
  font-size: 12px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.6);
}

.body--dark .logs-table :deep(th) {
  color: rgba(255, 255, 255, 0.7);
}

.logs-table :deep(td) {
  vertical-align: top;
}

.logs-table-wrap {
  overflow-x: auto;
}

.message-cell {
  max-width: 420px;
  white-space: normal;
  word-break: break-word;
}

.empty-history-cell {
  padding: 24px 16px;
}
</style>
