/**
 * DemoAgentStatusDialog
 * Faithful static replica of the real workspace system status dialog
 * (features/webapp/ui/components/WorkspaceSystemStatusDialog.tsx) shown from
 * the header status button: "All-time workspace progress" header, feature
 * status badges, the OnboardingProgressCard presentation (headline, meta,
 * stat cells, stage timeline), and the pause confirmation view.
 * Static healthy data, local state only.
 */
"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import { AnimatedElapsedTimer } from "@/shared/ui/components/AnimatedElapsedTimer";
import { Badge } from "@/shared/ui/components/Badge";
import { Button } from "@/shared/ui/components/Button";
import { Card, CardContent, CardHeader } from "@/shared/ui/components/Card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/components/Dialog";
import {
  Timeline,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "@/shared/ui/components/Timeline";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/components/Tooltip";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import { formatProspectPlatformSummary } from "@/shared/lib/platforms/prospectPlatformSummary";
import {
  formatAverageFitScoreDetail,
  formatEnrichedProfilesDetail,
} from "@/shared/lib/workspaceProgressDetails";
import { useDemoShell } from "./demoShellContext";

// Same stage list as OnboardingProgressCard.
const STAGES = [
  { id: "searching", label: "Search", step: 1 },
  { id: "qualifying", label: "Qualify", step: 2 },
  { id: "enriching", label: "Enrich", step: 3 },
  { id: "plans", label: "Plans", step: 4 },
] as const;

const STATUS_COPY = {
  healthy: "Available",
  degraded: "Limited",
  unavailable: "Unavailable",
  paused: "Paused",
} as const;

const STATUS_DOT_CLASS_NAME = {
  healthy: "bg-emerald-500",
  degraded: "bg-amber-500",
  unavailable: "bg-destructive",
  paused: "bg-muted-foreground",
} as const;

const DEMO_PROGRESS = {
  found: 128,
  twitterProspectsCount: 82,
  linkedInProspectsCount: 46,
  qualified: 46,
  enriched: 24,
  plansGenerated: 8,
  avgQualificationScore: 86,
  pipelineStartedMinutesAgo: 12,
};

export function DemoAgentStatusDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { labels } = useDemoShell();
  const [view, setView] = React.useState<"progress" | "pauseConfirm">(
    "progress"
  );

  const entitySingularLower = labels.entitySingular.toLowerCase();
  const entityPluralLower = labels.entityPlural.toLowerCase();

  const features = [
    {
      key: "discovery",
      label: `${labels.entitySingular} discovery`,
      detail: `△ Agent can find new ${entityPluralLower}.`,
    },
    {
      key: "qualification",
      label: `${labels.entitySingular} qualification`,
      detail: `△ Agent can score ${entityPluralLower}.`,
    },
    {
      key: "enrichment",
      label: `${labels.entitySingular} enrichment`,
      detail: `△ Agent can update ${entitySingularLower} details.`,
    },
    {
      key: "plan_creation",
      label: `${labels.entitySingular} plans`,
      detail: `△ Agent can create outreach plans for ${entityPluralLower}.`,
    },
    {
      key: "x_twitter",
      label: "X/Twitter",
      detail: "Connected and syncing.",
    },
  ];

  const pipelineStartedAt =
    getCurrentUTCTimestamp() -
    DEMO_PROGRESS.pipelineStartedMinutesAgo * 60 * 1000;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setView("progress");
    }
    onOpenChange(nextOpen);
  };

  const stageCounts: Record<(typeof STAGES)[number]["id"], number> = {
    searching: DEMO_PROGRESS.found,
    qualifying: DEMO_PROGRESS.qualified,
    enriching: DEMO_PROGRESS.enriched,
    plans: DEMO_PROGRESS.plansGenerated,
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {view === "pauseConfirm" ? (
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
              onClick={() => setView("progress")}
            >
              Cancel
            </Button>
            <Button
              className="w-full"
              size="xs"
              onClick={() => handleOpenChange(false)}
            >
              Pause △ Agent
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

          {/* Feature status row (same presentation as WorkspaceFeatureStatusRow) */}
          <TooltipProvider>
            <div className="scroll-fade-x border-border scrollbar-none overflow-x-auto [overflow-y:clip] border-b px-4 py-2.5 [&::-webkit-scrollbar]:hidden">
              <ul className="flex w-max list-none items-center gap-1.5 p-0">
                {features.map((feature) => (
                  <li key={feature.key}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          aria-label={`${feature.label}: ${STATUS_COPY.healthy}`}
                          className="bg-background h-7 gap-1.5 rounded-sm px-2.5 font-medium"
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "size-1.5 rounded-full",
                              STATUS_DOT_CLASS_NAME.healthy
                            )}
                          />
                          {feature.label}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-64">
                        <p className="font-medium">
                          {feature.label}: {STATUS_COPY.healthy}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {feature.detail}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            </div>
          </TooltipProvider>

          {/* OnboardingProgressCard presentation (displayMode="running") */}
          <Card className="w-full max-w-none rounded-none border-0 shadow-none">
            <CardHeader className="gap-3 border-b px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm leading-6 font-medium">
                    <span className="text-muted-foreground">
                      △ Agent is actively {labels.discoveryVerb} and qualifying{" "}
                      {entityPluralLower}.
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex min-h-4 flex-wrap items-center justify-between gap-3">
                <span className="text-muted-foreground text-xs">
                  {labels.displayName} pipeline
                </span>
                <AnimatedElapsedTimer
                  startedAt={pipelineStartedAt}
                  className="text-muted-foreground text-xs"
                />
              </div>
            </CardHeader>

            <CardContent className="grid grid-cols-3 divide-x border-b p-0">
              <StatCell
                label="Found"
                value={DEMO_PROGRESS.found}
                detail={
                  formatProspectPlatformSummary({
                    twitterProspectsCount: DEMO_PROGRESS.twitterProspectsCount,
                    linkedInProspectsCount:
                      DEMO_PROGRESS.linkedInProspectsCount,
                  }) ?? "\u00A0"
                }
              />
              <StatCell
                label="Qualified"
                value={DEMO_PROGRESS.qualified}
                detail={
                  formatAverageFitScoreDetail(
                    DEMO_PROGRESS.avgQualificationScore
                  ) ?? "\u00A0"
                }
              />
              <StatCell
                label="Enriched"
                value={DEMO_PROGRESS.enriched}
                detail={formatEnrichedProfilesDetail(DEMO_PROGRESS.enriched)}
              />
            </CardContent>

            <CardContent className="px-4 py-3">
              <Timeline defaultValue={4} orientation="horizontal">
                {STAGES.map((stage) => {
                  const count = stageCounts[stage.id];
                  return (
                    <TimelineItem
                      key={stage.id}
                      step={stage.step}
                      className="min-w-[72px] flex-1 group-data-[orientation=horizontal]/timeline:mt-0"
                    >
                      <TimelineHeader>
                        <TimelineSeparator className="group-data-[orientation=horizontal]/timeline:top-7" />
                        <TimelineDate
                          className={cn(
                            "mb-8 font-mono text-[10px] tabular-nums",
                            count > 0
                              ? "text-foreground"
                              : "text-muted-foreground/50"
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
                        <TimelineIndicator className="group-data-[orientation=horizontal]/timeline:top-7" />
                      </TimelineHeader>
                    </TimelineItem>
                  );
                })}
              </Timeline>
            </CardContent>
          </Card>

          <div className="border-border grid gap-2 border-t px-4 py-3">
            <Button
              className="w-full"
              variant="outline"
              size="xs"
              onClick={() => setView("pauseConfirm")}
            >
              Pause △ Agent
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
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
      <p className="text-muted-foreground text-[10px] font-medium">{label}</p>
      <p className="text-foreground mt-0.5 font-mono text-lg tabular-nums">
        <AnimatedNumber value={value} animateOnMount />
      </p>
      <p className="text-muted-foreground mt-0.5 text-[11px]">{detail}</p>
    </article>
  );
}
