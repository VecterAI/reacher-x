"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useAuth as useWorkosAuth } from "@workos-inc/authkit-nextjs/components";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { LinkedInConnectNoticeDialog } from "@/features/linked-accounts/ui/components";
import { useXAccountConnection } from "@/features/linked-accounts/hooks/useXAccountConnection";
import { useLinkedInAccountConnection } from "@/features/linked-accounts/hooks/useLinkedInAccountConnection";
import { useQueryWithStatus } from "@/shared/hooks";
import { ConnectionsStepContent } from "./ConnectionsStepContent";

interface ConnectionsStepProps {
  sessionId: Id<"workspaceSetupSessions"> | null;
  onCompleteStep: (
    status: "awaiting_plan" | "awaiting_preferences" | "ready"
  ) => void;
}

export function ConnectionsStep({
  sessionId,
  onCompleteStep,
}: ConnectionsStepProps) {
  const [linkedInDialogOpen, setLinkedInDialogOpen] = useState(false);
  const [isCompletingStep, setIsCompletingStep] = useState(false);
  const completionSessionIdRef = useRef<string | null>(null);
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
    statusLoading: xStatusLoading,
    statusError: xStatusError,
    isMutating: xIsMutating,
    handleConnectX,
    handleDisconnectX,
  } = useXAccountConnection({
    resolveCallbackUrl,
    enabled: isAuthenticated,
  });
  const {
    linkedinStatus,
    statusLoading: linkedInStatusLoading,
    statusError: linkedInStatusError,
    isMutating: linkedInIsMutating,
    handleConnectLinkedIn,
    handleDisconnectLinkedIn,
  } = useLinkedInAccountConnection({
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
    xStatusLoading ||
    linkedInStatusLoading;
  const statusError = [xStatusError, linkedInStatusError]
    .filter(Boolean)
    .join(" · ");
  const isMutating = xIsMutating || linkedInIsMutating || isCompletingStep;

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

  const persistConnectionsStep = useCallback(
    async (args: { connectedX: boolean; successMessage?: string }) => {
      if (!sessionId || completionSessionIdRef.current === sessionId) {
        return;
      }

      completionSessionIdRef.current = sessionId;
      setIsCompletingStep(true);
      try {
        const result = await completeSetupConnections({
          sessionId,
          connectedX: args.connectedX,
        });
        if (args.successMessage) {
          toast.success(args.successMessage);
        }
        onCompleteStep(result.status);
      } catch (error) {
        completionSessionIdRef.current = null;
        toast.error(
          args.connectedX
            ? "Could not save connection step"
            : "Could not continue setup",
          {
            description:
              error instanceof Error ? error.message : "Please try again.",
          }
        );
      } finally {
        setIsCompletingStep(false);
      }
    },
    [completeSetupConnections, onCompleteStep, sessionId]
  );

  useEffect(() => {
    if (!sessionId || pageLoading || xIsMutating || !canContinue) {
      return;
    }

    void persistConnectionsStep({ connectedX: true });
  }, [
    canContinue,
    pageLoading,
    persistConnectionsStep,
    sessionId,
    xIsMutating,
  ]);

  const handleConnectLater = useCallback(async () => {
    if (!sessionId) {
      toast.error("Setup draft is still loading", {
        description: "Please wait a moment and try again.",
      });
      return;
    }
    await persistConnectionsStep({
      connectedX: false,
      successMessage: "Connections step saved",
    });
  }, [persistConnectionsStep, sessionId]);

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
    await persistConnectionsStep({
      connectedX: true,
      successMessage: "Accounts connected",
    });
  }, [canContinue, persistConnectionsStep, sessionId]);

  return (
    <ConnectionsStepContent
      accounts={{
        loading: pageLoading,
        googleEmail,
        googleConnectedAt,
        isGoogleConnected,
        xStatus,
        linkedinStatus,
        onConnectX: handleConnectX,
        onDisconnectX: handleDisconnectX,
        onConnectLinkedIn: () => setLinkedInDialogOpen(true),
        onDisconnectLinkedIn: handleDisconnectLinkedIn,
      }}
      statusError={statusError}
      isMutating={isMutating}
      isCompletingStep={isCompletingStep}
      continueDisabled={!canContinue || !sessionId || isCompletingStep}
      onContinue={() => void handleContinue()}
      onConnectLater={() => void handleConnectLater()}
    >
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
    </ConnectionsStepContent>
  );
}
