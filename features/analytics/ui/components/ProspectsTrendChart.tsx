// features/analytics/ui/components/ProspectsTrendChart.tsx
"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
import type { TrendDataPoint } from "../../lib/types";

const chartConfig = {
  prospects: {
    label: "Prospects",
    color: "hsl(var(--chart-1))",
  },
  contacted: {
    label: "Contacted",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

export interface ProspectsTrendChartProps {
  data: TrendDataPoint[];
  className?: string;
}

export const ProspectsTrendChart = React.memo(function ProspectsTrendChart({
  data,
  className,
}: ProspectsTrendChartProps) {
  return (
    <Card className={cn("shadow-none", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">
          Prospects Over Time
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
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
              cursor={{ strokeDasharray: "3 3" }}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Area
              dataKey="contacted"
              type="monotone"
              fill="var(--color-contacted)"
              fillOpacity={0.3}
              stroke="var(--color-contacted)"
              strokeWidth={2}
              stackId="a"
            />
            <Area
              dataKey="prospects"
              type="monotone"
              fill="var(--color-prospects)"
              fillOpacity={0.3}
              stroke="var(--color-prospects)"
              strokeWidth={2}
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
});
