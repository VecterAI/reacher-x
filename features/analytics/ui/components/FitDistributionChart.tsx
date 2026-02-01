// features/analytics/ui/components/FitDistributionChart.tsx
"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/components/chart";
import { formatLargeNumber } from "@/shared/lib/utils";
import { ChartCard } from "./ChartCard";
import type { FitDistributionDataPoint } from "../../lib/types";

const chartConfig = {
  count: {
    label: "Prospects",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export interface FitDistributionChartProps {
  data: FitDistributionDataPoint[];
  className?: string;
}

export const FitDistributionChart = React.memo(function FitDistributionChart({
  data,
  className,
}: FitDistributionChartProps) {
  return (
    <ChartCard
      title="Fit Score Distribution"
      config={chartConfig}
      className={className}
    >
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="range"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={12}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={12}
          width={40}
          tickFormatter={(value) => formatLargeNumber(value)}
        />
        <ChartTooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
          content={<ChartTooltipContent indicator="dot" />}
        />
        <Bar dataKey="count" fill="var(--color-count)" radius={4} />
      </BarChart>
    </ChartCard>
  );
});
