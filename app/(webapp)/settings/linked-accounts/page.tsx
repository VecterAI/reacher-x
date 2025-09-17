"use client";

import React, { useEffect, useRef } from "react";
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

// components moved to features/linked-accounts

export default function LinkedAccountsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { accounts, isLoading, reconnectAccount, disconnectAccount } =
    useLinkedAccounts();
  const linkXAccount = useMutation(api.socialAccounts.linkXAccount);

  // Track if we've processed the OAuth status to prevent duplicate processing
  const hasProcessedOAuth = useRef(false);

  // Handle OAuth callback status - this IS appropriate use of useEffect
  // because we're synchronizing with external system (URL parameters)
  useEffect(() => {
    const status = searchParams.get("x_status");
    const tokensParam = searchParams.get("tokens");

    // Only process once per mount
    if (!status || hasProcessedOAuth.current) return;
    hasProcessedOAuth.current = true;

    // Clean up URL first
    router.replace("/settings/linked-accounts");

    // Handle success with tokens
    if (status === "success" && tokensParam) {
      try {
        const tokenData = JSON.parse(
          Buffer.from(tokensParam, "base64").toString()
        );
        console.log("Received token data:", tokenData);

        // Link the account using the mutation
        linkXAccount({
          provider: "x",
          providerAccountId: tokenData.xUserId,
          profile: { screenName: tokenData.screenName },
          tokens: {
            accessToken: tokenData.accessToken,
            refreshToken: tokenData.refreshToken,
            expiresAt: tokenData.expiresAt,
            tokenType: tokenData.tokenType,
            scope: tokenData.scope,
          },
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
          });
      } catch (error) {
        console.error("Failed to parse token data:", error);
        toast({
          title: "Connection Failed",
          description:
            "Failed to process Twitter account data. Please try again.",
          variant: "destructive",
        });
      }
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
          {/* Loading state */}
          {isLoading && (
            <>
              <AccountCardSkeleton />
              <AccountCardSkeleton />
            </>
          )}

          {/* Account cards */}
          {!isLoading && accounts.length > 0 && (
            <div className="space-y-4">
              {accounts.map((account) => (
                <AccountCard
                  key={account.id}
                  provider={account.provider}
                  accountName={account.accountName}
                  accountHandle={account.accountHandle}
                  isConnected={account.isConnected}
                  connectedAt={account.connectedAt}
                  onReconnect={() => reconnectAccount(account.id)}
                  onDisconnect={() => disconnectAccount(account.id)}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && accounts.length === 0 && (
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
