"use client";

import * as React from "react";
import NumberFlow, {
  type Format,
  useCanAnimate,
  useIsSupported,
} from "@number-flow/react";
import { cn } from "@/shared/lib/utils/utils";

export interface AnimatedNumberProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  locales?: Intl.LocalesArgument;
  format?: Format;
  isolate?: boolean;
  willChange?: boolean;
}

/**
 * Generic animated number primitive built on @number-flow/react.
 * Provides graceful fallback for reduced motion or unsupported environments.
 */
export default function AnimatedNumber({
  value,
  decimals = 0,
  prefix,
  suffix,
  locales,
  format,
  isolate = true,
  willChange = true,
  className,
  style,
  ...rest
}: AnimatedNumberProps) {
  const isSupported = useIsSupported();
  const canAnimate = useCanAnimate({ respectMotionPreference: true });

  const safe = Number.isFinite(value) ? value : 0;
  const rounded = Number(safe.toFixed(decimals));

  if (!isSupported || !canAnimate) {
    return (
      <span
        className={cn("font-mono tabular-nums", className)}
        style={style}
        {...rest}
      >
        {prefix}
        {rounded}
        {suffix}
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex items-baseline", className)}
      style={style}
      {...rest}
    >
      <NumberFlow
        value={rounded}
        prefix={prefix}
        suffix={suffix}
        locales={locales}
        format={format}
        className="font-mono tabular-nums"
        style={
          {
            "--number-flow-color": "currentColor",
            fontVariantNumeric: "tabular-nums",
          } as React.CSSProperties
        }
        willChange={willChange}
        isolate={isolate}
      />
    </span>
  );
}
