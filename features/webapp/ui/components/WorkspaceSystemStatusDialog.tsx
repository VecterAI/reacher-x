"use client";

import { useCallback, useMemo, useState } from "react";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { OnboardingProgressCard } from "@/features/agent/ui/components/OnboardingProgressCard";
import { useActiveUseCaseLabels, useQueryWithStatus } from "@/shared/hooks";
import type { WorkspaceSystemDiscoveryState } from "@/shared/lib/workspaceSystem";
import { getWorkspaceDiscoveryVerb } from "@/shared/lib/workspaceUseCases";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
        tooltip: "△ Agent has reached its limit",
        title: `△ Agent is paused because you’ve reached your current plan limit. Upgrade to continue ${discoveryVerb} and qualifying ${entityPluralLower}.`,
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
  const statusCopy = useWorkspaceSystemStatusCopy(status);
  const [pending, setPending] = useState(false);

  const handleAction = useCallback(async () => {
    if (!status.actionKind) {
      return;
    }

    if (status.actionKind === "resume" || status.actionKind === "retry") {
      setPending(true);
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
        setPending(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md overflow-hidden p-0"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{statusCopy.tooltip}</DialogTitle>
          <DialogDescription>{statusCopy.title}</DialogDescription>
        </DialogHeader>
        <OnboardingProgressCard
          workspaceId={status.workspaceId}
          displayMode={status.mode}
          footerMode={
            status.mode === "running"
              ? "hidden"
              : status.mode === "degraded"
                ? "action"
                : status.actionKind === "resume"
                  ? "resume"
                  : status.actionKind
                    ? "action"
                    : "hidden"
          }
          footerActionLabel={
            pending
              ? status.actionKind === "resume"
                ? "Resuming..."
                : "Starting..."
              : (status.actionLabel ?? undefined)
          }
          footerActionDisabled={pending}
          onFooterAction={status.actionKind ? handleAction : undefined}
          headlineOverride={statusCopy.title}
          metaLabelOverride={statusCopy.meta}
          onClose={() => onOpenChange(false)}
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
      </DialogContent>
    </Dialog>
  );
}
