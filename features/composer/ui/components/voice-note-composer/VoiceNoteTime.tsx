"use client";

import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";

function getDurationParts(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1_000));
  return {
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60,
  };
}

export function VoiceNoteTime({
  elapsedMs,
  totalMs,
}: {
  elapsedMs: number;
  totalMs: number;
}) {
  const elapsed = getDurationParts(elapsedMs);
  const total = getDurationParts(totalMs);

  return (
    <time
      className="text-muted-foreground inline-flex w-14 shrink-0 items-baseline justify-end text-xs tabular-nums"
      dateTime={`PT${Math.floor(Math.max(0, elapsedMs) / 1_000)}S`}
    >
      <AnimatedNumber value={elapsed.minutes} />
      <span>:</span>
      <AnimatedNumber
        value={elapsed.seconds}
        format={{ minimumIntegerDigits: 2 }}
      />
      <span>/</span>
      <AnimatedNumber value={total.minutes} />
      <span>:</span>
      <AnimatedNumber
        value={total.seconds}
        format={{ minimumIntegerDigits: 2 }}
      />
    </time>
  );
}
