<template>
  <q-page class="license-page" :style="pageBackgroundStyle">
    <div class="license-overlay" />

    <div class="license-content">
      <img :src="logoWhite" alt="OceanSAN" class="license-logo" />

      <div class="license-subtitle">Private Storage Made Simple</div>

      <div class="license-label">
        <span>Enter License Key</span>
        <div class="license-line"/>
      </div>
      

      <q-banner
        v-if="error"
        class="license-banner license-banner-error"
        dense
      >
        {{ error }}
      </q-banner>

      <q-banner
        v-if="success"
        class="license-banner license-banner-success"
        dense
      >
        {{ success }}
      </q-banner>

      <div v-if="loading" class="license-loading">Checking license status...</div>

      <div v-else class="license-form">
        <q-input
          v-model="formattedKeyInput"
          dense
          outlined
          class="license-input"
          input-class="license-input-value"
          placeholder="•••• - •••• - ••••"
          maxlength="14"
          :disable="submitting"
          @keyup.enter="handleSubmit"
        />

        <q-btn
          label="ACTIVATE"
          class="license-btn"
          :loading="submitting"
          :disable="submitting"
          @click="handleSubmit"
        />
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "boot/axios";
import { setLicenseCache } from "boot/license-guard";
import bgImage from "src/assets/license-bg.png";
import logoWhite from "src/assets/oceansan-white.png";

const router = useRouter();
const rawKey = ref("");
const loading = ref(true);
const submitting = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);
const pageBackgroundStyle = computed(() => ({
  backgroundImage: `url(${bgImage})`,
}));

const formattedKeyInput = computed({
  get: () => formatLicenseKey(rawKey.value),
  set: (value: string) => {
    rawKey.value = normalizeLicenseKey(value);
  },
});

function normalizeLicenseKey(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

function formatLicenseKey(value: string) {
  return normalizeLicenseKey(value).match(/.{1,4}/g)?.join("-") ?? "";
}

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

  if (!rawKey.value.trim()) {
    error.value = "License key is required.";
    return;
  }

  if (rawKey.value.length !== 12) {
    error.value = "License key must be 12 characters.";
    return;
  }

  try {
    submitting.value = true;
    const res = await api.post("/license/activate", {
      key: formatLicenseKey(rawKey.value),
    });
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
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  color: #ffffff;
  padding: 32px 20px;
}

.license-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.25);
}

.license-content {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.license-logo {
  width: min(340px, 78vw);
  height: auto;
}

.license-subtitle {
  margin-top: 8px;
  font-weight: 600;
  font-size: 15px;
  letter-spacing: 4.5px;
  color: rgba(255, 255, 255, 0.92);
  text-transform: capitalize;
}

.license-label {
  width: min(307px, 88vw);
  align-items: center;
  text-align: center;
  justify-content: center;
  gap: 10px;
  margin-top: 26px;
  color: #24cfff;
  font-size: 18px;
  font-weight: 600;
}

.license-line {
  height: 1.56px;
  width: 100%;
  background: rgba(39, 212, 255, 0.58);
}

.line {
  flex: 1;
  min-width: 30px;
  height: 1px;
  background: rgba(39, 212, 255, 0.58);
}

.license-loading {
  margin-top: 10px;
  color: rgba(255, 255, 255, 0.9);
}

.license-form {
  width: min(345px, 92vw);
  margin-top: 12px;
}

.license-banner {
  width: min(345px, 92vw);
  margin-top: 14px;
  border-radius: 12px;
}

.license-banner-error {
  background: rgba(207, 29, 56, 0.9);
  color: #fff;
}

.license-banner-success {
  background: rgba(13, 125, 80, 0.9);
  color: #fff;
}

.license-input {
  margin-bottom: 12px;
}

.license-btn {
  width: 100%;
  border-radius: 999px;
  height: 38px;
  background: #22cfff;
  color: #00395d;
  font-weight: 700;
}

.license-input :deep(.q-field__control) {
  border-radius: 999px;
  min-height: 40px;
  /* background: rgba(5, 26, 47, 0.48); */
}

.license-input :deep(.q-field__native),
.license-input :deep(.q-field__input) {
  color: #ffffff;
  text-align: center;
  font-size: 20px;
  letter-spacing: 4px;
  font-weight: 600;
}

.license-input :deep(.q-field__control:before) {
  border: 2px solid rgba(255, 255, 255, 0.94);
}

.license-input :deep(.q-field--focused .q-field__control:before),
.license-input :deep(.q-field--focused .q-field__control:after) {
  border-color: #29d5ff;
}

@media (max-width: 600px) {
  .license-subtitle {
    font-size: 11px;
    letter-spacing: 2px;
  }

  .license-label {
    font-size: 20px;
  }

  .license-input :deep(.q-field__native),
  .license-input :deep(.q-field__input) {
    font-size: 16px;
    letter-spacing: 3px;
  }
}
</style>
