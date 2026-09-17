/**
 * ProspectCardFooter
 * Badge row showing match score, finance, and location.
 * Match score animates on card hover.
 */
"use client";

import * as React from "react";
import { Badge } from "@/shared/ui/components/Badge";
// DollarSignIcon, MapPinIcon reserved for future badge icons
import { cn } from "@/shared/lib/utils";
import AnimatedPercent from "@/shared/ui/components/AnimatedPercent";
import { MatchResultIcon } from "../MatchResultIcon";
import { ModeHeatIcon } from "@/shared/ui/components/icons";
import { useActiveUseCaseLabels } from "@/shared/hooks";
import type { Doc } from "@/convex/_generated/dataModel";
import { resolveQualificationPresentation } from "@/features/prospects/lib/qualificationUi";
import type { ProspectOutreachProgress } from "@/features/prospects/lib/outreachProgressUi";
import { ProspectOutreachProgressBadge } from "./ProspectOutreachProgressBadge";

const compactBadgeClassName =
  "h-[22px] gap-1 overflow-hidden rounded-md py-0 font-normal leading-none";
const compactMonoClassName = "font-mono !leading-none";
const compactFitPercentClassName = "font-mono text-xs !leading-none";

interface ProspectCardFooterProps {
  planGenerationStatus?: Doc<"prospects">["planGenerationStatus"];
  outreachProgress?: ProspectOutreachProgress;
  qualificationStatus?: Doc<"prospects">["qualificationStatus"];
  qualificationScore?: number;
  finance?: string;
  location?: string;
  /** Whether the parent card is being hovered - triggers animation */
  isHovered?: boolean;
}

export function ProspectCardFooter({
  planGenerationStatus,
  outreachProgress,
  qualificationStatus,
  qualificationScore,
  finance,
  location,
  isHovered = false,
}: ProspectCardFooterProps) {
  const { entitySingular } = useActiveUseCaseLabels();
  const qualificationPresentation =
    resolveQualificationPresentation(qualificationStatus);
  const hasBadges =
    planGenerationStatus === "generating" ||
    outreachProgress !== undefined ||
    qualificationPresentation.showCardBadge ||
    qualificationScore !== undefined ||
    Boolean(finance) ||
    Boolean(location);

  // Track hover transitions to trigger animation on enter only
  const [animationKey, setAnimationKey] = React.useState(0);
  const [animatedValue, setAnimatedValue] = React.useState(
    qualificationScore ?? 0
  );
  const prevHoveredRef = React.useRef(isHovered);

  React.useEffect(() => {
    const wasNotHovered = !prevHoveredRef.current;
    prevHoveredRef.current = isHovered;

    if (isHovered && wasNotHovered && qualificationScore !== undefined) {
      // Reset to 10 (double digit to avoid layout shift) and animate up
      setAnimatedValue(10);
      setAnimationKey((k) => k + 1);
      // After a brief delay, set to target value so AnimatedPercent animates
      const timeout = setTimeout(() => {
        setAnimatedValue(qualificationScore);
      }, 150);
      return () => clearTimeout(timeout);
    } else if (!isHovered && qualificationScore !== undefined) {
      // Show full value when not hovered
      setAnimatedValue(qualificationScore);
    }
  }, [isHovered, qualificationScore]);

  if (!hasBadges) return null;

  return (
    <footer className="overflow-hidden">
      <div className="scroll-fade-x flex scrollbar-none items-center gap-2 overflow-x-auto [overflow-y:clip]">
        <ProspectOutreachProgressBadge
          planGenerationStatus={planGenerationStatus}
          progress={outreachProgress}
          className={compactBadgeClassName}
        />
        {qualificationPresentation.showCardBadge && (
          <Badge variant="outline" className={compactBadgeClassName}>
            <MatchResultIcon
              result={qualificationPresentation.icon}
              className={cn(
                "size-3.5 shrink-0",
                qualificationPresentation.cardIconClassName
              )}
              aria-hidden
            />
            <span className={compactMonoClassName}>
              {qualificationPresentation.cardLabelText}
            </span>
          </Badge>
        )}
        {qualificationScore !== undefined && (
          <Badge variant="outline" className={compactBadgeClassName}>
            <ModeHeatIcon className="size-3.5 shrink-0" aria-hidden />
            <AnimatedPercent
              key={animationKey}
              value={animatedValue}
              className={cn(
                compactFitPercentClassName,
                "[&_*]:!leading-none [&_number-flow-react]:!h-3"
              )}
              srLabel={`${entitySingular} match score`}
              suffix="% match"
              animateOnMount={false}
            />
          </Badge>
        )}
        {finance && (
          <Badge
            variant="outline"
            className={cn("shrink-0", compactBadgeClassName)}
          >
            {/* <DollarSignIcon className="size-3" aria-hidden /> */}
            {finance}
          </Badge>
        )}
        {location && (
          <Badge
            variant="outline"
            className={cn("shrink-0", compactBadgeClassName)}
          >
            {/* <MapPinIcon className="size-3" aria-hidden /> */}
            {location}
          </Badge>
        )}
      </div>
    </footer>
  );
}
