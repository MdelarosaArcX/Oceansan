<template>
  <q-card class="dashboard-card">
    <q-card-section class="row items-center justify-between">
      <div class="row items-center q-gutter-sm">
        <q-icon name="list_alt" color="primary" size="20px" />
        <div class="text-subtitle1 text-weight-medium">Schedules</div>
      </div>

      <q-btn
        unelevated
        :color="$q.dark.isActive ? 'base-dark-3' : 'base-dark-2'"
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
      :rows="rows"
      :columns="columns"
      row-key="id"
      separator="horizontal"
      :rows-per-page-options="[5, 10, 20]"
    >
      <template #body-cell-from="props">
        <q-td :props="props">
          <span class="ellipsis">
            {{ shortenPath(props.value) }}
            <q-tooltip>{{ props.value }}</q-tooltip>
          </span>
        </q-td>
      </template>

      <template #body-cell-to="props">
        <q-td :props="props">
          <span class="ellipsis">
            {{ shortenPath(props.value) }}
            <q-tooltip>{{ props.value }}</q-tooltip>
          </span>
        </q-td>
      </template>

      <!-- Status column -->
      <template #body-cell-status="props">
        <q-td :props="props">
          <q-chip dense :color="statusColor(props.value)" text-color="white">
            {{ props.value }}
          </q-chip>
        </q-td>
      </template>

      <!-- Action column -->
      <template #body-cell-action="props">
        <q-td :props="props" class="q-gutter-xs">
          <q-btn dense flat icon="play_arrow" color="primary" @click="runJob(props.row)">
            <q-tooltip>Run</q-tooltip>
          </q-btn>

          <q-btn dense flat icon="edit" color="primary" @click="openEdit(props.row)">
            <q-tooltip>Edit</q-tooltip>
          </q-btn>

          <q-btn dense flat icon="delete" class="text-red" @click="deleteJob(props.row)">
            <q-tooltip>Delete</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>
  </q-card>
  <ScheduleDialog v-model="dialog" :data="selectedSchedule" @submit="saveSchedule" />
</template>

<script setup lang="ts">
import { createSchedule, getSchedules, updateSchedule } from 'src/services/schedule.service';
import type { QTableColumn } from 'quasar';
import { onMounted, ref } from 'vue';
import ScheduleDialog from './ScheduleDialog.vue';
import type { BackendSchedule, SchedulePayload } from 'src/types/Schedule';
import { DAY_LABELS } from 'src/constants/days';
// const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
import { formatTime12h } from 'src/utils/formatters';

interface JobRow {
  id: string;
  name: string;
  from: string;
  to: string;
  last_archived: string;
  sched: number[];
  time: string;
  type: 'sync' | 'archive';
  status: 'Active' | 'In-active';
}

const dialog = ref(false);
const selectedSchedule = ref<SchedulePayload | null>(null);

const columns: QTableColumn<JobRow>[] = [
  { name: 'name', label: 'Name', field: 'name', align: 'left' },
  {
    name: 'from',
    label: 'From',
    field: 'from',
    align: 'left',
    classes: 'ellipsis',
    style: 'max-width: 260px',
  },
  {
    name: 'to',
    label: 'To',
    field: 'to',
    align: 'left',
    classes: 'ellipsis',
    style: 'max-width: 260px',
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
  },
  {
    name: 'time',
    label: 'Time',
    field: 'time',
    align: 'left',
    format: (val) => formatTime12h(val),
  },
  {
    name: 'last_archived',
    label: 'Last Archive',
    field: 'last_archived',
    align: 'left',
    format: (val: string | null) => {
      if (!val) return '-';

      return new Intl.DateTimeFormat('en-US', {
        month: 'short', // Jan
        day: 'numeric', // 2
        year: 'numeric', // 2026
        hour: 'numeric', // 2
        minute: '2-digit',
        hour12: true,
      }).format(new Date(val));
    },
  },
  {
    name: 'status',
    label: 'Status',
    field: 'status',
    align: 'left',
  },
  {
    name: 'action',
    label: 'Action',
    field: () => null,
    align: 'right',
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

function runJob(row: JobRow) {
  console.log('Run job:', row);
}

function deleteJob(row: JobRow) {
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
  if (!path) return '—'
  return path.split(/[\\/]/).slice(-4).join('/')
}


// Fetch schedules when the table mounts
onMounted(fetchSchedules);
</script>
