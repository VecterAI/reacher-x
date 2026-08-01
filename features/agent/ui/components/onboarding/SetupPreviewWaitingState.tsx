"use client";

import { useState } from "react";
import { getSetupPreviewWaitingCopy } from "@/features/agent/lib/setupPreviewWaitingCopy";
import { cn } from "@/shared/lib/utils";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import { AnimatedElapsedTimer } from "@/shared/ui/components/AnimatedElapsedTimer";
import { AgentWorkingMark } from "@/shared/ui/components/AgentWorkingMark";
import { Button } from "@/shared/ui/components/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/components/Dialog";

export interface SetupPreviewWaitingProgress {
  discoveredCount: number;
  qualifiedCount: number;
  enrichedCount: number;
  selectedCount: number;
}

export interface SetupPreviewWaitingStateProps {
  entityPlural: string;
  progress: SetupPreviewWaitingProgress;
  startedAt: number | null;
  targetCount?: number;
  className?: string;
}

interface PreviewProgressMetric {
  id: "found" | "qualified" | "enriched" | "ready";
  label: string;
  value: number;
  suffix?: string;
}

export function SetupPreviewWaitingState({
  entityPlural,
  progress,
  startedAt,
  targetCount = 3,
  className,
}: SetupPreviewWaitingStateProps) {
  const [progressOpen, setProgressOpen] = useState(false);
  const copy = getSetupPreviewWaitingCopy({ entityPlural });
  const metrics: PreviewProgressMetric[] = [
    {
      id: "found",
      label: "Found",
      value: progress.discoveredCount,
    },
    {
      id: "qualified",
      label: "Qualified",
      value: progress.qualifiedCount,
    },
    {
      id: "enriched",
      label: "Enriched",
      value: progress.enrichedCount,
    },
    {
      id: "ready",
      label: "Ready",
      value: progress.selectedCount,
      suffix: `/${targetCount}`,
    },
  ];

  return (
    <>
      <section
        aria-labelledby="setup-preview-waiting-title"
        className={cn(
          "flex min-h-[300px] flex-1 flex-col items-center px-4 pt-16 pb-16 text-center sm:pt-20",
          className
        )}
      >
        <AgentWorkingMark />
        <h2
          id="setup-preview-waiting-title"
          className="font-pixel-square text-foreground mt-6 text-xl font-medium text-pretty md:text-2xl"
        >
          {copy.title}
        </h2>
        <p className="text-muted-foreground mt-3 text-sm">
          {copy.searchContext}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          {copy.previewDisclaimer}
        </p>
        <time aria-label="Elapsed search time" className="mt-5 block">
          <AnimatedElapsedTimer
            startedAt={startedAt}
            className="text-foreground text-xl leading-none"
          />
        </time>
        <p className="text-muted-foreground mt-2 text-xs">{copy.estimate}</p>
        <Button
          type="button"
          size="xs"
          className="mt-5"
          onClick={() => setProgressOpen(true)}
        >
          Show progress
        </Button>
      </section>

      <Dialog open={progressOpen} onOpenChange={setProgressOpen}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
          <DialogHeader className="border-border border-b px-4 py-3 text-left">
            <DialogTitle>{copy.progressTitle}</DialogTitle>
            <DialogDescription className="sr-only">
              Current preview search counts
            </DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-4 divide-x">
            {metrics.map((metric) => (
              <PreviewProgressMetricCell key={metric.id} metric={metric} />
            ))}
          </dl>
          <footer className="text-muted-foreground flex items-center justify-between border-t px-4 py-3 text-xs">
            <span>Elapsed</span>
            <AnimatedElapsedTimer startedAt={startedAt} />
          </footer>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PreviewProgressMetricCell({
  metric,
}: {
  metric: PreviewProgressMetric;
}) {
  return (
    <div className="min-w-0 px-4 py-3">
      <dt className="text-muted-foreground text-[10px] font-medium">
        {metric.label}
      </dt>
      <dd className="text-foreground mt-0.5 font-mono text-lg tabular-nums">
        <AnimatedNumber
          value={metric.value}
          suffix={metric.suffix}
          animateOnMount
          format={{ useGrouping: true }}
        />
      </dd>
    </div>
  );
}
