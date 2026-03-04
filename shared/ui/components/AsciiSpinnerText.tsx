"use client";

import { useEffect, useState } from "react";

type SpinnerVariant = "spinner" | "pulse" | "clock";

const VARIANT_FRAMES: Record<SpinnerVariant, readonly string[]> = {
  spinner: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  pulse: ["·", "•", "●", "•", "·"],
  clock: ["◴", "◷", "◶", "◵"],
};

const VARIANT_DEFAULT_INTERVAL: Record<SpinnerVariant, number> = {
  spinner: 40,
  pulse: 200,
  clock: 250,
};

export function AsciiSpinnerText({
  text,
  variant = "spinner",
  intervalMs,
  className,
}: {
  text: string;
  variant?: SpinnerVariant;
  intervalMs?: number;
  className?: string;
}) {
  const frames = VARIANT_FRAMES[variant];
  const interval = intervalMs ?? VARIANT_DEFAULT_INTERVAL[variant];
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, interval);
    return () => window.clearInterval(id);
  }, [interval, frames.length]);

  return (
    <span role="status" aria-live="polite" className={className} title={text}>
      <span className="inline-block w-[1em] select-none" aria-hidden>
        {frames[frame]}
      </span>{" "}
      <span>{text}</span>
    </span>
  );
}
