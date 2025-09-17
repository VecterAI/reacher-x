"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/shared/hooks/useAuth";
import { useMemo } from "react";
// import { formatRelativeTime } from "@/shared/lib/utils/format";

export interface LinkedAccount {
  id: string;
  provider: "twitter" | "google";
  accountName: string;
  accountHandle: string;
  isConnected: boolean;
  connectedAt?: Date;
}

/**
 * Hook to manage linked social media accounts
 *
 * Features:
 * - Fetches social accounts from Convex
 * - Handles authentication state
 * - Provides mock data for unauthenticated users
 * - Manages loading states
 *
 * Usage:
 * ```tsx
 * const { accounts, isLoading, error } = useLinkedAccounts();
 * ```
 */
export function useLinkedAccounts() {
  const { isAuthenticated, user } = useAuth();

  // Fetch social accounts from Convex (only if authenticated)
  const socialAccounts = useQuery(
    api.socialAccounts.getUserSocialAccounts,
    isAuthenticated ? {} : "skip"
  );

  // Fetch current user to get their first-authenticated time (createdAt)
  const currentUser = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );

  // Transform data and handle loading states
  const { accounts, isLoading, error } = useMemo(() => {
    // If not authenticated, return mock data for Google only
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

    // If authenticated but still loading
    if (socialAccounts === undefined) {
      return {
        accounts: [],
        isLoading: true,
        error: null,
      };
    }

    // Transform Convex data to our interface
    const transformedAccounts: LinkedAccount[] = socialAccounts.map(
      (account) => ({
        id: account._id,
        provider: account.provider as "twitter" | "google",
        accountName: account.providerAccountId,
        accountHandle:
          account.provider === "google"
            ? account.providerAccountId
            : `@${account.providerAccountId}`,
        isConnected: true,
        // Use the actual time when the social account document was created in Convex
        connectedAt: account._creationTime
          ? new Date(account._creationTime)
          : undefined,
      })
    );

    // Add Google account if not present (since it's required for authentication)
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
        // Use user's first authenticated time from our Users table when available
        connectedAt: currentUser?.createdAt
          ? new Date(currentUser.createdAt)
          : undefined,
      });
    }

    // Add Twitter account if not present (for authenticated users)
    const hasTwitter = transformedAccounts.some(
      (acc) => acc.provider === "twitter"
    );
    if (!hasTwitter) {
      transformedAccounts.push({
        id: "twitter-placeholder",
        provider: "twitter",
        accountName: "ReacherXUser",
        accountHandle: "@ReacherXUser",
        isConnected: false,
      });
    }

    return {
      accounts: transformedAccounts,
      isLoading: false,
      error: null,
    };
  }, [isAuthenticated, socialAccounts, user, currentUser]);

  const reconnectAccount = (accountId: string) => {
    // TODO: Implement reconnection logic
    console.log("Reconnecting account:", accountId);
  };

  return {
    accounts,
    isLoading,
    error,
    reconnectAccount,
  };
}
