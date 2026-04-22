<template>
  <q-page :class="$q.dark.isActive ? 'bg-base-dark-2' : 'bg-base-light-1'">
    <div class="q-pa-lg">
      <div class="row items-center justify-between q-mb-lg">
        <div class="flex">
          <div class="q-mt-sm q-mr-sm">
            <q-icon name="o_event_available" size="24px" />
          </div>
          <div>
            <span class="fw-medium" style="font-size: 24px">Schedules</span>

            <div style="font-size: 16px">
              Add new backup schedule or edit existing task
            </div>
          </div>
        </div>

        <q-btn
          unelevated
          :class="$q.dark.isActive ? 'bg-accent text-base-dark-3' : 'bg-base-light-3 text-base-dark-3'"
          icon="add_circle"
          rounded
          label="Schedule Backup/Sync"
          @click="openCreate"
        />
      </div>

      <ScheduleTable
        :rows="rows"
        @edit="openEdit"
        @delete="deleteJob"
        @run="runJob"
        @pause="pauseJob"
        @resume="resumeJob"
        @stop="stopJob"
      />
      <ScheduleDialog v-model="dialog" :data="selectedSchedule" @submit="saveSchedule" />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import ScheduleDialog from 'src/components/ScheduleDialog.vue';
import ScheduleTable from 'src/components/ScheduleTable.vue';
import type { BackendSchedule, SchedulePayload } from 'src/types/Schedule';
import { createSchedule, deleteSchedule, getSchedules, updateSchedule } from 'src/services/schedule.service';
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
const rows = ref<JobRow[]>([]);
const dialog = ref(false);
const selectedSchedule = ref<SchedulePayload | null>(null);

async function fetchSchedules() {
  try {
    const data: BackendSchedule[] = await getSchedules();

    rows.value = data.map((s) => ({
      id: s.id,
      name: s.sched_name,
      from: s.src_path,
      to: s.dest_path,
      recycle_path: s.recycle_path ?? '',
      sched: s.days ?? [],
      last_archived: s.last_archived ?? '',
      last_sync: s.last_sync ?? '',
      engine: s.engine,
      type: s.type,
      recycle: s.recycle,
      status: s.active ? 'Active' : 'In-active',
      time: s.time,
    }));
  } catch (err) {
    console.error('Failed to fetch schedules', err);
  }
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
    engine: row.engine,
    recycle_path: row.recycle_path,
    sched: row.sched,
    type: row.type,
    time: row.time,
    recycle: row.recycle,
    status: row.status === 'Active',
  };
  dialog.value = true;
}

async function deleteJob(row: JobRow) {
  if (!row.id) return;
  await deleteSchedule(row.id);
  await fetchSchedules();
}

async function runJob(row: JobRow) {
  await store.startCopy(
    row.id,
    row.name,
    row.from,
    row.to,
    row.engine,
    row.type,
    row.recycle,
    row.recycle_path,
  );
  await fetchSchedules();
}

async function pauseJob(row: JobRow) {
  await store.pauseCopy(row.id);
}

async function resumeJob(row: JobRow) {
  await store.resumeCopy(
    row.id,
    row.name,
    row.from,
    row.to,
    row.engine,
    row.type,
    row.recycle,
    row.recycle_path,
  );
}

async function stopJob(row: JobRow) {
  await store.stopCopy(row.id);
}

async function saveSchedule(payload: SchedulePayload) {
  try {
    if (payload.id) {
      await updateSchedule({
        id: payload.id,
        sched_name: payload.name,
        src_path: payload.src_path,
        dest_path: payload.dest_path,
        recycle_path: payload.recycle_path || '',
        days: payload.sched.map(Number),
        engine: payload.engine,
        type: payload.type,
        time: payload.time,
        recycle: payload.recycle,
        active: payload.status,
      });

      $q.notify({
        type: 'success',
        message: 'Schedule Updated !',
      });
      await fetchSchedules();
      return true;
    }

    await createSchedule({
      sched_name: payload.name,
      src_path: payload.src_path,
      dest_path: payload.dest_path,
      recycle_path: payload.recycle_path || '',
      days: payload.sched.map(Number),
      engine: payload.engine,
      type: payload.type,
      time: payload.time,
      recycle: payload.recycle,
      active: true,
    });

    $q.notify({
      type: 'success',
      message: 'Schedule Created !',
    });

    await fetchSchedules();
    selectedSchedule.value = null;
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save schedule';

    $q.notify({
      type: 'negative',
      message,
    });

    console.error('Failed to create/update schedule', err);
    return false;
  }
}

onMounted(fetchSchedules);
</script>

<style scoped>
.dashboard-page {
  padding: 24px;
}

.dashboard-card {
  border-radius: 16px;
}
</style>
