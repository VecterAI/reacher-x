"use client";

import type { ComponentType } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  resolveOutreachProgressPresentation,
  type OutreachProgressIndicator,
  type OutreachProgressTone,
  type ProspectOutreachProgress,
} from "@/features/prospects/lib/outreachProgressUi";
import { cn } from "@/shared/lib/utils";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import { Badge } from "@/shared/ui/components/Badge";
import {
  CalendarClockIcon,
  CheckIcon,
  ErrorIcon,
  PauseCircleIcon,
  WarningIcon,
} from "@/shared/ui/components/icons";

const INDICATOR_TONE_CLASS_NAMES: Record<OutreachProgressTone, string> = {
  active: "text-primary",
  attention: "text-amber-600 dark:text-amber-400",
  warning: "text-destructive",
  success: "text-emerald-600 dark:text-emerald-400",
  muted: "text-muted-foreground",
};

const STATIC_INDICATOR_ICONS: Record<
  Exclude<OutreachProgressIndicator, "spinner">,
  ComponentType<{ className?: string }>
> = {
  waiting: CalendarClockIcon,
  attention: WarningIcon,
  paused: PauseCircleIcon,
  blocked: ErrorIcon,
  success: CheckIcon,
};

interface ProspectOutreachProgressBadgeProps {
  planGenerationStatus?: Doc<"prospects">["planGenerationStatus"];
  progress?: ProspectOutreachProgress;
  className?: string;
}

export function ProspectOutreachProgressBadge({
  planGenerationStatus,
  progress,
  className,
}: ProspectOutreachProgressBadgeProps) {
  const presentation = resolveOutreachProgressPresentation({
    planGenerationStatus,
    progress,
  });
  if (!presentation) {
    return null;
  }

  const toneClassName = INDICATOR_TONE_CLASS_NAMES[presentation.tone];

  return (
    <Badge
      variant="outline"
      className={cn("max-w-64", className)}
      title={presentation.title}
    >
      {presentation.indicator === "spinner" ? (
        <AsciiSpinnerText
          text={presentation.label}
          variant="spinner"
          className={cn(
            "[&>span:last-child]:text-foreground inline-flex min-w-0 items-center font-mono text-xs [&>span:last-child]:truncate",
            toneClassName
          )}
        />
      ) : (
        <StaticIndicatorContent
          indicator={presentation.indicator}
          label={presentation.label}
          toneClassName={toneClassName}
        />
      )}
    </Badge>
  );
}

function StaticIndicatorContent({
  indicator,
  label,
  toneClassName,
}: {
  indicator: Exclude<OutreachProgressIndicator, "spinner">;
  label: string;
  toneClassName: string;
}) {
  const Icon = STATIC_INDICATOR_ICONS[indicator];

  return (
    <>
      <Icon
        className={cn("size-3.5 shrink-0 fill-current", toneClassName)}
        aria-hidden
      />
      <span className="truncate font-mono text-xs" role="status">
        {label}
      </span>
    </>
  );
}
