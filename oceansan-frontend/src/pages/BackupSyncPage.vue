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
              Configure your Documents folder and connect Oceansan Cloud to enable cloud backups.
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

              <q-toggle v-model="includeSubfolders" label="Include subfolders" />

              <div class="row items-center q-gutter-sm">
                <q-btn
                  color="primary"
                  icon="play_arrow"
                  label="Run backup now"
                  :disable="!documentsPath || runningBackup"
                  :loading="runningBackup"
                  @click="runBackupNow"
                />
                <div class="text-caption text-grey-6">Runs a single backup immediately.</div>
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
                v-model="syncMode"
                :options="syncModes"
                label="Sync mode"
                outlined
                dense
              />

              <q-select
                v-model="schedule"
                :options="schedules"
                label="Sync schedule"
                outlined
                dense
              />

              <q-toggle v-model="encryptBackup" label="Encrypt backups" />
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12">
          <q-card class="section-card">
            <q-card-section class="row items-center q-gutter-sm">
              <q-icon name="cloud" color="primary" size="20px" />
              <div class="text-subtitle1 text-weight-medium">Oceansan Cloud</div>
            </q-card-section>

            <q-separator />

            <q-card-section class="q-gutter-md">
              <q-input
                v-model="nextcloudUrl"
                label="Server URL"
                outlined
                dense
                placeholder="https://cloud.example.com"
              />
              <q-input v-model="nextcloudUsername" label="Username" outlined dense />
              <q-input
                v-model="nextcloudAppPassword"
                label="App Password"
                type="password"
                outlined
                dense
              />
              <div class="text-caption text-grey-6">
                Create an App Password in Nextcloud and paste it here.
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12">
          <q-card class="section-card">
            <q-card-section class="row items-center q-gutter-sm">
              <q-icon name="tune" color="primary" size="20px" />
              <div class="text-subtitle1 text-weight-medium">Summary</div>
            </q-card-section>

            <q-separator />

            <q-card-section class="row q-col-gutter-md">
              <div class="col-12 col-md-4">
                <div class="text-caption text-grey-6">Local folder</div>
                <div class="text-body2 path-pill">{{ documentsPath || 'Not set' }}</div>
              </div>
              <div class="col-12 col-md-4">
                <div class="text-caption text-grey-6">Nextcloud</div>
                <div class="text-body2">
                  {{ nextcloudConfigured ? "Configured" : "Not configured" }}
                </div>
              </div>
              <div class="col-12 col-md-4">
                <div class="text-caption text-grey-6">Next sync</div>
                <div class="text-body2">{{ schedule }}</div>
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
import { computed, onMounted, ref } from "vue";
import { useQuasar } from "quasar";
import {
  getBackupSettings,
  saveBackupSettings,
  runBackup,
} from "src/services/backupSync.service";

const $q = useQuasar();

const documentsPath = ref("");
const includeSubfolders = ref(true);
const syncMode = ref("One-way backup");
const schedule = ref("Daily");
const encryptBackup = ref(true);
const nextcloudUrl = ref<string | null>(null);
const nextcloudUsername = ref<string | null>(null);
const nextcloudAppPassword = ref<string | null>(null);

const syncModes = ["One-way backup", "Two-way sync", "Mirror"] as const;
const schedules = ["Real-time", "Hourly", "Daily", "Weekly"] as const;

const saving = ref(false);
const runningBackup = ref(false);

const canPickFolder = computed(() => Boolean(window.oceansan?.openDirectory));
const nextcloudConfigured = computed(() => {
  return Boolean(nextcloudUrl.value && nextcloudUsername.value && nextcloudAppPassword.value);
});

async function loadSettings() {
  const { data } = await getBackupSettings();
  documentsPath.value = data.documentsPath || "";
  includeSubfolders.value = data.includeSubfolders ?? true;
  syncMode.value = data.syncMode || syncModes[0] || "One-way backup";
  schedule.value = data.schedule || schedules[2] || "Daily";
  encryptBackup.value = data.encryptBackup ?? true;
  nextcloudUrl.value = data.nextcloudUrl ?? null;
  nextcloudUsername.value = data.nextcloudUsername ?? null;
  nextcloudAppPassword.value = data.nextcloudAppPassword ?? null;
}

async function pickFolder() {
  if (!window.oceansan?.openDirectory) return;
  const path = await window.oceansan.openDirectory();
  if (path) documentsPath.value = path;
}

async function saveSettings() {
  saving.value = true;
  try {
    const { data } = await saveBackupSettings({
      documentsPath: documentsPath.value,
      includeSubfolders: includeSubfolders.value,
      syncMode: syncMode.value,
      schedule: schedule.value,
      encryptBackup: encryptBackup.value,
      nextcloudUrl: nextcloudUrl.value,
      nextcloudUsername: nextcloudUsername.value,
      nextcloudAppPassword: nextcloudAppPassword.value,
    });
    nextcloudUrl.value = data.nextcloudUrl ?? null;
    nextcloudUsername.value = data.nextcloudUsername ?? null;
    nextcloudAppPassword.value = data.nextcloudAppPassword ?? null;
    $q.notify({ type: "positive", message: "Backup settings saved." });
  } catch (err: unknown) {
    $q.notify({ type: "negative", message: getErrorMessage(err, "Failed to save settings.") });
  } finally {
    saving.value = false;
  }
}

async function runBackupNow() {
  runningBackup.value = true;
  try {
    await runBackup();
    $q.notify({ type: "positive", message: "Backup queued." });
  } catch (err: unknown) {
    $q.notify({ type: "negative", message: getErrorMessage(err, "Failed to start backup.") });
  } finally {
    runningBackup.value = false;
  }
}

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
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
</style>
