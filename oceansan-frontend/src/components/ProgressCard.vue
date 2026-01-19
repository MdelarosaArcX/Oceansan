<template>
  <q-card class="shadow-3">
    <q-card-section>
      <div class="text-h6">Progress</div>
    </q-card-section>

    <q-card-section v-if="store.running">
      <q-linear-progress
        :value="store.percent / 100"
        stripe
        rounded
        size="20px"
        animated
      />

      <div class="q-mt-sm text-caption">
        {{ store.percent }}% – {{ store.currentFile }}
      </div>
    </q-card-section>

    <q-card-section v-else class="text-grey">
      No active copy job
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { useCopyStore } from "stores/copy.store";

const store = useCopyStore();
</script>
