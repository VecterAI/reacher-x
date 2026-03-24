/**
 * Billing / calendar cycle boundaries for usage snapshots on the Plans page.
 */

import { parseIsoToTimestamp } from "../../shared/lib/utils/time/timeUtils";
import type { PlanTier } from "./planConstants";

/** Subscription shape from @convex-dev/polar getCurrentSubscription (loose). */
export type PolarSubscriptionLike = {
  currentPeriodStart?: unknown;
  currentPeriodEnd?: unknown;
  status?: string;
  cancelAtPeriodEnd?: boolean;
} | null;

function toTimestamp(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    return parseIsoToTimestamp(value) ?? null;
  }
  return null;
}

/** UTC calendar month containing `now`. */
export function getUtcMonthBounds(now: number): {
  cycleStart: number;
  cycleEnd: number;
} {
  const d = new Date(now);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const cycleStart = Date.UTC(y, m, 1, 0, 0, 0, 0);
  const cycleEnd = Date.UTC(y, m + 1, 0, 23, 59, 59, 999);
  return { cycleStart, cycleEnd };
}

/**
 * Paid tiers with an active subscription use Polar period boundaries.
 * Free tier (and missing subscription) use UTC calendar months.
 */
export function computeUsageCycleWindow(args: {
  now: number;
  tier: PlanTier;
  subscription: PolarSubscriptionLike;
}): { cycleStart: number; cycleEnd: number } {
  const { now, tier, subscription } = args;
  if (tier !== "free" && subscription != null) {
    const start = toTimestamp(subscription.currentPeriodStart);
    const end = toTimestamp(subscription.currentPeriodEnd);
    if (start != null && end != null && end > start && end >= now) {
      return { cycleStart: start, cycleEnd: end };
    }
  }

  return getUtcMonthBounds(now);
}
