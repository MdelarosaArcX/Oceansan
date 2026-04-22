<template>
  <q-card class="dashboard-card modern-card">
    <q-table
      flat
      class="modern-table"
      :card-class="$q.dark.isActive ? 'bg-base-dark-4' : 'bg-base-light-2'"
      :rows="props.rows"
      :columns="columns"
      row-key="id"
      separator="horizontal"
      :table-row-class-fn="() => $q.dark.isActive ? 'bg-base-dark-6' : 'bg-base-light-4'"
      :rows-per-page-options="[5, 10, 20]"
    >
      <template v-slot:header="props">
        <q-tr :props="props" >
          <q-th
            v-for="col in props.cols"
            :key="col.name"
            :props="props"
            class="text-uppercase"
            :class="'text-uppercase fw-light' + $q.dark.isActive ? 'bg-base-dark-4' : 'text-base-dark-2'"
          >
            {{ col.label }}
          </q-th>
        </q-tr>
      </template>
      <template #body-cell-from="props">
        <q-td :props="props">
          <div class="path-cell">
            <q-icon name="drive_folder_upload" size="16px" class="q-mr-xs text-grey-6" />
            <span class="path-text">
              {{ shortenPath(props.value) }}
              <q-tooltip>{{ props.value }}</q-tooltip>
            </span>
          </div>
        </q-td>
      </template>

      <template #body-cell-to="props">
        <q-td :props="props">
          <div class="path-cell">
            <q-icon name="o_archive" size="16px" class="q-mr-xs text-grey-6" />
            <span class="path-text">
              {{ shortenPath(props.value) }}
              <q-tooltip>{{ props.value }}</q-tooltip>
            </span>
          </div>
        </q-td>
      </template>

      <!-- Status column -->
      <template #body-cell-status="props">
        <q-td :props="props">
          <div
            v-if="!store.jobs[props.row.id] || store.jobs[props.row.id]?.status === 'complete'"
            class="status-cell"
          >
            <q-chip dense rounded :color="statusColor(props.value)" text-color="white">
              {{ props.value }}
            </q-chip>
          </div>

          <div v-else class="progress-cell">
            <q-chip
              dense
              rounded
              :color="store.jobs[props.row.id]?.status === 'paused' ? 'warning' : 'red'"
              text-color="white"
            >
              {{ store.jobs[props.row.id]?.status === 'paused' ? 'Paused' : 'Running' }}
            </q-chip>
            <q-linear-progress
              stripe
              rounded
              size="20px"
              v-if="store.jobs[props.row.id]?.percent && props.row.engine === 'rclone'"
              :value="store.jobs[props.row.id]?.percent"
              color="primary"
              class="q-mt-sm"
              ><div class="absolute-full flex flex-center">
                <q-badge
                  text-color="white"
                  color="primary"
                  :label="store.jobs[props.row.id]?.speed"
                />
              </div>
            </q-linear-progress>
            <div
              class="text-caption text-grey q-mt-xs ellipsis"
              v-if="props.row.engine !== 'rclone'"
            >
              est. {{ store.jobs[props.row.id]?.speed }}
            </div>
          </div>
        </q-td>
      </template>

      <!-- Action column -->
      <template #body-cell-action="props">
        <q-td :props="props">
          <div class="action-cell">
            <q-btn
              v-if="!isRowRunning(props.row.id) && !isRowPaused(props.row.id)"
              dense
              flat
              round
              icon="play_arrow"
              color="primary"
              @click="runJob(props.row)"
            >
              <q-tooltip>Run</q-tooltip>
            </q-btn>

            <q-btn
              v-if="isRowRunning(props.row.id)"
              dense
              flat
              round
              icon="pause"
              color="warning"
              @click="emit('pause', props.row)"
            >
              <q-tooltip>Pause</q-tooltip>
            </q-btn>

            <q-btn
              v-if="isRowPaused(props.row.id)"
              dense
              flat
              round
              icon="play_arrow"
              color="positive"
              @click="emit('resume', props.row)"
            >
              <q-tooltip>Resume</q-tooltip>
            </q-btn>

            <q-btn
              v-if="
                isRowRunning(props.row.id) ||
                isRowPaused(props.row.id)
              "
              dense
              flat
              round
              icon="stop_circle"
              color="negative"
              @click="emit('stop', props.row)"
            >
              <q-tooltip>Stop</q-tooltip>
            </q-btn>

            <q-btn
              v-if="!isRowRunning(props.row.id) && !isRowPaused(props.row.id)"
              dense
              flat
              round
              icon="edit"
              :color="$q.dark.isActive ? 'accent' : 'base-dark-2'"
              @click="emit('edit', props.row)"
            >
              <q-tooltip>Edit</q-tooltip>
            </q-btn>

            <q-btn
              dense
              flat
              round
              icon="delete"
              color="negative"
              @click="emit('delete', props.row)"
            >
              <q-tooltip>Delete</q-tooltip>
            </q-btn>
          </div>
        </q-td>
      </template>
    </q-table>
  </q-card>
