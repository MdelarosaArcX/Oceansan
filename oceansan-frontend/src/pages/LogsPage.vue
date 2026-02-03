<template>
  <q-page :class="$q.dark.isActive ? 'bg-base-dark-3' : 'bg-base-light-1'">
    <div class="q-pa-lg">
      <q-card class="dashboard-card modern-card">
        <q-card-section class="row items-center q-gutter-sm">
          <q-icon name="history" color="primary" size="20px" />
          <div class="text-subtitle1 text-weight-medium">Job Logs</div>
        </q-card-section>

        <q-separator />

        <q-table
          binary-state-sort
          flat
          row-key="_id"
          :rows="rows"
          :columns="columns"
          :loading="loading"
          v-model:pagination="pagination"
          :rows-number="pagination.rowsNumber"
          :rows-per-page-options="[3, 5, 10, 20]"
          separator="horizontal"
          class="modern-table"
          @request="onRequest"
        >
          <!-- Header -->
          <template v-slot:header="props">
            <q-tr :props="props">
              <q-th auto-width />
              <q-th v-for="col in props.cols" :key="col.name" :props="props">
                {{ col.label }}
              </q-th>
            </q-tr>
          </template>

          <!-- Expandable rows -->
          <template #body="props">
            <q-tr :props="props">
              <q-td auto-width>
                <q-btn
                  dense
                  round
                  flat
                  size="sm"
                  icon="keyboard_arrow_down"
                  @click="props.expand = !props.expand"
                  :class="['expand-btn', { expanded: props.expand }]"
                />
              </q-td>

              <!-- <q-td v-for="col in props.cols" :key="col.name" :props="props">
                {{ col.value }}
              </q-td> -->
              <q-td v-for="col in props.cols" :key="col.name" :props="props">
                <template v-if="col.name === 'source' || col.name === 'destination'">
                  <div class="path-cell">
                    <q-icon name="folder" size="16px" class="q-mr-xs text-grey-6" />
                    <span class="path-text">
                      {{ shortenPath(col.value) }}
                      <q-tooltip>{{ col.value }}</q-tooltip>
                    </span>
                  </div>
                </template>

                <template v-else>
                  {{ col.value }}
                </template>
              </q-td>
            </q-tr>

            <q-tr v-show="props.expand">
              <q-td colspan="100%" class="expand-panel">
                <q-card flat bordered class="expand-card">
                  <q-table
                    dense
                    flat
                    row-key="_id"
                    :rows="props.row.files"
                    :columns="fileColumns"
                    hide-bottom
                    :pagination="{ rowsPerPage: 0 }"
                  >
                    <template #body-cell-size="fprops">
                      <q-td :props="fprops">
                        {{ formatBytes(fprops.value) }}
                      </q-td>
                    </template>

                    <template #body-cell-status="fprops">
                      <q-td :props="fprops">
                        <q-chip dense :color="fileStatusColor(fprops.value)" text-color="white">
                          {{ fprops.value }}
                        </q-chip>
                      </q-td>
                    </template>
                  </q-table>
                </q-card>
              </q-td>
            </q-tr>
          </template>
          <!-- <template #body-cell-source="props">
            <q-td :props="props">
              <span class="ellipsis">
                {{ shortenPath(props.value) }}
                <q-tooltip>{{ props.value }}</q-tooltip>
              </span>
            </q-td>
          </template>

          <template #body-cell-destination="props">
            <q-td :props="props">
              <span class="ellipsis">
                {{ shortenPath(props.value) }}
                <q-tooltip>{{ props.value }}</q-tooltip>
              </span>
            </q-td>
          </template> -->
          <!-- Loading overlay -->
          <template #loading>
            <q-inner-loading showing>
              <q-spinner color="primary" size="40px" />
            </q-inner-loading>
          </template>

          <!-- Empty state -->
          <template #no-data>
            <div class="full-width row flex-center text-grey q-pa-lg">No logs found</div>
          </template>
        </q-table>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { QTableColumn } from 'quasar';
import { fetchScheduleLogs } from 'src/services/scheduleLogs.service';

/* -------------------------
 Types
--------------------------*/
interface FileLog {
  _id: string;
  path: string;
  size: number;
  status: 'copied' | 'failed' | 'pending' | 'updated' | 'deleted';
}

interface QTableRequestPagination {
  page: number;
  rowsPerPage: number;
  sortBy?: string;
  descending?: boolean;
  rowsNumber?: number; // optional, QTable sometimes sends it
}

interface QTableRequest {
  pagination: QTableRequestPagination;
}

