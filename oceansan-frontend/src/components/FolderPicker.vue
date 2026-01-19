<template>
  <q-input
    outlined
    readonly
    :label="label"
    :model-value="modelValue"
  >
    <template #append>
      <q-btn flat icon="folder_open" @click="pickFolder" />
    </template>
  </q-input>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  modelValue: string;
}>();

const emit = defineEmits(["update:modelValue"]);

function pickFolder() {
  /**
   * TEMP:
   * For now use input dialog.
   * Later replace with Electron folder dialog.
   */
  const path = prompt("Enter folder path");
  if (path) emit("update:modelValue", path);
}
</script>
