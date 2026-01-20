<template>
  <q-card class="dashboard-card">
    <q-card-section class="row items-center q-gutter-sm">
      <q-icon
        name="sync"
        size="20px"
        :color="store.running ? 'primary' : 'grey'"
      />
      <div class="text-subtitle1 text-weight-medium">
        Copy Progress
      </div>
    </q-card-section>

    <q-separator />

    <q-card-section v-if="store.running">
      <q-linear-progress
        :value="store.percent / 100"
        rounded
        stripe
        animated
        size="18px"
        color="primary"
      />

      <div class="q-mt-sm text-caption text-grey-7">
        {{ store.percent }}% — {{ store.currentFile }}
      </div>
    </q-card-section>

    <q-card-section v-else class="text-grey-6 text-center">
      <q-icon name="pause_circle" size="32px" />
      <div class="q-mt-sm">
        No active copy job
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { useCopyStore } from "stores/copy.store";

const store = useCopyStore();
</script>
