<template>
  <router-view />
</template>

<script setup lang="ts">
//
import { useCopyStore } from "stores/copy.store";

const copyStore = useCopyStore();
copyStore.connect(); // ⬅ REQUIRED

</script>
