"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useActiveUseCaseLabels, useQueryWithStatus } from "@/shared/hooks";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import {
  Timeline,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "@/shared/ui/components/Timeline";
import { Button } from "@/shared/ui/components/Button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/shared/ui/components/Card";
import { cn } from "@/shared/lib/utils";

interface OnboardingProgressCardProps {
  workspaceId: string;
  displayMode?: "running" | "paused" | "attention";
  footerMode?: "default" | "hidden" | "resume" | "action";
  footerActionLabel?: string;
  footerActionDisabled?: boolean;
  onFooterAction?: () => void | Promise<void>;
  headlineOverride?: string | null;
  metaLabelOverride?: string | null;
  timerMode?: "elapsed" | "paused" | "hidden";
  onClose?: () => void;
}

const STAGES = [
  { id: "searching", label: "Search", step: 1 },
  { id: "qualifying", label: "Qualify", step: 2 },
  { id: "enriching", label: "Enrich", step: 3 },
  { id: "plans", label: "Plans", step: 4 },
] as const;

const DEFAULT_PROGRESS_DATA = {
  found: 0,
  qualified: 0,
  enriched: 0,
  plansGenerated: 0,
  avgQualificationScore: 0,
  readyQualifiedEnrichedCount: 0,
  workflowStatus: "stopped" as const,
  pauseReason: null,
  isResumable: false,
  systemMode: "running" as const,
  userVisibleIssueState: null,
  pipelineStartedAt: null,
  phase: "searching" as const,
  isDone: false,
};

function getTimelineStep(data: {
  found: number;
  qualified: number;
  enriched: number;
  plansGenerated: number;
  isDone: boolean;
}): number {
  if (data.plansGenerated > 0 || data.isDone) return 4;
  if (data.enriched > 0) return 3;
  if (data.qualified > 0) return 2;
  if (data.found > 0) return 1;
  return 0;
}

function getStageCount(
  stageId: string,
  data: {
    found: number;
    qualified: number;
    enriched: number;
    plansGenerated: number;
  }
): number {
  switch (stageId) {
    case "searching":
      return data.found;
    case "qualifying":
      return data.qualified;
    case "enriching":
      return data.enriched;
    case "plans":
      return data.plansGenerated;
    default:
      return 0;
  }
}

