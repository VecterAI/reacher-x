"use client";

import { useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useAuth as useWorkosAuth } from "@workos-inc/authkit-nextjs/components";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ConnectedAccountsList,
  ConnectedAccountsListWithErrorHint,
} from "@/features/linked-accounts/ui/components/ConnectedAccountsList";
import { useXAccountConnection } from "@/features/linked-accounts/hooks/useXAccountConnection";
import { useQueryWithStatus } from "@/shared/hooks";
import { Button } from "@/shared/ui/components/Button";

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
  const pathname = usePathname();
  const { isAuthenticated, isLoading: convexLoading } = useConvexAuth();
  const { user, loading: workosLoading } = useWorkosAuth();

  const resolveCallbackUrl = useCallback(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return `${window.location.origin}${pathname}`;
  }, [pathname]);

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
      onCompleteStep();
    } catch (error) {
      toast.error("Could not save connection step", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    }
  }, [canContinue, completeSetupConnections, onCompleteStep, sessionId]);

  return (
    <section className="flex flex-col gap-0">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">Let the ∆ Agent take action</h2>
        <p className="text-muted-foreground text-sm">
          Connect your accounts so the agent can send DMs, reply to posts, and
          engage on your behalf.
        </p>
      </header>

      <div className="mt-6">
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

      <div className="mt-8 flex flex-col gap-3 pt-2 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          Back
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start sm:self-auto"
            onClick={() => void handleConnectLater()}
          >
            Connect later
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canContinue || !sessionId}
            onClick={() => void handleContinue()}
          >
            Continue
          </Button>
        </div>
      </div>
    </section>
  );
}
