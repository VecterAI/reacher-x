"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useAuth } from "./useAuth";

const ONBOARDING_DELAYED_FALLBACK_MESSAGE =
  "Setup is taking longer than expected. We're retrying automatically.";

/**
 * Shows safe onboarding status toasts based on canonical workspace navigation state.
 */
export function useOnboardingStatusToast() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigationState = useQuery(
    api.workspaces.getWorkspaceNavigationState,
    isAuthenticated ? {} : "skip"
  );

  const lastIssueStatusRef = useRef<"none" | "delayed" | null>(null);
  const readyToastShownRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || isLoading || !navigationState) return;

    const issueStatus = navigationState.userVisibleIssueState.status;
    const issueMessage =
      navigationState.userVisibleIssueState.message ??
      ONBOARDING_DELAYED_FALLBACK_MESSAGE;

    if (
      navigationState.lockState === "locked" &&
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
      navigationState.readyQualifiedEnrichedCount > 0 &&
      !readyToastShownRef.current
    ) {
      toast.success("Your prospects are ready", {
        id: "onboarding-ready",
        description: "Qualified prospects are now available.",
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
  }, [isAuthenticated, isLoading, navigationState]);
}
