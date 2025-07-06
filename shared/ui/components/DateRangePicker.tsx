// shared/ui/components/DateRangePicker.tsx
"use client";

import * as React from "react";
import { DateRange } from "react-day-picker";

import { cn } from "@/shared/lib/utils/utils";
import { Button } from "@/shared/ui/components/Button";
import { Calendar } from "@/shared/ui/components/Calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/components/Popover";
import { CalendarTodayIcon } from "./icons";

interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Select range",
  disabled,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Helper function to safely convert to Date
  const safeToDate = (date: Date | string | undefined): Date | undefined => {
    if (!date) return undefined;
    if (date instanceof Date) return date;
    if (typeof date === "string") {
      const parsed = new Date(date);
      return isNaN(parsed.getTime()) ? undefined : parsed;
    }
    return undefined;
  };

  // Safely convert the value to ensure proper Date objects
  const safeValue: DateRange | undefined = value
    ? {
        from: safeToDate(value.from),
        to: safeToDate(value.to),
      }
    : undefined;

  // Helper function to safely format date
  const formatDate = (date: Date | string | undefined): string => {
    const dateObj = safeToDate(date);
    return dateObj ? dateObj.toLocaleDateString() : "";
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            size="sm"
            className={cn(
              "w-full justify-start text-left font-normal",
              !safeValue && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <CalendarTodayIcon className="mr-2 fill-current" />
            {safeValue?.from ? (
              safeValue.to ? (
                <>
                  {formatDate(safeValue.from)} - {formatDate(safeValue.to)}
                </>
              ) : (
                formatDate(safeValue.from)
              )
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            autoFocus
            mode="range"
            defaultMonth={safeValue?.from}
            selected={safeValue}
            onSelect={(range) => {
              onChange?.(range);
              if (range?.from && range?.to) {
                setOpen(false);
              }
            }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
