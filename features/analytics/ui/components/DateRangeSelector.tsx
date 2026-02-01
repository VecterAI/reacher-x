// features/analytics/ui/components/DateRangeSelector.tsx
"use client";

import * as React from "react";
import { useQueryStates, parseAsStringLiteral, parseAsIsoDateTime } from "nuqs";
import { DateRange } from "react-day-picker";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/components/Tabs";
import { cn } from "@/shared/lib/utils";
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

  const handleCustomRangeChange = React.useCallback(
    (dateRange: DateRange | undefined) => {
      if (dateRange?.from && dateRange?.to) {
        setParams({
          range: "custom",
          from: dateRange.from,
          to: dateRange.to,
        });
      } else if (dateRange?.from) {
        setParams({
          range: "custom",
          from: dateRange.from,
          to: null,
        });
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
            Custom
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
