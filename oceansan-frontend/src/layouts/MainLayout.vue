<template>
  <q-layout view="hHh Lpr lff">
    <q-header
      class="q-pl-md"
      :class="$q.dark.isActive ? 'bg-base-dark-2' : 'bg-accent text-base-dark-2'"
    >
      <q-toolbar style="height: 82px">
        <q-img src="/oceansan.png" spinner-color="white" style="width: 186px" />

        <q-space />
        <q-chip color="primary" text-color="base-dark-2">Network: {{ networkLabel }}</q-chip>
        <q-chip color="primary" text-color="base-dark-2">RAM Usage: {{ ramUsageLabel }}</q-chip>
        <q-chip color="primary" text-color="base-dark-2">CPU Usage: {{ cpuUsageLabel }}</q-chip>
        <!-- <q-btn flat round dense :color="statusButtonColor" :icon="statusButtonIcon">
          <q-tooltip>Status</q-tooltip>
          <q-menu anchor="bottom right" self="top right">
            <q-list style="min-width: 260px">
              <q-item>
                <q-item-section avatar>
                  <q-icon :name="backendStatusIcon" :color="backendStatusColor" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Backend Service</q-item-label>
                  <q-item-label caption>{{ backendStatusLabel }}</q-item-label>
                </q-item-section>
              </q-item>

              <q-separator />

              <q-item>
                <q-item-section avatar>
                  <q-icon name="desktop_windows" color="accent" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>OS Type</q-item-label>
                  <q-item-label caption>{{ osStatus }}</q-item-label>
                </q-item-section>
              </q-item>

              <q-separator />

              <q-item>
                <q-item-section avatar>
                  <q-icon name="memory" color="secondary" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>RAM Memory</q-item-label>
                  <q-item-label caption>{{ ramStatus }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn> -->

        <!-- Dark mode toggle -->
        <!-- <q-btn flat round dense icon="notifications"> </q-btn> -->
        <!-- <q-btn flat round dense :icon="isDark ? 'dark_mode' : 'light_mode'" @click="toggleDark">
          <q-tooltip>
            {{ isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode' }}
          </q-tooltip>
        </q-btn> -->
        <q-btn flat round dense icon="settings" @click="dialogSettings = true"> </q-btn>
      </q-toolbar>
    </q-header>
    <q-drawer
      v-model="drawer"
      show-if-above
      :width="200"
      :breakpoint="500"
      :class="$q.dark.isActive ? 'bg-base-dark-4' : 'bg-accent text-base-dark-2'"
    >
      <q-scroll-area style="height: calc(100% - 54px)">
        <q-list padding>
          <template v-for="(menuItem, index) in menuList" :key="index">
            <q-item
              clickable
              :to="menuItem.to"
              :class="[
                menuItem.label === activeMenu
                  ? Dark.isActive
                    ? 'bg-base-dark-5 text-white text-bold'
                    : 'bg-base-light-2 text-base-dark-2'
                  : Dark.isActive
                    ? 'bg-dark-page text-white'
                    : 'bg-light text-dark',
              ]"
              v-ripple
            >
              <q-item-section avatar>
                <q-icon :name="menuItem.icon" />
              </q-item-section>
              <q-item-section>
                {{ menuItem.label }}
              </q-item-section>
            </q-item>
            <q-separator :key="'sep' + index" v-if="menuItem.separator" />
          </template>
        </q-list>
      </q-scroll-area>
    </q-drawer>

    <q-page-container>
      <router-view />
      <SettingsDialog v-model="dialogSettings" />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { Dark } from 'quasar';
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useCopyStore } from 'src/stores/copy.store';
import SettingsDialog from 'src/components/SettingsDialog.vue';

// const isDark = computed(() => Dark.isActive);

// function toggleDark() {
//   Dark.toggle();
//   localStorage.setItem('dark-mode', String(Dark.isActive));
// }

const store = useCopyStore();
onMounted(() => {
  store.connect();
});

const dialogSettings = ref<boolean>(false);
const drawer = ref(false);
const menuList = [
  {
    icon: 'dashboard',
    label: 'Dashboard',
    separator: false,
    to: '/dashboard',
  },
  {
    icon: 'event_available',
    label: 'Schedule',
    separator: false,
    to: '/schedule',
  },
  {
    icon: 'cloud_sync',
    label: 'Backup / Sync',
    separator: false,
    to: '/backup/sync',
  },
  {
    icon: 'history_toggle_off',
    label: 'Logs',
    separator: false,
    to: '/logs',
  },
  
];
const route = useRoute();

const activeMenu = computed(() => {
  const current = menuList.find((item) => item.to === route.path);
  return current?.label ?? '';
});

const networkLabel = computed(() => {
  if (store.networkMbps === null) return '-- gbps';

  const mbps = Math.max(store.networkMbps, 0);

  if (mbps >= 1000) {
    return `${(mbps / 1000).toFixed(3)} gbps`;
  }

  if (mbps >= 1) {
    return `${mbps.toFixed(2)} mbps`;
  }

  return `${(mbps * 1000).toFixed(2)} kbps`;
});

const ramUsageLabel = computed(() => {
  if (store.ramUsagePercent === null) return '--%';
  return `${store.ramUsagePercent.toFixed(1)}%`;
});

const cpuUsageLabel = computed(() => {
  if (store.cpuUsagePercent === null) return '--%';
  return `${store.cpuUsagePercent.toFixed(1)}%`;
});

// const backendStatusLabel = computed(() => {
//   if (store.backendStatus === 'online') return 'Online';
//   if (store.backendStatus === 'connecting') return 'Connecting';
//   return 'Offline';
// });

// const backendStatusColor = computed(() => {
//   if (store.backendStatus === 'online') return 'positive';
//   if (store.backendStatus === 'connecting') return 'warning';
//   return 'negative';
// });

// const backendStatusIcon = computed(() => {
//   if (store.backendStatus === 'online') return 'dns';
//   if (store.backendStatus === 'connecting') return 'sync';
//   return 'portable_wifi_off';
// });

// const statusButtonIcon = computed(() => {
//   if (store.backendStatus === 'online') return 'monitor_heart';
//   if (store.backendStatus === 'connecting') return 'troubleshoot';
//   return 'warning_amber';
// });

// const statusButtonColor = computed(() => {
//   if (store.backendStatus === 'online') return 'positive';
//   if (store.backendStatus === 'connecting') return 'warning';
//   return 'negative';
// });

// const ramStatus = computed(() => {
//   if (!store.rssMB && !store.freeGB) return 'Waiting...';
//   const parts = [];
//   if (store.rssMB) parts.push(`App ${store.rssMB} MB`);
//   if (store.freeGB) parts.push(`Free ${store.freeGB} GB`);
//   return parts.join(' | ');
// });

// const osStatus = computed(() => {
//   if (store.osType && store.osPlatform) {
//     return `${store.osType} (${store.osPlatform})`;
//   }

//   if (store.osType) return store.osType;
//   return 'Waiting...';
// });
</script>

<style>
.q-list {
  padding: 0;
}
</style>
