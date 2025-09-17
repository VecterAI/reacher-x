"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/shared/hooks/useAuth";
import { useMemo } from "react";

export interface LinkedAccount {
  id: string;
  provider: "twitter" | "google";
  accountName: string;
  accountHandle: string;
  isConnected: boolean;
  connectedAt?: Date;
}

export function useLinkedAccounts() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  const socialAccounts = useQuery(
    api.socialAccounts.getUserSocialAccounts,
    isAuthenticated ? {} : "skip"
  );

  const currentUser = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );

  const { accounts, isLoading, error } = useMemo(() => {
    // While auth is hydrating, report loading to avoid unauthenticated mock flicker
    if (authLoading) {
      return {
        accounts: [],
        isLoading: true,
        error: null,
      };
    }

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

    if (socialAccounts === undefined) {
      return {
        accounts: [],
        isLoading: true,
        error: null,
      };
    }

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
        connectedAt: account._creationTime
          ? new Date(account._creationTime)
          : undefined,
      })
    );

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
  }, [authLoading, isAuthenticated, socialAccounts, user, currentUser]);

  const reconnectAccount = (accountId: string) => {
    console.log("Reconnecting account:", accountId);
  };

  return {
    accounts,
    isLoading,
    error,
    reconnectAccount,
  };
}
