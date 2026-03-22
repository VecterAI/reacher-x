"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useMemo } from "react";

import { cn } from "@/shared/lib/utils";
import { useSliderWithInput } from "@/shared/ui/hooks/use-slider-with-input";
import { Input } from "@/shared/ui/components/Input";
import { Label } from "@/shared/ui/components/Label";
import { Slider } from "@/shared/ui/components/Slider";

export type RangeHistogramFieldProps = {
  domainMin: number;
  domainMax: number;
  step?: number;
  defaultRange: [number, number];
  binCounts: number[];
  minLabel?: string;
  maxLabel?: string;
  fieldLabel?: string;
  ariaLabel?: string;
  describedBy?: string;
  /** Renders below both inputs, full width (matches FormDescription rhythm vs /workspace fields). */
  supportingText?: ReactNode;
  supportingTextId?: string;
  showPercentSuffix?: boolean;
  onRangeChange?: (range: [number, number]) => void;
  className?: string;
};

function binInRange(
  index: number,
  binCount: number,
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number
): boolean {
  if (binCount <= 0) return false;
  const binWidth = (domainMax - domainMin) / binCount;
  const binStart = domainMin + index * binWidth;
  const binEnd = domainMin + (index + 1) * binWidth;
  return binStart < rangeMax && binEnd > rangeMin;
}

export function RangeHistogramField({
  domainMin,
  domainMax,
  step = 1,
  defaultRange,
  binCounts,
  minLabel = "Min",
  maxLabel = "Max",
  fieldLabel,
  ariaLabel = "Value range",
  describedBy,
  supportingText,
  supportingTextId,
  showPercentSuffix = false,
  onRangeChange,
  className,
}: RangeHistogramFieldProps) {
  const baseId = useId();
  const defaultRangeMin = defaultRange[0];
  const defaultRangeMax = defaultRange[1];
  const stableRange = useMemo(
    () => [defaultRangeMin, defaultRangeMax] as [number, number],
    [defaultRangeMin, defaultRangeMax]
  );
  const {
    sliderValue,
    inputValues,
    handleSliderChange,
    handleInputChange,
    validateAndUpdateValue,
  } = useSliderWithInput({
    minValue: domainMin,
    maxValue: domainMax,
    initialValue: stableRange,
    defaultValue: stableRange,
  });

  useEffect(() => {
    if (sliderValue.length >= 2) {
      onRangeChange?.([sliderValue[0], sliderValue[1]]);
    }
  }, [onRangeChange, sliderValue]);

  const maxCount = Math.max(...binCounts, 1);
  const low = sliderValue[0] ?? domainMin;
  const high = sliderValue[1] ?? domainMax;

  return (
    <section
      className={cn("space-y-3", className)}
      aria-labelledby={fieldLabel ? `${baseId}-title` : undefined}
    >
      {fieldLabel ? (
        <h3 className="sr-only" id={`${baseId}-title`}>
          {fieldLabel}
        </h3>
      ) : null}

      <div className="flex flex-col gap-0">
        <div
          aria-hidden
          className="flex h-12 w-full items-end gap-0 overflow-hidden"
        >
          {binCounts.map((count, i) => {
            const active = binInRange(
              i,
              binCounts.length,
              domainMin,
              domainMax,
              low,
              high
            );
            return (
              <div
                key={i}
                className="flex h-full min-w-0 flex-1 flex-col justify-end"
              >
                <div
                  className="w-full"
                  style={{ height: `${(count / maxCount) * 100}%` }}
                >
                  <span
                    className={cn(
                      "block h-full min-h-[2px] w-full",
                      active
                        ? "bg-muted-foreground/60"
                        : "bg-muted-foreground/25"
                    )}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <Slider
          aria-describedby={describedBy}
          aria-label={ariaLabel}
          max={domainMax}
          min={domainMin}
          onValueChange={handleSliderChange}
          step={step}
          value={sliderValue}
          variant="histogram"
        />
      </div>

      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="sr-only">{fieldLabel ?? ariaLabel}</legend>
        {/*
          Explicit label row + input row (grid) keeps Min/Max aligned. A two-column flex
          stack can misalign inputs when columns differ in height or stretch behavior.
          gap-y-2 matches FormItem spacing used on /workspace.
        */}
        <div className="grid w-full min-w-0 grid-cols-2 gap-x-4 gap-y-2">
          <Label className="min-w-0" htmlFor={`${baseId}-min`}>
            {minLabel}
          </Label>
          <Label className="min-w-0" htmlFor={`${baseId}-max`}>
            {maxLabel}
          </Label>
          <div className="relative min-w-0">
            <Input
              className={cn("tabular-nums", showPercentSuffix && "pe-7")}
              id={`${baseId}-min`}
              inputMode="numeric"
              onBlur={() => validateAndUpdateValue(inputValues[0] ?? "", 0)}
              onChange={(e) => handleInputChange(e, 0)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  validateAndUpdateValue(inputValues[0] ?? "", 0);
                }
              }}
              type="text"
              value={inputValues[0] ?? ""}
            />
            {showPercentSuffix ? (
              <span
                aria-hidden
                className="text-muted-foreground pointer-events-none absolute inset-y-0 end-2 flex items-center text-sm"
              >
                %
              </span>
            ) : null}
          </div>
          <div className="relative min-w-0">
            <Input
              className={cn("tabular-nums", showPercentSuffix && "pe-7")}
              id={`${baseId}-max`}
              inputMode="numeric"
              onBlur={() => validateAndUpdateValue(inputValues[1] ?? "", 1)}
              onChange={(e) => handleInputChange(e, 1)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  validateAndUpdateValue(inputValues[1] ?? "", 1);
                }
              }}
              type="text"
              value={inputValues[1] ?? ""}
            />
            {showPercentSuffix ? (
              <span
                aria-hidden
                className="text-muted-foreground pointer-events-none absolute inset-y-0 end-2 flex items-center text-sm"
              >
                %
              </span>
            ) : null}
          </div>
          {supportingText ? (
            <p
              className="text-muted-foreground col-span-2 text-sm leading-relaxed"
              id={supportingTextId}
            >
              {supportingText}
            </p>
          ) : null}
        </div>
      </fieldset>
    </section>
  );
}
