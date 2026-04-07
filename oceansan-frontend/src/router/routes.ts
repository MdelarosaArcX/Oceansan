import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/license',
  },
  {
    path: '/license',
    component: () => import('layouts/LicenseLayout.vue'),
    children: [{ path: '', component: () => import('pages/LicensePage.vue') }],
  },
  {
    path: '/dashboard',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/DashboardPage.vue') }],
  },
  {
    path: '/schedule',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/SchedulePage.vue') }],
  },
  {
    path: '/logs',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/LogsPage.vue') }],
  },
  {
    path: '/backup/sync',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/BackupSyncPage.vue') }],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
];

export default routes;
