<template>
  <q-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" persistent>
    <q-card class="q-pa-none" style="width: 720px; max-width: 90vw">
      <!-- Header -->
      <q-card-section class="row items-center justify-between q-pb-sm">
        <div>
          <div class="text-h6 text-weight-medium">
            {{ isEdit ? 'Edit Schedule' : 'Create Schedule' }}
          </div>
          <div class="text-caption text-grey">Configure schedule details and execution time</div>
        </div>

        <q-btn icon="close" round flat @click="close" />
      </q-card-section>

      <q-separator />

      <!-- Form (Scrollable) -->
      <q-card-section class="q-pt-md q-pa-none">
        <q-scroll-area :style="{ height: $q.screen.lt.md ? '60vh' : '70vh' }">
          <div class="q-pa-md">
            <q-form id="schedule-form" @submit="submit" @reset="reset" class="q-gutter-lg">
              <!-- Status -->
              <q-card flat bordered class="q-pa-md" v-if="form.id">
                <div class="row items-center justify-between">
                  <div>
                    <div class="text-subtitle2">Status</div>
                    <div class="text-caption text-grey">Enable or disable this schedule</div>
                  </div>

                  <div class="row items-center q-gutter-sm">
                    <q-chip dense :color="form.status ? 'positive' : 'grey'" text-color="white">
                      {{ form.status ? 'Active' : 'In-active' }}
                    </q-chip>
                    <q-toggle v-model="form.status" color="primary" />
                  </div>
                </div>
              </q-card>

              <!-- Basic Info -->
              <q-card flat bordered class="q-pa-md q-gutter-md">
                <div class="text-subtitle2">Basic Information</div>

                <q-select v-model="form.type" :rules="[(val) => !!val || 'Schedule Type is required']" :options="[
                  { value: 'archive', label: 'Archive' },
                  { value: 'sync', label: 'Sync' },
                ]" option-value="value" option-label="label" emit-value map-options outlined dense required
                  label="Schedule Type" />

                <q-input v-model="form.name" outlined dense label="Schedule Name"
                  :rules="[(val) => !!val || 'Name is required']" required />

                <q-checkbox v-if="form.type === 'sync'" v-model="recycle" 
                  label="Recycle deleted sync file?" color="cyan" />
              </q-card>

              <!-- Paths -->
              <q-card flat bordered class="q-pa-md q-gutter-md">
                <div class="text-subtitle2">Paths</div>

                <q-input v-model="form.src_path" outlined dense icon="folder" label="Source Folder"
                  :rules="[(val) => !!val || 'Source path is required']" required>
                  <template #prepend>
                    <q-icon name="folder" />
                  </template>
                </q-input>

                <q-input v-model="form.dest_path" outlined dense label="Destination Folder"
                  :rules="[(val) => !!val || 'Destination path is required']" required>
                  <template #prepend>
                    <q-icon name="folder" />
                  </template>
                </q-input>

                <q-input v-if="recycle" v-model="form.recycle_path" outlined dense label="Recycle Folder"
                  :rules="[(val) => !!val || 'Recycle path is required']" required>
                  <template #prepend>
                    <q-icon name="folder" />
                  </template>
                </q-input>




              </q-card>

              <!-- Schedule -->
              <q-card flat bordered class="q-pa-md q-gutter-md">
                <div class="text-subtitle2">Schedule</div>

                <!-- Days -->
                <div>
                  <div class="text-caption text-grey q-mb-sm">Select days to run</div>

                  <div class="row q-gutter-sm items-center">
                    <q-checkbox v-model="checkedAll" :indeterminate="indeterminate" label="All Days" color="cyan" />

                    <q-checkbox v-for="day in DAY_OPTIONS" :key="day.value" v-model="form.sched" :val="day.value"
                      :label="day.label" color="cyan" dense />
                  </div>
                </div>

                <!-- Time -->
                <q-input v-model="form.time" outlined dense mask="time" :rules="['time']" required
                  label="Execution Time">
                  <template #append>
                    <q-icon name="access_time" class="cursor-pointer">
                      <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                        <q-time v-model="form.time">
                          <div class="row items-center justify-end">
                            <q-btn v-close-popup label="Close" flat color="primary" />
                          </div>
                        </q-time>
                      </q-popup-proxy>
                    </q-icon>
                  </template>
                </q-input>
              </q-card>

              <!-- Actions -->
            </q-form>
          </div>
        </q-scroll-area>
      </q-card-section>
      <q-separator />

      <!-- Footer (fixed) -->
      <q-card-section class="q-pa-sm">
        <div class="row justify-end q-gutter-sm">
          <q-btn rounded flat label="Reset" type="reset" form="schedule-form" />

          <q-btn no-caps rounded unelevated :label="isEdit ? 'Update Schedule' : 'Create Schedule'" color="primary"
            type="submit" form="schedule-form" />
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import type { SchedulePayload } from 'src/types/Schedule';
import { computed, reactive, ref, watch } from 'vue';
import { DAY_OPTIONS } from 'src/constants/days';
const props = defineProps<{
  modelValue: boolean;
  data?: SchedulePayload | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submit', value: SchedulePayload): void;
}>();

const isEdit = computed(() => !!props.data?.id);

const form = reactive<SchedulePayload>({
  name: '',
  src_path: '',
  dest_path: '',
  recycle_path: '',
  sched: [],
  time: '',
  recycle:true,
  type: 'archive',
  status: false,

});

// const days = [
//   { label: 'Sun', value: '0' },
//   { label: 'Mon', value: '1' },
//   { label: 'Tue', value: '2' },
//   { label: 'Wed', value: '3' },
//   { label: 'Thu', value: '4' },
//   { label: 'Fri', value: '5' },
//   { label: 'Sat', value: '6' },
// ];

const checkedAll = ref<boolean>(false);
const recycle = ref<boolean>(false);
const indeterminate = ref(false);

watch(
  () => props.data,
  (val) => {
    if (val) Object.assign(form, val);
    else reset();
  },
  { immediate: true },
);

watch(checkedAll, (val) => {
  if (val) {
    form.sched = [...allDayValues];
    indeterminate.value = false;
  } else if (!indeterminate.value) {
    form.sched = [];
  }
});

watch(
  () => form.sched,
  (val) => {
    if (val.length === allDayValues.length) {
      checkedAll.value = true;
      indeterminate.value = false;
    } else if (val.length === 0) {
      checkedAll.value = false;
      indeterminate.value = false;
    } else {
      checkedAll.value = false;
      indeterminate.value = true;
    }
  },
  { deep: true },
);

function submit() {
  emit('submit', { ...form });
  reset();
  close();
}
const allDayValues = DAY_OPTIONS.map((d) => d.value);

function reset() {
  Object.assign(form, {
    id: undefined,
    type: '',
    name: '',
    src_path: '',
    dest_path: '',
    recycle_path: '',
    sched: [],
    time: '',
  });
  checkedAll.value = false;
}

function close() {
  reset();
  emit('update:modelValue', false);
}
</script>
