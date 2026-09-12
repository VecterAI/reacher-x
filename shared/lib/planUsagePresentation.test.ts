import { describe, expect, test } from "vitest";
import {
  getPlanUsageNoticeKey,
  getUsageProgress,
} from "./planUsagePresentation";

describe("usage presentation", () => {
  test.each([
    [0, 100, 0],
    [25, 100, 0.25],
    [100, 100, 1],
    [105, 100, 1],
    [0, 0, 0],
    [100, -1, 0],
    [-10, 100, 0],
    [NaN, 100, 0],
    [100, Infinity, 0],
  ])("bounds the ring for %s / %s", (used, limit, fraction) => {
    expect(getUsageProgress(used, limit).fraction).toBe(fraction);
  });
  test("plan changes and cycle resets have different dismissal keys", () => {
    expect(getPlanUsageNoticeKey("a", 100)).not.toBe(
      getPlanUsageNoticeKey("a", 1000)
    );
    expect(getPlanUsageNoticeKey("a", 100)).not.toBe(
      getPlanUsageNoticeKey("b", 100)
    );
  });
});
