/**
 * Safe localStorage utilities with error handling
 * Handles browser compatibility and storage quotas gracefully
 */

// Storage keys
export const STORAGE_KEYS = {
  WORKSPACE_DESCRIPTION: "workspace_description",
  WORKSPACE_NAME: "workspace_name",
  WORKSPACE_SOURCE_URL: "workspace_source_url",
  ONBOARDING_COMPLETED: "RX_ONBOARDING_COMPLETED",
  TOUR_STATE_V1: "rx.tour.v1",
} as const;

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    if (typeof window === "undefined") {
      return false;
    }
    const test = "__localStorage_test__";
    localStorage.setItem(test, "test");
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely get an item from localStorage
 */
export function getLocalStorage(key: string): string | null {
  try {
    if (!isLocalStorageAvailable()) {
      return null;
    }
    return localStorage.getItem(key);
  } catch {
    // Keep console here minimal: this util is used very frequently; avoid noisy logs even in dev
    return null;
  }
}

/**
 * Safely set an item in localStorage
 */
export function setLocalStorage(key: string, value: string): boolean {
  try {
    if (!isLocalStorageAvailable()) {
      return false;
    }
    localStorage.setItem(key, value);
    // Dispatch a custom event to notify listeners within the same page.
    // Defer dispatch to avoid synchronous state updates during render.
    queueMicrotask(() => {
      try {
        window.dispatchEvent(
          new CustomEvent("onLocalStorageChange", { detail: { key } })
        );
      } catch {}
    });
    return true;
  } catch {
    // Silent failure to avoid noise and PII; callers can handle missing values
    return false;
  }
}

/**
 * Safely remove an item from localStorage
 */
export function removeLocalStorage(key: string): boolean {
  try {
    if (!isLocalStorageAvailable()) {
      return false;
    }
    localStorage.removeItem(key);
    return true;
  } catch {
    // Silent failure to avoid noise and PII
    return false;
  }
}

/**
 * Store workspace description for non-signed-in users
 */
export function storeWorkspaceDescription(description: string): boolean {
  return setLocalStorage(STORAGE_KEYS.WORKSPACE_DESCRIPTION, description);
}

/**
 * Get workspace description for non-signed-in users
 */
export function getWorkspaceDescription(): string | null {
  return getLocalStorage(STORAGE_KEYS.WORKSPACE_DESCRIPTION);
}

/**
 * Store workspace name for non-signed-in users
 */
export function storeWorkspaceName(name: string): boolean {
  return setLocalStorage(STORAGE_KEYS.WORKSPACE_NAME, name);
}

/**
 * Get workspace name for non-signed-in users
 */
export function getWorkspaceName(): string | null {
  return getLocalStorage(STORAGE_KEYS.WORKSPACE_NAME);
}

/**
 * Store workspace source URL (provenance for URL-generated descriptions)
 */
export function storeWorkspaceSourceUrl(url: string): boolean {
  return setLocalStorage(STORAGE_KEYS.WORKSPACE_SOURCE_URL, url);
}

/**
 * Get workspace source URL (if previously stored locally)
 */
export function getWorkspaceSourceUrl(): string | null {
  return getLocalStorage(STORAGE_KEYS.WORKSPACE_SOURCE_URL);
}

/**
 * Clear all workspace data
 */
export function clearWorkspaceData(): boolean {
  const descriptionRemoved = removeLocalStorage(
    STORAGE_KEYS.WORKSPACE_DESCRIPTION
  );
  const nameRemoved = removeLocalStorage(STORAGE_KEYS.WORKSPACE_NAME);
  const sourceUrlRemoved = removeLocalStorage(
    STORAGE_KEYS.WORKSPACE_SOURCE_URL
  );
  return descriptionRemoved && nameRemoved && sourceUrlRemoved;
}

export function markOnboardingCompleted(): boolean {
  return setLocalStorage(STORAGE_KEYS.ONBOARDING_COMPLETED, String(Date.now()));
}

export function hasOnboardingCompletedLocally(): boolean {
  return !!getLocalStorage(STORAGE_KEYS.ONBOARDING_COMPLETED);
}

export function clearOnboardingCompleted(): boolean {
  return removeLocalStorage(STORAGE_KEYS.ONBOARDING_COMPLETED);
}

/**
 * Get locally stored tour state (v1) if present
 */
export function getLocalTourStateV1(): Record<string, unknown> | null {
  try {
    const raw = getLocalStorage(STORAGE_KEYS.TOUR_STATE_V1);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object")
      return parsed as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear locally stored tour state (v1)
 */
export function clearLocalTourStateV1(): boolean {
  return removeLocalStorage(STORAGE_KEYS.TOUR_STATE_V1);
}

/**
 * Clear all application-specific localStorage data.
 * This deliberately preserves unrelated keys (e.g., from other apps) by
 * removing only known prefixes/keys we use.
 */
export function clearAllLocalAppData(): void {
  try {
    if (typeof window === "undefined" || !("localStorage" in window)) return;

    // Explicit keys used across the app
    const explicitKeys = [
      STORAGE_KEYS.WORKSPACE_DESCRIPTION,
      STORAGE_KEYS.WORKSPACE_NAME,
      STORAGE_KEYS.WORKSPACE_SOURCE_URL,
      STORAGE_KEYS.ONBOARDING_COMPLETED,
      STORAGE_KEYS.TOUR_STATE_V1,
      // Common feature storage keys
      "RX_SORT_SETTINGS",
      "RX_FILTER_SETTINGS",
      "RX_SEARCH_HISTORY",
      "RX_VOTE_CACHE",
      // next-themes default key
      "theme",
    ];

    for (const key of explicitKeys) {
      try {
        window.localStorage.removeItem(key);
      } catch {}
    }

    // Remove any keys that clearly belong to our namespace prefixes
    const namespacePrefixes = ["RX_", "reacherx_", "reacher-x_"];
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (namespacePrefixes.some((p) => key.startsWith(p))) {
        try {
          window.localStorage.removeItem(key);
        } catch {}
      }
    }

    // Notify listeners within the page
    try {
      window.dispatchEvent(
        new CustomEvent("onLocalStorageChange", { detail: { key: "*" } })
      );
    } catch {}
  } catch {
    // Silent failure in production; safe to ignore
  }
}
