// features/analytics/ui/components/ResponseTimeChart.tsx
"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
    <Card className={cn("shadow-none", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">
          Response Time Distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
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
              tickFormatter={(value) =>
                value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value
              }
            />
            <ChartTooltip
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Bar dataKey="count" fill="var(--color-count)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
});
