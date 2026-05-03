"use client";

import * as React from "react";
import {
  CartesianGrid,
  XAxis,
  YAxis,
  Line,
  LineChart,
  Bar,
  BarChart,
  Area,
  AreaChart,
} from "recharts";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/components/Badge";
import {
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/shared/ui/components/chart";
import { ChartCard } from "@/features/analytics/ui/components";

export function formatRelativeDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function statusVariant(
  value: string | null | undefined
): "default" | "secondary" | "destructive" | "outline" {
  if (!value) {
    return "outline";
  }
  if (
    value.includes("failed") ||
    value.includes("rejected") ||
    value.includes("failing")
  ) {
    return "destructive";
  }
  if (
    value.includes("active") ||
    value.includes("completed") ||
    value.includes("processed") ||
    value.includes("promoted")
  ) {
    return "default";
  }
  if (
    value.includes("pending") ||
    value.includes("processing") ||
    value.includes("running")
  ) {
    return "secondary";
  }
  return "outline";
}

export function StatusBadge({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  return (
    <Badge
      variant={statusVariant(value)}
      className={cn("capitalize", className)}
    >
      {(value ?? "unknown").replaceAll("_", " ")}
    </Badge>
  );
}

export function usePagedRows<T>(rows: T[], pageSize: number) {
  const [page, setPage] = React.useState(0);

  React.useEffect(() => {
    setPage(0);
  }, [rows.length, pageSize]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const items = rows.slice(safePage * pageSize, safePage * pageSize + pageSize);

  return {
    page: safePage,
    totalPages,
    items,
    setPage,
    canPrevious: safePage > 0,
    canNext: safePage < totalPages - 1,
  };
}

export function AgentOpsLineChart({
  title,
  config,
  data,
  lines,
}: {
  title: string;
  config: ChartConfig;
  data: Record<string, string | number>[];
  lines: Array<{ dataKey: string; stroke: string }>;
}) {
  return (
    <ChartCard title={title} config={config}>
      <LineChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={32} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend
          content={<ChartLegendContent className="text-foreground" />}
        />
        {lines.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            name={String(config[line.dataKey]?.label ?? line.dataKey)}
            stroke={line.stroke}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ChartCard>
  );
}

export function AgentOpsBarChart({
  title,
  config,
  data,
  bars,
}: {
  title: string;
  config: ChartConfig;
  data: Record<string, string | number>[];
  bars: Array<{ dataKey: string; fill: string; stackId?: string }>;
}) {
  return (
    <ChartCard title={title} config={config}>
      <BarChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={32} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend
          content={<ChartLegendContent className="text-foreground" />}
        />
        {bars.map((bar) => (
          <Bar
            key={bar.dataKey}
            dataKey={bar.dataKey}
            name={String(config[bar.dataKey]?.label ?? bar.dataKey)}
            fill={bar.fill}
            radius={4}
            stackId={bar.stackId}
          />
        ))}
      </BarChart>
    </ChartCard>
  );
}

export function AgentOpsAreaChart({
  title,
  config,
  data,
  areas,
}: {
  title: string;
  config: ChartConfig;
  data: Record<string, string | number>[];
  areas: Array<{ dataKey: string; stroke: string; fill: string }>;
}) {
  return (
    <ChartCard title={title} config={config}>
      <AreaChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={32} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend
          content={<ChartLegendContent className="text-foreground" />}
        />
        {areas.map((area) => (
          <Area
            key={area.dataKey}
            type="monotone"
            dataKey={area.dataKey}
            name={String(config[area.dataKey]?.label ?? area.dataKey)}
            stroke={area.stroke}
            fill={area.fill}
            fillOpacity={0.2}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ChartCard>
  );
}
