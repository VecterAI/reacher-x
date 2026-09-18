import { describe, expect, it } from "vitest";
import {
  formatAverageFitScoreDetail,
  formatEnrichedProfilesDetail,
} from "./workspaceProgressDetails";

describe("workspace progress details", () => {
  describe("formatAverageFitScoreDetail", () => {
    it("identifies the average as a fit score out of 100", () => {
      expect(formatAverageFitScoreDetail(77)).toBe("Avg. match: 77/100");
    });

    it("hides the detail when no average is available", () => {
      expect(formatAverageFitScoreDetail(0)).toBeNull();
    });
  });

  describe("formatEnrichedProfilesDetail", () => {
    it.each([
      [0, "0 profiles ready"],
      [1, "1 profile ready"],
      [12, "12 profiles ready"],
    ])("formats %i enriched profiles as %s", (enrichedCount, expected) => {
      expect(formatEnrichedProfilesDetail(enrichedCount)).toBe(expected);
    });
  });
});
