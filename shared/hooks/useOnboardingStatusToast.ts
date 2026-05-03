"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@nanostores/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useAuth } from "./useAuth";
import { useActiveUseCaseLabels } from "./useActiveUseCaseLabels";
import { usePreferredShellQueryArgs } from "./usePreferredShellQueryArgs";
import { useQueryWithStatus } from "./useQueryWithStatus";
import { $preferredShellContext } from "@/shared/stores/preferredShellContext";

const ONBOARDING_DELAYED_FALLBACK_MESSAGE =
  "Setup is taking longer than expected. We're retrying automatically.";

/**
 * Shows safe onboarding status toasts based on canonical workspace navigation state.
 */
export function useOnboardingStatusToast() {
  const { isAuthenticated, isLoading } = useAuth();
  const { entityPlural } = useActiveUseCaseLabels();
  const preferredShellContext = useStore($preferredShellContext);
  const preferredShellQueryArgs = usePreferredShellQueryArgs();
  const navigationStateQuery = useQueryWithStatus(
    api.shell.getAppShellState,
    isAuthenticated ? preferredShellQueryArgs : "skip"
  );
  const workspaceStatusQuery = useQueryWithStatus(
    api.workspaces.getWorkspaceSetupStatus,
    isAuthenticated ? preferredShellQueryArgs : "skip"
  );
  const navigationState = navigationStateQuery.data;

  const lastIssueStatusRef = useRef<"none" | "delayed" | null>(null);
  const readyToastShownRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || isLoading || !navigationStateQuery.isSuccess)
      return;
    if (!navigationState) return;
    if (
      preferredShellContext === "workspace" &&
      workspaceStatusQuery.data?.status === "complete"
    ) {
      return;
    }

    const issueStatus = navigationState.userVisibleIssueState.status;
    const issueMessage =
      navigationState.userVisibleIssueState.message ??
      ONBOARDING_DELAYED_FALLBACK_MESSAGE;

    if (
      navigationState.lockState !== "ready" &&
      issueStatus === "delayed" &&
      lastIssueStatusRef.current !== "delayed"
    ) {
      toast.info("Workspace setup update", {
        id: "onboarding-delayed",
        description: issueMessage,
      });
    }

    if (
      navigationState.lockState === "ready" &&
      (navigationState.actionableReadyCount ??
        navigationState.readyQualifiedEnrichedCount) > 0 &&
      !readyToastShownRef.current
    ) {
      toast.success(`Your ${entityPlural.toLowerCase()} are ready`, {
        id: "onboarding-ready",
        description: `Qualified ${entityPlural.toLowerCase()} are now available.`,
      });
      readyToastShownRef.current = true;
      toast.dismiss("onboarding-delayed");
    }

    if (navigationState.lockState !== "ready") {
      readyToastShownRef.current = false;
    }

    if (issueStatus === "none" && lastIssueStatusRef.current === "delayed") {
      toast.dismiss("onboarding-delayed");
    }

    lastIssueStatusRef.current = issueStatus;
  }, [
    isAuthenticated,
    entityPlural,
    isLoading,
    navigationState,
    navigationStateQuery.isSuccess,
    preferredShellContext,
    workspaceStatusQuery.data?.status,
  ]);
}
