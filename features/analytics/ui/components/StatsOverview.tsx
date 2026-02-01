// features/analytics/ui/components/StatsOverview.tsx
"use client";

import * as React from "react";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import { ArrowUpwardIcon } from "@/shared/ui/components/icons";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { cn } from "@/shared/lib/utils";
import type { StatMetricData } from "../../lib/types";

// Re-export type for consumers
export type { StatMetricData } from "../../lib/types";

// ============================================================================
// Types
// ============================================================================

export interface StatsOverviewProps {
  metrics: StatMetricData[];
  className?: string;
}

// ============================================================================
// StatMetric - Individual metric display (no border, designed for unified container)
// ============================================================================

interface StatMetricProps {
  metric: StatMetricData;
  /** 0-based index used for divider logic */
  index: number;
}

const StatMetric = React.memo(function StatMetric({
  metric,
  index,
}: StatMetricProps) {
  const {
    title,
    value,
    change,
    changePercent,
    trend,
    icon,
    format = "number",
  } = metric;

  // Prevent hydration mismatch by showing skeleton until client-side mounted
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const isPositive = trend === "up";
  const decimals = format === "number" ? 0 : 1;
  const suffix = format === "percent" ? "%" : undefined;

  // Divider visibility logic based on grid position:
  // - Desktop (4 cols): items 1,2,3 get vertical divider (not item 0)
  // - Tablet (2 cols): items 1,3 get vertical divider (right column only)
  // - Mobile (1 col): no vertical dividers (horizontal handled by divide-y)
  const showVerticalDividerDesktop = index > 0;
  const showVerticalDividerTablet = index % 2 === 1; // right column items

  return (
    <article className="relative flex flex-col justify-center p-4">
      {/*
        Vertical Divider - Strategic UX role:
        - Inset from top/bottom (top-4 bottom-4) creates breathing room
        - Guides the eye horizontally through the funnel progression
        - Subtle enough to unify, distinct enough to separate
      */}
      <div
        aria-hidden="true"
        className={cn(
          "bg-border absolute top-4 bottom-4 left-0 w-px",
          // Mobile: always hide vertical dividers
          "hidden",
          // Tablet: show only on right column (index 1, 3)
          showVerticalDividerTablet && "sm:max-lg:block",
          // Desktop: show on all except first
          showVerticalDividerDesktop && "lg:block"
        )}
      />

      {/* Header: Title + Icon */}
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm font-medium">
          {title}
        </span>
        {icon && (
          <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
        )}
      </div>

      {/* Value - Show skeleton during SSR to prevent flash */}
      <div className="mt-2">
        {isMounted ? (
          <AnimatedNumber
            value={value}
            decimals={decimals}
            suffix={suffix}
            className="text-3xl font-semibold tracking-tight"
            format={{ useGrouping: true }}
          />
        ) : (
          <Skeleton className="h-9 w-20" />
        )}
      </div>

      {/* Trend Indicator */}
      <div className="mt-1.5 flex items-center gap-1.5 text-sm">
        {isMounted ? (
          <>
            <span
              className={cn(
                "flex items-center gap-0.5 font-medium",
                isPositive ? "text-emerald-600" : "text-red-500"
              )}
            >
              <ArrowUpwardIcon
                className={cn(
                  "size-3.5 fill-current",
                  !isPositive && "rotate-180"
                )}
              />
              <AnimatedNumber
                value={Math.abs(change)}
                decimals={1}
                className="tabular-nums"
              />
            </span>
            <span className="text-muted-foreground">
              (
              <AnimatedNumber
                value={changePercent}
                decimals={2}
                prefix={changePercent >= 0 ? "+" : ""}
                suffix="%"
                className="tabular-nums"
              />
              )
            </span>
          </>
        ) : (
          <>
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-16" />
          </>
        )}
      </div>
    </article>
  );
});

// ============================================================================
// StatMetricSkeleton - Loading state for individual metric
// ============================================================================

interface StatMetricSkeletonProps {
  index: number;
}

