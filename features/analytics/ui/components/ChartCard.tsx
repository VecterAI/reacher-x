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
import { cn } from "@/shared/lib/utils";

// ============================================================================
// Types
// ============================================================================

type ChartChildren = React.ComponentProps<
  typeof RechartsPrimitive.ResponsiveContainer
>["children"];

export interface ChartCardProps {
  title: string;
  config: ChartConfig;
  children: ChartChildren;
  className?: string;
  chartHeight?: string;
  chartMaxWidth?: string;
  centerChart?: boolean;
}

// ============================================================================
// ChartCard - Unified wrapper for analytics charts
// ============================================================================

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
