"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryStates, parseAsString } from "nuqs";
import {
  PageHeader,
  PageLayout,
  PageContent,
} from "@/features/webapp/ui/components";
import { useLinkedAccounts } from "@/features/linked-accounts/hooks/useLinkedAccounts";
import {
  AccountCard,
  AccountCardSkeleton,
} from "@/features/linked-accounts/ui/components";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { logger } from "@/shared/lib/logger";
import { toast } from "sonner";

export default function ConnectedAccountsPage() {
  const router = useRouter();
  const [{ x_status, session, next }, setOauthParams] = useQueryStates({
    x_status: parseAsString,
    session: parseAsString,
    next: parseAsString,
  });

  const { accounts, isLoading, connectAccount, disconnectAccount } =
    useLinkedAccounts();
  const linkXAccount = useMutation(api.socialAccountsMutations.linkXAccount);

  // Track OAuth processing state to prevent flicker
  const hasProcessedOAuth = useRef(false);
  const [isProcessingOAuth, setIsProcessingOAuth] = useState(false);
  const nextRef = useRef<string | null>(null);

  // Process OAuth callback - runs once on page load when OAuth params are present
  useEffect(() => {
    const status = x_status || undefined;
    const sessionId = session || undefined;
    const nextUrl = next || undefined;
    if (nextUrl) nextRef.current = nextUrl;

    // Only process once per mount and only if we have a status
    if (!status || hasProcessedOAuth.current) return;
    hasProcessedOAuth.current = true;

    // Clean up URL immediately to prevent re-processing on re-renders
    setOauthParams(
      { x_status: null, session: null, next: null },
      { history: "replace" }
    );

    // Handle success with session - use async handler
    if (status === "success" && sessionId) {
      const processOAuth = async () => {
        try {
          // Fetch token data from secure session
          const response = await fetch(`/api/x/session?sessionId=${sessionId}`);
          const result = await response.json();

          if (!result.success || !result.data) {
            throw new Error(result.error || "Failed to retrieve session data");
          }

          const tokenData = result.data;
          logger.info("Received token data from session");

          // Encrypt tokens before sending to Convex
          const encryptResponse = await fetch("/api/x/encrypt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accessToken: tokenData.accessToken,
              refreshToken: tokenData.refreshToken,
            }),
          });

          if (!encryptResponse.ok) {
            throw new Error("Failed to encrypt tokens");
          }

          const { encryptedAccessToken, encryptedRefreshToken } =
            await encryptResponse.json();

          // Link the account using the mutation
          await linkXAccount({
            provider: "X",
            providerAccountId: tokenData.xUserId,
            profile: { screenName: tokenData.screenName },
            tokens: {
              accessToken: encryptedAccessToken,
              refreshToken: encryptedRefreshToken,
              expiresAt: tokenData.expiresAt,
              tokenType: tokenData.tokenType,
              scope: tokenData.scope,
            },
          });

          toast.success("Connected!", {
            description: "Twitter account connected successfully!",
          });

          // Redirect back to the requested page if provided
          if (nextRef.current) {
            router.push(nextRef.current);
          }
        } catch (error) {
          logger.error("Failed to link X account:", error);
          toast.error("Connection Failed", {
            description: "Failed to link Twitter account. Please try again.",
          });
        }
      };

      processOAuth();
    } else if (status === "connected") {
      toast.success("Connected!", {
        description: "Twitter account connected successfully!",
      });
    } else {
      const errorMessages: Record<string, string> = {
        error_state: "Invalid state parameter. Please try again.",
        missing_verifier: "Missing verification code. Please try again.",
        server_misconfig: "Server configuration error. Please contact support.",
        token_error: "Failed to exchange authorization code. Please try again.",
        user_fetch_error: "Failed to fetch user information. Please try again.",
        invalid_user: "Invalid user information received. Please try again.",
        exception: "An unexpected error occurred. Please try again.",
      };
      toast.error("Error!", {
        description:
          errorMessages[status] ||
          "Failed to connect Twitter account. Please try again.",
      });
    }
  }, [x_status, session, next, setOauthParams, router, linkXAccount]);

  return (
    <PageLayout>
      <PageHeader title="Connected accounts" onBack={() => router.back()} />
      <PageContent className="mx-4 mt-4 pb-4">
        <div className="space-y-4">
          {/* Loading state - show skeletons while data is loading OR OAuth is processing */}
          {isLoading || isProcessingOAuth ? (
            <>
              <AccountCardSkeleton />
              <AccountCardSkeleton />
            </>
          ) : accounts.length > 0 ? (
            /* Account cards - only render when we have data */
            <div className="space-y-4">
              {accounts.map((account) => (
                <AccountCard
                  key={account.id}
                  provider={account.provider}
                  accountName={account.accountName}
                  accountHandle={account.accountHandle}
                  isConnected={account.isConnected}
                  connectedAt={account.connectedAt}
                  statusText={account.statusText}
                  onReconnect={() => connectAccount(account.provider)}
                  onDisconnect={() =>
                    disconnectAccount(account.id, account.provider)
                  }
                />
              ))}
            </div>
          ) : (
            /* Empty state - only show when we have no data and not loading */
            <div className="py-8 text-center">
              <p className="text-muted-foreground">
                No connected accounts found. Connect your social media accounts
                to get started.
              </p>
            </div>
          )}
        </div>
      </PageContent>
    </PageLayout>
  );
}
