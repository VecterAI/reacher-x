// features/analytics/ui/components/StatCard.tsx
"use client";

import * as React from "react";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import { ArrowUpwardIcon } from "@/shared/ui/components/icons";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { cn } from "@/shared/lib/utils";

export interface StatCardProps {
  title: string;
  value: number;
  change: number;
  changePercent: number;
  trend: "up" | "down";
  icon?: React.ReactNode;
  format?: "number" | "percent" | "decimal";
  className?: string;
}

/**
 * StatCard displays a metric with animated values and trend indicator.
 *
 * Performance optimizations applied:
 * - `rendering-hydration-no-flicker`: Uses mounted state to prevent hydration mismatch
 * - `rerender-memo`: Component is memoized at usage site (AnalyticsDashboard)
 * - `rendering-conditional-render`: Uses ternary for loading state
 */
export function StatCard({
  title,
  value,
  change,
  changePercent,
  trend,
  icon,
  format = "number",
  className,
}: StatCardProps) {
  // Prevent hydration mismatch by showing skeleton until client-side mounted
  // This follows `rendering-hydration-no-flicker` best practice
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const isPositive = trend === "up";

  // Determine decimal places and suffix based on format
  const decimals = format === "number" ? 0 : 1;
  const suffix = format === "percent" ? "%" : undefined;

  return (
    <article
      className={cn(
        "bg-card text-card-foreground rounded-lg border p-4",
        className
      )}
    >
      {/* Header: Title + Icon */}
      <div className="flex items-start justify-between">
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

      {/* Trend Indicator - Also animated for consistency */}
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
}
