<template>
  <q-page :class="$q.dark.isActive ? 'bg-base-dark-3' : 'bg-base-light-1'">
    <div class="q-pa-lg">
      <ScheduleTable/>
    </div>
   
  </q-page>
</template>

<script setup lang="ts">
import ScheduleTable from "src/components/ScheduleTable.vue";

</script>

<style scoped>
.dashboard-page {
  padding: 24px;
}

.dashboard-card {
  border-radius: 16px;
}
</style>
