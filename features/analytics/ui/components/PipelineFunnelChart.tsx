// features/analytics/ui/components/PipelineFunnelChart.tsx
"use client";

import * as React from "react";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";
import {
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/components/chart";
import { useActiveUseCaseLabels } from "@/shared/hooks";
import { ChartCard } from "./ChartCard";
import type { PipelineFunnelDataPoint } from "../../lib/types";

// ============================================================================
// Chart Configuration
// ============================================================================

export interface PipelineFunnelChartProps {
  data: PipelineFunnelDataPoint[];
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/** Map stage IDs to config keys for consistent coloring */
function getColorKey(
  stage: PipelineFunnelDataPoint["stage"]
): "new" | "contacted" | "inProgress" | "converted" {
  const map: Record<
    PipelineFunnelDataPoint["stage"],
    "new" | "contacted" | "inProgress" | "converted"
  > = {
    new: "new",
    contacted: "contacted",
    in_progress: "inProgress",
    converted: "converted",
  };
  return map[stage] || "new";
}

// ============================================================================
// PipelineFunnelChart Component
// ============================================================================

/**
 * PipelineFunnelChart displays the prospect pipeline as a horizontal bar chart.
 *
 * Shows the progression: New → Contacted → In progress → Converted
 * with conversion rates between stages.
 *
 * ## Design Decisions
 * - Horizontal bar chart (layout="vertical") for clear stage comparison
 * - Each bar shows count with color-coded stages
 * - Tooltip shows count and conversion rate from previous stage
 * - Uses ChartCard for consistency with other analytics charts
 */
export const PipelineFunnelChart = React.memo(function PipelineFunnelChart({
  data,
  className,
}: PipelineFunnelChartProps) {
  const { entityPlural, stageLabels } = useActiveUseCaseLabels();
  const chartConfig = React.useMemo(
    () =>
      ({
        count: {
          label: entityPlural,
        },
        new: {
          label: stageLabels.new,
          color: "hsl(var(--chart-1))",
        },
        contacted: {
          label: stageLabels.contacted,
          color: "hsl(var(--chart-2))",
        },
        inProgress: {
          label: stageLabels.in_progress,
          color: "hsl(var(--chart-3))",
        },
        converted: {
          label: stageLabels.converted,
          color: "hsl(var(--chart-4))",
        },
      }) satisfies ChartConfig,
    [entityPlural, stageLabels]
  );

  return (
    <ChartCard
      title="Pipeline funnel"
      config={chartConfig}
      className={className}
    >
      <BarChart
        data={data}
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
          dataKey="stage"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={12}
          width={80}
          tickFormatter={(value: PipelineFunnelDataPoint["stage"]) => {
            const label = stageLabels[value];
            return label.length > 10 ? `${label.slice(0, 10)}…` : label;
          }}
        />
        <ChartTooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
          content={
            <ChartTooltipContent
              indicator="dot"
              labelFormatter={(_, payload) => {
                const item = payload[0]?.payload as
                  | PipelineFunnelDataPoint
                  | undefined;
                return item ? stageLabels[item.stage] : "";
              }}
              formatter={(value, _name, item) => {
                const payload = item.payload as PipelineFunnelDataPoint;
                const fillColor = payload.fill;
                return (
                  <div className="flex flex-col gap-1">
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
                    {payload.conversionRate !== null && (
                      <div className="flex items-center gap-2 pl-[18px]">
                        <span className="text-muted-foreground">
                          From previous
                        </span>
                        <span className="ml-auto font-mono font-medium tabular-nums">
                          {payload.conversionRate}%
                        </span>
                      </div>
                    )}
                  </div>
                );
              }}
            />
          }
        />
        <Bar dataKey="count" radius={4}>
          {data.map((entry) => (
            <Cell
              key={entry.stage}
              fill={`var(--color-${getColorKey(entry.stage)})`}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartCard>
  );
});