function StatMetricSkeleton({ index }: StatMetricSkeletonProps) {
  const showVerticalDividerDesktop = index > 0;
  const showVerticalDividerTablet = index % 2 === 1;

  return (
    <article className="relative flex flex-col justify-center p-4">
      <div
        aria-hidden="true"
        className={cn(
          "bg-border absolute top-4 bottom-4 left-0 w-px",
          "hidden",
          showVerticalDividerTablet && "sm:max-lg:block",
          showVerticalDividerDesktop && "lg:block"
        )}
      />
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-4" />
      </div>
      <div className="mt-2">
        <Skeleton className="h-9 w-20" />
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-16" />
      </div>
    </article>
  );
}

// ============================================================================
// Shared container styles
// ============================================================================

const containerClassName =
  "bg-card text-card-foreground rounded-lg border shadow-none";

const gridClassName = cn(
  "grid",
  // Column configuration: 1 → 2 → 4
  "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  // Horizontal dividers on mobile (between stacked items)
  "divide-y sm:divide-y-0",
  // Tablet: horizontal border between rows (row 2 = items at index 2, 3)
  "[&>*:nth-child(n+3)]:sm:max-lg:border-t"
);

// ============================================================================
// StatsOverview - Unified container with strategic dividers
// ============================================================================

/**
 * StatsOverview displays multiple metrics in a unified card with intelligent dividers.
 *
 * ## Composition Pattern
 * Use `StatsOverviewSkeleton` for loading states:
 * ```tsx
 * {isLoading ? <StatsOverviewSkeleton /> : <StatsOverview metrics={data} />}
 * ```
 *
 * ## UX Strategy for Dividers
 *
 * The dividers serve a strategic purpose beyond mere visual separation:
 *
 * 1. **Visual Rhythm & Pacing**
 *    Dividers create pause points that guide the eye through the metrics.
 *    On desktop, vertical dividers support left-to-right scanning (natural reading flow).
 *    On mobile, horizontal dividers support top-to-bottom scanning.
 *
 * 2. **Funnel Narrative**
 *    The metrics represent a progression: Prospects → Contacted → Response → Conversions.
 *    Dividers separate each stage while the unified container keeps them as one story.
 *
 * 3. **Inset for Refinement**
 *    Dividers are inset from edges (top-4, bottom-4) rather than full-bleed.
 *    This creates breathing room and feels more designed/intentional.
 *
 * 4. **Responsive Transformation**
 *    - Desktop (lg+): Vertical dividers between all 4 columns
 *    - Tablet (sm-lg): Vertical dividers between columns + horizontal border between rows
 *    - Mobile (<sm): Horizontal dividers only (vertical would feel cramped)
 *
 * ## Performance
 * - Component is memoized to prevent unnecessary re-renders
 * - Skeleton states maintain layout stability during loading
 */
export const StatsOverview = React.memo(function StatsOverview({
  metrics,
  className,
}: StatsOverviewProps) {
  return (
    <section className={cn(containerClassName, className)}>
      <div className={gridClassName}>
        {metrics.map((metric, index) => (
          <StatMetric key={metric.id} metric={metric} index={index} />
        ))}
      </div>
    </section>
  );
});

// ============================================================================
// StatsOverviewSkeleton - Loading state for StatsOverview
// ============================================================================

export interface StatsOverviewSkeletonProps {
  className?: string;
  /** Number of skeleton metrics to display - defaults to 4 */
  count?: number;
}

/**
 * StatsOverviewSkeleton provides a loading skeleton that matches StatsOverview layout.
 * Use composition pattern: {loading ? <StatsOverviewSkeleton /> : <StatsOverview ... />}
 */
export function StatsOverviewSkeleton({
  className,
  count = 4,
}: StatsOverviewSkeletonProps) {
  return (
    <section className={cn(containerClassName, className)}>
      <div className={gridClassName}>
        {Array.from({ length: count }).map((_, index) => (
          <StatMetricSkeleton key={index} index={index} />
        ))}
      </div>
    </section>
  );
}
