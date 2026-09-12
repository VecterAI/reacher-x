"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { useQueryWithStatus } from "@/shared/hooks/useQueryWithStatus";
import { parseAsString, useQueryStates } from "nuqs";
import { api } from "@/convex/_generated/api";
import { showStyleSyncIssueToast } from "@/features/linked-accounts/lib/styleSyncIssueToast";
import { logger } from "@/shared/lib/logger";
import { toast } from "sonner";
import { finishLinkedInConnection } from "@/features/linked-accounts/lib/linkedinConnectionHelpers";

export type LinkedInConnectionStatus = {
  isConnected: boolean;
  status?:
    | "connected"
    | "connecting"
    | "reconnect_required"
    | "action_required"
    | "restricted"
    | "disconnected";
  accountId?: string;
  providerId?: string;
  entityUrn?: string;
  username?: string;
  publicIdentifier?: string;
  displayName?: string;
  headline?: string;
  profileImageUrl?: string;
  publicProfileUrl?: string;
  premiumFeatures?: string[];
  connectedAt?: number;
  styleSyncIssue?: {
    key: string;
    lastError?: string;
  };
};

export interface UseLinkedInAccountConnectionOptions {
  callbackUrl?: string;
  enabled?: boolean;
  showStyleSyncIssueToast?: boolean;
}

