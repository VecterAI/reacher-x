"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/Card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/components/chart";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import { formatLargeNumber } from "@/shared/lib/utils";
import type { UsageTrendPoint } from "../../lib/types";

export interface WorkspaceUsageCardProps {
  accentColor: string;
  limit: number;
  name: string;
  trend: UsageTrendPoint[];
  unlimited: boolean;
  used: number;
}

export const WorkspaceUsageCard = React.memo(function WorkspaceUsageCard({
  accentColor,
  limit,
  name,
  trend,
  unlimited,
  used,
}: WorkspaceUsageCardProps) {
  const gradientId = React.useId();
  const donutConfig = React.useMemo(
    () =>
      ({
        used: {
          label: "Used",
          color: accentColor,
        },
        available: {
          label: "Unused",
          color: "hsl(var(--muted))",
        },
      }) satisfies ChartConfig,
    [accentColor]
  );

  const activityConfig = React.useMemo(
    () =>
      ({
        count: {
          label: "Qualified",
          color: accentColor,
        },
      }) satisfies ChartConfig,
    [accentColor]
  );

  const donutData = React.useMemo(() => {
    const usedValue = Math.max(0, used);
    const remainingValue = Math.max(0, limit - used);

    if (usedValue + remainingValue <= 0) {
      return [
        { key: "used", value: 0 },
        { key: "available", value: 1 },
      ];
    }

    return [
      { key: "used", value: usedValue },
      { key: "available", value: remainingValue },
    ];
  }, [limit, used]);

  return (
    <Card className="shadow-none">
      <CardHeader className="p-4 pb-4">
        <CardTitle className="text-lg font-medium">{name}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {unlimited ? (
          <div className="relative">
            <div className="pointer-events-none absolute top-0 left-0 z-10">
              <AnimatedNumber
                value={used}
                animateOnMount
                className="text-foreground text-3xl font-semibold tracking-tight"
                format={{ useGrouping: true }}
              />
            </div>
            <ChartContainer config={activityConfig} className="h-[220px] pt-12">
              <AreaChart
                data={trend}
                margin={{ top: 12, right: 0, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={accentColor}
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="100%"
                      stopColor={accentColor}
                      stopOpacity={0.04}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <ChartTooltip
                  cursor={{ stroke: accentColor, strokeOpacity: 0.2 }}
                  content={<ChartTooltipContent indicator="line" />}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={accentColor}
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        ) : (
          <div className="relative">
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <div className="flex flex-col items-center">
                <AnimatedNumber
                  value={used}
                  animateOnMount
                  className="text-foreground text-3xl font-semibold tracking-tight"
                  format={{ useGrouping: true }}
                />
                <div className="text-muted-foreground mt-0.5 flex items-baseline gap-1 text-xs font-medium">
                  <span>/</span>
                  <AnimatedNumber
                    value={limit}
                    animateOnMount
                    className="text-xs"
                    format={{ useGrouping: true }}
                  />
                </div>
              </div>
            </div>
            <ChartContainer config={donutConfig} className="h-[220px]">
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, itemName) => (
                        <div className="flex min-w-28 items-center gap-2">
                          <span className="text-muted-foreground">
                            {itemName === "used" ? "Used" : "Unused"}
                          </span>
                          <span className="ml-auto font-mono font-medium tabular-nums">
                            {formatLargeNumber(value as number)}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="key"
                  innerRadius={62}
                  outerRadius={88}
                  strokeWidth={8}
                >
                  {donutData.map((entry, index) => (
                    <Cell
                      key={`${entry.key}-${index}`}
                      fill={
                        entry.key === "used" ? accentColor : "hsl(var(--muted))"
                      }
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
