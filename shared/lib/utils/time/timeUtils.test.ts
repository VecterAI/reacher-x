import { describe, expect, it } from "vitest";
import { getDelayUntilNextUtcHour } from "./timeUtils";

describe("getDelayUntilNextUtcHour", () => {
  it("refreshes just after the next aggregate hour boundary", () => {
    const timestamp = Date.UTC(2026, 7, 31, 10, 59, 30);

    expect(getDelayUntilNextUtcHour(timestamp, 1_000)).toBe(31_000);
  });

  it("waits a full hour when already on the boundary", () => {
    const timestamp = Date.UTC(2026, 7, 31, 11, 0, 0);

    expect(getDelayUntilNextUtcHour(timestamp, 1_000)).toBe(3_601_000);
  });
});
