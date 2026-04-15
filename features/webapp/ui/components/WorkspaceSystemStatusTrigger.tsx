"use client";

import { useCallback, useMemo, useState } from "react";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { OnboardingProgressCard } from "@/features/agent/ui/components/OnboardingProgressCard";
import { useActiveUseCaseLabels } from "@/shared/hooks";
import { Button } from "@/shared/ui/components/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/components/Dialog";
import { ChangeHistoryIcon } from "@/shared/ui/components/icons";
import { cn } from "@/shared/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/components/Tooltip";

type WorkspaceSystemStatus = {
  workspaceId: string;
  mode: "running" | "paused" | "attention";
  workflowStatus: "running" | "paused" | "stopped" | "limit_reached";
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

interface WorkspaceSystemStatusTriggerProps {
  status: WorkspaceSystemStatus;
}

export function WorkspaceSystemStatusTrigger({
  status,
}: WorkspaceSystemStatusTriggerProps) {
  const router = useRouter();
  const { activeUseCase, entityPlural } = useActiveUseCaseLabels();
  const startProspectingWorkflow = useAction(
    api.workspaces.startProspectingWorkflow
  );
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const tone = useMemo(() => {
    if (status.mode === "running") {
      return {
        dotClassName: "bg-emerald-500",
      };
    }
    if (status.mode === "paused") {
      return {
        dotClassName: "bg-amber-500",
      };
    }
    return {
      dotClassName: "bg-destructive",
    };
  }, [status.mode]);

  const entityPluralLower = entityPlural.toLowerCase();
  const statusCopy = useMemo(() => {
    if (status.mode === "running") {
      return {
        tooltip: "∆ Agent is active",
        title: `∆ Agent is actively discovering and qualifying ${entityPluralLower}.`,
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
            ? "∆ Agent paused due to inactivity"
            : "∆ Agent is paused",
        title: `∆ Agent is ${pausedReason}. Resume to continue finding ${entityPluralLower}.`,
        meta: `${activeUseCase.displayName} paused`,
      };
    }

    if (status.issueReason === "setup_incomplete") {
      return {
        tooltip: "∆ Agent setup is incomplete",
        title: `Finish setup so your ∆ Agent can keep discovering and qualifying ${entityPluralLower}.`,
        meta: `${activeUseCase.displayName} setup`,
      };
    }

    if (status.issueReason === "limit_reached") {
      return {
        tooltip: "∆ Agent has reached its limit",
        title: `∆ Agent is paused until you increase capacity or free up space.`,
        meta: `${activeUseCase.displayName} capacity`,
      };
    }

    return {
      tooltip: "∆ Agent needs attention",
      title: `∆ Agent hit an issue and needs a retry before it can continue working on ${entityPluralLower}.`,
      meta: "Action required",
    };
  }, [
    activeUseCase.displayName,
    entityPluralLower,
    status.issueReason,
    status.mode,
    status.pauseReason,
  ]);

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
        if (!result.success && result.error !== "Workflow is already running") {
          throw new Error(result.error || "Could not start the ∆ Agent.");
        }
        toast.success(
          status.actionKind === "resume"
            ? "∆ Agent resumed."
            : "∆ Agent retry started."
        );
      } catch (error) {
        toast.error("Could not start the ∆ Agent", {
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
      } finally {
        setPending(false);
      }
      return;
    }

    setOpen(false);
    if (status.actionKind === "open_setup") {
      router.push("/agent/setup");
      return;
    }

    if (status.actionKind === "view_plans") {
      router.push("/plans");
    }
  }, [router, startProspectingWorkflow, status]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={status.mode === "running" ? "ghost" : "outline"}
              size="xsIcon"
              aria-label={statusCopy.tooltip}
              onClick={() => setOpen(true)}
              className="relative"
            >
              <ChangeHistoryIcon
                aria-hidden="true"
                className="size-4 fill-current"
              />
              <span className="border-background absolute top-1 right-1 size-1.5 rounded-full border">
                <span
                  className={cn(
                    "block size-full rounded-full",
                    tone.dotClassName
                  )}
                />
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{statusCopy.tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

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
          onClose={() => setOpen(false)}
          timerMode={
            status.mode === "running"
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
