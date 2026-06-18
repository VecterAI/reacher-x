"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { AnimatedElapsedTimer } from "@/shared/ui/components/AnimatedElapsedTimer";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import { ChangeHistoryIcon } from "@/shared/ui/components/icons";
import { cn } from "@/shared/lib/utils";
import {
  WorkspaceSystemStatusDialog,
  type WorkspaceSystemStatus,
} from "@/features/webapp/ui/components/WorkspaceSystemStatusDialog";

type OnboardingProgressLike = {
  found: number;
  actionableReadyCount: number;
  pipelineStartedAt: number | null;
  pausedAt?: number | null;
};

interface WorkspaceSystemStatusFeedBarProps {
  status: WorkspaceSystemStatus;
  progress: OnboardingProgressLike;
  className?: string;
}

export function WorkspaceSystemStatusFeedBar({
  status,
  progress,
  className,
}: WorkspaceSystemStatusFeedBarProps) {
  const [open, setOpen] = useState(false);

  const inProgressCount = Math.max(
    progress.found - progress.actionableReadyCount,
    0
  );
  const isPaused = status.mode === "paused";
  const statusText =
    status.mode === "paused"
      ? "Agent paused"
      : status.mode === "degraded"
        ? "Agent recovering"
        : status.mode === "attention"
          ? "Agent needs attention"
        : "Agent working";
  const countSuffix =
    status.mode === "paused"
      ? "prospects left to process"
      : "prospects in progress";
  const label =
    inProgressCount > 0
      ? `${statusText} • ${inProgressCount} ${countSuffix}`
      : statusText;
  const dotClassName =
    status.mode === "running"
      ? "bg-emerald-500"
      : status.mode === "attention"
        ? "bg-destructive"
        : "bg-amber-500";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        className={cn(
          "bg-background border-border flex w-full min-w-0 items-center gap-2 rounded-[12px] border p-2 text-left",
          className
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="border-border relative shrink-0 rounded-md border p-1">
            <ChangeHistoryIcon className="text-foreground size-4 fill-current" />
            <span className="ring-background absolute top-0 right-0 size-2 translate-x-1/4 -translate-y-1/4 rounded-full ring-2">
              <span
                className={cn("block size-full rounded-full", dotClassName)}
              />
            </span>
          </div>
          <span className="min-w-0 truncate text-sm font-medium">
            <span>{statusText}</span>
            {inProgressCount > 0 ? (
              <>
                <span className="text-muted-foreground"> {" • "}</span>
                <AnimatedNumber
                  value={inProgressCount}
                  className="text-foreground align-baseline text-sm"
                />
                <span className="text-foreground font-mono tabular-nums">
                  {" "}
                  {countSuffix}
                </span>
              </>
            ) : null}
          </span>
        </div>

        <div className="text-muted-foreground flex shrink-0 items-center gap-2 font-mono text-xs">
          <AnimatedElapsedTimer
            startedAt={progress.pipelineStartedAt}
            pausedAt={isPaused ? progress.pausedAt ?? null : null}
            className="text-muted-foreground text-xs"
          />
          {!isPaused ? (
            <AsciiSpinnerText
              className="text-muted-foreground font-mono text-sm"
            />
          ) : null}
          <div className="border-border text-foreground rounded-md border p-1">
            <ChevronRight className="size-4" aria-hidden />
          </div>
        </div>
      </button>

      <WorkspaceSystemStatusDialog
        open={open}
        onOpenChange={setOpen}
        status={status}
      />
    </>
  );
}
