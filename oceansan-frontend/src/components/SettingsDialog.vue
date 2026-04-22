<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    persistent
  >
    <q-card class="q-pa-none" style="width: 820px; max-width: 90vw">
      <!-- Header -->
      <q-card-section class="row items-center justify-between q-pb-sm">
        <div>
          <div class="text-h6 text-weight-medium">Settings</div>
        </div>

        <q-btn icon="close" round flat @click="close" />
      </q-card-section>

      <q-separator />

      <!-- Form (Scrollable) -->
      <q-card-section class="q-pt-md q-pa-none">
        <q-scroll-area :style="{ height: $q.screen.lt.md ? '60vh' : '70vh' }">
          <div class="q-pa-md">
            <q-toggle
              v-model="isDark"
              checked-icon="dark_mode"
              color="primary"
              label="Switch Dark Mode"
              unchecked-icon="light_mode"
              @click="toggleDark()"
            />
          </div>
        </q-scroll-area>
      </q-card-section>
      <q-separator />

      <!-- Footer (fixed) -->
      <q-card-section class="q-pa-sm">
        <div class="row justify-end q-gutter-sm">
          <q-btn rounded flat label="Reset" type="reset" form="schedule-form" />
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { Dark } from 'quasar';
import { computed } from 'vue';

const isDark = computed(() => Dark.isActive);

defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

function close() {
  emit('update:modelValue', false);
}

function toggleDark() {
  Dark.toggle();
  localStorage.setItem('dark-mode', String(Dark.isActive));
}
</script>
