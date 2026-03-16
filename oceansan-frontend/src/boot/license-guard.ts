import { boot } from "quasar/wrappers";
import { api } from "./axios";

type LicenseStatus = {
  active: boolean;
  expired?: boolean;
  expiresAt?: string | null;
};

const CACHE_TTL_MS = 30_000;
let cache: { status: LicenseStatus | null; checkedAt: number } = {
  status: null,
  checkedAt: 0,
};

export function setLicenseCache(status: LicenseStatus) {
  cache = { status, checkedAt: Date.now() };
}

async function fetchStatus() {
  const now = Date.now();
  if (cache.status && now - cache.checkedAt < CACHE_TTL_MS) {
    return cache.status;
  }

  try {
    const { data } = await api.get<LicenseStatus>("/license");
    cache = { status: data, checkedAt: now };
    return data;
  } catch {
    const fallback = { active: false };
    cache = { status: fallback, checkedAt: now };
    return fallback;
  }
}

export default boot(({ router }) => {
  router.beforeEach(async (to) => {
    if (to.path === "/license") {
      const status = await fetchStatus();
      if (status.active) {
        return { path: "/dashboard", replace: true };
      }
      return true;
    }

    const status = await fetchStatus();
    if (!status.active) {
      return { path: "/license", replace: true };
    }
    return true;
  });
});
