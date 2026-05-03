"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";

export interface CharacterCounterProps {
  current: number;
  max: number;
  className?: string;
}

/**
 * Animated character counter using @number-flow/react
 * - Color reflects state: muted < near-limit < over-limit
 * - Uses tabular numerals for alignment
 */
export function CharacterCounter({
  current,
  max,
  className,
}: CharacterCounterProps) {
  const isOverLimit = current > max;
  const isNearLimit = current > max * 0.8;

  const colorClass = isOverLimit
    ? "text-red-500"
    : isNearLimit
      ? "text-primary dark:text-primary"
      : "text-muted-foreground";

  return (
    <span
      className={cn("text-sm font-medium", colorClass, className)}
      aria-live="polite"
      aria-label={`${current} of ${max} characters used`}
    >
      <AnimatedNumber
        value={current}
        format={{
          useGrouping: false,
        }}
      />
      <span className="font-mono tabular-nums">/{max}</span>
    </span>
  );
}

export default CharacterCounter;
