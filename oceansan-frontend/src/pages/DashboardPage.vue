<template>
  <q-page :class="$q.dark.isActive ? 'bg-base-dark-3' : 'bg-base-light-1'">
    <div class="q-pa-lg">
      <ScheduleTable/>
    </div>
    <!-- Header -->
    <!-- <div class="row items-center q-mb-lg">
      <div class="col">
        <div class="text-h5 text-weight-bold">File Copy Dashboard</div>
        <div class="text-caption text-grey-6">
          Configure and monitor file copy jobs
        </div>
      </div>

      <q-btn
        unelevated
        color="primary"
        icon="play_arrow"
        label="Start Copy"
        :disable="!from || !to || running"
        @click="startCopy"
      />
    </div>

    <div class="row q-col-gutter-lg">
      <div class="col-12 col-md-5">
        <q-card class="dashboard-card">
          <q-card-section class="row items-center q-gutter-sm">
            <q-icon name="settings" size="20px" color="primary" />
            <div class="text-subtitle1 text-weight-medium">
              Copy Configuration
            </div>
          </q-card-section>

          <q-separator />

          <q-card-section class="q-gutter-md">
            <FolderPicker
              label="Source Folder"
              v-model="from"
            />
            <FolderPicker
              label="Destination Folder"
              v-model="to"
            />
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-7">
        <ProgressCard />
      </div>
    </div> -->
  </q-page>
</template>

<script setup lang="ts">
// import { ref } from "vue";
// import FolderPicker from "components/FolderPicker.vue";
// import ProgressCard from "components/ProgressCard.vue";
import ScheduleTable from "src/components/ScheduleTable.vue";
// import { useCopyStore } from "stores/copy.store";

// const store = useCopyStore();

// const from = ref("");
// const to = ref("");
// const running = store.running;

// async function startCopy() {
//   await store.startCopy(from.value, to.value);
// }

</script>

<style scoped>
.dashboard-page {
  padding: 24px;
}

.dashboard-card {
  border-radius: 16px;
}
</style>
