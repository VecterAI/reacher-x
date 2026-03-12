// features/analytics/ui/components/ProspectsTrendChart.tsx
"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/components/chart";
import { formatLargeNumber } from "@/shared/lib/utils";
import { useActiveUseCaseLabels } from "@/shared/hooks";
import { ChartCard } from "./ChartCard";
import type { TrendDataPoint } from "../../lib/types";

export interface ProspectsTrendChartProps {
  data: TrendDataPoint[];
  className?: string;
}

export const ProspectsTrendChart = React.memo(function ProspectsTrendChart({
  data,
  className,
}: ProspectsTrendChartProps) {
  const { entityPlural, stageLabels } = useActiveUseCaseLabels();
  const chartConfig = React.useMemo(
    () =>
      ({
        prospects: {
          label: entityPlural,
          color: "hsl(var(--chart-1))",
        },
        contacted: {
          label: stageLabels.contacted,
          color: "hsl(var(--chart-3))",
        },
      }) satisfies ChartConfig,
    [entityPlural, stageLabels]
  );

  return (
    <ChartCard
      title={`${entityPlural} over time`}
      config={chartConfig}
      className={className}
    >
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
          tickFormatter={(value) => formatLargeNumber(value)}
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
    </ChartCard>
  );
});