export function useLinkedInAccountConnection({
  callbackUrl,
  enabled = true,
  showStyleSyncIssueToast: shouldShowStyleSyncIssueToast = false,
}: UseLinkedInAccountConnectionOptions) {
  const linkedinApi = api.linkedin;
  const [{ linkedin_status, account_id }, setParams] = useQueryStates({
    linkedin_status: parseAsString,
    account_id: parseAsString,
  });

  const getLinkedInStatus = useAction(linkedinApi.getLinkedInConnectionStatus);
  const syncLinkedInConnection = useAction(linkedinApi.syncLinkedInConnection);
  const getLinkedInConnectLink = useAction(linkedinApi.getLinkedInConnectLink);
  const disconnectLinkedIn = useAction(linkedinApi.disconnectLinkedIn);
  const getLinkedInStatusRef = useRef(getLinkedInStatus);
  const syncLinkedInConnectionRef = useRef(syncLinkedInConnection);
  const shownStyleSyncIssueKeyRef = useRef<string | null>(null);
  const styleSyncRefreshTimeoutsRef = useRef<number[]>([]);

  const statusQuery = useQueryWithStatus(
    api.connectedAccounts.getConnectionSnapshot,
    enabled ? { platform: "linkedin" } : "skip"
  );
  const linkedinStatus =
    statusQuery.data?.platform === "linkedin" ? statusQuery.data : null;
  const [isFinalizing, setIsFinalizing] = useState(false);
  const finalizedCallbackRef = useRef(false);
  const finalizingRef = useRef(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  // Keep the populated list visible during post-connect background rechecks.
  const statusLoading = enabled && statusQuery.isPending;

  useEffect(() => {
    getLinkedInStatusRef.current = getLinkedInStatus;
  }, [getLinkedInStatus]);

  useEffect(() => {
    syncLinkedInConnectionRef.current = syncLinkedInConnection;
  }, [syncLinkedInConnection]);

  const clearStyleSyncRefreshTimeouts = useCallback(() => {
    for (const timeoutId of styleSyncRefreshTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }
    styleSyncRefreshTimeoutsRef.current = [];
  }, []);

  const clearQueryParams = useCallback(() => {
    setParams(
      {
        linkedin_status: null,
        account_id: null,
      },
      { history: "replace" }
    );
  }, [setParams]);

  const refreshStatus = useCallback(async () => {
    if (!enabled) {
      return null;
    }

    try {
      const nextStatus = await getLinkedInStatusRef.current({});
      if (!finalizedCallbackRef.current) setStatusError(null);
      return nextStatus;
    } catch (err) {
      logger.warn("Failed to load LinkedIn connection status:", err);
      if (!finalizedCallbackRef.current) {
        setStatusError(
          err instanceof Error ? err.message : "Unable to load LinkedIn status."
        );
      }
      return null;
    }
  }, [enabled]);

  const schedulePostConnectStatusChecks = useCallback(() => {
    if (!shouldShowStyleSyncIssueToast || typeof window === "undefined") {
      return;
    }

    clearStyleSyncRefreshTimeouts();
    for (const delayMs of [4_000, 12_000, 30_000]) {
      const timeoutId = window.setTimeout(() => {
        void refreshStatus();
      }, delayMs);
      styleSyncRefreshTimeoutsRef.current.push(timeoutId);
    }
  }, [
    clearStyleSyncRefreshTimeouts,
    refreshStatus,
    shouldShowStyleSyncIssueToast,
  ]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    return () => {
      clearStyleSyncRefreshTimeouts();
    };
  }, [clearStyleSyncRefreshTimeouts]);

  useEffect(() => {
    const issue = linkedinStatus?.styleSyncIssue;
    if (
      !shouldShowStyleSyncIssueToast ||
      linkedinStatus?.status !== "connected" ||
      !issue?.key ||
      shownStyleSyncIssueKeyRef.current === issue.key
    ) {
      return;
    }

    shownStyleSyncIssueKeyRef.current = issue.key;
    showStyleSyncIssueToast({
      issue,
      platform: "linkedin",
    });
  }, [linkedinStatus, shouldShowStyleSyncIssueToast]);

  const retryConnection = useCallback(async () => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    setIsFinalizing(true);
    setStatusError(null);
    try {
      await finishLinkedInConnection(() =>
        syncLinkedInConnectionRef.current({})
      );
      toast.success("Connected LinkedIn account");
      schedulePostConnectStatusChecks();
    } catch (error) {
      setStatusError(
        error instanceof Error
          ? error.message
          : "Could not finish connecting LinkedIn. Try again."
      );
    } finally {
      finalizingRef.current = false;
      setIsFinalizing(false);
      clearQueryParams();
    }
  }, [clearQueryParams, schedulePostConnectStatusChecks]);

  useEffect(() => {
    if (!enabled || finalizedCallbackRef.current) return;
    if (
      !linkedin_status &&
      !account_id &&
      linkedinStatus?.status !== "connecting"
    )
      return;
    finalizedCallbackRef.current = true;
    if (linkedin_status && linkedin_status !== "success") {
      clearQueryParams();
      toast.error("Unable to connect LinkedIn", {
        description: "LinkedIn authorization was cancelled or failed.",
      });
      return;
    }
    void retryConnection();
  }, [
    linkedin_status,
    account_id,
    linkedinStatus?.status,
    enabled,
    clearQueryParams,
    retryConnection,
  ]);

  useEffect(() => {
    if (linkedinStatus?.status === "connected") setStatusError(null);
  }, [linkedinStatus?.status]);

  const handleConnectLinkedIn = useCallback(async () => {
    try {
      setIsMutating(true);
      const returnTo =
        callbackUrl ??
        (typeof window !== "undefined"
          ? `${window.location.origin}${window.location.pathname}`
          : "");

      if (!returnTo) {
        throw new Error("Could not resolve LinkedIn callback URL.");
      }

      const { redirectUrl } = await getLinkedInConnectLink({
        callbackUrl: returnTo,
      });

      if (!redirectUrl) {
        throw new Error("LinkedIn authorization could not be started.");
      }

      window.location.href = redirectUrl;
    } catch (err) {
      logger.error("Failed to start LinkedIn connect:", err);
      toast.error("Unable to start LinkedIn connection", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
      setIsMutating(false);
    }
  }, [callbackUrl, getLinkedInConnectLink]);

  const handleDisconnectLinkedIn = useCallback(async () => {
    try {
      setIsMutating(true);
      setStatusError(null);
      await disconnectLinkedIn({});
      toast.success("Disconnected LinkedIn account");
    } catch (err) {
      logger.error("Failed to disconnect LinkedIn account:", err);
      toast.error("Unable to disconnect LinkedIn", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setIsMutating(false);
    }
  }, [disconnectLinkedIn]);

  return {
    linkedinStatus,
    statusLoading,
    statusError: statusError ?? statusQuery.error?.message ?? null,
    isFinalizing,
    isMutating,
    refreshStatus,
    retryConnection,
    handleConnectLinkedIn,
    handleDisconnectLinkedIn,
  };
}
