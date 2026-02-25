// features/analytics/ui/components/PipelineFunnelChart.tsx
"use client";

import * as React from "react";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";
import {
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/components/chart";
import { ChartCard } from "./ChartCard";
import type { PipelineFunnelDataPoint } from "../../lib/types";

// ============================================================================
// Chart Configuration
// ============================================================================

const chartConfig = {
  count: {
    label: "Prospects",
  },
  new: {
    label: "New",
    color: "hsl(var(--chart-1))",
  },
  contacted: {
    label: "Contacted",
    color: "hsl(var(--chart-2))",
  },
  inProgress: {
    label: "In progress",
    color: "hsl(var(--chart-3))",
  },
  converted: {
    label: "Converted",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig;

// ============================================================================
// Types
// ============================================================================

export interface PipelineFunnelChartProps {
  data: PipelineFunnelDataPoint[];
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/** Map stage names to config keys for consistent coloring */
function getColorKey(stage: string): keyof typeof chartConfig {
  const map: Record<string, keyof typeof chartConfig> = {
    New: "new",
    Contacted: "contacted",
    "In progress": "inProgress",
    Converted: "converted",
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
          tickFormatter={(value) =>
            value.length > 10 ? `${value.slice(0, 10)}…` : value
          }
        />
        <ChartTooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
          content={
            <ChartTooltipContent
              indicator="dot"
              formatter={(value, _name, item) => {
                const payload = item.payload as PipelineFunnelDataPoint;
                const fillColor = payload.fill;
                return (
                  <div className="flex flex-col gap-1">
                    {/* Count row with indicator dot */}
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
                    {/* Conversion rate row - indented to align with Count text */}
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
