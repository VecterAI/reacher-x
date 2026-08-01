"use client";

import { useEffect, useState } from "react";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";

const SYSTEM_FACTS: Array<{
  value: number;
  suffix?: string;
  label: string;
  /** Non-zero start so "0" still has a visible count-down. */
  resetFrom?: number;
}> = [
  { value: 10, suffix: "×", label: "Less manual work" },
  { value: 24, suffix: "/7", label: "Working for you" },
  { value: 4, suffix: "×", label: "More qualified matches" },
  { value: 0, label: "Expertise required", resetFrom: 12 },
];

function FactValue({
  value,
  suffix,
  resetFrom = 0,
}: {
  value: number;
  suffix?: string;
  resetFrom?: number;
}) {
  const [display, setDisplay] = useState(resetFrom);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setDisplay(value);
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <AnimatedNumber value={display} suffix={suffix} />;
}

export function SystemFactsGrid() {
  const [runId, setRunId] = useState(0);

  return (
    <ul
      className="grid gap-x-12 sm:grid-cols-2 md:col-span-7"
      onMouseEnter={() => setRunId((id) => id + 1)}
    >
      {SYSTEM_FACTS.map((fact) => (
        <li key={fact.label} className="border-border border-t pt-5 pb-8">
          <p className="text-3xl font-bold md:text-4xl">
            <FactValue
              key={`${fact.label}-${runId}`}
              value={fact.value}
              suffix={fact.suffix}
              resetFrom={fact.resetFrom}
            />
          </p>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            {fact.label}
          </p>
        </li>
      ))}
    </ul>
  );
}
