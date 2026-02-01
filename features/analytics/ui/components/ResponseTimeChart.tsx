// features/analytics/ui/components/ResponseTimeChart.tsx
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
import type { ResponseTimeDataPoint } from "../../lib/types";

const chartConfig = {
  count: {
    label: "Responses",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export interface ResponseTimeChartProps {
  data: ResponseTimeDataPoint[];
  className?: string;
}

export const ResponseTimeChart = React.memo(function ResponseTimeChart({
  data,
  className,
}: ResponseTimeChartProps) {
  return (
    <ChartCard
      title="Response Time Distribution"
      config={chartConfig}
      className={className}
    >
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="bucket"
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
