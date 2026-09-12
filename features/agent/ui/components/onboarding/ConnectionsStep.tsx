"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useAuth as useWorkosAuth } from "@workos-inc/authkit-nextjs/components";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [isCompletingStep, setIsCompletingStep] = useState(false);
  const completionSessionIdRef = useRef<string | null>(null);
  const { isAuthenticated, isLoading: convexLoading } = useConvexAuth();
  const { user, loading: workosLoading } = useWorkosAuth();

  const currentUserQuery = useQueryWithStatus(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );
  const accountsEnabled = isAuthenticated && !!currentUserQuery.data;

  const xQuery = useQueryWithStatus(
    api.connectedAccounts.getConnectionSnapshot,
    accountsEnabled ? { platform: "twitter" } : "skip"
  );
  const linkedinQuery = useQueryWithStatus(
    api.connectedAccounts.getConnectionSnapshot,
    accountsEnabled ? { platform: "linkedin" } : "skip"
  );
  const xStatus = xQuery.data?.platform === "twitter" ? xQuery.data : null;
  const linkedinStatus =
    linkedinQuery.data?.platform === "linkedin" ? linkedinQuery.data : null;

  const completeSetupConnections = useMutation(
    api.setupSessions.completeSetupConnections
  );

  const pageLoading =
    convexLoading ||
    workosLoading ||
    (isAuthenticated && currentUserQuery.isPending) ||
    (accountsEnabled && (xQuery.isPending || linkedinQuery.isPending));
  const statusError = [xQuery.error?.message, linkedinQuery.error?.message]
    .filter(Boolean)
    .join(" · ");
  const isMutating = isCompletingStep;

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
    if (!sessionId || pageLoading || !canContinue) {
      return;
    }

    void persistConnectionsStep({ connectedX: true });
  }, [canContinue, pageLoading, persistConnectionsStep, sessionId]);

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
        onConnectX: () => router.push("/settings/connected-accounts"),
        onDisconnectX: () => router.push("/settings/connected-accounts"),
        onConnectLinkedIn: () => router.push("/settings/connected-accounts"),
        onRetryLinkedIn: () => router.push("/settings/connected-accounts"),
        onDisconnectLinkedIn: () => router.push("/settings/connected-accounts"),
      }}
      statusError={statusError}
      isMutating={isMutating}
      isCompletingStep={isCompletingStep}
      continueDisabled={!canContinue || !sessionId || isCompletingStep}
      onContinue={() => void handleContinue()}
      onConnectLater={() => void handleConnectLater()}
    />
  );
}
