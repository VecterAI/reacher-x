"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { OnboardingProgressCard } from "@/features/agent/ui/components/OnboardingProgressCard";
import { useActiveUseCaseLabels, useQueryWithStatus } from "@/shared/hooks";
import type { WorkspaceSystemDiscoveryState } from "@/shared/lib/workspaceSystem";
import { getWorkspaceDiscoveryVerb } from "@/shared/lib/workspaceUseCases";
import { Button } from "@/shared/ui/components/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/components/Dialog";

export type WorkspaceSystemStatus = {
  workspaceId: string;
  mode: "running" | "degraded" | "paused" | "attention";
  workflowStatus: "running" | "paused" | "stopped" | "limit_reached";
  discoveryState: WorkspaceSystemDiscoveryState;
  pauseReason: "manual" | "inactive" | null;
  issueReason: "setup_incomplete" | "workflow_failed" | "limit_reached" | null;
  canResume: boolean;
  label: string;
  tooltip: string;
  dialogTitle: string;
  dialogDescription: string;
  actionLabel: string | null;
  actionKind: "resume" | "open_setup" | "view_plans" | "retry" | null;
};

type WorkspaceStatusDialogView = "progress" | "pauseConfirm";
type WorkspaceStatusDialogPendingAction = "pause" | "primary" | null;

function canPauseWorkspace(status: WorkspaceSystemStatus) {
  return (
    status.mode === "running" ||
    status.mode === "degraded" ||
    (status.mode === "attention" && status.discoveryState === "active")
  );
}

export function useWorkspaceSystemStatusCopy(status: WorkspaceSystemStatus) {
  const { activeUseCase, activeUseCaseKey, entityPlural } =
    useActiveUseCaseLabels();
  const planQuery = useQueryWithStatus(api.plans.getCurrentPlan);
  const entityPluralLower = entityPlural.toLowerCase();
  const discoveryVerb = getWorkspaceDiscoveryVerb(activeUseCaseKey);
  const requiresPlan =
    planQuery.data?.tier === "free" && status.issueReason === "limit_reached";
  const attentionWhileDiscoveryActive =
    status.issueReason === "workflow_failed" &&
    status.discoveryState === "active";

  return useMemo(() => {
    if (requiresPlan) {
      return {
        tooltip: "Upgrade plan",
        title: `Upgrade plan to keep △ Agent ${discoveryVerb} and qualifying ${entityPluralLower}.`,
        meta: `${activeUseCase.displayName} billing`,
      };
    }

    if (status.mode === "running") {
      return {
        tooltip: "△ Agent is active",
        title: `△ Agent is actively ${discoveryVerb} and qualifying ${entityPluralLower}.`,
        meta: `${activeUseCase.displayName} pipeline`,
      };
    }

    if (status.mode === "paused") {
      const pausedReason =
        status.pauseReason === "inactive"
          ? "paused due to inactivity"
          : "paused";
      return {
        tooltip:
          status.pauseReason === "inactive"
            ? "△ Agent paused due to inactivity"
            : "△ Agent is paused",
        title: `△ Agent is ${pausedReason}. Resume to continue ${discoveryVerb} ${entityPluralLower}.`,
        meta: `${activeUseCase.displayName} paused`,
      };
    }

    if (status.mode === "degraded") {
      return {
        tooltip: "△ Agent is still running and retrying automatically",
        title: `△ Agent is still running and retrying automatically while it works on ${entityPluralLower}.`,
        meta: `${activeUseCase.displayName} recovering`,
      };
    }

    if (attentionWhileDiscoveryActive) {
      return {
        tooltip: "△ Agent is still active, but needs attention",
        title: `△ Agent needs attention. New ${entityPluralLower} may still appear while one part needs a retry.`,
        meta: "Action required",
      };
    }

    if (status.issueReason === "setup_incomplete") {
      return {
        tooltip: "△ Agent setup is incomplete",
        title: `Finish setup so your △ Agent can keep ${discoveryVerb} and qualifying ${entityPluralLower}.`,
        meta: `${activeUseCase.displayName} setup`,
      };
    }

    if (status.issueReason === "limit_reached") {
      return {
        tooltip: "△ Agent reached this workspace's limit",
        title: `△ Agent is paused because this workspace reached its qualified ${entityPluralLower} limit for the current billing cycle. Upgrade to continue ${discoveryVerb} and qualifying ${entityPluralLower}.`,
        meta: `${activeUseCase.displayName} capacity`,
      };
    }

    return {
      tooltip: "△ Agent needs attention",
      title: `△ Agent hit an issue and needs a retry before it can continue working on ${entityPluralLower}.`,
      meta: "Action required",
    };
  }, [
    activeUseCase.displayName,
    attentionWhileDiscoveryActive,
    discoveryVerb,
    entityPluralLower,
    requiresPlan,
    status.issueReason,
    status.mode,
    status.pauseReason,
  ]);
}

interface WorkspaceSystemStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: WorkspaceSystemStatus;
}

