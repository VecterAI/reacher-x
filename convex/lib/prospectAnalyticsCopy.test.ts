import { describe, expect, it } from "vitest";
import { classifyQualificationActivityTitle } from "./prospectAnalyticsCore";

describe("match activity reporting compatibility", () => {
  it.each([
    ["Qualified with 88% fit", "qualified"],
    ["Did not qualify (42% fit)", "disqualified"],
    ["Good match · 88% match", "qualified"],
    ["Not a match · 42% match", "disqualified"],
    ["Profile details found", null],
    ["Unrelated activity", null],
  ] as const)(
    "classifies %s without rewriting saved activity",
    (title, expected) => {
      expect(classifyQualificationActivityTitle(title)).toBe(expected);
    }
  );
});
