import { format } from "date-fns";
import {
  countTimestampsByBucket,
  createTrendBucketSet,
  type NormalizedAnalyticsWindow,
} from "./analyticsCore";

export type UsageCycleWindow = {
  cycleStart: number;
  cycleEnd: number;
};

export type UsageTrendPoint = {
  date: string;
  value: number;
};

export function createUsageCycleKey(window: UsageCycleWindow) {
  return `${window.cycleStart}:${window.cycleEnd}`;
}

export function parseUsageCycleKey(
  value: string | null | undefined
): UsageCycleWindow | null {
  if (!value) {
    return null;
  }

  const [rawStart, rawEnd] = value.split(":");
  const cycleStart = Number(rawStart);
  const cycleEnd = Number(rawEnd);

  if (!Number.isFinite(cycleStart) || !Number.isFinite(cycleEnd)) {
    return null;
  }

  if (cycleEnd <= cycleStart) {
    return null;
  }

  return { cycleStart, cycleEnd };
}

export function sameUsageCycleWindow(
  left: UsageCycleWindow,
  right: UsageCycleWindow
) {
  return (
    left.cycleStart === right.cycleStart && left.cycleEnd === right.cycleEnd
  );
}

export function formatUsageCycleLabel(window: UsageCycleWindow) {
  return `${format(window.cycleStart, "d MMM")} – ${format(window.cycleEnd, "d MMM yyyy")}`;
}

export function dedupeUsageCycleWindows<
  T extends UsageCycleWindow & { isCurrent?: boolean },
>(windows: T[]) {
  const deduped: T[] = [];

  for (const window of windows) {
    const existingIndex = deduped.findIndex((candidate) =>
      sameUsageCycleWindow(candidate, window)
    );

    if (existingIndex === -1) {
      deduped.push(window);
      continue;
    }

    if (window.isCurrent && !deduped[existingIndex]?.isCurrent) {
      deduped.splice(existingIndex, 1, window);
    }
  }

  return deduped.sort((left, right) => right.cycleStart - left.cycleStart);
}

export function buildUsageTrendPoints(args: {
  window: UsageCycleWindow;
  timestamps: number[];
  now: number;
}) {
  const effectiveEnd = Math.min(args.window.cycleEnd, args.now);
  if (effectiveEnd <= args.window.cycleStart) {
    return [] satisfies UsageTrendPoint[];
  }

  const durationMs = effectiveEnd - args.window.cycleStart;
  const normalizedWindow: NormalizedAnalyticsWindow = {
    range: "custom",
    granularity: "daily",
    current: {
      startMs: args.window.cycleStart,
      endMs: effectiveEnd,
    },
    previous: {
      startMs: args.window.cycleStart - durationMs,
      endMs: args.window.cycleStart,
    },
  };
  const bucketSet = createTrendBucketSet(normalizedWindow);
  const counts = countTimestampsByBucket(args.timestamps, bucketSet);

  return bucketSet.buckets.map((bucket, index) => ({
    date: bucket.label,
    value: counts[index] ?? 0,
  }));
}

export function sortUsageWorkspaceRows<
  T extends { name: string; used: number },
>(rows: T[]) {
  return [...rows].sort(
    (left, right) =>
      right.used - left.used || left.name.localeCompare(right.name)
  );
}
