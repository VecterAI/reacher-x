// features/analytics/ui/components/PlatformDistributionChart.tsx
"use client";

import * as React from "react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/components/chart";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/Card";
import { cn } from "@/shared/lib/utils";
import type { PlatformDistributionDataPoint } from "../../lib/types";

const chartConfig = {
  count: {
    label: "Prospects",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export interface PlatformDistributionChartProps {
  data: PlatformDistributionDataPoint[];
  className?: string;
}

export const PlatformDistributionChart = React.memo(
  function PlatformDistributionChart({
    data,
    className,
  }: PlatformDistributionChartProps) {
    return (
      <Card className={cn("shadow-none", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            Platform Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ChartContainer
            config={chartConfig}
            className="mx-auto h-[250px] w-full max-w-[300px]"
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
          </ChartContainer>
        </CardContent>
      </Card>
    );
  }
);
