import type {
  UsageCycleOption,
  UsageDashboardData,
  UsageWorkspaceTemplate,
} from "./types";

export const USAGE_LAYOUT_CACHE_KEY = "RX_USAGE_LAYOUT_V1";

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
  if (!raw) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded) as unknown;

    if (parsed && typeof parsed === "object") {
      return parsed as UsageLayoutCache;
    }

    return null;
  } catch {
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

export function writeUsageLayoutCache(cache: UsageLayoutCache) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const serialized = JSON.stringify(cache);
    window.localStorage.setItem(USAGE_LAYOUT_CACHE_KEY, serialized);

    const maxAgeSeconds = 60 * 60 * 24 * 30;
    const secure =
      typeof window !== "undefined" && window.location.protocol === "https:";
    document.cookie = `${USAGE_LAYOUT_CACHE_KEY}=${encodeURIComponent(serialized)};path=/;max-age=${maxAgeSeconds};SameSite=Lax${secure ? ";Secure" : ""}`;
  } catch {
    // ignore quota or private mode errors
  }
}
