// features/analytics/ui/components/DateRangeSelector.tsx
"use client";

import * as React from "react";
import { useQueryStates, parseAsStringLiteral, parseAsIsoDateTime } from "nuqs";
import { DateRange } from "react-day-picker";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/components/Tabs";
import { cn } from "@/shared/lib/utils";
import { getInclusiveDayCount } from "@/shared/lib/utils/time/timeUtils";
import type { DateRangePreset } from "../../lib/types";
import { DATE_RANGE_PRESETS } from "../../lib/dateRange";
import { DateRangeInputPicker } from "./DateRangeInputPicker";

export interface DateRangeSelectorProps {
  className?: string;
}

export function DateRangeSelector({ className }: DateRangeSelectorProps) {
  const [{ range, from, to }, setParams] = useQueryStates({
    range: parseAsStringLiteral(DATE_RANGE_PRESETS).withDefault("7d"),
    from: parseAsIsoDateTime,
    to: parseAsIsoDateTime,
  });

  // Per Vercel best practices: useMemo for derived state (rerender-memo)
  // Primitive dependencies [from, to] per rerender-dependencies rule
  const customDaysLabel = React.useMemo(() => {
    const days = getInclusiveDayCount(from, to);
    return days ? `${days}d` : "Custom";
  }, [from, to]);

  const handlePresetChange = React.useCallback(
    (value: string) => {
      const preset = value as DateRangePreset;
      if (preset === "custom") {
        // Just switch to custom tab, don't clear dates
        setParams({ range: preset });
      } else {
        // Clear custom dates when switching to preset
        setParams({ range: preset, from: null, to: null });
      }
    },
    [setParams]
  );

  // Per Vercel best practices: useCallback for stable callbacks (rerender-functional-setstate)
  const handleCustomRangeChange = React.useCallback(
    (dateRange: DateRange | undefined) => {
      if (dateRange?.from && dateRange?.to) {
        const days = getInclusiveDayCount(dateRange.from, dateRange.to);

        // Auto-switch to preset if matches
        if (days === 7) {
          setParams({ range: "7d", from: null, to: null });
          return;
        }
        if (days === 30) {
          setParams({ range: "30d", from: null, to: null });
          return;
        }

        setParams({ range: "custom", from: dateRange.from, to: dateRange.to });
      } else if (dateRange?.from) {
        setParams({ range: "custom", from: dateRange.from, to: null });
      }
    },
    [setParams]
  );

  const customDateRange: DateRange | undefined =
    from || to ? { from: from ?? undefined, to: to ?? undefined } : undefined;

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <Tabs value={range} onValueChange={handlePresetChange}>
        <TabsList size="sm">
          <TabsTrigger value="today" size="sm">
            Today
          </TabsTrigger>
          <TabsTrigger value="1d" size="sm">
            24h
          </TabsTrigger>
          <TabsTrigger value="7d" size="sm">
            7d
          </TabsTrigger>
          <TabsTrigger value="30d" size="sm">
            30d
          </TabsTrigger>
          <TabsTrigger value="custom" size="sm">
            {customDaysLabel}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {range === "custom" && (
        <DateRangeInputPicker
          value={customDateRange}
          onChange={handleCustomRangeChange}
          className="w-auto"
        />
      )}
    </div>
  );
}
