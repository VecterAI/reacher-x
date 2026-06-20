import { useSyncExternalStore } from "react";

export type PreferredShellContext = "workspace" | "setup_session";

const STORAGE_KEY = "reacherx.preferred-shell-context";
const listeners = new Set<() => void>();

let preferredShellContextState: PreferredShellContext | null = null;
let preferredShellContextClientSnapshotReady = false;

function parsePreferredShellContext(
  value: string | null
): PreferredShellContext | null {
  if (value === "workspace" || value === "setup_session") {
    return value;
  }

  return null;
}

function readStoredPreferredShellContext(): PreferredShellContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return parsePreferredShellContext(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function syncPreferredShellContextFromStorage() {
  preferredShellContextState = readStoredPreferredShellContext();
}

function subscribePreferredShellContext(onStoreChange: () => void) {
  listeners.add(onStoreChange);

  if (typeof window === "undefined") {
    return () => {
      listeners.delete(onStoreChange);
    };
  }

  queueMicrotask(() => {
    preferredShellContextClientSnapshotReady = true;
    syncPreferredShellContextFromStorage();
    emitChange();
  });

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      syncPreferredShellContextFromStorage();
      emitChange();
    }
  };

  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getPreferredShellContextSnapshot(): PreferredShellContext | null {
  if (typeof window === "undefined" || !preferredShellContextClientSnapshotReady) {
    return null;
  }

  return preferredShellContextState;
}

function getPreferredShellContextServerSnapshot(): PreferredShellContext | null {
  return null;
}

export function usePreferredShellContext(): PreferredShellContext | null {
  return useSyncExternalStore(
    subscribePreferredShellContext,
    getPreferredShellContextSnapshot,
    getPreferredShellContextServerSnapshot
  );
}

export function setPreferredShellContext(
  nextContext: PreferredShellContext | null
): void {
  preferredShellContextState = nextContext;

  if (typeof window === "undefined") {
    emitChange();
    return;
  }

  try {
    if (nextContext === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, nextContext);
    }
  } catch {
    // Ignore storage write failures and keep the in-memory preference.
  }

  emitChange();
}