interface JobLog {
  _id: string;
  scheduleId: string;
  type: 'archive' | 'sync';
  source: string;
  destination: string;
  startTime: string;
  endTime?: string | null;
  totalFiles: number;
  totalSize: number;
  files: FileLog[];
}

/* -------------------------
 State
--------------------------*/
const rows = ref<JobLog[]>([]);
const loading = ref(false);

const pagination = ref({
  page: 1,
  rowsPerPage: 5,
  rowsNumber: 0, // this must come from backend total
  sortBy: 'startTime',
  descending: true,
});

/* -------------------------
 Columns (Main table)
--------------------------*/
const columns: QTableColumn<JobLog>[] = [
  {
    name: 'type',
    label: 'Type',
    field: 'type',
    align: 'left',
    sortable: true,
    format: (val) => (val ? val.charAt(0).toUpperCase() + val.slice(1) : ''),
  },
  {
    name: 'source',
    label: 'Source',
    field: 'source',
    align: 'left',
    classes: 'ellipsis',
    style: 'max-width: 260px',
  },
  {
    name: 'destination',
    label: 'Destination',
    field: 'destination',
    align: 'left',
    classes: 'ellipsis',
    style: 'max-width: 260px',
  },
  {
    name: 'startTime',
    label: 'Start Time',
    field: 'startTime',
    sortable: true,
    align: 'center',
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
  {
    name: 'endTime',
    label: 'End Time',
    field: 'endTime',
    sortable: true,
    align: 'center',
    format: (val?: string | null) => {
      if (!val) return '—'; // or 'Running', 'In progress', etc.

      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(val));
    },
  },
  { name: 'totalFiles', label: 'Files', field: 'totalFiles', align: 'center' },
  {
    name: 'totalSize',
    label: 'Total Size',
    field: 'totalSize',
    align: 'right',
    format: (val: number) => formatBytes(val),
  },
];

/* -------------------------
 Columns (Expanded files)
--------------------------*/
const fileColumns: QTableColumn<FileLog>[] = [
  { name: 'path', label: 'Files', field: 'path', align: 'left' },
  { name: 'size', label: 'Size', field: 'size', align: 'right' },
  { name: 'status', label: 'Status', field: 'status' },
];

/* -------------------------
 Server-side handler
--------------------------*/
async function onRequest({ pagination: req }: QTableRequest) {
  loading.value = true;
  try {
    const res = await fetchScheduleLogs({
      page: req.page,
      rowsPerPage: req.rowsPerPage,
      ...(req.sortBy !== undefined && { sortBy: req.sortBy }),
      ...(req.descending !== undefined && { descending: req.descending }),
    });

    rows.value = res.data.data;

    // update reactive pagination
    pagination.value.page = res.data.pagination.page;
    pagination.value.rowsPerPage = res.data.pagination.rowsPerPage;
    pagination.value.rowsNumber = res.data.pagination.total;
    pagination.value.sortBy = req.sortBy ?? pagination.value.sortBy;
    pagination.value.descending = req.descending ?? pagination.value.descending;
  } finally {
    loading.value = false;
  }
}

/* -------------------------
 Helpers
--------------------------*/
function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
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
    case 'deleted':
      return 'negative';
    case 'pending':
      return 'warning';
    case 'updated':
      return 'warning';
    default:
      return 'grey';
  }
}
function shortenPath(path: string) {
  if (!path) return '—';
  return path.split(/[\\/]/).slice(-4).join('/');
}

/* -------------------------
 Initial load
--------------------------*/
onMounted(async () => {
  await onRequest({ pagination: pagination.value });
});
</script>
<style scoped>
/* Card */
.modern-card {
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
}

/* Table */
.modern-table .q-tr {
  transition: background-color 0.2s ease;
}

.modern-table .q-tr:hover {
  background: rgba(0, 0, 0, 0.03);
}

.body--dark .modern-table .q-tr:hover {
  background: rgba(255, 255, 255, 0.05);
}

/* Expand button */
.expand-btn {
  transition: transform 0.2s ease;
}

.expand-btn.expanded {
  transform: rotate(180deg);
}

/* Path cells */
.path-cell {
  display: flex;
  align-items: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
}

.path-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}

/* Expand panel */
.expand-panel {
  background: transparent;
  padding: 12px 24px;
}

.expand-card {
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.02);
}

.body--dark .expand-card {
  background: rgba(255, 255, 255, 0.05);
}

/* Status chips (soft) */
.q-chip.positive {
  background: #21ba45;
}

.q-chip.warning {
  background: #f2c037;
}

.q-chip.negative {
  background: #c10015;
}
</style>
