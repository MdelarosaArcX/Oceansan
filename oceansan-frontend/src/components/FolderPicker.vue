<template>
  <q-input
    outlined
    dense
    readonly
    :label="label"
    :model-value="modelValue"
  >
    <template #prepend>
      <q-icon name="folder" />
    </template>

    <template #append>
      <q-btn
        flat
        dense
        icon="folder_open"
        @click="pickFolder"
      />
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
  const path = prompt("Enter folder path");
  if (path) emit("update:modelValue", path);
}
</script>
