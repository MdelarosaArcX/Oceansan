<template>
  <q-page class="license-page">
    <div class="license-card">
      <div class="text-h6 text-center">OceanSAN License</div>
      <div class="text-caption text-center text-grey-4">
        Enter your license key to activate this application.
      </div>

      <q-separator dark class="q-my-sm" />

      <div v-if="loading" class="text-center text-grey-4 q-pa-sm">
        Checking license status...
      </div>

      <div v-else>
        <q-banner
          v-if="error"
          class="q-mb-sm bg-red-10 text-white"
          dense
        >
          {{ error }}
        </q-banner>

        <q-banner
          v-if="success"
          class="q-mb-sm bg-green-10 text-white"
          dense
        >
          {{ success }}
        </q-banner>

        <q-input
          v-model="key"
          dense
          outlined
          input-class="text-white"
          placeholder="Enter license key"
          class="q-mb-sm"
          :disable="submitting"
          @keyup.enter="handleSubmit"
        />

        <q-btn
          label="Activate"
          color="grey-3"
          text-color="black"
          class="full-width"
          :loading="submitting"
          :disable="submitting"
          @click="handleSubmit"
        />
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "boot/axios";
import { setLicenseCache } from "boot/license-guard";

const router = useRouter();
const key = ref("");
const loading = ref(true);
const submitting = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);

async function checkLicense() {
  try {
    const res = await api.get("/license");
    if (res.data?.active) {
      await router.replace("/dashboard");
      return;
    }
  } catch (err) {
    console.error("Failed to check license:", err);
  } finally {
    loading.value = false;
  }
}

async function handleSubmit() {
  error.value = null;
  success.value = null;

  if (!key.value.trim()) {
    error.value = "License key is required.";
    return;
  }

  try {
    submitting.value = true;
    const res = await api.post("/license/activate", { key: key.value.trim() });
    success.value = res.data?.message || "License activated.";
    setLicenseCache({ active: true, expiresAt: res.data?.expiresAt ?? null });
    setTimeout(() => {
      void router.replace("/dashboard");
    }, 800);
  } catch (err: unknown) {
    console.error("License activation error:", err);
    const maybeAxios = err as { response?: { data?: { message?: string } } };
    error.value =
      maybeAxios.response?.data?.message || "Failed to activate license.";
  } finally {
    submitting.value = false;
  }
}

onMounted(checkLicense);
</script>

<style scoped>
.license-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f1921;
  color: #ffffff;
  padding: 24px;
}

.license-card {
  width: 100%;
  max-width: 420px;
  background: #1f2933;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