export function OnboardingProgressCard({
  workspaceId,
  displayMode = "running",
  footerMode = "default",
  footerActionLabel,
  footerActionDisabled = false,
  onFooterAction,
  headlineOverride,
  metaLabelOverride,
  timerMode = "elapsed",
  onClose,
}: OnboardingProgressCardProps) {
  const router = useRouter();
  const { activeUseCase, pageLabels } = useActiveUseCaseLabels();

  const dataQuery = useQueryWithStatus(api.prospects.getOnboardingProgress, {
    workspaceId: workspaceId as Id<"workspaces">,
  });
  const data = dataQuery.data ?? DEFAULT_PROGRESS_DATA;

  const pipelineStartedAt = data?.pipelineStartedAt ?? null;
  const readyCount = data?.readyQualifiedEnrichedCount ?? 0;
  const isReady = readyCount > 0;
  const issueMessage =
    data?.userVisibleIssueState?.status === "delayed"
      ? data.userVisibleIssueState.message
      : null;

  const [elapsed, setElapsed] = useState(() =>
    pipelineStartedAt ? Math.floor((Date.now() - pipelineStartedAt) / 1000) : 0
  );

  // Tick the timer
  useEffect(() => {
    if (!pipelineStartedAt || isReady) return;
    const tick = () =>
      setElapsed(Math.floor((Date.now() - pipelineStartedAt) / 1000));
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [pipelineStartedAt, isReady]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  const timelineStep = data ? getTimelineStep(data) : 0;
  const entitiesLower = activeUseCase.entityPlural.toLowerCase();

  const handleViewProspects = () => {
    router.push("/");
  };

  if (dataQuery.isError) {
    return (
      <Card className="p-4 shadow-none">
        <p className="text-sm font-medium">Could not load setup progress</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {dataQuery.error.message || "Please try again."}
        </p>
      </Card>
    );
  }

  const headerMessage = headlineOverride
    ? headlineOverride
    : isReady
      ? `Your ${entitiesLower} are ready`
      : issueMessage
        ? issueMessage
        : displayMode === "paused"
          ? "∆ Agent is paused."
          : displayMode === "attention"
            ? "∆ Agent needs attention."
            : "Setting up your workspace...";
  const headerMetaLabel =
    metaLabelOverride ??
    (displayMode === "running"
      ? `${activeUseCase.displayName} pipeline`
      : displayMode === "paused"
        ? `${activeUseCase.displayName} paused`
        : "Action required");

  return (
    <Card className="w-full max-w-md shadow-none">
      <CardHeader className="gap-3 border-b px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm leading-6 font-medium">
              {headlineOverride ? (
                <span className="text-muted-foreground">{headerMessage}</span>
              ) : headerMessage === "Setting up your workspace..." ? (
                <AsciiSpinnerText
                  text={headerMessage}
                  variant="spinner"
                  className="text-foreground"
                />
              ) : (
                <span
                  className={
                    isReady ? "text-foreground" : "text-muted-foreground"
                  }
                >
                  {headerMessage}
                </span>
              )}
            </div>
          </div>
          {onClose ? (
            <Button
              variant="ghost"
              size="xsIcon"
              className="text-muted-foreground hover:text-foreground -mr-1 shrink-0 rounded-full"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <X className="size-4" />
            </Button>
          ) : headerMessage === "Setting up your workspace..." ? (
            <div className="w-8 shrink-0" />
          ) : null}
        </div>
        <div className="flex min-h-4 items-center justify-between gap-3">
          <span className="text-muted-foreground text-xs">
            {headerMetaLabel}
          </span>
          {timerMode === "elapsed" ? (
            <span className="text-muted-foreground font-mono text-xs tabular-nums">
              <AnimatedNumber value={minutes} />
              {":"}
              <AnimatedNumber
                value={seconds}
                format={{ minimumIntegerDigits: 2 }}
              />
            </span>
          ) : timerMode === "paused" ? (
            <span className="text-muted-foreground font-mono text-xs tabular-nums">
              Paused
            </span>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="grid grid-cols-3 divide-x border-b p-0">
        <StatCell
          label="Found"
          value={data.found}
          detail={`${platformCount(data.found)} platf.`}
        />
        <StatCell
          label="Qualified"
          value={data.qualified}
          detail={
            data.avgQualificationScore > 0
              ? `avg: ${data.avgQualificationScore}`
              : "\u00A0"
          }
        />
        <StatCell
          label="Enriched"
          value={data.enriched}
          detail={data.enriched > 0 ? `${data.enriched} prof.` : "\u00A0"}
        />
      </CardContent>

      <CardContent className="px-4 py-3">
        <Timeline defaultValue={timelineStep} orientation="horizontal">
          {STAGES.map((stage) => {
            const count = getStageCount(stage.id, data);
            return (
              <TimelineItem
                key={stage.id}
                step={stage.step}
                className="min-w-0 flex-1 group-data-[orientation=horizontal]/timeline:mt-0"
              >
                <TimelineHeader>
                  <TimelineSeparator className="group-data-[orientation=horizontal]/timeline:top-5" />
                  <TimelineDate
                    className={cn(
                      "mb-6 font-mono text-[10px] tabular-nums",
                      count > 0 ? "text-foreground" : "text-muted-foreground/50"
                    )}
                  >
                    {count > 0 ? (
                      <AnimatedNumber value={count} />
                    ) : (
                      <span>-</span>
                    )}
                  </TimelineDate>
                  <TimelineTitle className="text-[11px]">
                    {stage.label}
                  </TimelineTitle>
                  <TimelineIndicator className="group-data-[orientation=horizontal]/timeline:top-5" />
                </TimelineHeader>
              </TimelineItem>
            );
          })}
        </Timeline>
      </CardContent>

      {footerMode !== "hidden" ? (
        <CardFooter className="border-t px-4 py-3">
          {footerMode === "default" ? (
            isReady ? (
              <Button
                variant="default"
                size="xs"
                className="w-full"
                onClick={handleViewProspects}
              >
                View {pageLabels.entities.toLowerCase()}
              </Button>
            ) : (
              <Button variant="outline" size="xs" className="w-full" disabled>
                Setup in progress...
              </Button>
            )
          ) : (
            <Button
              variant="default"
              size="xs"
              className="w-full"
              onClick={() => void onFooterAction?.()}
              disabled={footerActionDisabled || !onFooterAction}
            >
              {footerActionLabel ??
                (footerMode === "resume" ? "Resume ∆ Agent" : "Continue")}
            </Button>
          )}
        </CardFooter>
      ) : null}
    </Card>
  );
}

function StatCell({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <article className="px-4 py-2.5">
      <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
        {label}
      </p>
      <p className="text-foreground mt-0.5 font-mono text-lg tabular-nums">
        <AnimatedNumber value={value} animateOnMount />
      </p>
      <p className="text-muted-foreground mt-0.5 text-[11px]">{detail}</p>
    </article>
  );
}

function platformCount(found: number): number {
  return found > 0 ? 1 : 0;
}
