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
  LinkedInConnectNoticeDialog,
} from "@/features/linked-accounts/ui/components";
import { useXAccountConnection } from "@/features/linked-accounts/hooks/useXAccountConnection";
import { useLinkedInAccountConnection } from "@/features/linked-accounts/hooks/useLinkedInAccountConnection";
import { useQueryWithStatus } from "@/shared/hooks";

export default function ConnectedAccountsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: convexLoading } = useConvexAuth();
  const { user, loading: workosLoading } = useWorkosAuth();
  const [linkedInDialogOpen, setLinkedInDialogOpen] = React.useState(false);

  const callbackUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/settings/connected-accounts`
      : "";

  const {
    xStatus,
    statusLoading: xStatusLoading,
    statusError: xStatusError,
    isMutating: xIsMutating,
    handleConnectX,
    handleDisconnectX,
  } = useXAccountConnection({
    callbackUrl,
    enabled: isAuthenticated,
    showStyleSyncIssueToast: true,
  });
  const {
    linkedinStatus,
    statusLoading: linkedInStatusLoading,
    statusError: linkedInStatusError,
    isMutating: linkedInIsMutating,
    handleConnectLinkedIn,
    handleDisconnectLinkedIn,
  } = useLinkedInAccountConnection({
    callbackUrl,
    enabled: isAuthenticated,
    showStyleSyncIssueToast: true,
  });

  const currentUserQuery = useQueryWithStatus(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );

  const pageLoading =
    convexLoading ||
    workosLoading ||
    (isAuthenticated && currentUserQuery.isPending) ||
    xStatusLoading ||
    linkedInStatusLoading;
  const statusError = [xStatusError, linkedInStatusError]
    .filter(Boolean)
    .join(" · ");
  const isMutating = xIsMutating || linkedInIsMutating;

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
            linkedinStatus={linkedinStatus}
            onConnectX={handleConnectX}
            onDisconnectX={handleDisconnectX}
            onConnectLinkedIn={() => setLinkedInDialogOpen(true)}
            onDisconnectLinkedIn={handleDisconnectLinkedIn}
          />
        </ConnectedAccountsListWithErrorHint>

        {isMutating ? (
          <p className="text-muted-foreground text-xs">
            Updating account status…
          </p>
        ) : null}
      </PageContent>
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
