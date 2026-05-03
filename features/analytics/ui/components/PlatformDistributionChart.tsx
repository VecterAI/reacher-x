// features/analytics/ui/components/PlatformDistributionChart.tsx
"use client";

import * as React from "react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";
import {
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/components/chart";
import { useActiveUseCaseLabels } from "@/shared/hooks";
import { ChartCard } from "./ChartCard";
import type { PlatformDistributionDataPoint } from "../../lib/types";

export interface PlatformDistributionChartProps {
  data: PlatformDistributionDataPoint[];
  className?: string;
}

export const PlatformDistributionChart = React.memo(
  function PlatformDistributionChart({
    data,
    className,
  }: PlatformDistributionChartProps) {
    const { entityPlural } = useActiveUseCaseLabels();
    const chartConfig = React.useMemo(
      () =>
        ({
          count: {
            label: entityPlural,
            color: "hsl(var(--chart-1))",
          },
        }) satisfies ChartConfig,
      [entityPlural]
    );

    return (
      <ChartCard
        title="Platform distribution"
        config={chartConfig}
        className={className}
        chartMaxWidth="max-w-[300px]"
        centerChart
      >
        <RadarChart data={data}>
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="dot" />}
          />
          <PolarGrid gridType="polygon" />
          <PolarAngleAxis
            dataKey="platform"
            tick={{ fontSize: 11 }}
            tickLine={false}
          />
          <Radar
            dataKey="count"
            fill="var(--color-count)"
            fillOpacity={0.6}
            stroke="var(--color-count)"
            strokeWidth={2}
          />
        </RadarChart>
      </ChartCard>
    );
  }
);
