"use client";

import * as React from "react";
import NumberFlow, {
  type Format,
  useCanAnimate,
  useIsSupported,
} from "@number-flow/react";
import { cn } from "@/shared/lib/utils";

export interface AnimatedNumberProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  locales?: Intl.LocalesArgument;
  format?: Format;
  isolate?: boolean;
  willChange?: boolean;
  animateOnMount?: boolean;
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
  animateOnMount = false,
  className,
  style,
  ...rest
}: AnimatedNumberProps) {
  const isSupported = useIsSupported();
  const canAnimate = useCanAnimate({ respectMotionPreference: true });

  const safe = Number.isFinite(value) ? value : 0;
  const rounded = Number(safe.toFixed(decimals));
  const resolvedFormat = React.useMemo<Format>(
    () => ({
      maximumFractionDigits: decimals,
      ...format,
    }),
    [decimals, format]
  );
  const fallbackFormatter = React.useMemo(
    () =>
      new Intl.NumberFormat(
        locales,
        resolvedFormat as Intl.NumberFormatOptions
      ),
    [locales, resolvedFormat]
  );

  const [display, setDisplay] = React.useState<number>(() =>
    animateOnMount ? 0 : rounded
  );

  // Sync displayed value when the computed number changes
  React.useEffect(() => {
    setDisplay(rounded);
  }, [rounded]);

  if (!isSupported || !canAnimate) {
    return (
      <span
        className={cn("inline-flex items-baseline", className)}
        style={style}
        {...rest}
      >
        <span className="font-mono tabular-nums">
          {prefix}
          {fallbackFormatter.format(display)}
          {suffix}
        </span>
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
        value={display}
        prefix={prefix}
        suffix={suffix}
        locales={locales}
        format={resolvedFormat}
        className="font-mono tabular-nums"
        style={
          {
            "--number-flow-color": "currentColor",
            // Disable NumberFlow's vertical mask padding to avoid layout flicker
            // when placeholders/zero states transition into live values.
            "--number-flow-mask-height": "0em",
            fontVariantNumeric: "tabular-nums",
          } as React.CSSProperties
        }
        willChange={willChange}
        isolate={isolate}
      />
    </span>
  );
}
