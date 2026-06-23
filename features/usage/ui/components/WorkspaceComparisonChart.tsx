"use client";

import * as React from "react";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";
import {
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/components/chart";
import { formatLargeNumber } from "@/shared/lib/utils";
import { ChartCard } from "@/features/analytics/ui/components";
import type { UsageComparisonMode, UsageComparisonRow } from "../../lib/types";

export interface WorkspaceComparisonChartProps {
  accentColors: string[];
  mode: UsageComparisonMode;
  rows: UsageComparisonRow[];
}

export const WorkspaceComparisonChart = React.memo(
  function WorkspaceComparisonChart({
    accentColors,
    mode,
    rows,
  }: WorkspaceComparisonChartProps) {
    const chartConfig = React.useMemo(
      () =>
        ({
          value: {
            label: mode === "count" ? "Qualified" : "Usage %",
            color: "hsl(var(--chart-1))",
          },
        }) satisfies ChartConfig,
      [mode]
    );

    return (
      <ChartCard title="Workspace comparison" config={chartConfig}>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
        >
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={12}
            domain={mode === "percent" ? [0, 100] : [0, "dataMax"]}
            tickFormatter={(value) =>
              mode === "percent"
                ? `${value}%`
                : formatLargeNumber(Number(value))
            }
          />
          <YAxis
            type="category"
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={140}
            fontSize={12}
            tickFormatter={(value: string) =>
              value.length > 20 ? `${value.slice(0, 20)}…` : value
            }
          />
          <ChartTooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
            content={
              <ChartTooltipContent
                indicator="dot"
                labelFormatter={(_, payload) => payload[0]?.payload?.name ?? ""}
                formatter={(value, _name, item) => {
                  const payload = item.payload as UsageComparisonRow;
                  const formattedValue =
                    mode === "percent"
                      ? `${value}%`
                      : formatLargeNumber(Number(value));

                  return (
                    <div className="grid min-w-36 gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {mode === "percent" ? "Used" : "Qualified"}
                        </span>
                        <span className="ml-auto font-mono font-medium tabular-nums">
                          {formattedValue}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          Cycle total
                        </span>
                        <span className="ml-auto font-mono font-medium tabular-nums">
                          {formatLargeNumber(payload.used)}
                          {payload.limit != null
                            ? ` / ${formatLargeNumber(payload.limit)}`
                            : ""}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
            }
          />
          <Bar dataKey="value" radius={4}>
            {rows.map((row, index) => (
              <Cell
                key={row.name}
                fill={
                  accentColors[index % accentColors.length] ??
                  "hsl(var(--chart-1))"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ChartCard>
    );
  }
);