</template>

<script setup lang="ts">
import type { QTableColumn } from 'quasar';
import { useQuasar } from 'quasar';
import type { PropType } from 'vue';
import { DAY_LABELS } from 'src/constants/days';
import { formatTime12h } from 'src/utils/formatters';
import { useCopyStore } from 'stores/copy.store';

interface JobRow {
  id: string;
  name: string;
  from: string;
  to: string;
  recycle_path: string;
  last_archived?: string | null;
  last_sync?: string | null;
  sched: number[];
  time: string;
  engine: string;
  type: 'sync' | 'archive';
  recycle: boolean;
  status: 'Active' | 'In-active';
}
const $q = useQuasar();
const store = useCopyStore();

const props = defineProps({
  rows: {
    type: Array as PropType<JobRow[]>,
    default: () => [],
  },
});

const emit = defineEmits<{
  (e: 'edit', row: JobRow): void;
  (e: 'delete', row: JobRow): void;
  (e: 'run', row: JobRow): void;
  (e: 'pause', row: JobRow): void;
  (e: 'resume', row: JobRow): void;
  (e: 'stop', row: JobRow): void;
}>();

const columns: QTableColumn<JobRow>[] = [
  { name: 'name', label: 'Name', field: 'name', align: 'left', sortable: true },
  { name: 'type', label: 'Type', field: 'type', align: 'left', sortable: true },
  {
    name: 'from',
    label: 'Source',
    field: 'from',
    align: 'left',
    classes: 'ellipsis',
    style: 'max-width: 260px',
    sortable: true,
  },
  {
    name: 'to',
    label: 'Destination',
    field: 'to',
    align: 'left',
    classes: 'ellipsis',
    style: 'max-width: 260px',
    sortable: true,
  },

  {
    name: 'sched',
    label: 'Days',
    field: 'sched',
    align: 'left',
    format: (val: number[]) => {
      if (!val?.length) return '-';
      return val
        .sort()
        .map((d) => DAY_LABELS[d])
        .join(', ');
    },
    sortable: true,
  },
  {
    name: 'time',
    label: 'Time',
    field: 'time',
    align: 'left',
    format: (val) => formatTime12h(val),
    sortable: true,
  },
  {
    name: 'last_run',
    label: 'Last Archive/Sync',
    align: 'left',
    field: (row: JobRow) => (row.type === 'archive' ? row.last_archived : row.last_sync),
    format: (val: string | null) => {
      if (!val) return '-';

      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(val));
    },
    sortable: true,
  },

  {
    name: 'status',
    label: 'Status',
    field: 'status',
    align: 'center',
    sortable: true,
  },
  {
    name: 'action',
    label: 'Action',
    field: () => null,
    align: 'center',
  },
];

function statusColor(status: JobRow['status']) {
  switch (status) {
    case 'Active':
      return 'primary';
    case 'In-active':
      return 'base-dark-2';
    default:
      return 'grey';
  }
}

function shortenPath(path: string) {
  if (!path) return '—';
  return path.split(/[\\/]/).slice(-4).join('/');
}

function runJob(row: JobRow) {
  emit('run', row);
}

function isRowRunning(rowId: string) {
  return store.jobs[rowId]?.status === 'running';
}

function isRowPaused(rowId: string) {
  return store.jobs[rowId]?.status === 'paused';
}
</script>
<style scoped>
/* Card */
.modern-card {
  border-radius: 14px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.06);
}

/* Table */
.modern-table .q-tr {
  transition: background-color 0.15s ease;
}

.modern-table .q-tr:hover {
  background: rgba(0, 0, 0, 0.035);
}

.body--dark .modern-table .q-tr:hover {
  background: rgba(255, 255, 255, 0.06);
}

/* Path */
.path-cell {
  display: flex;
  align-items: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
}

.path-text {
  max-width: 220px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Status */
.status-cell {
  display: flex;
  justify-content: center;
}

/* Progress */
.progress-cell {
  min-width: 180px;
}

/* Actions */
.action-cell {
  display: flex;
  justify-content: center;
  gap: 6px;
}

/* Subtle divider feel */
.q-table__middle {
  border-radius: 12px;
}
</style>
