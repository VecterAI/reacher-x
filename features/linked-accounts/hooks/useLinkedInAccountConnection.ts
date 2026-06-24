"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { parseAsString, useQueryStates } from "nuqs";
import { api } from "@/convex/_generated/api";
import { showStyleSyncIssueToast } from "@/features/linked-accounts/lib/styleSyncIssueToast";
import { logger } from "@/shared/lib/logger";
import { toast } from "sonner";

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
  resolveCallbackUrl?: () => string;
  enabled?: boolean;
  showStyleSyncIssueToast?: boolean;
}

export function useLinkedInAccountConnection({
  callbackUrl,
  resolveCallbackUrl,
  enabled = true,
  showStyleSyncIssueToast: shouldShowStyleSyncIssueToast = false,
}: UseLinkedInAccountConnectionOptions) {
  const linkedinApi = (api as any).linkedin;
  const [{ linkedin_status }, setParams] = useQueryStates({
    linkedin_status: parseAsString,
  });

  const getLinkedInStatus = useAction(linkedinApi.getLinkedInConnectionStatus);
  const syncLinkedInConnection = useAction(linkedinApi.syncLinkedInConnection);
  const getLinkedInConnectLink = useAction(linkedinApi.getLinkedInConnectLink);
  const disconnectLinkedIn = useAction(linkedinApi.disconnectLinkedIn);
  const getLinkedInStatusRef = useRef(getLinkedInStatus);
  const syncLinkedInConnectionRef = useRef(syncLinkedInConnection);
  const shownStyleSyncIssueKeyRef = useRef<string | null>(null);
  const styleSyncRefreshTimeoutsRef = useRef<number[]>([]);

  const [linkedinStatus, setLinkedInStatus] =
    useState<LinkedInConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

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
      },
      { history: "replace" }
    );
  }, [setParams]);

  const refreshStatus = useCallback(async () => {
    if (!enabled) {
      setStatusLoading(false);
      return null;
    }

    try {
      setStatusLoading(true);
      const nextStatus = await getLinkedInStatusRef.current({});
      setLinkedInStatus(nextStatus);
      setStatusError(null);
      return nextStatus;
    } catch (err) {
      logger.warn("Failed to load LinkedIn connection status:", err);
      setStatusError(
        err instanceof Error ? err.message : "Unable to load LinkedIn status."
      );
      return null;
    } finally {
      setStatusLoading(false);
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

  useEffect(() => {
    if (!linkedin_status || !enabled) {
      return;
    }

    void (async () => {
      try {
        setIsMutating(true);
        if (linkedin_status === "success") {
          setLinkedInStatus((previous) => ({
            ...previous,
            isConnected: true,
            status: "connecting",
          }));
          setStatusError(null);
          toast.success("Connected LinkedIn account", {
            description: "LinkedIn is finishing its initial sync.",
          });
          schedulePostConnectStatusChecks();
          clearQueryParams();
          setIsMutating(false);
          void syncLinkedInConnectionRef
            .current({})
            .then((nextStatus) => {
              setLinkedInStatus(nextStatus);
              setStatusError(null);
            })
            .catch(async (err) => {
              logger.error("Failed to finalize LinkedIn connection:", err);
              setStatusError(
                err instanceof Error ? err.message : "Please try again."
              );
              const refreshed = await refreshStatus();
              if (!refreshed) {
                setLinkedInStatus((previous) =>
                  previous?.status === "connecting" ? null : previous
                );
              }
            });
          return;
        } else {
          await refreshStatus();
          toast.error("Unable to connect LinkedIn", {
            description: "LinkedIn authorization was cancelled or failed.",
          });
        }
      } catch (err) {
        logger.error("Failed to finalize LinkedIn connection:", err);
        toast.error("Unable to connect LinkedIn", {
          description: err instanceof Error ? err.message : "Please try again.",
        });
      } finally {
        clearQueryParams();
        setIsMutating(false);
      }
    })();
  }, [
    clearQueryParams,
    enabled,
    linkedin_status,
    refreshStatus,
    schedulePostConnectStatusChecks,
  ]);

  const handleConnectLinkedIn = useCallback(async () => {
    try {
      setIsMutating(true);
      const returnTo =
        resolveCallbackUrl?.() ??
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
  }, [callbackUrl, getLinkedInConnectLink, resolveCallbackUrl]);

  const handleDisconnectLinkedIn = useCallback(async () => {
    const previousStatus = linkedinStatus;
    try {
      setIsMutating(true);
      setLinkedInStatus({
        isConnected: false,
        status: "disconnected",
      });
      setStatusError(null);
      await disconnectLinkedIn({});
      toast.success("Disconnected LinkedIn account");
    } catch (err) {
      setLinkedInStatus(previousStatus);
      logger.error("Failed to disconnect LinkedIn account:", err);
      toast.error("Unable to disconnect LinkedIn", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setIsMutating(false);
    }
  }, [disconnectLinkedIn, linkedinStatus]);

  return {
    linkedinStatus,
    statusLoading,
    statusError,
    isMutating,
    refreshStatus,
    handleConnectLinkedIn,
    handleDisconnectLinkedIn,
  };
}
