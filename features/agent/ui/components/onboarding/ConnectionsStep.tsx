"use client";

import { useCallback, useMemo } from "react";
import { useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useAuth as useWorkosAuth } from "@workos-inc/authkit-nextjs/components";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PageContent } from "@/features/webapp/ui/components";
import {
  ConnectedAccountsList,
  ConnectedAccountsListWithErrorHint,
} from "@/features/linked-accounts/ui/components/ConnectedAccountsList";
import { useXAccountConnection } from "@/features/linked-accounts/hooks/useXAccountConnection";
import { useQueryWithStatus } from "@/shared/hooks";
import { Button } from "@/shared/ui/components/Button";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";

interface ConnectionsStepProps {
  sessionId: Id<"workspaceSetupSessions"> | null;
  onBack: () => void;
  onCompleteStep: () => void;
}

export function ConnectionsStep({
  sessionId,
  onBack,
  onCompleteStep,
}: ConnectionsStepProps) {
  const { isAuthenticated, isLoading: convexLoading } = useConvexAuth();
  const { user, loading: workosLoading } = useWorkosAuth();

  const resolveCallbackUrl = useCallback(() => {
    if (typeof window === "undefined") {
      return "";
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    url.searchParams.delete("error");
    url.searchParams.delete("error_description");
    return `${url.origin}${url.pathname}${url.search}`;
  }, []);

  const {
    xStatus,
    statusLoading,
    statusError,
    isMutating,
    handleConnectX,
    handleDisconnectX,
  } = useXAccountConnection({
    resolveCallbackUrl,
    enabled: isAuthenticated,
  });

  const currentUserQuery = useQueryWithStatus(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );

  const completeSetupConnections = useMutation(
    api.setupSessions.completeSetupConnections
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

  const xIsFullyConnected = Boolean(xStatus?.isConnected);

  const canContinue = useMemo(
    () => isGoogleConnected && xIsFullyConnected,
    [isGoogleConnected, xIsFullyConnected]
  );

  const handleConnectLater = useCallback(async () => {
    if (!sessionId) {
      toast.error("Setup draft is still loading", {
        description: "Please wait a moment and try again.",
      });
      return;
    }
    try {
      await completeSetupConnections({
        sessionId,
        connectedX: false,
      });
      toast.success("Connections step saved");
      onCompleteStep();
    } catch (error) {
      toast.error("Could not continue setup", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    }
  }, [completeSetupConnections, onCompleteStep, sessionId]);

  const handleContinue = useCallback(async () => {
    if (!sessionId) {
      toast.error("Setup draft is still loading", {
        description: "Please wait a moment and try again.",
      });
      return;
    }
    if (!canContinue) {
      return;
    }
    try {
      await completeSetupConnections({
        sessionId,
        connectedX: true,
      });
      toast.success("Accounts connected");
      onCompleteStep();
    } catch (error) {
      toast.error("Could not save connection step", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    }
  }, [canContinue, completeSetupConnections, onCompleteStep, sessionId]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <ScrollArea className="min-h-0 flex-1">
        <PageContent className="min-w-0 overflow-x-hidden px-4 py-4">
          <header className="space-y-1">
            <h2 className="text-xl font-semibold">
              Let the ∆ Agent take action
            </h2>
            <p className="text-muted-foreground text-sm wrap-break-word">
              Connect your accounts so the agent can send DMs, reply to posts,
              and engage on your behalf.
            </p>
          </header>

          <div className="mt-4">
            <ConnectedAccountsListWithErrorHint statusError={statusError}>
              <ConnectedAccountsList
                loading={pageLoading}
                googleEmail={googleEmail}
                googleConnectedAt={googleConnectedAt}
                isGoogleConnected={isGoogleConnected}
                xStatus={xStatus}
                onConnectX={handleConnectX}
                onDisconnectX={handleDisconnectX}
                hideXDisconnect
              />
            </ConnectedAccountsListWithErrorHint>

            {isMutating ? (
              <p className="text-muted-foreground mt-2 text-xs">
                Updating account status…
              </p>
            ) : null}
          </div>
        </PageContent>
      </ScrollArea>

      <div className="bg-background shrink-0 border-t px-4 py-2">
        <div className="flex w-full min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="shrink-0"
            onClick={onBack}
          >
            Back
          </Button>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => void handleConnectLater()}
            >
              Connect later
            </Button>
            <Button
              type="button"
              size="xs"
              disabled={!canContinue || !sessionId}
              onClick={() => void handleContinue()}
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
