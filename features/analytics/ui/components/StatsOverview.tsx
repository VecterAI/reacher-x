// features/analytics/ui/components/StatsOverview.tsx
"use client";

import * as React from "react";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import { ArrowUpwardIcon } from "@/shared/ui/components/icons";
import { Card } from "@/shared/ui/components/Card";
import { cn } from "@/shared/lib/utils";
import type { StatMetricData } from "../../lib/types";

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
    context,
    semantic = "default",
  } = metric;

  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const isPositive = trend === "up";
  const decimals = format === "number" ? 0 : 1;
  const suffix = format === "percent" ? "%" : undefined;

  const isGoodTrend = semantic === "destructive" ? !isPositive : isPositive;

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

      {/* Header: Title + Icon */}
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm font-medium">
          {title}
        </span>
        {icon && (
          <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
        )}
      </div>

      {/* Value */}
      <div className="mt-2">
        {isMounted ? (
          <AnimatedNumber
            value={value}
            decimals={decimals}
            suffix={suffix}
            className={cn(
              "text-3xl font-semibold tracking-tight",
              semantic === "destructive" && value > 0 && "text-red-500"
            )}
            format={{ useGrouping: true }}
          />
        ) : (
          <span className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
            {value.toFixed(decimals)}
            {suffix}
          </span>
        )}
      </div>

      {/* Context line */}
      {context && (
        <div className="text-muted-foreground mt-0.5 text-xs">{context}</div>
      )}

      {/* Trend Indicator */}
      <div className="mt-1.5 flex items-center gap-1.5 text-sm">
        {isMounted ? (
          <>
            <span
              className={cn(
                "flex items-center gap-0.5 font-medium",
                isGoodTrend ? "text-emerald-600" : "text-red-500"
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
            <span
              className={cn(
                "flex items-center gap-0.5 font-medium",
                isGoodTrend ? "text-emerald-600" : "text-red-500"
              )}
            >
              <ArrowUpwardIcon
                className={cn(
                  "size-3.5 fill-current",
                  !isPositive && "rotate-180"
                )}
              />
              <span className="font-mono tabular-nums">
                {Math.abs(change).toFixed(1)}
              </span>
            </span>
            <span className="text-muted-foreground font-mono tabular-nums">
              ({changePercent >= 0 ? "+" : ""}
              {changePercent.toFixed(2)}%)
            </span>
          </>
        )}
      </div>
    </article>
  );
});

// ============================================================================
// Shared container styles
// ============================================================================

const gridClassName = cn(
  "grid",
  "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  "divide-y sm:divide-y-0",
  "[&>*:nth-child(n+3)]:sm:max-lg:border-t"
);

// ============================================================================
// StatsOverview - Unified container with strategic dividers
// ============================================================================

export const StatsOverview = React.memo(function StatsOverview({
  metrics,
  className,
}: StatsOverviewProps) {
  return (
    <Card className={cn("shadow-none", className)}>
      <div className={gridClassName}>
        {metrics.map((metric, index) => (
          <StatMetric key={metric.id} metric={metric} index={index} />
        ))}
      </div>
    </Card>
  );
});
