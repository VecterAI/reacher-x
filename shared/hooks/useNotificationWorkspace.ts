"use client";

import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "./useAuth";
import { usePreferredShellQueryArgs } from "./usePreferredShellQueryArgs";
import { useQueryWithStatus } from "./useQueryWithStatus";

/**
 * Resolves the workspace notifications should be scoped to for the current
 * shell context. Draft setup sessions without a target workspace intentionally
 * return null so they don't inherit another workspace's notifications.
 */
export function useNotificationWorkspace() {
  const { isAuthenticated } = useAuth();
  const preferredShellQueryArgs = usePreferredShellQueryArgs();
  const shellStateQuery = useQueryWithStatus(
    api.shell.getAppShellState,
    isAuthenticated ? preferredShellQueryArgs : "skip"
  );
  const shellState = shellStateQuery.data;

  const workspaceId = useMemo(() => {
    if (!shellState) {
      return null;
    }

    return shellState.notificationWorkspaceId ?? null;
  }, [shellState]);

  return {
    workspaceId,
    shellStateQuery,
  };
}
