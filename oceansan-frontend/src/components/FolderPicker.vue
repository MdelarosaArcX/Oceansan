<template>
  <q-input
    outlined
    dense
    :readonly="hasNativePicker"
    :input-class="hasNativePicker ? 'cursor-pointer' : undefined"
    :label="label"
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    @click="handleClick"
  >
    <template #prepend>
      <q-icon name="folder" />
    </template>

    <template v-if="hasNativePicker" #append>
      <q-btn
        flat
        dense
        icon="folder_open"
        @click.stop="pickFolder"
      />
    </template>
  </q-input>
</template>

<script setup lang="ts">
import { computed } from 'vue';

defineProps<{
  label: string;
  modelValue: string | undefined;
}>();

const emit = defineEmits(["update:modelValue"]);
const hasNativePicker = computed(
  () => typeof window !== 'undefined' && typeof window.oceansan?.pickFolder === 'function',
);

async function pickFolder() {
  const oceansanApi = window.oceansan;
  if (!hasNativePicker.value || !oceansanApi) {
    console.warn('Folder picker is unavailable because the Electron preload bridge is missing.');
    return;
  }

  const pickedPath = await oceansanApi.pickFolder();
  if (pickedPath) {
    emit("update:modelValue", pickedPath);
  }
}

function handleClick() {
  if (hasNativePicker.value) {
    void pickFolder();
  }
}
</script>
