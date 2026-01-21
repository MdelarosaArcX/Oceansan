<template>
  <q-page :class="$q.dark.isActive ? 'bg-base-dark-3' : 'bg-base-light-1'">
    <div class="q-pa-lg">
      <q-card class="dashboard-card">
        <q-card-section class="row items-center q-gutter-sm">
          <q-icon name="history" color="primary" size="20px" />
          <div class="text-subtitle1 text-weight-medium">Job Logs</div>
        </q-card-section>

        <q-separator />

        <q-table
          flat
          bordered
          :rows="rows"
          :columns="columns"
          row-key="id"
          :rows-per-page-options="[5, 10]"
        >
          <template v-slot:header="props">
            <q-tr :props="props">
              <q-th auto-width></q-th>
              <q-th v-for="col in props.cols" :key="col.name" :props="props">
                {{ col.label }}
              </q-th>
            </q-tr>
          </template>
          <!-- Custom body for expandable rows -->
          <template #body="props">
            <!-- Main row -->
            <q-tr :props="props">
              <q-td auto-width>
                <q-btn
                  size="sm"
                  color="primary"
                  round
                  dense
                  @click="props.expand = !props.expand"
                  :icon="props.expand ? 'remove' : 'add'"
                />
              </q-td>

              <q-td v-for="col in props.cols" :key="col.name" :props="props">
                {{ col.value }}
              </q-td>
            </q-tr>

            <!-- Expanded row -->
            <q-tr v-show="props.expand" :props="props">
              <q-td colspan="100%" class=" q-pa-md">
                <div class="text-subtitle2 q-mb-sm">Files</div>

                <q-table
                  flat
                  dense
                  :rows="props.row.files"
                  :columns="fileColumns"
                  row-key="path"
                  hide-bottom
                >
                  <template #body-cell-status="fprops">
                    <q-td :props="fprops">
                      <q-chip dense :color="fileStatusColor(fprops.value)" text-color="white">
                        {{ fprops.value }}
                      </q-chip>
                    </q-td>
                  </template>

                  <template #body-cell-size="fprops">
                    <q-td :props="fprops">
                      {{ formatBytes(fprops.value) }}
                    </q-td>
                  </template>
                </q-table>
              </q-td>
            </q-tr>
          </template>
        </q-table>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { QTableColumn } from 'quasar';

/* -----------------------------
 Types
------------------------------*/
interface FileLog {
  path: string;
  size: number;
  status: 'copied' | 'failed' | 'pending';
}

interface JobLog {
  id: string;
  type: 'archive' | 'sync';
  source: string;
  destination: string;
  startTime: string;
  totalFiles: number;
  totalSize: number;
  files: FileLog[];
}

/* -----------------------------
 Main Table Columns
------------------------------*/
const columns: QTableColumn<JobLog>[] = [
  { name: 'type', label: 'Type', field: 'type', align: 'left' },
  { name: 'source', label: 'Source', field: 'source', align: 'left' },
  { name: 'destination', label: 'Destination', field: 'destination', align: 'left' },
  {
    name: 'startTime',
    label: 'Start Time',
    field: 'startTime',
    align: 'left',
    format: (val: string) =>
      new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(val)),
  },
  { name: 'totalFiles', label: 'Files', field: 'totalFiles', align: 'right' },
  {
    name: 'totalSize',
    label: 'Total Size',
    field: 'totalSize',
    align: 'right',
    format: (val: number) => formatBytes(val),
  },
];

/* -----------------------------
 Expanded Files Table Columns
------------------------------*/
const fileColumns: QTableColumn<FileLog>[] = [
  { name: 'path', label: 'File Path', field: 'path', align: 'left' },
  { name: 'size', label: 'Size', field: 'size', align: 'right' },
  { name: 'status', label: 'Status', field: 'status', align: 'left' },
];

/* -----------------------------
 Dummy Data
------------------------------*/
const rows = ref<JobLog[]>([
  {
    id: '1',
    type: 'archive',
    source: 'C:\\Users\\asus tuf a15\\Documents\\Project\\video\\input',
    destination: 'C:\\Users\\asus tuf a15\\Documents\\Project\\video\\output',
    startTime: '2026-01-21T04:37:00.036+00:00',
    totalFiles: 6,
    totalSize: 3088119194,
    files: [
      { path: '18 ANIMALS 5994 UHD h264.mp4', size: 1433148282, status: 'copied' },
      { path: '18 ANIMALS 5994 UHD h2642.mp4', size: 143314821, status: 'copied' },
      { path: 'example.mp4', size: 2000000, status: 'pending' },
    ],
  },
  {
    id: '2',
    type: 'sync',
    source: 'C:\\Project\\Input',
    destination: 'C:\\Project\\Output',
    startTime: '2026-01-20T10:20:00.036+00:00',
    totalFiles: 3,
    totalSize: 1024000000,
    files: [
      { path: 'file1.mp4', size: 500000000, status: 'copied' },
      { path: 'file2.mp4', size: 300000000, status: 'failed' },
      { path: 'file3.mp4', size: 200000000, status: 'pending' },
    ],
  },
]);

/* -----------------------------
 Helpers
------------------------------*/
function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function fileStatusColor(status: FileLog['status']) {
  switch (status) {
    case 'copied':
      return 'positive';
    case 'failed':
      return 'negative';
    case 'pending':
      return 'warning';
    default:
      return 'grey';
  }
}
</script>

<style scoped>
.dashboard-card {
  border-radius: 16px;
}
</style>
