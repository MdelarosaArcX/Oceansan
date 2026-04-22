<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    persistent
    ><q-card class="schedule-dialog-card q-pa-none">
      <q-card-section class="dialog-header">
        <div class="header-left">
          <q-icon name="folder_copy" size="24px" />
          <div>
            <div class="header-title">
              {{ isEdit ? 'Edit Schedule Backup / Sync' : 'Schedule Backup / Sync' }}
            </div>
            <div class="header-subtitle">Configure schedule details and execution time</div>
          </div>
        </div>

        <q-btn icon="close" flat round dense class="close-btn" @click="close" />
      </q-card-section>

      <q-card-section class="dialog-body q-pa-none">
        <q-scroll-area :style="{ height: $q.screen.lt.md ? '62vh' : '68vh' }">
          <q-form id="schedule-form" @submit="submit" @reset="reset" class="dialog-content">
            <div class="section-panel">
              <div class="section-title">Basic Information</div>

              <div class="status-row">
                <span class="status-label">Status</span>
                <button
                  type="button"
                  class="status-toggle-pill"
                  :class="{ 'is-on': form.status }"
                  :aria-pressed="form.status ? 'true' : 'false'"
                  @click="form.status = !form.status"
                >
                  <span class="status-toggle-thumb">{{ form.status ? 'ON' : 'OFF' }}</span>
                </button>
              </div>

              <div class="basic-grid">
                <q-input
                  v-model="form.name"
                  outlined
                  dense
                  class="field-soft"
                  color="grey-8"
                  label-color="grey-10"
                  label="Schedule Name"
                  :rules="[(val) => requiredRule(val) || 'Name is required']"
                  required
                />

                <q-select
                  v-model="form.type"
                  :rules="[(val) => requiredRule(val) || 'Schedule Type is required']"
                  :options="scheduleTypeOptions"
                  option-value="value"
                  option-label="label"
                  emit-value
                  map-options
                  outlined
                  dense
                  required
                  color="grey-8"
                  label-color="grey-10"
                  class="field-soft"
                  label="Schedule Type"
                />

                <q-select
                  v-model="form.engine"
                  :rules="[(val) => requiredRule(val) || 'Engine is required']"
                  :options="[
                    { value: 'robocopy', label: 'Robocopy' },
                    { value: 'xcopy', label: 'XCopy' },
                    { value: 'rclone', label: 'Rclone' },
                  ]"
                  option-value="value"
                  option-label="label"
                  emit-value
                  map-options
                  outlined
                  dense
                  required
                  class="field-soft"
                  label="Engine"
                  color="grey-8"
                  label-color="grey-10"
                />
              </div>

              <div v-if="form.type === 'sync'" class="recycle-row">
                <q-checkbox
                  v-model="form.recycle"
                  :indeterminate="indeterminate"
                  label="Recycle deleted sync file?"
                  color="grey-7"
                />
              </div>

              <div class="section-title">Paths</div>

              <FolderPicker
                v-model="form.src_path"
                label="Source folder"
                :rules="[sourcePathRule]"
                class="field-soft q-mb-md"
              />

              <FolderPicker
                v-model="form.dest_path"
                label="Destination folder"
                :rules="[destinationRequiredRule, destinationDiffRule]"
                class="field-soft"
              />

              <FolderPicker
                v-if="form.recycle && form.type === 'sync'"
                v-model="form.recycle_path"
                label="Recycle folder"
                :rules="[recyclePathRule]"
                class="field-soft q-mt-md"
              />

              <div class="section-title">Date & Time</div>

              <div class="day-row">
                <q-checkbox
                  v-model="checkedAll"
                  :indeterminate="indeterminate"
                  label="Daily"
                  class="day-checkbox"
                  color="grey-8"
                  label-color="grey-10"
                />

                <q-checkbox
                  v-for="day in DAY_OPTIONS"
                  :key="day.value"
                  v-model="form.sched"
                  :val="day.value"
                  :label="day.label"
                  dense
                  class="day-checkbox"
                  color="grey-8"
                  label-color="grey-10"
                />
              </div>

              <q-input
                v-model="form.time"
                outlined
                dense
                mask="time"
                :rules="['time']"
                required
                color="grey-8"
                label-color="grey-10"
                label="Execution Time"
                class="field-soft q-mt-md"
              >
                <template #append>
                  <q-icon name="schedule" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-time v-model="form.time" color="grey-8" label-color="grey-10">
                        <div class="row items-center justify-end">
                          <q-btn v-close-popup label="Close" flat color="primary" />
                        </div>
                      </q-time>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </q-form>
        </q-scroll-area>
      </q-card-section>

      <q-card-section class="dialog-footer">
        <div class="row justify-end q-gutter-md">
          <q-btn
            rounded
            flat
            label="RESET"
            type="reset"
            form="schedule-form"
            class="footer-reset"
          />

          <q-btn
            no-caps
            rounded
            unelevated
            :label="isEdit ? 'UPDATE' : 'CONFIRM'"
            class="footer-confirm"
            type="submit"
            form="schedule-form"
          />
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import FolderPicker from 'src/components/FolderPicker.vue';
import { DAY_OPTIONS } from 'src/constants/days';
import type { SchedulePayload } from 'src/types/Schedule';
import { computed, reactive, ref, watch } from 'vue';

