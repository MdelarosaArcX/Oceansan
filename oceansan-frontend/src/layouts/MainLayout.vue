<template>
  <q-layout view="lHh Lpr lff">
    <q-header
      class="q-pl-md"
      style="border-bottom: 1px solid #505050"
      :class="$q.dark.isActive ? 'bg-base-dark-3' : 'bg-base-light-1 text-base-dark-2'"
    >
      <q-toolbar>
        <q-toolbar-title>{{ activeMenu }}</q-toolbar-title>

        <q-space />

        <!-- Dark mode toggle -->
        <q-btn flat round dense icon="notifications"> </q-btn>
        <q-btn flat round dense :icon="isDark ? 'dark_mode' : 'light_mode'" @click="toggleDark">
          <q-tooltip>
            {{ isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode' }}
          </q-tooltip>
        </q-btn>
      </q-toolbar>
    </q-header>
    <q-drawer
      v-model="drawer"
      show-if-above
      :width="200"
      :breakpoint="500"
      :class="$q.dark.isActive ? '' : 'bg-base-light-2 text-base-dark-2'"
    >
      <q-scroll-area style="height: calc(100% - 54px); margin-top: 43px">
        <q-list padding>
          <template v-for="(menuItem, index) in menuList" :key="index">
            <q-item
              clickable
              :to="menuItem.to"
              :class="[
                menuItem.label === activeMenu
                  ? Dark.isActive
                    ? 'bg-base-dark-3 text-base-light-2'
                    : 'bg-base-light-1 text-base-dark-2'
                  : Dark.isActive
                    ? 'bg-dark-page text-base-light-2'
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
      <q-img class="absolute-top" style="height: 54px">
        <div class="absolute-bottom bg-transparent" style="padding: 0px">
          <div class="text-weight-bold" :class="$q.dark.isActive ? '' : 'text-base-dark-2'">
            <q-img src="/oceansan.png" spinner-color="white" />
          </div>
        </div>
      </q-img>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import { Dark } from 'quasar';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const isDark = computed(() => Dark.isActive);

function toggleDark() {
  Dark.toggle();
  localStorage.setItem('dark-mode', String(Dark.isActive));
}

const drawer = ref(false);
const menuList = [
  {
    icon: 'dashboard',
    label: 'Dashboard',
    separator: false,
    to: '/dashboard',
  },
  {
    icon: 'monitor',
    label: 'Schedule',
    separator: false,
    to: '/',
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
  const current = menuList.find(item => item.to === route.path);
  return current?.label ?? '';
});
</script>
