// features/analytics/ui/components/DateRangeInputPicker.tsx
"use client";

import * as React from "react";
import { format, isValid, parse } from "date-fns";
import { DateRange } from "react-day-picker";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";
import { Calendar } from "@/shared/ui/components/Calendar";
import { Input } from "@/shared/ui/components/Input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/components/Popover";
import { CalendarTodayIcon } from "@/shared/ui/components/icons";

const DATE_FORMAT = "yyyy-MM-dd";
const DATE_PLACEHOLDER = "YYYY-MM-DD";

interface DateRangeInputPickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  disabled?: boolean;
  className?: string;
}

function safeToDate(date: Date | string | undefined): Date | undefined {
  if (!date) return undefined;
  if (date instanceof Date) return date;
  if (typeof date === "string") {
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
}

function formatDateForInput(date: Date | undefined): string {
  if (!date) return "";
  return format(date, DATE_FORMAT);
}

function parseDateInput(raw: string): Date | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const parsed = parse(trimmed, DATE_FORMAT, new Date());
  return isValid(parsed) ? parsed : undefined;
}

interface SingleDateInputProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder: string;
  disabled?: boolean;
  "aria-label": string;
}

function SingleDateInput({
  value,
  onChange,
  placeholder,
  disabled,
  "aria-label": ariaLabel,
}: SingleDateInputProps) {
  const [open, setOpen] = React.useState(false);
  const [textValue, setTextValue] = React.useState("");
  const [isEditing, setIsEditing] = React.useState(false);

  // Sync textValue with external value when not editing
  React.useEffect(() => {
    if (isEditing) return;
    setTextValue(formatDateForInput(value));
  }, [isEditing, value]);

  const handleBlur = React.useCallback(() => {
    setIsEditing(false);
    const parsed = parseDateInput(textValue);
    if (parsed) {
      onChange(parsed);
    } else if (textValue.trim() === "") {
      onChange(undefined);
    } else {
      // Invalid input - reset to previous value
      setTextValue(formatDateForInput(value));
    }
  }, [onChange, textValue, value]);

  const handleCalendarSelect = React.useCallback(
    (date: Date | undefined) => {
      onChange(date);
      setOpen(false);
    },
    [onChange]
  );

  return (
    <div className="relative flex-1">
      <Input
        size="sm"
        value={textValue}
        onChange={(e) => setTextValue(e.target.value)}
        onFocus={() => setIsEditing(true)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="pr-8 font-mono text-sm"
        aria-label={ariaLabel}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="xsIcon"
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 -translate-y-1/2"
            disabled={disabled}
            aria-label={`Open calendar for ${ariaLabel}`}
          >
            <CalendarTodayIcon className="size-3.5 fill-current" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            autoFocus
            mode="single"
            captionLayout="dropdown"
            selected={value}
            onSelect={handleCalendarSelect}
            defaultMonth={value}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function DateRangeInputPicker({
  value,
  onChange,
  disabled,
  className,
}: DateRangeInputPickerProps) {
  const safeFrom = React.useMemo(() => safeToDate(value?.from), [value?.from]);
  const safeTo = React.useMemo(() => safeToDate(value?.to), [value?.to]);

  const handleFromChange = React.useCallback(
    (date: Date | undefined) => {
      // Auto-swap if from > to
      if (date && safeTo && date > safeTo) {
        onChange?.({ from: safeTo, to: date });
      } else {
        onChange?.({ from: date, to: safeTo });
      }
    },
    [onChange, safeTo]
  );

  const handleToChange = React.useCallback(
    (date: Date | undefined) => {
      // Auto-swap if to < from
      if (date && safeFrom && date < safeFrom) {
        onChange?.({ from: date, to: safeFrom });
      } else {
        onChange?.({ from: safeFrom, to: date });
      }
    },
    [onChange, safeFrom]
  );

  return (
    <div
      className={cn(
        "flex min-w-[280px] items-center gap-2 rounded-md",
        className
      )}
    >
      <SingleDateInput
        value={safeFrom}
        onChange={handleFromChange}
        placeholder={DATE_PLACEHOLDER}
        disabled={disabled}
        aria-label="Start date"
      />
      <span className="text-muted-foreground shrink-0 text-sm">→</span>
      <SingleDateInput
        value={safeTo}
        onChange={handleToChange}
        placeholder={DATE_PLACEHOLDER}
        disabled={disabled}
        aria-label="End date"
      />
    </div>
  );
}
