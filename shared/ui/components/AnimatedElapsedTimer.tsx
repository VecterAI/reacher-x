"use client";

import { useAnimationActivity } from "@/shared/contexts/AnimationActivityProvider";

import { useEffect, useState } from "react";
import { cn, getCurrentUTCTimestamp } from "@/shared/lib/utils";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";

interface AnimatedElapsedTimerProps {
  startedAt: number | null;
  pausedAt?: number | null;
  className?: string;
  prefix?: string;
}

function getElapsedSeconds(
  startedAt: number | null,
  pausedAt?: number | null
): number {
  if (!startedAt) {
    return 0;
  }

  const endTimestamp = pausedAt ?? getCurrentUTCTimestamp();
  return Math.max(0, Math.floor((endTimestamp - startedAt) / 1000));
}

export function AnimatedElapsedTimer({
  startedAt,
  pausedAt = null,
  className,
  prefix,
}: AnimatedElapsedTimerProps) {
  const active = useAnimationActivity();
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    getElapsedSeconds(startedAt, pausedAt)
  );

  useEffect(() => {
    setElapsedSeconds(getElapsedSeconds(startedAt, pausedAt));

    if (!active || !startedAt || pausedAt) {
      return;
    }

    const id = window.setInterval(() => {
      setElapsedSeconds(getElapsedSeconds(startedAt, null));
    }, 1000);

    return () => window.clearInterval(id);
  }, [active, pausedAt, startedAt]);

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  if (!startedAt) {
    return null;
  }

  return (
    <span className={cn("font-mono tabular-nums", className)}>
      {prefix ? <span>{prefix} </span> : null}
      <AnimatedNumber value={minutes} />
      {":"}
      <AnimatedNumber value={seconds} format={{ minimumIntegerDigits: 2 }} />
    </span>
  );
}
