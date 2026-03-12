"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { parseAsString, useQueryStates } from "nuqs";
import { useStore } from "@nanostores/react";
import { useSetupThreadDraft } from "./useSetupThreadDraft";
import { useWorkspace } from "./useWorkspace";
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
  const isSetupRoute = pathname === "/agent/setup";
  const [{ threadId, action }] = useQueryStates({
    threadId: parseAsString,
    action: parseAsString,
  });
  const optimisticSetupUseCaseKey = useStore($setupUseCaseDraftKey);
  const { workspace } = useWorkspace();
  const { setupDraft } = useSetupThreadDraft(isSetupRoute ? threadId : null);

  useEffect(() => {
    if (!isSetupRoute && optimisticSetupUseCaseKey !== null) {
      setSetupUseCaseDraftKey(null);
    }
  }, [isSetupRoute, optimisticSetupUseCaseKey]);

  const persistedUseCaseKey =
    workspace?.useCaseKey ?? DEFAULT_WORKSPACE_USE_CASE_KEY;
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
