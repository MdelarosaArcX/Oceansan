<template>
  <q-page padding>
    <div class="row q-col-gutter-lg">

      <!-- Configuration -->
      <div class="col-12 col-md-5">
        <q-card class="shadow-3">
          <q-card-section>
            <div class="text-h6">Copy Configuration</div>
          </q-card-section>

          <q-card-section>
            <FolderPicker
              label="Source Folder"
              v-model="from"
            />
            <FolderPicker
              label="Destination Folder"
              v-model="to"
            />
          </q-card-section>

          <q-card-actions align="right">
            <q-btn
              color="primary"
              label="Start Copy"
              :disable="!from || !to || running"
              @click="startCopy"
            />
          </q-card-actions>
        </q-card>
      </div>

      <!-- Progress -->
      <div class="col-12 col-md-7">
        <ProgressCard />
      </div>

    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from "vue";
import FolderPicker from "components/FolderPicker.vue";
import ProgressCard from "components/ProgressCard.vue";
import { useCopyStore } from "stores/copy.store";

const store = useCopyStore();

const from = ref("");
const to = ref("");
const running = store.running;

async function startCopy() {
  await store.startCopy(from.value, to.value);
}
</script>
