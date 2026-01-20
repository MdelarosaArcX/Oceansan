<template>
  <q-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <q-card style="width: 700px; max-width: 80vw">
      <!-- Header -->
      <q-card-section class="row items-center justify-between">
        <div class="text-h6">
          {{ isEdit ? 'Edit Schedule' : 'Create Schedule' }}
        </div>
        <q-btn icon="close" round flat @click="close" />
      </q-card-section>

      <q-separator />

      <!-- Form -->
      <q-card-section>
        <q-form @submit="submit" @reset="reset" class="q-gutter-md">
          <q-input outlined dense label="Name" v-model="form.name" required />

          <q-input outlined dense readonly label="From" v-model="form.from">
            <template #prepend>
              <q-icon name="folder" />
            </template>
            <template #append>
              <q-btn flat dense icon="folder_open" @click="pickFolder('from')" />
            </template>
          </q-input>

          <q-input outlined dense readonly label="Destination" v-model="form.to">
            <template #prepend>
              <q-icon name="folder" />
            </template>
            <template #append>
              <q-btn flat dense icon="folder_open" @click="pickFolder('to')" />
            </template>
          </q-input>

          <!-- Days -->
          <div class="q-gutter-sm">
            <q-checkbox
              v-for="day in days"
              :key="day.value"
              v-model="form.sched"
              :val="day.value"
              :label="day.label"
              color="cyan"
            />
          </div>

          <!-- Time -->
          <q-input outlined dense v-model="form.time" mask="time" :rules="['time']">
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

          <!-- Actions -->
          <div class="row justify-end q-gutter-sm">
            <q-btn flat label="Reset" type="reset" />
            <q-btn :label="isEdit ? 'Update' : 'Create'" color="primary" type="submit" />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import type { SchedulePayload } from 'src/types/Schedule';
import { computed, reactive, watch } from 'vue';


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
  from: null,
  to: null,
  sched: [],
  time: '00:00',
});

watch(
  () => props.data,
  (val) => {
    if (val) Object.assign(form, val);
    else reset();
  },
  { immediate: true },
);

const days = [
  { label: 'Sun', value: '0' },
  { label: 'Mon', value: '1' },
  { label: 'Tue', value: '2' },
  { label: 'Wed', value: '3' },
  { label: 'Thu', value: '4' },
  { label: 'Fri', value: '5' },
  { label: 'Sat', value: '6' },
];

function pickFolder(type: 'from' | 'to') {
  const path = prompt('Enter folder path');
  if (path) form[type] = path;
}

function submit() {
  emit('submit', { ...form });
  close();
}

function reset() {
  Object.assign(form, {
    id: undefined,
    name: '',
    from: null,
    to: null,
    sched: [],
    time: '00:00',
  });
}

function close() {
  emit('update:modelValue', false);
}
</script>
