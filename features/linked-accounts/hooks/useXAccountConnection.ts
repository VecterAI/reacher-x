"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { parseAsString, useQueryStates } from "nuqs";
import { api } from "@/convex/_generated/api";
import { logger } from "@/shared/lib/logger";
import { toast } from "sonner";

export type TwitterConnectionStatus = {
  isConnected: boolean;
  status?: "connected" | "expired" | "reconnect_required" | "disconnected";
  connectedAccountId?: string;
  screenName?: string;
  name?: string;
  profileImageUrl?: string;
  verified?: boolean;
  missingScopes?: string[];
  expiresAt?: number;
  /** Ms since epoch; mirrors Convex `xAccounts._creationTime` when connected. */
  connectedAt?: number;
};

export interface UseXAccountConnectionOptions {
  /** Full callback URL for OAuth return (e.g. settings page). */
  callbackUrl?: string;
  /** Resolve at click time so client-only routes (e.g. agent) work without SSR URL. */
  resolveCallbackUrl?: () => string;
  /** When false, skips loading X status (e.g. not yet authenticated). */
  enabled?: boolean;
}

export function useXAccountConnection({
  callbackUrl,
  resolveCallbackUrl,
  enabled = true,
}: UseXAccountConnectionOptions) {
  const [{ code, state, error, error_description }, setOauthParams] =
    useQueryStates({
      code: parseAsString,
      state: parseAsString,
      error: parseAsString,
      error_description: parseAsString,
    });

  const getXStatus = useAction(api.x.getTwitterConnectionStatus);
  const getXConnectLink = useAction(api.x.getTwitterConnectLink);
  const completeXConnection = useAction(api.x.completeTwitterConnection);
  const disconnectTwitter = useAction(api.x.disconnectTwitter);
  const getXStatusRef = useRef(getXStatus);
  const authExchangeKeyRef = useRef<string | null>(null);

  const [xStatus, setXStatus] = useState<TwitterConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  useEffect(() => {
    getXStatusRef.current = getXStatus;
  }, [getXStatus]);

  const clearOauthParams = useCallback(() => {
    setOauthParams(
      {
        code: null,
        state: null,
        error: null,
        error_description: null,
      },
      { history: "replace" }
    );
  }, [setOauthParams]);

  const refreshStatus = useCallback(async () => {
    if (!enabled) {
      setStatusLoading(false);
      return;
    }
    try {
      setStatusLoading(true);
      const nextStatus = await getXStatusRef.current({});
      setXStatus(nextStatus);
      setStatusError(null);
    } catch (err) {
      logger.warn("Failed to load X connection status:", err);
      setStatusError(
        err instanceof Error ? err.message : "Unable to load X status."
      );
    } finally {
      setStatusLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!error && !(code && state)) {
      return;
    }

    if (error) {
      clearOauthParams();
      toast.error("Unable to connect X", {
        description:
          error_description || "X authorization was cancelled or failed.",
      });
      void refreshStatus();
      return;
    }

    const exchangeKey = `${code}:${state}`;
    if (authExchangeKeyRef.current === exchangeKey) {
      return;
    }
    authExchangeKeyRef.current = exchangeKey;

    void (async () => {
      try {
        setIsMutating(true);
        await completeXConnection({
          code: code!,
          state: state!,
        });
        toast.success("Connected X account", {
          description: "Your X account is ready.",
        });
      } catch (exchangeError) {
        logger.error("Failed to finalize X connection:", exchangeError);
        toast.error("Unable to connect X", {
          description:
            exchangeError instanceof Error
              ? exchangeError.message
              : "Please try again.",
        });
      } finally {
        clearOauthParams();
        await refreshStatus();
        setIsMutating(false);
      }
    })();
  }, [
    clearOauthParams,
    code,
    completeXConnection,
    error,
    error_description,
    refreshStatus,
    state,
  ]);

  const handleConnectX = useCallback(async () => {
    try {
      setIsMutating(true);
      const resolved =
        resolveCallbackUrl?.() ??
        callbackUrl ??
        (typeof window !== "undefined"
          ? `${window.location.origin}${window.location.pathname}`
          : "");
      if (!resolved) {
        throw new Error("Could not resolve OAuth callback URL.");
      }
      const { redirectUrl } = await getXConnectLink({ callbackUrl: resolved });
      if (!redirectUrl) {
        throw new Error("X authorization could not be started.");
      }
      window.location.href = redirectUrl;
    } catch (err) {
      logger.error("Failed to start X connect:", err);
      toast.error("Unable to start X connection", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
      setIsMutating(false);
    }
  }, [callbackUrl, getXConnectLink, resolveCallbackUrl]);

  const handleDisconnectX = useCallback(async () => {
    try {
      setIsMutating(true);
      await disconnectTwitter({});
      toast.success("Disconnected X account");
      await refreshStatus();
    } catch (err) {
      logger.error("Failed to disconnect X account:", err);
      toast.error("Unable to disconnect X", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setIsMutating(false);
    }
  }, [disconnectTwitter, refreshStatus]);

  return {
    xStatus,
    statusLoading,
    statusError,
    isMutating,
    refreshStatus,
    handleConnectX,
    handleDisconnectX,
  };
}
