/**
 * ProspectCardFooter
 * Badge row showing fit score (ASCII bar), finance, location.
 * Fit bar animates on every card hover with ease-out effect.
 */
"use client";

import * as React from "react";
import { Badge } from "@/shared/ui/components/Badge";
// DollarSignIcon, MapPinIcon reserved for future badge icons
import { cn } from "@/shared/lib/utils";
import AnimatedPercent from "@/shared/ui/components/AnimatedPercent";
import { Flag2Icon } from "@/shared/ui/components/icons";
import { useActiveUseCaseLabels } from "@/shared/hooks";
import type { Doc } from "@/convex/_generated/dataModel";
import { resolveQualificationPresentation } from "@/features/prospects/lib/qualificationUi";

interface ProspectCardFooterProps {
  qualificationStatus?: Doc<"prospects">["qualificationStatus"];
  qualificationScore?: number;
  finance?: string;
  location?: string;
  /** Whether the parent card is being hovered - triggers animation */
  isHovered?: boolean;
}

/**
 * Animated ASCII progress bar for prospect cards.
 * Shows completed state by default.
 * On hover: Animates from empty to full with ease-out timing.
 */
function FitBar({
  percentage,
  isHovered,
  className,
}: {
  percentage: number;
  isHovered?: boolean;
  className?: string;
}) {
  const totalBlocks = 5;
  const targetBlocks = Math.floor((percentage / 100) * totalBlocks);
  const [filledBlocks, setFilledBlocks] = React.useState(targetBlocks);
  const animationRef = React.useRef<NodeJS.Timeout | null>(null);
  const prevHoveredRef = React.useRef(isHovered);

  React.useEffect(() => {
    // Clear any existing animation
    if (animationRef.current) clearTimeout(animationRef.current);

    // Only animate when transitioning from not hovered to hovered
    const wasNotHovered = !prevHoveredRef.current;
    prevHoveredRef.current = isHovered;

    if (isHovered && wasNotHovered) {
      // Reset to start state
      setFilledBlocks(0);

      // Add delay before animation starts (150ms)
      animationRef.current = setTimeout(() => {
        let current = 0;

        // Ease-out: start fast, slow down at end
        const baseInterval = 30;
        const maxInterval = 120;

        const animateStep = () => {
          if (current < targetBlocks) {
            current++;
            setFilledBlocks(current);

            // Calculate next interval with ease-out (slower as we approach end)
            const progress = current / targetBlocks;
            const easedInterval =
              baseInterval + (maxInterval - baseInterval) * progress * progress;

            animationRef.current = setTimeout(animateStep, easedInterval);
          }
        };

        animateStep();
      }, 150);
    } else if (!isHovered) {
      // When not hovered, show full state instantly (avoid redundant updates on re-renders)
      setFilledBlocks((prev) => (prev === targetBlocks ? prev : targetBlocks));
    }

    return () => {
      if (animationRef.current) clearTimeout(animationRef.current);
    };
  }, [isHovered, targetBlocks]);

  const emptyBlocks = totalBlocks - filledBlocks;
  const bar = "█".repeat(filledBlocks) + "░".repeat(emptyBlocks);

  return (
    <span
      className={cn("font-mono text-[8px] tracking-tight", className)}
      aria-label={`${percentage}% fit`}
    >
      {bar}
    </span>
  );
}

export function ProspectCardFooter({
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
      <div className="scrollbar-none scroll-fade-effect-x flex items-center gap-2 overflow-x-auto">
        {qualificationPresentation.showCardBadge && (
          <div className="text-foreground border-border flex shrink-0 items-center gap-1 overflow-hidden rounded-md border px-2.5 py-0.5">
            <Flag2Icon
              className={cn(
                "size-3.5 shrink-0",
                qualificationPresentation.cardIconClassName
              )}
              aria-hidden
            />
            <span className="font-mono text-xs">
              {qualificationPresentation.cardLabelText}
            </span>
          </div>
        )}
        {qualificationScore !== undefined && (
          <div className="text-foreground border-border flex shrink-0 items-center gap-1 overflow-hidden rounded-md border px-2.5 py-0.5">
            <FitBar percentage={qualificationScore} isHovered={isHovered} />
            <AnimatedPercent
              key={animationKey}
              value={animatedValue}
              className="text-xs"
              srLabel={`${entitySingular} fit score`}
              suffix="% fit"
              animateOnMount={false}
            />
          </div>
        )}
        {finance && (
          <Badge
            variant="outline"
            className="shrink-0 gap-1 rounded-md font-normal"
          >
            {/* <DollarSignIcon className="size-3" aria-hidden /> */}
            {finance}
          </Badge>
        )}
        {location && (
          <Badge
            variant="outline"
            className="shrink-0 gap-1 rounded-md font-normal"
          >
            {/* <MapPinIcon className="size-3" aria-hidden /> */}
            {location}
          </Badge>
        )}
      </div>
    </footer>
  );
}
