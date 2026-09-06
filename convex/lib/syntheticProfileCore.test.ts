import { describe, expect, test } from "vitest";
import { syntheticExamples } from "../../test/syntheticProfiles";
import {
  formatSyntheticTargetingExamples,
  hasSyntheticProfileExamples,
  validateSyntheticProfileExamples,
} from "./syntheticProfileCore";

describe("synthetic targeting examples", () => {
  test("requires exactly one example from each platform per persona", () => {
    expect(hasSyntheticProfileExamples({ syntheticExamples })).toBe(true);
    for (const examples of [
      [],
      syntheticExamples.slice(0, 1),
      [syntheticExamples[0]!, syntheticExamples[0]!],
      [...syntheticExamples, syntheticExamples[0]!],
    ]) {
      expect(hasSyntheticProfileExamples({ syntheticExamples: examples })).toBe(
        false
      );
    }
    expect(() => validateSyntheticProfileExamples([])).toThrow();
  });
  test("rejects blank or implausibly long card fields", () => {
    for (const change of [
      { displayName: " " },
      { title: "" },
      { bio: "x".repeat(161) },
    ]) {
      expect(
        hasSyntheticProfileExamples({
          syntheticExamples: [
            { ...syntheticExamples[0]!, ...change },
            syntheticExamples[1]!,
          ],
        })
      ).toBe(false);
    }
  });
  test("downstream context omits invented identities and labels examples as non-evidence", () => {
    const context = formatSyntheticTargetingExamples([{ syntheticExamples }]);
    expect(context).toContain("not evidence or extra requirements");
    expect(context).toContain("twitter:");
    expect(context).toContain("linkedin:");
    for (const example of syntheticExamples)
      expect(context).not.toContain(example.displayName);
    expect(formatSyntheticTargetingExamples([])).toBe("");
  });
});