export function WorkspaceSystemStatusDialog({
  open,
  onOpenChange,
  status,
}: WorkspaceSystemStatusDialogProps) {
  const router = useRouter();
  const startProspectingWorkflow = useAction(
    api.workspaces.startProspectingWorkflow
  );
  const stopProspectingWorkflow = useAction(
    api.workspaces.stopProspectingWorkflow
  );
  const statusCopy = useWorkspaceSystemStatusCopy(status);
  const [view, setView] = useState<WorkspaceStatusDialogView>("progress");
  const [pendingAction, setPendingAction] =
    useState<WorkspaceStatusDialogPendingAction>(null);
  const canPause = canPauseWorkspace(status);
  const isPauseConfirmOpen = view === "pauseConfirm";
  const isPending = pendingAction !== null;
  const primaryActionLabel = status.actionLabel ?? "Continue";
  const primaryActionPendingLabel =
    status.actionKind === "resume" ? "Resuming..." : "Starting...";

  useEffect(() => {
    if (!open) {
      setView("progress");
      setPendingAction(null);
    }
  }, [open]);

  const handlePrimaryAction = useCallback(async () => {
    if (!status.actionKind) {
      return;
    }

    if (status.actionKind === "resume" || status.actionKind === "retry") {
      setPendingAction("primary");
      try {
        const result = await startProspectingWorkflow({
          workspaceId: status.workspaceId as Id<"workspaces">,
        });
        if (!result.success) {
          throw new Error(result.error || "Could not start the △ Agent.");
        }
        toast.success(
          result.outcome === "rearmed_running_workflow"
            ? "△ Agent recovery re-armed."
            : status.actionKind === "resume"
              ? "△ Agent resumed."
              : "△ Agent retry started."
        );
      } catch (error) {
        toast.error("Could not start the △ Agent", {
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
      } finally {
        setPendingAction(null);
      }
      return;
    }

    onOpenChange(false);
    if (status.actionKind === "open_setup") {
      router.push("/agent/setup");
      return;
    }

    if (status.actionKind === "view_plans") {
      router.push("/plans");
    }
  }, [onOpenChange, router, startProspectingWorkflow, status]);

  const handlePauseRequest = useCallback(() => {
    setView("pauseConfirm");
  }, []);

  const handlePauseCancel = useCallback(() => {
    if (isPending) {
      return;
    }
    setView("progress");
  }, [isPending]);

  const handlePauseConfirm = useCallback(async () => {
    setPendingAction("pause");
    try {
      const result = await stopProspectingWorkflow({
        workspaceId: status.workspaceId as Id<"workspaces">,
      });

      if (!result.success) {
        throw new Error(result.error || "Could not pause the △ Agent.");
      }

      toast.success("△ Agent paused.");
      onOpenChange(false);
    } catch (error) {
      toast.error("Could not pause the △ Agent", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setPendingAction(null);
    }
  }, [onOpenChange, status.workspaceId, stopProspectingWorkflow]);

  const footerHasActions = canPause || Boolean(status.actionKind);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {isPauseConfirmOpen ? (
        <DialogContent
          showCloseButton={false}
          className="max-w-md gap-0 overflow-hidden p-0"
        >
          <DialogHeader className="border-border border-b px-4 py-3 text-left">
            <DialogTitle>Pause △ Agent?</DialogTitle>
            <DialogDescription className="sr-only">
              Pause workspace agent confirmation
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-4 py-4">
            <p className="text-sm">
              This pauses new discovery for this workspace and stops active
              monitor activity.
            </p>
            <p className="text-muted-foreground text-sm">
              Your saved prospects and progress stay intact, and you can resume
              later from this same workspace status dialog.
            </p>
            <div className="bg-muted/40 border-border rounded-lg border px-3 py-2.5">
              <p className="text-sm font-medium">
                Use this when you want to work through the current queue or stop
                ongoing workspace activity for now.
              </p>
            </div>
          </div>

          <DialogFooter className="border-border grid gap-2 border-t px-4 py-3">
            <Button
              className="w-full"
              variant="outline"
              size="xs"
              onClick={handlePauseCancel}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              className="w-full"
              size="xs"
              onClick={() => void handlePauseConfirm()}
              disabled={isPending}
            >
              {pendingAction === "pause" ? "Pausing..." : "Pause △ Agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : (
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
          <DialogHeader className="border-border border-b px-4 py-3 text-left">
            <DialogTitle>All-time workspace progress</DialogTitle>
            <DialogDescription className="sr-only">
              All-time workspace progress
            </DialogDescription>
          </DialogHeader>
          <OnboardingProgressCard
            workspaceId={status.workspaceId}
            className="max-w-none rounded-none border-0 shadow-none"
            displayMode={status.mode}
            footerMode="hidden"
            headlineOverride={statusCopy.title}
            metaLabelOverride={statusCopy.meta}
            timerMode={
              status.mode === "running"
                ? "elapsed"
                : status.mode === "degraded"
                  ? "elapsed"
                  : status.mode === "paused"
                    ? "paused"
                    : "hidden"
            }
          />

          {footerHasActions ? (
            <div className="border-border grid gap-2 border-t px-4 py-3">
              {status.actionKind ? (
                <Button
                  className="w-full"
                  size="xs"
                  onClick={() => void handlePrimaryAction()}
                  disabled={isPending}
                >
                  {pendingAction === "primary"
                    ? primaryActionPendingLabel
                    : primaryActionLabel}
                </Button>
              ) : null}

              {canPause ? (
                <Button
                  className="w-full"
                  variant="outline"
                  size="xs"
                  onClick={handlePauseRequest}
                  disabled={isPending}
                >
                  Pause △ Agent
                </Button>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      )}
    </Dialog>
  );
}
