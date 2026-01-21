import type { QVueGlobals } from 'quasar';

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $q: QVueGlobals;
  }
}
