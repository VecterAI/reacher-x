"use client";

import { useEffect, useState } from "react";

const SPINNER_FRAMES = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
] as const;

export function AsciiSpinnerText({
  text,
  intervalMs = 40,
  className,
}: {
  text: string;
  intervalMs?: number;
  className?: string;
}) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % SPINNER_FRAMES.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return (
    <span role="status" aria-live="polite" className={className} title={text}>
      <span className="inline-block w-[1em] select-none" aria-hidden>
        {SPINNER_FRAMES[frame]}
      </span>{" "}
      <span>{text}</span>
    </span>
  );
}
