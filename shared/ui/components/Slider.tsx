"use client";

import { Slider as SliderPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/shared/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/components/Tooltip";

const sliderThumbVariants = {
  default:
    "border-primary bg-background ring-ring/50 block size-4 shrink-0 rounded-full border shadow-sm transition-[color,box-shadow] outline-none hover:ring-4 focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50",
  /** Comp-style range control: high-contrast range, white/black thumbs; works in light + dark. */
  histogram:
    "block size-4 shrink-0 cursor-grab rounded-full border-2 border-foreground bg-background shadow-[0_1px_3px_rgba(0,0,0,0.12)] outline-none ring-0 transition-[box-shadow] hover:ring-0 focus-visible:ring-2 focus-visible:ring-foreground/25 active:cursor-grabbing disabled:pointer-events-none disabled:opacity-50",
} as const;

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  showTooltip = false,
  tooltipContent,
  variant = "default",
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  showTooltip?: boolean;
  tooltipContent?: (value: number) => React.ReactNode;
  variant?: keyof typeof sliderThumbVariants;
}) {
  const [internalValues, setInternalValues] = React.useState<number[]>(
    Array.isArray(value)
      ? value
      : Array.isArray(defaultValue)
        ? defaultValue
        : [min, max]
  );

  React.useEffect(() => {
    if (value !== undefined) {
      setInternalValues(Array.isArray(value) ? value : [value]);
    }
  }, [value]);

  const handleValueChange = (newValue: number[]) => {
    setInternalValues(newValue);
    props.onValueChange?.(newValue);
  };

  const [showTooltipState, setShowTooltipState] = React.useState(false);

  const handlePointerDown = () => {
    if (showTooltip) {
      setShowTooltipState(true);
    }
  };

  const handlePointerUp = React.useCallback(() => {
    if (showTooltip) {
      setShowTooltipState(false);
    }
  }, [showTooltip]);

  React.useEffect(() => {
    if (showTooltip) {
      document.addEventListener("pointerup", handlePointerUp);
      return () => {
        document.removeEventListener("pointerup", handlePointerUp);
      };
    }
  }, [showTooltip, handlePointerUp]);

  const renderThumb = (value: number) => {
    const thumb = (
      <SliderPrimitive.Thumb
        className={sliderThumbVariants[variant]}
        data-slot="slider-thumb"
        onPointerDown={handlePointerDown}
      />
    );

    if (!showTooltip) return thumb;

    return (
      <TooltipProvider>
        <Tooltip open={showTooltipState}>
          <TooltipTrigger asChild>{thumb}</TooltipTrigger>
          <TooltipContent
            className="px-2 py-1 text-xs"
            side={props.orientation === "vertical" ? "right" : "top"}
            sideOffset={8}
          >
            <p>{tooltipContent ? tooltipContent(value) : value}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        variant === "histogram" &&
          "py-2 data-[orientation=horizontal]:pt-3 data-[orientation=horizontal]:pb-3",
        className
      )}
      data-slot="slider"
      defaultValue={defaultValue}
      max={max}
      min={min}
      onValueChange={handleValueChange}
      value={value}
      {...props}
    >
      <SliderPrimitive.Track
        className={cn(
          "relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5",
          variant === "histogram" ? "bg-border" : "bg-muted"
        )}
        data-slot="slider-track"
      >
        <SliderPrimitive.Range
          className={cn(
            "absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full",
            variant === "histogram" ? "bg-foreground" : "bg-primary"
          )}
          data-slot="slider-range"
        />
      </SliderPrimitive.Track>
      {Array.from({ length: internalValues.length }, (_, index) => (
        <React.Fragment key={String(index)}>
          {renderThumb(internalValues[index])}
        </React.Fragment>
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