const props = defineProps<{
  modelValue: boolean;
  data?: SchedulePayload | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submit', value: SchedulePayload): Promise<boolean>;
}>();

const isEdit = computed(() => !!props.data?.id);

const form = reactive<SchedulePayload>({
  name: '',
  src_path: '',
  dest_path: '',
  recycle_path: '',
  sched: [],
  time: '',
  recycle: false,
  engine: '',
  type: 'archive',
  status: false,
});

const checkedAll = ref<boolean>(false);
const indeterminate = ref(false);

const scheduleTypeOptions = computed(() => [
  { value: 'archive', label: 'Archive' },
  {
    value: 'sync',
    label: 'Sync',
    disable: form.engine === 'xcopy',
  },
]);

const requiredRule = (val: string | number | null | undefined) => !!val;
const sourcePathRule = (val: string | null | undefined) => !!val || 'Source path is required';
const destinationRequiredRule = (val: string | null | undefined) =>
  !!val || 'Destination path is required';
const destinationDiffRule = (val: string | null | undefined) =>
  val !== form.src_path || 'Destination must be different from Source';
const recyclePathRule = (val: string | null | undefined) => !!val || 'Recycle path is required';

watch(
  () => form.engine,
  (newVal) => {
    if (newVal === 'xcopy' && form.type === 'sync') {
      form.type = 'archive';
    }
  },
);

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

async function submit() {
  const success = await emit('submit', { ...form });
  if (success) {
    reset();
    close();
  }
}

const allDayValues = DAY_OPTIONS.map((d) => d.value);

function reset() {
  Object.assign(form, {
    id: undefined,
    type: 'archive',
    engine: '',
    name: '',
    src_path: '',
    dest_path: '',
    recycle_path: '',
    sched: [],
    time: '',
    recycle: false,
    status: false,
  });
  checkedAll.value = false;
}

function close() {
  reset();
  emit('update:modelValue', false);
}
</script>

<style scoped>
.schedule-dialog-card {
  width: 820px;
  max-width: 90vw;
  background: #ebebeb;
  border-radius: 8px;
  color: #1f1f1f;
}

.dialog-header {
  padding: 14px 16px 8px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.header-title {
  font-size: 24px;
  font-weight: 500;
  line-height: 1.1;
}

.header-subtitle {
  margin-top: 4px;
  font-size: 16px;
  font-weight: 300;
  color: #3f3f3f;
}

.close-btn {
  color: #121212;
}

.dialog-content {
  padding: 0 16px 8px;
}

.section-panel {
  border-radius: 8px;
  padding: 18px 20px;
  margin-bottom: 16px;
}

.section-title {
  font-size: 18px;
  font-weight: 400;
  margin-bottom: 14px;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.status-label {
  font-size: 16px;
}

.status-toggle-pill {
  width: 70px;
  height: 30px;
  border: none;
  border-radius: 999px;
  background: #bdbdbd;
  position: relative;
  display: inline-block;
  padding: 0;
  cursor: pointer;
  transition: background-color 0.18s ease;
}

.status-toggle-pill.is-on {
  background: #17c8f5;
}

.status-toggle-thumb {
  width: 42px;
  height: 24px;
  border-radius: 999px;
  background: #ffffff;
  position: absolute;
  top: 3px;
  left: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #17c8f5;
  transition: transform 0.18s ease;
}

.status-toggle-pill.is-on .status-toggle-thumb {
  transform: translateX(22px);
}

.status-toggle-pill:not(.is-on) .status-toggle-thumb {
  color: #6f6f6f;
}

.basic-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 10px;
}

.recycle-row {
  margin-top: 10px;
}

.day-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.day-checkbox :deep(.q-checkbox__label) {
  font-size: 16px;
}

.field-soft :deep(.q-field__control) {
  background: #d7d7d7;
  border-radius: 8px;
}

.field-soft :deep(.q-field--outlined .q-field__control:before),
.field-soft :deep(.q-field--outlined .q-field__control:after) {
  border: none;
}

.field-soft :deep(.q-field__label),
.field-soft :deep(.q-field__native),
.field-soft :deep(.q-field__input) {
  font-size: 16px;
}

.dialog-footer {
  padding: 0 16px 14px;
}

.footer-reset {
  font-size: 16px;
  font-weight: 700;
  color: #1b1b1b;
}

.footer-confirm {
  font-size: 16px;
  font-weight: 700;
  background: #c8c8c8;
  color: #121212;
  padding: 10px 22px;
}

@media (max-width: 1024px) {
  .header-title {
    font-size: 28px;
  }

  .header-subtitle {
    font-size: 18px;
  }

  .section-title {
    font-size: 24px;
  }

  .status-label,
  .field-soft :deep(.q-field__label),
  .field-soft :deep(.q-field__native),
  .field-soft :deep(.q-field__input),
  .day-checkbox :deep(.q-checkbox__label),
  .footer-reset,
  .footer-confirm {
    font-size: 18px;
  }

  .field-soft :deep(.q-field__control) {
    min-height: 52px;
  }
}

@media (max-width: 768px) {
  .basic-grid {
    grid-template-columns: 1fr;
  }

  .section-panel {
    padding: 14px;
  }
}
</style>
