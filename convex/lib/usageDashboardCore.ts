import { format } from "date-fns";
import { DEFAULT_REPORTING_TIME_ZONE } from "../../shared/lib/utils/time/timeUtils";
import {
  countTimestampsByBucket,
  createTrendBucketSet,
  type NormalizedAnalyticsWindow,
} from "./analyticsCore";
import type { PlanTier } from "./planConstants";

export type UsageCycleWindow = {
  cycleStart: number;
  cycleEnd: number;
};

export type UsageTrendPoint = {
  date: string;
  value: number;
};

export type UsagePlanSnapshot = {
  tier: PlanTier;
  prospectsLimit: number;
  workspacesLimit: number;
};

/** Current-cycle limits always come from the canonical live plan. */
export function resolveUsagePlanSnapshot(args: {
  isCurrent: boolean;
  livePlan: UsagePlanSnapshot;
  storedCycle: UsagePlanSnapshot | null;
}): UsagePlanSnapshot {
  if (args.isCurrent || !args.storedCycle) {
    return args.livePlan;
  }

  return args.storedCycle;
}

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
  const bucketSet = createUsageTrendBucketSet(args);
  if (!bucketSet) {
    return [] satisfies UsageTrendPoint[];
  }
  const counts = countTimestampsByBucket(args.timestamps, bucketSet);

  return buildUsageTrendPointsFromCounts(bucketSet, counts);
}

export function createUsageTrendBucketSet(args: {
  window: UsageCycleWindow;
  now: number;
}) {
  const effectiveEnd = Math.min(args.window.cycleEnd, args.now);
  if (effectiveEnd <= args.window.cycleStart) {
    return null;
  }

  const durationMs = effectiveEnd - args.window.cycleStart;
  const normalizedWindow: NormalizedAnalyticsWindow = {
    range: "custom",
    granularity: "daily",
    timeZone: DEFAULT_REPORTING_TIME_ZONE,
    current: {
      startMs: args.window.cycleStart,
      endMs: effectiveEnd,
    },
    previous: {
      startMs: args.window.cycleStart - durationMs,
      endMs: args.window.cycleStart,
    },
  };
  return createTrendBucketSet(normalizedWindow);
}

export function buildUsageTrendPointsFromCounts(
  bucketSet: ReturnType<typeof createTrendBucketSet>,
  counts: number[]
) {
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
