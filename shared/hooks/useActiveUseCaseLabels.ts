"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useStore } from "@nanostores/react";
import { useSetupThreadDraft } from "./useSetupThreadDraft";
import { useWorkspace } from "./useWorkspace";
import {
  getWorkspaceUseCaseLocalStorageServerSnapshot,
  getWorkspaceUseCaseLocalStorageSnapshot,
  subscribeWorkspaceUseCaseLocalStorage,
} from "@/shared/lib/workspaceUseCaseCache";
import { useActiveUseCaseLabelsContext } from "@/shared/contexts/ActiveUseCaseLabelsProvider";
import {
  DEFAULT_WORKSPACE_USE_CASE_KEY,
  getWorkspaceUseCase,
} from "@/shared/lib/workspaceUseCases";
import { getWorkspaceRoutes } from "@/shared/lib/workspaceRoutes";
import {
  $setupUseCaseDraftKey,
  setSetupUseCaseDraftKey,
} from "@/shared/stores/setupUseCaseDraft";

const locationSearchListeners = new Set<() => void>();

let locationSearchClientSnapshotReady = false;
let historyPatched = false;
let locationSearchChangeScheduled = false;
let popstateListenerAttached = false;

function emitLocationSearchChange() {
  for (const listener of locationSearchListeners) {
    listener();
  }
}

function scheduleLocationSearchChange() {
  if (locationSearchChangeScheduled) {
    return;
  }

  locationSearchChangeScheduled = true;

  // Defer notifications so router history mutations never trigger synchronous
  // updates during React's navigation effects.
  queueMicrotask(() => {
    locationSearchChangeScheduled = false;
    emitLocationSearchChange();
  });
}

function patchHistoryForSearchSubscriptions() {
  if (typeof window === "undefined" || historyPatched) {
    return;
  }

  const originalPushState = window.history.pushState.bind(window.history);
  const originalReplaceState = window.history.replaceState.bind(window.history);

  window.history.pushState = (...args) => {
    originalPushState(...args);
    scheduleLocationSearchChange();
  };

  window.history.replaceState = (...args) => {
    originalReplaceState(...args);
    scheduleLocationSearchChange();
  };

  historyPatched = true;
}

function ensureLocationSearchBrowserSubscriptions() {
  if (typeof window === "undefined") {
    return;
  }

  patchHistoryForSearchSubscriptions();

  if (popstateListenerAttached) {
    return;
  }

  window.addEventListener("popstate", scheduleLocationSearchChange);
  popstateListenerAttached = true;
}

function subscribeLocationSearch(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  locationSearchListeners.add(onStoreChange);
  ensureLocationSearchBrowserSubscriptions();

  queueMicrotask(() => {
    if (!locationSearchClientSnapshotReady) {
      locationSearchClientSnapshotReady = true;
      emitLocationSearchChange();
      return;
    }

    onStoreChange();
  });

  return () => {
    locationSearchListeners.delete(onStoreChange);
  };
}

function getLocationSearchSnapshot(): string {
  if (typeof window === "undefined" || !locationSearchClientSnapshotReady) {
    return "";
  }

  return window.location.search;
}

function getLocationSearchServerSnapshot(): string {
  return "";
}

export function useActiveUseCaseLabels() {
  const pathname = usePathname();
  const labelsCtx = useActiveUseCaseLabelsContext();
  const serverInitialUseCaseKey = labelsCtx?.serverInitialUseCaseKey ?? null;

  const isSetupRoute = pathname === "/agent/setup";
  const locationSearch = useSyncExternalStore(
    subscribeLocationSearch,
    getLocationSearchSnapshot,
    getLocationSearchServerSnapshot
  );
  const setupSearchParams = useMemo(
    () => (isSetupRoute ? new URLSearchParams(locationSearch) : null),
    [isSetupRoute, locationSearch]
  );
  const threadId = setupSearchParams?.get("threadId") ?? null;
  const action = setupSearchParams?.get("action") ?? null;
  const optimisticSetupUseCaseKey = useStore($setupUseCaseDraftKey);
  const { workspace } = useWorkspace();
  const { setupDraft } = useSetupThreadDraft(isSetupRoute ? threadId : null);

  const lsFromStore = useSyncExternalStore(
    subscribeWorkspaceUseCaseLocalStorage,
    getWorkspaceUseCaseLocalStorageSnapshot,
    getWorkspaceUseCaseLocalStorageServerSnapshot
  );

  useEffect(() => {
    if (!isSetupRoute && optimisticSetupUseCaseKey !== null) {
      setSetupUseCaseDraftKey(null);
    }
  }, [isSetupRoute, optimisticSetupUseCaseKey]);

  /**
   * Resolution order:
   * 1. Live Convex workspace (authoritative when loaded)
   * 2. localStorage (via useSyncExternalStore; first client snapshot is null to match SSR, then reads cache)
   * 3. Cookie / server initial from layout, then product default
   */
  const persistedUseCaseKey =
    workspace?.useCaseKey ??
    lsFromStore ??
    serverInitialUseCaseKey ??
    DEFAULT_WORKSPACE_USE_CASE_KEY;

  const setupFallbackUseCaseKey =
    action === "newWorkspace"
      ? DEFAULT_WORKSPACE_USE_CASE_KEY
      : persistedUseCaseKey;
  const activeUseCaseKey = isSetupRoute
    ? (optimisticSetupUseCaseKey ??
      setupDraft?.useCaseKey ??
      setupFallbackUseCaseKey)
    : persistedUseCaseKey;

  const activeUseCase = useMemo(
    () => getWorkspaceUseCase(activeUseCaseKey),
    [activeUseCaseKey]
  );
  const routes = useMemo(
    () => getWorkspaceRoutes(activeUseCaseKey),
    [activeUseCaseKey]
  );

  return {
    activeUseCase,
    activeUseCaseKey: activeUseCase.key,
    entitySingular: activeUseCase.entitySingular,
    entityPlural: activeUseCase.entityPlural,
    pageLabels: activeUseCase.pageLabels,
    profileLabelPlural: activeUseCase.profileLabelPlural,
    routes,
    stageLabels: activeUseCase.stageLabels,
    successLabel: activeUseCase.pageLabels.converts,
    isSetupRoute,
    isUsingSetupDraft:
      isSetupRoute &&
      Boolean(optimisticSetupUseCaseKey ?? setupDraft?.useCaseKey),
  };
}
