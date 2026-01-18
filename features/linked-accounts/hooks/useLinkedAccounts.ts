"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/shared/hooks/useAuth";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { logger } from "@/shared/lib/logger";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";

export interface LinkedAccount {
  id: string;
  provider: "twitter" | "google";
  accountName: string;
  accountHandle: string;
  isConnected: boolean;
  connectedAt?: Date;
  statusText?: string;
}

export function useLinkedAccounts() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();

  const socialAccounts = useQuery(
    api.socialAccountsMutations.getUserSocialAccounts,
    isAuthenticated ? {} : "skip"
  );

  const currentUser = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );

  const unlinkXAccount = useMutation(
    api.socialAccountsMutations.unlinkXAccount
  );

  // ✅ Calculate everything during rendering - no unnecessary state or effects
  const { accounts, isLoading, error } = useMemo(() => {
    // While auth is hydrating, show loading to avoid flicker
    if (authLoading) {
      return {
        accounts: [],
        isLoading: true,
        error: null,
      };
    }

    // For unauthenticated users, show minimal mock data
    if (!isAuthenticated) {
      return {
        accounts: [
          {
            id: "google-mock",
            provider: "google" as const,
            accountName: user?.email || "user@gmail.com",
            accountHandle: user?.email || "user@gmail.com",
            isConnected: false,
          },
        ] as LinkedAccount[],
        isLoading: false,
        error: null,
      };
    }

    // While social accounts are loading, show loading state
    if (socialAccounts === undefined) {
      return {
        accounts: [],
        isLoading: true,
        error: null,
      };
    }

    // Transform social accounts data during rendering
    const transformedAccounts: LinkedAccount[] = socialAccounts.map(
      (account: {
        _id: string;
        provider: string;
        providerAccountId: string;
        screenName?: string;
        _creationTime: number;
        expiresAt?: number;
      }) => {
        const isTwitter = account.provider === "X";
        let isConnected = true;
        let statusText: string | undefined = undefined;
        if (isTwitter && account.expiresAt) {
          // Use current timestamp from account's perspective
          // This is acceptable because the result changes based on account data
          // Intentional: need current time to check expiration
          const currentTime = getCurrentUTCTimestamp();
          const diff = account.expiresAt - currentTime;
          if (diff <= 0) {
            isConnected = false; // mark as needs reconnect
            statusText = "Expired";
          } else if (diff <= 5 * 60 * 1000) {
            statusText = "Expiring soon";
          }
        }

        return {
          id: account._id,
          provider: isTwitter ? "twitter" : (account.provider as "google"),
          accountName:
            account.provider === "google"
              ? account.providerAccountId
              : account.screenName || account.providerAccountId,
          accountHandle:
            account.provider === "google"
              ? account.providerAccountId
              : account.screenName
                ? `@${account.screenName}`
                : `@${account.providerAccountId}`,
          isConnected,
          connectedAt: account._creationTime
            ? new Date(account._creationTime)
            : undefined,
          statusText,
        } as LinkedAccount;
      }
    );

    // Add Google account if not present (since it's the auth provider)
    const hasGoogle = transformedAccounts.some(
      (acc) => acc.provider === "google"
    );
    if (!hasGoogle) {
      transformedAccounts.push({
        id: "google-auth",
        provider: "google",
        accountName: user?.email || "user@gmail.com",
        accountHandle: user?.email || "user@gmail.com",
        isConnected: true,
        connectedAt: currentUser?._creationTime
          ? new Date(currentUser._creationTime)
          : undefined,
      });
    }

    // Only add Twitter placeholder if no Twitter account exists
    // This prevents the flicker from showing @Connect Twitter
    const hasTwitter = transformedAccounts.some(
      (acc) => acc.provider === "twitter"
    );
    if (!hasTwitter) {
      transformedAccounts.push({
        id: "twitter-placeholder",
        provider: "twitter",
        accountName: "Twitter",
        accountHandle: "@Connect",
        isConnected: false,
      });
    }

    return {
      accounts: transformedAccounts,
      isLoading: false,
      error: null,
    };
  }, [authLoading, isAuthenticated, socialAccounts, user, currentUser]);

  const connectAccount = (provider: "twitter" | "google") => {
    // Route to the correct OAuth flow based on provider
    if (provider === "google") {
      // Use existing login route (WorkOS) – mirrors header "Sign in"
      router.push("/login");
      return;
    }
    // Twitter/X connect supports optional returnTo; default back to linked accounts
    const returnTo = encodeURIComponent("/settings/connected-accounts");
    router.push(`/api/x/connect?returnTo=${returnTo}`);
  };

  const disconnectAccount = async (
    accountId: string,
    provider: "twitter" | "google"
  ) => {
    try {
      // Only Twitter/X unlink is supported from this screen.
      if (provider !== "twitter") {
        return;
      }
      if (accountId === "twitter-placeholder") {
        return; // Can't disconnect placeholder
      }
      await unlinkXAccount();
    } catch (error) {
      logger.error("Failed to disconnect account:", error);
    }
  };

  return {
    accounts,
    isLoading,
    error,
    connectAccount,
    disconnectAccount,
  };
}
