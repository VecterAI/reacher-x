"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
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
  LinkedInConnectNoticeDialog,
} from "@/features/linked-accounts/ui/components";
import { useXAccountConnection } from "@/features/linked-accounts/hooks/useXAccountConnection";
import { useLinkedInAccountConnection } from "@/features/linked-accounts/hooks/useLinkedInAccountConnection";
import { useQueryWithStatus } from "@/shared/hooks";
import { TextShimmer } from "@/shared/ui/components/TextShimmer";

export default function ConnectedAccountsPage() {
  const { isAuthenticated, isLoading: convexLoading } = useConvexAuth();
  const { user, loading: workosLoading } = useWorkosAuth();
  const searchParams = useSearchParams();
  const [linkedInDialogOpen, setLinkedInDialogOpen] = React.useState(false);

  const callbackUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/settings/connected-accounts`;

  const currentUserQuery = useQueryWithStatus(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );
  const accountsEnabled = isAuthenticated && !!currentUserQuery.data;

  const {
    xStatus,
    statusLoading: xStatusLoading,
    statusError: xStatusError,
    isMutating: xIsMutating,
    handleConnectX,
    handleDisconnectX,
  } = useXAccountConnection({
    callbackUrl,
    enabled: accountsEnabled,
    showStyleSyncIssueToast: true,
  });
  const {
    linkedinStatus,
    statusLoading: linkedInStatusLoading,
    statusError: linkedInStatusError,
    isMutating: linkedInIsMutating,
    isFinalizing: linkedInFinalizing,
    retryConnection: retryLinkedInConnection,
    handleConnectLinkedIn,
    handleDisconnectLinkedIn,
  } = useLinkedInAccountConnection({
    callbackUrl,
    enabled: accountsEnabled,
    showStyleSyncIssueToast: true,
  });

  const userUnavailable =
    isAuthenticated &&
    (currentUserQuery.isError ||
      (currentUserQuery.isSuccess && !currentUserQuery.data));
  const userError = currentUserQuery.isError
    ? "Could not load your account. Refresh the page to try again."
    : userUnavailable
      ? "Your account is not ready yet. Refresh the page to try again."
      : null;
  const statusError = [userError, xStatusError, linkedInStatusError]
    .filter(Boolean)
    .join(" · ");

  const isFinishingConnection =
    linkedInFinalizing ||
    searchParams.get("linkedin_status") === "success" ||
    Boolean(searchParams.get("account_id")) ||
    Boolean(searchParams.get("code") && searchParams.get("state"));
  const pageLoading =
    convexLoading ||
    workosLoading ||
    (isAuthenticated && currentUserQuery.isPending) ||
    xStatusLoading ||
    linkedInStatusLoading ||
    isFinishingConnection;
  const isUpdatingAccount =
    xIsMutating || linkedInIsMutating || isFinishingConnection;

  const googleEmail = user?.email || "";
  const googleConnectedAt = currentUserQuery.data?._creationTime
    ? new Date(currentUserQuery.data._creationTime)
    : undefined;
  const isGoogleConnected = Boolean(user?.email);

  return (
    <PageLayout className="flex max-w-none flex-col overflow-hidden border-none">
      <PageHeader title="Connected accounts" />
      <div className="scroll-fade min-h-0 min-w-0 flex-1 overflow-y-auto">
        <PageContent className="mx-4 mt-4 max-w-lg min-w-0 pb-4">
          <ConnectedAccountsListWithErrorHint statusError={statusError}>
            {!userUnavailable && (
              <ConnectedAccountsList
                loading={pageLoading}
                googleEmail={googleEmail}
                googleConnectedAt={googleConnectedAt}
                isGoogleConnected={isGoogleConnected}
                xStatus={xStatus}
                linkedinStatus={linkedinStatus}
                onConnectX={handleConnectX}
                onDisconnectX={handleDisconnectX}
                onConnectLinkedIn={() => setLinkedInDialogOpen(true)}
                onDisconnectLinkedIn={handleDisconnectLinkedIn}
                onRetryLinkedIn={
                  linkedInStatusError && linkedinStatus?.status === "connecting"
                    ? () => void retryLinkedInConnection()
                    : undefined
                }
              />
            )}
          </ConnectedAccountsListWithErrorHint>
          {isUpdatingAccount && !userUnavailable ? (
            <p className="text-muted-foreground text-xs" role="status">
              <TextShimmer>Updating account status…</TextShimmer>
            </p>
          ) : null}
        </PageContent>
      </div>
      <LinkedInConnectNoticeDialog
        open={linkedInDialogOpen}
        isSubmitting={linkedInIsMutating}
        onCancel={() => setLinkedInDialogOpen(false)}
        onContinue={() => {
          setLinkedInDialogOpen(false);
          void handleConnectLinkedIn();
        }}
        onOpenPasswordReset={() => {
          window.open(
            "https://www.linkedin.com/checkpoint/rp/request-password-reset",
            "_blank",
            "noopener,noreferrer"
          );
        }}
      />
    </PageLayout>
  );
}
