// features/analytics/ui/components/QualificationDistributionChart.tsx
"use client";

import * as React from "react";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";
import {
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/components/chart";
import { QUALIFICATION_UI_LABELS } from "@/features/prospects/lib/qualificationUi";
import { ChartCard } from "./ChartCard";
import type { QualificationDistributionDataPoint } from "../../lib/types";

const L = QUALIFICATION_UI_LABELS;

const EMPTY_QUALIFICATION: QualificationDistributionDataPoint[] = [
  { segment: "qualified", count: 0 },
  { segment: "disqualified", count: 0 },
];

function normalizeQualificationData(
  data: QualificationDistributionDataPoint[] | undefined
): QualificationDistributionDataPoint[] {
  if (!data || data.length === 0) {
    return EMPTY_QUALIFICATION;
  }
  return data;
}

type ChartRow = QualificationDistributionDataPoint & {
  label: string;
  fill: string;
};

export interface QualificationDistributionChartProps {
  data?: QualificationDistributionDataPoint[];
  className?: string;
}

export const QualificationDistributionChart = React.memo(
  function QualificationDistributionChart({
    data,
    className,
  }: QualificationDistributionChartProps) {
    const chartData = React.useMemo((): ChartRow[] => {
      return normalizeQualificationData(data).map((point) => ({
        ...point,
        label: point.segment === "qualified" ? L.qualified : L.unqualified,
        fill:
          point.segment === "qualified"
            ? "hsl(var(--chart-1))"
            : "hsl(var(--chart-2))",
      }));
    }, [data]);

    const chartConfig = React.useMemo(
      () =>
        ({
          qualified: {
            label: L.qualified,
            color: "hsl(var(--chart-1))",
          },
          disqualified: {
            label: L.unqualified,
            color: "hsl(var(--chart-2))",
          },
        }) satisfies ChartConfig,
      []
    );

    return (
      <ChartCard
        title={L.chartTitle}
        config={chartConfig}
        className={className}
      >
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
        >
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={12}
          />
          <YAxis
            type="category"
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={12}
            width={120}
          />
          <ChartTooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
            content={
              <ChartTooltipContent
                indicator="dot"
                labelFormatter={(_, payload) => {
                  const item = payload[0]?.payload as ChartRow | undefined;
                  return item?.label ?? "";
                }}
                formatter={(value, _name, item) => {
                  const payload = item.payload as ChartRow;
                  const fillColor = payload.fill;
                  return (
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 shrink-0 rounded-[2px] border"
                        style={{
                          backgroundColor: fillColor,
                          borderColor: fillColor,
                        }}
                      />
                      <span className="text-muted-foreground">Count</span>
                      <span className="ml-auto font-mono font-medium tabular-nums">
                        {(value as number).toLocaleString()}
                      </span>
                    </div>
                  );
                }}
              />
            }
          />
          <Bar dataKey="count" radius={4}>
            {chartData.map((entry) => (
              <Cell key={entry.segment} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ChartCard>
    );
  }
);
