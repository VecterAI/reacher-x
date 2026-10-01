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
 * Complimentary grants run one quota window for the whole grant term. The
 * window resets only when the grant is replaced (a fresh term starts), which
 * matches how paid subscriptions reset on Polar renewal - never on calendar
 * month boundaries.
 */
export type ComplimentaryGrantTerm = {
  createdAt: number;
  expiresAt?: number;
};

export function getComplimentaryGrantTermWindow(
  grant: ComplimentaryGrantTerm | null | undefined
): { cycleStart: number; cycleEnd: number } | null {
  if (
    !grant ||
    !Number.isFinite(grant.createdAt) ||
    !Number.isFinite(grant.expiresAt) ||
    grant.expiresAt! <= grant.createdAt
  ) {
    return null;
  }
  return { cycleStart: grant.createdAt, cycleEnd: grant.expiresAt! };
}

/**
 * Paid tiers with an active subscription use Polar period boundaries.
 * Paid tiers with a complimentary grant (and no subscription) use the grant
 * term. Internal unpaid fallback (and missing subscription) use UTC calendar
 * months.
 */
export function computeUsageCycleWindow(args: {
  now: number;
  tier: PlanTier;
  subscription: PolarSubscriptionLike;
  complimentaryGrantTerm?: ComplimentaryGrantTerm | null;
}): { cycleStart: number; cycleEnd: number } {
  const { now, tier, subscription, complimentaryGrantTerm } = args;
  if (tier !== "free" && subscription != null) {
    const start = toTimestamp(subscription.currentPeriodStart);
    const end = toTimestamp(subscription.currentPeriodEnd);
    if (start != null && end != null && end > start && end >= now) {
      return { cycleStart: start, cycleEnd: end };
    }
  }

  if (tier !== "free") {
    const grantWindow = getComplimentaryGrantTermWindow(complimentaryGrantTerm);
    // Mirror the subscription guard: an expired grant whose row has not been
    // removed yet must not freeze the window in the past (which would stop
    // usage counting); it falls back to the calendar month until expiry
    // cleanup downgrades the plan.
    if (grantWindow && grantWindow.cycleEnd >= now) {
      return grantWindow;
    }
  }

  return getUtcMonthBounds(now);
}
