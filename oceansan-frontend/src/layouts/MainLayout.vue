<template>
  <q-layout view="lHh Lpr lff">
    <q-header class="q-pl-md" style="border-bottom: 1px solid #505050;" :class="$q.dark.isActive ? 'bg-secondary' : 'bg-positive text-negative'">
      <q-toolbar>
        <q-toolbar-title>{{ activeMenu }}</q-toolbar-title>

        <q-space />

        <!-- Dark mode toggle -->
        <q-btn flat round dense icon="notifications">
        </q-btn>
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
      :class="$q.dark.isActive ? '' : 'bg-accent text-negative'"
    >
      <q-scroll-area style="height: calc(100% - 70px); margin-top: 70px">
        <q-list padding>
          <template v-for="(menuItem, index) in menuList" :key="index">
            <q-item
              clickable
              :class="[
                menuItem.label === activeMenu
                  ? Dark.isActive
                    ? 'bg-secondary text-accent'
                    : 'bg-positive text-negative'
                  : Dark.isActive
                    ? 'bg-dark-page text-accent'
                    : 'bg-light text-dark',
              ]"
              v-ripple
              @click="setActiveMenu(menuItem.label)"
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
      <q-img class="absolute-top" style="height: 70px">
        <div class="absolute-bottom bg-transparent">
          <div class="text-weight-bold" :class="$q.dark.isActive ? '' : 'text-negative'">
            OCEANSAN
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

const isDark = computed(() => Dark.isActive);

function toggleDark() {
  Dark.toggle();
  localStorage.setItem('dark-mode', String(Dark.isActive));
}

const drawer = ref(false);
const menuList = [
  {
    icon: 'monitor',
    label: 'Dashboard',
    separator: false,
  },
  {
    icon: 'history_toggle_off',
    label: 'Logs',
    separator: false,
  },
];
const activeMenu = ref('Dashboard');
function setActiveMenu(menu: string) {
  activeMenu.value = menu;
}
</script>
