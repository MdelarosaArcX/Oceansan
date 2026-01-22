<template>
  <q-card class="dashboard-card modern-card">
    <q-card-section class="row items-center justify-between q-pb-sm">
      <div class="row items-center q-gutter-sm">
        <q-icon name="list_alt" color="primary" size="20px" />
        <div class="text-subtitle1 text-weight-medium">Schedules</div>
      </div>

      <q-btn
        unelevated
        :class="$q.dark.isActive ? 'bg-accent  text-base-dark-3' : 'bg-base-dark-2 text-base-light-1'"
        icon="add_circle"
        rounded
        label="Create Schedule"
        @click="openCreate"
        no-caps
      />
    </q-card-section>

    <q-separator />

    <q-table
      flat
      class="modern-table"
      :rows="rows"
      :columns="columns"
      row-key="id"
      separator="horizontal"
      :rows-per-page-options="[5, 10, 20]"
    >
      <template #body-cell-from="props">
        <q-td :props="props">
          <div class="path-cell">
            <q-icon name="folder" size="16px" class="q-mr-xs text-grey-6" />
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
            <q-icon name="folder_open" size="16px" class="q-mr-xs text-grey-6" />
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
          <div v-if="store.runningJobId !== props.row.id" class="status-cell">
            <q-chip dense rounded :color="statusColor(props.value)" text-color="white">
              {{ props.value }}
            </q-chip>
          </div>

          <div v-else class="progress-cell">
            <q-linear-progress
              :value="store.percent / 100"
              rounded
              stripe
              animated
              size="14px"
              color="primary"
            />
            <div class="text-caption text-grey q-mt-xs ellipsis">
              {{ store.percent }}% — {{ store.currentFile }}
            </div>
          </div>
        </q-td>
      </template>

      <!-- Action column -->
      <template #body-cell-action="props">
        <q-td :props="props">
          <div class="action-cell">
            <q-btn dense flat round icon="play_arrow" color="primary" @click="runJob(props.row)">
              <q-tooltip>Run</q-tooltip>
            </q-btn>

            <q-btn dense flat round icon="edit" :color="$q.dark.isActive ? 'accent' : 'base-dark-2'" @click="openEdit(props.row)">
              <q-tooltip>Edit</q-tooltip>
            </q-btn>

            <q-btn dense flat round icon="delete" color="negative" @click="deleteJob(props.row)">
              <q-tooltip>Delete</q-tooltip>
            </q-btn>
          </div>
        </q-td>
      </template>
    </q-table>
  </q-card>
  <ScheduleDialog v-model="dialog" :data="selectedSchedule" @submit="saveSchedule" />
</template>

<script setup lang="ts">
import {
  createSchedule,
  deleteSchedule,
  getSchedules,
  updateSchedule,
} from 'src/services/schedule.service';
import type { QTableColumn } from 'quasar';
import { onMounted, ref } from 'vue';
import ScheduleDialog from './ScheduleDialog.vue';
import type { BackendSchedule, SchedulePayload } from 'src/types/Schedule';
import { DAY_LABELS } from 'src/constants/days';
import { formatTime12h } from 'src/utils/formatters';
import { useCopyStore } from 'stores/copy.store';

interface JobRow {
  id: string;
  name: string;
  from: string;
  to: string;
  last_archived?: string | null;
  last_sync?: string | null;
  sched: number[];
  time: string;
  type: 'sync' | 'archive';
  status: 'Active' | 'In-active';
}

const dialog = ref(false);
const selectedSchedule = ref<SchedulePayload | null>(null);

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
  // ✅ NEW SCHEDULE COLUMN
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

const rows = ref<JobRow[]>([]);

async function fetchSchedules() {
  try {
    const data: BackendSchedule[] = await getSchedules();

    rows.value = data.map((s) => ({
      id: s._id,
      name: s.sched_name,
      from: s.src_path,
      to: s.dest_path,
      sched: s.days ?? [],
      last_archived: s.last_archived ?? '',
      last_sync: s.last_sync ?? '',
      type: s.type,
      status: s.active ? 'Active' : 'In-active',
      time: s.time,
    }));
  } catch (err) {
    console.error('Failed to fetch schedules', err);
  }
}

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

async function deleteJob(row: JobRow) {
  if (row.id) {
    await deleteSchedule(row.id);
    await fetchSchedules();
    return;
  }
  console.log('Delete job:', row);
}

function openCreate() {
  selectedSchedule.value = null;
  dialog.value = true;
}

function openEdit(row: JobRow) {
  selectedSchedule.value = {
    id: row.id,
    name: row.name,
    src_path: row.from,
    dest_path: row.to,
    sched: row.sched,
    type: row.type,
    time: row.time,
    status: row.status === 'Active' ? true : false,
  };
  dialog.value = true;
}

// After creating a schedule, refresh the table
async function saveSchedule(payload: SchedulePayload) {
  if (payload.id) {
    await updateSchedule({
      id: payload.id,
      sched_name: payload.name,
      src_path: payload.src_path,
      dest_path: payload.dest_path,
      days: payload.sched.map(Number),
      type: payload.type,
      time: payload.time,
      active: payload.status,
    });
    console.log('Update schedule', payload);
    await fetchSchedules();
    return;
  }

  try {
    await createSchedule({
      sched_name: payload.name,
      src_path: payload.src_path,
      dest_path: payload.dest_path,
      days: payload.sched.map(Number),
      type: payload.type,
      time: payload.time,
      active: true,
    });

    console.log('Schedule created');

    // Refresh table
    await fetchSchedules();
  } catch (err) {
    console.error('Failed to create schedule', err);
  }
}

function shortenPath(path: string) {
  if (!path) return '—';
  return path.split(/[\\/]/).slice(-4).join('/');
}

const store = useCopyStore();

async function runJob(row: JobRow) {
  await store.startCopy(row.id, row.from, row.to, row.type);
  // Refresh table
  await fetchSchedules();
}

// Fetch schedules when the table mounts
onMounted(fetchSchedules);
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
