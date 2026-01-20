<template>
  <q-card class="dashboard-card">
    <q-card-section class="row items-center justify-between">
      <div class="row items-center q-gutter-sm">
        <q-icon name="list_alt" color="primary" size="20px" />
        <div class="text-subtitle1 text-weight-medium">Schedules</div>
      </div>

      <q-btn
        unelevated
        :color="$q.dark.isActive ? 'secondary' : 'negative'"
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

          <q-btn dense flat icon="edit" color="secondary" @click="openEdit(props.row)">
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
import type { QTableColumn } from 'quasar';
import { ref } from 'vue';
// import ScheduleDialog from './ScheduleDialog.vue';
// import type { SchedulePayload } from './ScheduleDialog.vue';
import ScheduleDialog from './ScheduleDialog.vue';
import type { SchedulePayload } from 'src/types/Schedule';

interface JobRow {
  id: number;
  name: string;
  from: string;
  to: string;
  lastArchive: string;
  status: 'Active' | 'In-active';
}

const dialog = ref(false);
const selectedSchedule = ref<SchedulePayload | null>(null);

const columns: QTableColumn<JobRow>[] = [
  { name: 'name', label: 'Name', field: 'name', align: 'left' },
  { name: 'from', label: 'From', field: 'from', align: 'left' },
  { name: 'to', label: 'To', field: 'to', align: 'left' },
  {
    name: 'lastArchive',
    label: 'Last Archive',
    field: 'lastArchive',
    align: 'left',
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

const rows: JobRow[] = [
  {
    id: 1,
    name: 'Daily Backup',
    from: 'D:/Data',
    to: 'E:/Backup',
    lastArchive: '2026-01-17 22:10',
    status: 'Active',
  },
  {
    id: 2,
    name: 'Media Sync',
    from: 'D:/Media',
    to: 'NAS/Media',
    lastArchive: '—',
    status: 'In-active',
  },
];

function statusColor(status: JobRow['status']) {
  switch (status) {
    case 'Active':
      return 'primary';
    case 'In-active':
      return 'negative';
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
    from: row.from,
    to: row.to,
    sched: [],
    time: '00:00',
  };
  dialog.value = true;
}

function saveSchedule(payload: SchedulePayload) {
  if (payload.id) {
    console.log('Update schedule', payload);
  } else {
    console.log('Create schedule', payload);
  }
}
</script>
