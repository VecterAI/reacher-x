/**
 * PipelineTimeline
 * Displays the prospect's pipeline stages as a horizontal timeline.
 * Uses Origin UI timeline component.
 */
"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { formatRelativeTime } from "@/shared/lib/utils";
import { format } from "date-fns";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import {
  Timeline,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "@/shared/ui/components/Timeline";
import { ScrollArea, ScrollBar } from "@/shared/ui/components/ScrollArea";
import { Button } from "@/shared/ui/components/Button";
import { useActiveUseCaseLabels } from "@/shared/hooks";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type PipelineStage =
  | "new"
  | "contacted"
  | "in_progress"
  | "converted"
  | "archived";

export interface PipelineStageData {
  stage: PipelineStage;
  timestamp?: number;
}

export interface PipelineTimelineProps {
  /** Current pipeline stage */
  currentStage: PipelineStage;
  /** Stage timestamps */
  stageTimestamps?: Partial<Record<PipelineStage, number>>;
  /** Additional className */
  className?: string;
}

const PIPELINE_STAGES: { id: PipelineStage; step: number }[] = [
  { id: "new", step: 1 },
  { id: "contacted", step: 2 },
  { id: "in_progress", step: 3 },
  { id: "converted", step: 4 },
  { id: "archived", step: 5 },
];

function getStepFromStage(stage: PipelineStage): number {
  const found = PIPELINE_STAGES.find((s) => s.id === stage);
  return found?.step ?? 1;
}

function formatStageTimestamp(timestamp?: number): string {
  if (!timestamp) return "-";
  const now = getCurrentUTCTimestamp();
  const diff = now - timestamp;
  const oneDay = 24 * 60 * 60 * 1000;

  // If within past 7 days, show relative time
  if (diff < 7 * oneDay) {
    return formatRelativeTime(new Date(timestamp).toISOString());
  }
  // Otherwise show date
  return format(new Date(timestamp), "MMM d, yyyy");
}

export function PipelineTimeline({
  currentStage,
  stageTimestamps = {},
  className,
}: PipelineTimelineProps) {
  const { stageLabels } = useActiveUseCaseLabels();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const currentStep = getStepFromStage(currentStage);

  const handleScrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -150, behavior: "smooth" });
    }
  };

  const handleScrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 150, behavior: "smooth" });
    }
  };

  return (
    <div className={cn("relative", className)}>
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium">Pipeline</h3>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="xsIcon"
            onClick={handleScrollLeft}
            aria-label="Scroll left"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="xsIcon"
            onClick={handleScrollRight}
            aria-label="Scroll right"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Timeline with horizontal scroll */}
      <ScrollArea className="w-full">
        <div ref={scrollRef} className="pb-4">
          <Timeline defaultValue={currentStep} orientation="horizontal">
            {PIPELINE_STAGES.map((stage) => (
              <TimelineItem
                key={stage.id}
                step={stage.step}
                className="min-w-[100px] group-data-[orientation=horizontal]/timeline:mt-0"
              >
                <TimelineHeader>
                  <TimelineSeparator className="group-data-[orientation=horizontal]/timeline:top-8" />
                  <TimelineDate className="mb-10 text-[10px]">
                    {formatStageTimestamp(stageTimestamps[stage.id])}
                  </TimelineDate>
                  <TimelineTitle className="text-xs">
                    {stageLabels[stage.id]}
                  </TimelineTitle>
                  <TimelineIndicator className="group-data-[orientation=horizontal]/timeline:top-8" />
                </TimelineHeader>
              </TimelineItem>
            ))}
          </Timeline>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
