"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { useToast } from "@/shared/ui/hooks/useToast";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function LinkedAccountsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { accounts, isLoading, reconnectAccount, disconnectAccount } =
    useLinkedAccounts();
  const linkXAccount = useMutation(api.socialAccountsMutations.linkXAccount);

  // Track OAuth processing state to prevent flicker
  const hasProcessedOAuth = useRef(false);
  const [isProcessingOAuth, setIsProcessingOAuth] = useState(false);

  // ✅ This effect is appropriate because we're synchronizing with external system (URL parameters)
  // This follows React best practices: "Code that runs because a component was displayed should be in Effects"
  useEffect(() => {
    const status = searchParams.get("x_status");
    const sessionId = searchParams.get("session");

    // Only process once per mount and only if we have a status
    if (!status || hasProcessedOAuth.current) return;
    hasProcessedOAuth.current = true;

    // Clean up URL immediately to prevent re-processing on re-renders
    router.replace("/settings/linked-accounts");

    // Handle success with session
    if (status === "success" && sessionId) {
      setIsProcessingOAuth(true); // Start OAuth processing

      // Fetch token data from secure session
      fetch(`/api/x/session?sessionId=${sessionId}`)
        .then((response) => response.json())
        .then(async (result) => {
          if (result.success && result.data) {
            const tokenData = result.data;
            console.log("Received token data from session");

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
            return linkXAccount({
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
          } else {
            throw new Error(result.error || "Failed to retrieve session data");
          }
        })
        .then(() => {
          toast({
            title: "Success",
            description: "Twitter account connected successfully!",
          });
        })
        .catch((error) => {
          console.error("Failed to link X account:", error);
          toast({
            title: "Connection Failed",
            description: "Failed to link Twitter account. Please try again.",
            variant: "destructive",
          });
        })
        .finally(() => {
          setIsProcessingOAuth(false); // End OAuth processing
        });
    } else if (status === "connected") {
      toast({
        title: "Success",
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
      toast({
        title: "Connection Failed",
        description:
          errorMessages[status] ||
          "Failed to connect Twitter account. Please try again.",
        variant: "destructive",
      });
    }
  }, [searchParams, router, toast, linkXAccount]);

  return (
    <PageLayout>
      <PageHeader title="Linked accounts" onBack={() => router.back()} />
      <PageContent className="mx-4 mt-4">
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
                  onReconnect={() => reconnectAccount()}
                  onDisconnect={() => disconnectAccount(account.id)}
                />
              ))}
            </div>
          ) : (
            /* Empty state - only show when we have no data and not loading */
            <div className="py-8 text-center">
              <p className="text-muted-foreground">
                No linked accounts found. Connect your social media accounts to
                get started.
              </p>
            </div>
          )}
        </div>
      </PageContent>
    </PageLayout>
  );
}
