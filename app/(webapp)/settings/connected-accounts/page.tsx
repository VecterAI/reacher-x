"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { useAuth as useWorkosAuth } from "@workos-inc/authkit-nextjs/components";
import { api } from "@/convex/_generated/api";
import {
  PageHeader,
  PageLayout,
  PageContent,
} from "@/features/webapp/ui/components";
import {
  ConnectedAccountsList,
  ConnectedAccountsListWithErrorHint,
} from "@/features/linked-accounts/ui/components/ConnectedAccountsList";
import { useXAccountConnection } from "@/features/linked-accounts/hooks/useXAccountConnection";
import { useQueryWithStatus } from "@/shared/hooks";

export default function ConnectedAccountsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: convexLoading } = useConvexAuth();
  const { user, loading: workosLoading } = useWorkosAuth();

  const callbackUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/settings/connected-accounts`
      : "";

  const {
    xStatus,
    statusLoading,
    statusError,
    isMutating,
    handleConnectX,
    handleDisconnectX,
  } = useXAccountConnection({
    callbackUrl,
    enabled: isAuthenticated,
  });

  const currentUserQuery = useQueryWithStatus(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );

  const pageLoading =
    convexLoading ||
    workosLoading ||
    (isAuthenticated && currentUserQuery.isPending) ||
    statusLoading;

  const googleEmail = user?.email || "user@gmail.com";
  const googleConnectedAt = currentUserQuery.data?._creationTime
    ? new Date(currentUserQuery.data._creationTime)
    : undefined;
  const isGoogleConnected = Boolean(user?.email);

  return (
    <PageLayout>
      <PageHeader title="Connected accounts" onBack={() => router.back()} />
      <PageContent className="mx-4 mt-4 pb-4">
        <ConnectedAccountsListWithErrorHint statusError={statusError}>
          <ConnectedAccountsList
            loading={pageLoading}
            googleEmail={googleEmail}
            googleConnectedAt={googleConnectedAt}
            isGoogleConnected={isGoogleConnected}
            xStatus={xStatus}
            onConnectX={handleConnectX}
            onDisconnectX={handleDisconnectX}
          />
        </ConnectedAccountsListWithErrorHint>

        {isMutating ? (
          <p className="text-muted-foreground text-xs">
            Updating account status…
          </p>
        ) : null}
      </PageContent>
    </PageLayout>
  );
}
