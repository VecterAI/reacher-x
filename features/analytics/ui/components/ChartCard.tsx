// features/analytics/ui/components/ChartCard.tsx
"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { ChartContainer, type ChartConfig } from "@/shared/ui/components/chart";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/Card";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { cn } from "@/shared/lib/utils";

// ============================================================================
// Types
// ============================================================================

/** Children type that matches ChartContainer's expected children type */
type ChartChildren = React.ComponentProps<
  typeof RechartsPrimitive.ResponsiveContainer
>["children"];

export interface ChartCardProps {
  /** Chart title displayed in the header */
  title: string;
  /** Recharts chart configuration for theming */
  config: ChartConfig;
  /** Chart content (Recharts components) - must be a valid Recharts chart */
  children: ChartChildren;
  /** Optional className for the card container */
  className?: string;
  /** Chart container height - defaults to 250px */
  chartHeight?: string;
  /** Max width constraint for chart container (e.g., for radar charts) */
  chartMaxWidth?: string;
  /** Center the chart horizontally (useful for radar charts) */
  centerChart?: boolean;
}

// ============================================================================
// ChartCard - Unified wrapper for analytics charts
// ============================================================================

/**
 * ChartCard provides a consistent layout for all analytics charts.
 *
 * Eliminates duplication of Card → CardHeader → CardContent → ChartContainer
 * pattern across FitDistributionChart, ResponseTimeChart, ProspectsTrendChart,
 * and PlatformDistributionChart.
 */
export const ChartCard = React.memo(function ChartCard({
  title,
  config,
  children,
  className,
  chartHeight = "h-[250px]",
  chartMaxWidth,
  centerChart = false,
}: ChartCardProps) {
  return (
    <Card className={cn("shadow-none", className)}>
      <CardHeader className="p-4 pb-4">
        <CardTitle className="text-lg font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <ChartContainer
          config={config}
          className={cn(
            chartHeight,
            "w-full",
            centerChart && "mx-auto",
            chartMaxWidth
          )}
        >
          {children}
        </ChartContainer>
      </CardContent>
    </Card>
  );
});

// ============================================================================
// ChartCardSkeleton - Loading state for ChartCard
// ============================================================================

export interface ChartCardSkeletonProps {
  className?: string;
  /** Chart container height - should match the chart it's replacing */
  chartHeight?: string;
}

/**
 * ChartCardSkeleton provides a loading skeleton that matches ChartCard layout.
 * Use composition pattern: {loading ? <ChartCardSkeleton /> : <ChartCard />}
 */
export function ChartCardSkeleton({
  className,
  chartHeight = "h-[250px]",
}: ChartCardSkeletonProps) {
  return (
    <Card className={cn("shadow-none", className)}>
      <CardHeader className="p-4 pb-4">
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <Skeleton className={cn(chartHeight, "w-full")} />
      </CardContent>
    </Card>
  );
}
