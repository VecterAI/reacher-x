import { describe, expect, test } from "vitest";
import {
  getAgentOpsDashboardWindow,
  getAgentOpsDashboardFields,
  getAgentOpsTrendSlice,
  getAgentOpsTrendSliceOffsets,
} from "./agentOpsDashboardCore";

describe("Agent Ops chart bounds and calendar coverage", () => {
  test.each([
    ["America/New_York", "2026-03-08", "2026-03-08", 23],
    ["America/New_York", "2026-11-01", "2026-11-01", 25],
    ["Asia/Karachi", "2026-03-08", "2026-03-08", 24],
    ["Asia/Kathmandu", "2026-03-08", "2026-03-08", 24],
  ])(
    "covers the complete %s calendar day %s",
    (timeZone, fromDate, toDate, hours) => {
      const { normalizedWindow, bucketSet } = getAgentOpsDashboardWindow({
        range: "custom",
        timeZone,
        fromDate,
        toDate,
        nowMs: Date.UTC(2026, 11, 1),
      });
      expect(
        normalizedWindow.current.endMs - normalizedWindow.current.startMs
      ).toBe(hours * 3600000);
      expect(bucketSet.buckets[0].startMs).toBe(
        normalizedWindow.current.startMs
      );
      expect(bucketSet.buckets.at(-1)!.endMs).toBe(
        normalizedWindow.current.endMs
      );
    }
  );
  test.each([31, 32, 90, 180, 181, 365, 366, 3650, 36500])(
    "covers %i days exactly with bounded contiguous slices",
    (days) => {
      const end = Date.UTC(2026, 8, 7, 12);
      const { normalizedWindow, bucketSet } = getAgentOpsDashboardWindow({
        range: "custom",
        from: end - days * 86400000,
        to: end,
        nowMs: end,
        timeZone: "UTC",
      });
      const slices = getAgentOpsTrendSliceOffsets(
        bucketSet.buckets.length,
        "overview"
      ).map((offset) => getAgentOpsTrendSlice(normalizedWindow, offset));
      expect(slices.length).toBeLessThanOrEqual(15);
      expect(slices.every((slice) => slice.length <= 4)).toBe(true);
      expect(slices.flat()).toEqual(bucketSet.buckets);
      for (let i = 1; i < bucketSet.buckets.length; i++)
        expect(bucketSet.buckets[i].startMs).toBe(
          bucketSet.buckets[i - 1].endMs
        );
      expect(bucketSet.buckets.at(-1)!.endMs).toBe(
        normalizedWindow.current.endMs
      );
    }
  );
  test("keeps both summary and chart fan-out bounded for every tab", () => {
    for (const tab of [
      "overview",
      "discovery",
      "quality",
      "memory",
      "activity",
    ] as const) {
      const summary = getAgentOpsDashboardFields(tab, "summary");
      const trend = getAgentOpsDashboardFields(tab, "trend");
      expect(
        (summary.analytics.length + summary.agentOps.length) * 2
      ).toBeLessThanOrEqual(20);
      expect(
        (trend.analytics.length + trend.agentOps.length) * 4
      ).toBeLessThanOrEqual(40);
      for (const fields of [summary, trend]) {
        expect(new Set(fields.agentOps).size).toBe(fields.agentOps.length);
        expect(new Set(fields.analytics).size).toBe(fields.analytics.length);
      }
    }
  });
});
