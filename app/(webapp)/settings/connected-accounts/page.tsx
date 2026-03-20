"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryStates, parseAsString } from "nuqs";
import { useAction } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useAuth as useWorkosAuth } from "@workos-inc/authkit-nextjs/components";
import { api } from "@/convex/_generated/api";
import {
  PageHeader,
  PageLayout,
  PageContent,
} from "@/features/webapp/ui/components";
import {
  AccountCard,
  AccountCardSkeleton,
} from "@/features/linked-accounts/ui/components";
import { useQueryWithStatus } from "@/shared/hooks";
import { logger } from "@/shared/lib/logger";
import { toast } from "sonner";

type TwitterConnectionStatus = {
  isConnected: boolean;
  status?: "connected" | "expired" | "reconnect_required" | "disconnected";
  connectedAccountId?: string;
  screenName?: string;
  name?: string;
  profileImageUrl?: string;
  missingScopes?: string[];
  expiresAt?: number;
};

export default function ConnectedAccountsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: convexLoading } = useConvexAuth();
  const { user, loading: workosLoading } = useWorkosAuth();
  const [{ code, state, error, error_description }, setOauthParams] =
    useQueryStates({
      code: parseAsString,
      state: parseAsString,
      error: parseAsString,
      error_description: parseAsString,
    });

  const authExchangeKeyRef = React.useRef<string | null>(null);

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

  const currentUserQuery = useQueryWithStatus(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );

  const getXStatus = useAction(api.x.getTwitterConnectionStatus);
  const getXConnectLink = useAction(api.x.getTwitterConnectLink);
  const completeXConnection = useAction(api.x.completeTwitterConnection);
  const disconnectTwitter = useAction(api.x.disconnectTwitter);
  const getXStatusRef = React.useRef(getXStatus);

  const [xStatus, setXStatus] = useState<TwitterConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  useEffect(() => {
    getXStatusRef.current = getXStatus;
  }, [getXStatus]);

  const refreshStatus = useCallback(async () => {
    try {
      setStatusLoading(true);
      const nextStatus = await getXStatusRef.current({});
      setXStatus(nextStatus);
      setStatusError(null);
    } catch (error) {
      logger.warn("Failed to load X connection status:", error);
      setStatusError(
        error instanceof Error ? error.message : "Unable to load X status."
      );
    } finally {
      setStatusLoading(false);
    }
  }, []);

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
      const callbackUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/settings/connected-accounts`
          : undefined;
      const { redirectUrl } = await getXConnectLink({ callbackUrl });
      if (!redirectUrl) {
        throw new Error("X authorization could not be started.");
      }
      window.location.href = redirectUrl;
    } catch (error) {
      logger.error("Failed to start X connect:", error);
      toast.error("Unable to start X connection", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
      setIsMutating(false);
    }
  }, [getXConnectLink]);

  const handleDisconnectX = useCallback(async () => {
    try {
      setIsMutating(true);
      await disconnectTwitter({});
      toast.success("Disconnected X account");
      await refreshStatus();
    } catch (error) {
      logger.error("Failed to disconnect X account:", error);
      toast.error("Unable to disconnect X", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsMutating(false);
    }
  }, [disconnectTwitter, refreshStatus]);

  const pageLoading =
    convexLoading ||
    workosLoading ||
    (isAuthenticated && currentUserQuery.isPending) ||
    statusLoading;

  const googleHandle = user?.email || "user@gmail.com";
  const xHandle = xStatus?.isConnected
    ? `@${xStatus.screenName || "connected"}`
    : "@Connect";
  const xStatusText = xStatus?.isConnected
    ? xStatus.name
      ? `${xStatus.name} via X OAuth`
      : "Connected via X OAuth"
    : xStatus?.status === "reconnect_required" &&
        xStatus.missingScopes &&
        xStatus.missingScopes.length > 0
      ? `Reconnect required: missing ${xStatus.missingScopes.join(", ")}`
      : statusError || "Not connected";

  const accountCards = useMemo(() => {
    const googleConnectedAt = currentUserQuery.data?._creationTime
      ? new Date(currentUserQuery.data._creationTime)
      : undefined;
    const xConnectedAt = xStatus?.isConnected ? new Date() : undefined;

    return [
      {
        id: "google-auth",
        provider: "google" as const,
        accountHandle: googleHandle,
        isConnected: Boolean(user?.email),
        connectedAt: googleConnectedAt,
      },
      {
        id: "twitter-composio",
        provider: "twitter" as const,
        accountHandle: xHandle,
        isConnected: Boolean(xStatus?.isConnected),
        connectedAt: xConnectedAt,
        statusText: xStatusText,
      },
    ];
  }, [
    googleHandle,
    user?.email,
    currentUserQuery.data?._creationTime,
    xHandle,
    xStatus?.isConnected,
    xStatusText,
  ]);

  return (
    <PageLayout>
      <PageHeader title="Connected accounts" onBack={() => router.back()} />
      <PageContent className="mx-4 mt-4 pb-4">
        <div className="space-y-4">
          {pageLoading ? (
            <>
              <AccountCardSkeleton />
              <AccountCardSkeleton />
            </>
          ) : (
            accountCards.map((account) => (
              <AccountCard
                key={account.id}
                provider={account.provider}
                accountName={account.accountHandle}
                accountHandle={account.accountHandle}
                isConnected={account.isConnected}
                connectedAt={account.connectedAt}
                statusText={account.statusText}
                onReconnect={
                  account.provider === "twitter" ? handleConnectX : undefined
                }
                onDisconnect={
                  account.provider === "twitter" && account.isConnected
                    ? handleDisconnectX
                    : undefined
                }
              />
            ))
          )}

          {isMutating ? (
            <p className="text-muted-foreground text-xs">
              Updating account status…
            </p>
          ) : null}

          {statusError ? (
            <p className="text-muted-foreground text-xs">{statusError}</p>
          ) : null}
        </div>
      </PageContent>
    </PageLayout>
  );
}
