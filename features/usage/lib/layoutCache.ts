import type {
  UsageCycleOption,
  UsageDashboardData,
  UsageWorkspaceTemplate,
} from "./types";

export const USAGE_LAYOUT_CACHE_KEY = "RX_USAGE_LAYOUT_V1";
export const USAGE_LAYOUT_CACHE_CHANGED_EVENT = "rx-usage-layout-cache-changed";

let usageLayoutClientSnapshotReady = false;
let cachedUsageLayoutRaw: string | null | undefined;
let cachedUsageLayoutValue: UsageLayoutCache | null = null;

export type UsageLayoutCache = {
  cycleOptions: UsageCycleOption[];
  perWorkspaceLimit: number;
  planLabel: string;
  planTier: UsageDashboardData["summary"]["plan"]["tier"];
  resetDaysLeft: number;
  resetLabel: string;
  selectedCycleKey: string;
  workspaceTemplates: UsageWorkspaceTemplate[];
  workspacesLimit: number;
  workspacesUsed: number;
};

export function parseUsageLayoutCache(
  raw: string | null | undefined
): UsageLayoutCache | null {
  if (raw === cachedUsageLayoutRaw) {
    return cachedUsageLayoutValue;
  }

  if (!raw) {
    cachedUsageLayoutRaw = raw;
    cachedUsageLayoutValue = null;
    return null;
  }

  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded) as unknown;

    if (parsed && typeof parsed === "object") {
      cachedUsageLayoutRaw = raw;
      cachedUsageLayoutValue = parsed as UsageLayoutCache;
      return cachedUsageLayoutValue;
    }

    cachedUsageLayoutRaw = raw;
    cachedUsageLayoutValue = null;
    return null;
  } catch {
    cachedUsageLayoutRaw = raw;
    cachedUsageLayoutValue = null;
    return null;
  }
}

export function readUsageLayoutCache(): UsageLayoutCache | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return parseUsageLayoutCache(
      window.localStorage.getItem(USAGE_LAYOUT_CACHE_KEY)
    );
  } catch {
    return null;
  }
}

export function subscribeUsageLayoutCache(
  onStoreChange: () => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  queueMicrotask(() => {
    usageLayoutClientSnapshotReady = true;
    onStoreChange();
  });

  const onStorage = (event: StorageEvent) => {
    if (event.key === USAGE_LAYOUT_CACHE_KEY || event.key === null) {
      onStoreChange();
    }
  };
  const onCustom = () => onStoreChange();

  window.addEventListener("storage", onStorage);
  window.addEventListener(USAGE_LAYOUT_CACHE_CHANGED_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(USAGE_LAYOUT_CACHE_CHANGED_EVENT, onCustom);
  };
}

export function getUsageLayoutCacheSnapshot(): UsageLayoutCache | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!usageLayoutClientSnapshotReady) {
    return null;
  }

  return readUsageLayoutCache();
}

export function getUsageLayoutCacheServerSnapshot(): UsageLayoutCache | null {
  return null;
}

export function writeUsageLayoutCache(cache: UsageLayoutCache) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const serialized = JSON.stringify(cache);
    const currentRaw = window.localStorage.getItem(USAGE_LAYOUT_CACHE_KEY);
    cachedUsageLayoutRaw = serialized;
    cachedUsageLayoutValue = cache;

    if (currentRaw === serialized) {
      return;
    }

    window.localStorage.setItem(USAGE_LAYOUT_CACHE_KEY, serialized);
  } catch {
    // ignore quota or private mode errors
  }

  try {
    window.dispatchEvent(new Event(USAGE_LAYOUT_CACHE_CHANGED_EVENT));
  } catch {
    // ignore event dispatch errors
  }
}
