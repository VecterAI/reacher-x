"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQueryWithStatus } from "@/shared/hooks";
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
  CardHeader,
  CardContent,
  CardFooter,
} from "@/shared/ui/components/Card";
import { cn } from "@/shared/lib/utils";

interface OnboardingProgressCardProps {
  workspaceId: string;
}

const STAGES = [
  { id: "searching", label: "Search", step: 1 },
  { id: "qualifying", label: "Qualify", step: 2 },
  { id: "enriching", label: "Enrich", step: 3 },
  { id: "plans", label: "Plans", step: 4 },
] as const;

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
}: OnboardingProgressCardProps) {
  const router = useRouter();

  const dataQuery = useQueryWithStatus(api.prospects.getOnboardingProgress, {
    workspaceId: workspaceId as Id<"workspaces">,
  });
  const data = dataQuery.data;

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

  const handleViewProspects = () => {
    router.push("/");
  };

  if (dataQuery.isPending) {
    return (
      <Card className="animate-pulse p-4 shadow-none">
        <div className="bg-muted h-4 w-48 rounded" />
      </Card>
    );
  }

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

  if (!data) {
    return null;
  }

  return (
    <Card className="w-full max-w-md shadow-none">
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b px-4 py-3">
        <div className="text-sm font-medium">
          {isReady ? (
            <span className="text-foreground">Your prospects are ready</span>
          ) : issueMessage ? (
            <span className="text-muted-foreground">{issueMessage}</span>
          ) : (
            <AsciiSpinnerText
              text="Setting up your workspace..."
              variant="spinner"
              className="text-foreground"
            />
          )}
        </div>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          <AnimatedNumber value={minutes} />
          {":"}
          <AnimatedNumber
            value={seconds}
            format={{ minimumIntegerDigits: 2 }}
          />
        </span>
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

      <CardFooter className="border-t px-4 py-3">
        {isReady ? (
          <Button
            variant="default"
            size="xs"
            className="w-full"
            onClick={handleViewProspects}
          >
            View prospects
          </Button>
        ) : (
          <Button variant="outline" size="xs" className="w-full" disabled>
            Setup in progress...
          </Button>
        )}
      </CardFooter>
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
