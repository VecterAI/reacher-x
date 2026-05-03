"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";

export interface AnimatedPercentProps {
  value: number;
  min?: number;
  max?: number;
  className?: string;
  /**
   * Accessible label for screen readers describing what this percentage is for.
   * Defaults to "Upload progress".
   */
  srLabel?: string;
  /** Number of decimal places to display. Defaults to 0. */
  decimals?: number;
  /** Custom suffix to display after the number. Defaults to '%'. */
  suffix?: string;
  /** Whether to animate from 0 on mount. Defaults to true for backward compatibility. */
  animateOnMount?: boolean;
}

/**
 * Animated inline percentage using @number-flow/react.
 * - Keeps visual design minimal (inline numerals) while adding delightful motion
 * - Provides proper ARIA progress semantics without introducing a visual progress bar
 * - Respects prefers-reduced-motion and feature support gracefully
 */
export default function AnimatedPercent({
  value,
  min = 0,
  max = 100,
  className,
  srLabel = "Upload progress",
  decimals = 0,
  suffix = "%",
  animateOnMount = true,
}: AnimatedPercentProps) {
  const clamped = Math.max(
    min,
    Math.min(max, Number.isFinite(value) ? value : 0)
  );
  const rounded = Number(clamped.toFixed(decimals));

  return (
    <span
      role="progressbar"
      aria-label={srLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={rounded}
      aria-valuetext={`${rounded}%`}
      aria-live="polite"
      className={cn("inline-flex items-baseline", className)}
    >
      <AnimatedNumber
        value={rounded}
        suffix={suffix}
        format={{
          // Match CharacterCounter: no grouping separators
          useGrouping: false,
        }}
        animateOnMount={animateOnMount}
      />
    </span>
  );
}
