"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { parseAsString, useQueryStates } from "nuqs";
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

export function useActiveUseCaseLabels() {
  const pathname = usePathname();
  const labelsCtx = useActiveUseCaseLabelsContext();
  const serverInitialUseCaseKey = labelsCtx?.serverInitialUseCaseKey ?? null;

  const isSetupRoute = pathname === "/agent/setup";
  const [{ threadId, action }] = useQueryStates({
    threadId: parseAsString,
    action: parseAsString,
  });
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
