import {
  type WorkspaceUseCaseKey,
  isWorkspaceUseCaseKey,
} from "@/shared/lib/workspaceUseCases";

/** Shared by localStorage, document.cookie, and Next.js `cookies()`. */
export const WORKSPACE_USE_CASE_STORAGE_KEY = "rx.workspaceUseCaseKey";

/** Dispatched after `persistWorkspaceUseCaseKey` so same-tab subscribers can resync. */
export const WORKSPACE_USE_CASE_CACHE_CHANGED_EVENT =
  "rx-workspace-use-case-cache-changed";

let workspaceUseCaseLsClientSnapshotReady = false;

/**
 * useSyncExternalStore subscription for reading `WORKSPACE_USE_CASE_STORAGE_KEY`.
 * First client snapshot is `null` (matches SSR), then a microtask flips to the real localStorage value.
 */
export function subscribeWorkspaceUseCaseLocalStorage(
  onStoreChange: () => void
): () => void {
  if (typeof window === "undefined") return () => {};

  queueMicrotask(() => {
    workspaceUseCaseLsClientSnapshotReady = true;
    onStoreChange();
  });

  const onStorage = (e: StorageEvent) => {
    if (e.key === WORKSPACE_USE_CASE_STORAGE_KEY || e.key === null) {
      onStoreChange();
    }
  };
  const onCustom = () => onStoreChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(WORKSPACE_USE_CASE_CACHE_CHANGED_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(
      WORKSPACE_USE_CASE_CACHE_CHANGED_EVENT,
      onCustom
    );
  };
}

export function getWorkspaceUseCaseLocalStorageSnapshot(): WorkspaceUseCaseKey | null {
  if (typeof window === "undefined") return null;
  if (!workspaceUseCaseLsClientSnapshotReady) return null;
  return readWorkspaceUseCaseCache();
}

export function getWorkspaceUseCaseLocalStorageServerSnapshot(): WorkspaceUseCaseKey | null {
  return null;
}

export function parseWorkspaceUseCaseKeyParam(
  value: string | undefined
): WorkspaceUseCaseKey | null {
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value);
    return isWorkspaceUseCaseKey(decoded) ? decoded : null;
  } catch {
    return isWorkspaceUseCaseKey(value) ? value : null;
  }
}

export function readWorkspaceUseCaseCache(): WorkspaceUseCaseKey | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_USE_CASE_STORAGE_KEY);
    return isWorkspaceUseCaseKey(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** @deprecated Use persistWorkspaceUseCaseKey */
export function writeWorkspaceUseCaseCache(key: WorkspaceUseCaseKey): void {
  persistWorkspaceUseCaseKey(key);
}

/**
 * Persists the active workspace use-case key for the next full page load:
 * - localStorage (SPA navigations, same-tab)
 * - cookie (SSR + first paint on refresh / new tab)
 */
export function persistWorkspaceUseCaseKey(key: WorkspaceUseCaseKey): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WORKSPACE_USE_CASE_STORAGE_KEY, key);
  } catch {
    // ignore quota / private mode
  }
  try {
    const maxAgeSeconds = 60 * 60 * 24 * 400; // ~400 days
    const secure =
      typeof window !== "undefined" && window.location.protocol === "https:";
    document.cookie = `${WORKSPACE_USE_CASE_STORAGE_KEY}=${encodeURIComponent(key)};path=/;max-age=${maxAgeSeconds};SameSite=Lax${secure ? ";Secure" : ""}`;
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new Event(WORKSPACE_USE_CASE_CACHE_CHANGED_EVENT));
  } catch {
    // ignore
  }
}
