import { describe, expect, test } from "vitest";
import {
  computeUsageCycleWindow,
  getComplimentaryGrantTermWindow,
  getUtcMonthBounds,
} from "./planCycleUtils";

const OCT_2026_START = Date.UTC(2026, 9, 1, 0, 0, 0, 0);
const OCT_2026_END = Date.UTC(2026, 10, 0, 23, 59, 59, 999);
const NOW_IN_OCT = Date.UTC(2026, 9, 15, 12, 0, 0, 0);

describe("getComplimentaryGrantTermWindow", () => {
  test("returns the grant term as a usage window", () => {
    expect(
      getComplimentaryGrantTermWindow({
        createdAt: OCT_2026_START,
        expiresAt: OCT_2026_END,
      })
    ).toEqual({ cycleStart: OCT_2026_START, cycleEnd: OCT_2026_END });
  });

  test("returns null for missing, permanent, or inverted grants", () => {
    expect(getComplimentaryGrantTermWindow(null)).toBeNull();
    expect(getComplimentaryGrantTermWindow(undefined)).toBeNull();
    expect(
      getComplimentaryGrantTermWindow({ createdAt: OCT_2026_START })
    ).toBeNull();
    expect(
      getComplimentaryGrantTermWindow({
        createdAt: OCT_2026_END,
        expiresAt: OCT_2026_START,
      })
    ).toBeNull();
  });
});

describe("computeUsageCycleWindow", () => {
  test("paid subscription period wins over the grant term", () => {
    const nowInsideSubscriptionPeriod = Date.UTC(2026, 8, 20, 12, 0, 0, 0);
    const window = computeUsageCycleWindow({
      now: nowInsideSubscriptionPeriod,
      tier: "hobby",
      subscription: {
        currentPeriodStart: Date.UTC(2026, 8, 7),
        currentPeriodEnd: Date.UTC(2026, 9, 7),
      },
      complimentaryGrantTerm: {
        createdAt: OCT_2026_START,
        expiresAt: OCT_2026_END,
      },
    });
    expect(window).toEqual({
      cycleStart: Date.UTC(2026, 8, 7),
      cycleEnd: Date.UTC(2026, 9, 7),
    });
  });

  test("complimentary grants run one window for the whole grant term", () => {
    const window = computeUsageCycleWindow({
      now: NOW_IN_OCT,
      tier: "hobby",
      subscription: null,
      complimentaryGrantTerm: {
        createdAt: Date.UTC(2026, 8, 7),
        expiresAt: OCT_2026_END,
      },
    });
    expect(window).toEqual({
      cycleStart: Date.UTC(2026, 8, 7),
      cycleEnd: OCT_2026_END,
    });
    // The window must not reset on calendar month boundaries mid-term.
    expect(window.cycleStart).not.toBe(OCT_2026_START);
  });

  test("permanent grants without an expiry fall back to calendar months", () => {
    const window = computeUsageCycleWindow({
      now: NOW_IN_OCT,
      tier: "hobby",
      subscription: null,
      complimentaryGrantTerm: { createdAt: Date.UTC(2026, 8, 7) },
    });
    expect(window).toEqual(getUtcMonthBounds(NOW_IN_OCT));
  });

  test("free tier always uses calendar months", () => {
    const window = computeUsageCycleWindow({
      now: NOW_IN_OCT,
      tier: "free",
      subscription: null,
      complimentaryGrantTerm: {
        createdAt: OCT_2026_START,
        expiresAt: OCT_2026_END,
      },
    });
    expect(window).toEqual(getUtcMonthBounds(NOW_IN_OCT));
  });

  test("paid tier without a usable subscription falls back to the grant term", () => {
    const window = computeUsageCycleWindow({
      now: NOW_IN_OCT,
      tier: "base",
      subscription: { status: "canceled" },
      complimentaryGrantTerm: {
        createdAt: Date.UTC(2026, 8, 7),
        expiresAt: OCT_2026_END,
      },
    });
    expect(window).toEqual({
      cycleStart: Date.UTC(2026, 8, 7),
      cycleEnd: OCT_2026_END,
    });
  });
});
