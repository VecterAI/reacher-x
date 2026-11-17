import { describe, expect, test } from "vitest";
import { DEFAULT_POOL_LIMITS, resolvePoolLimits } from "./benchmarkConcurrency";

const starter = {
  workflow: 4,
  qualification: 2,
  enrichment: 1,
  previewQualification: 0,
  previewEnrichment: 0,
  outreachPlan: 0,
  memoryEvaluation: 1,
};

describe("benchmark pool limits", () => {
  test("unset keeps production defaults", () => {
    expect(resolvePoolLimits("")).toEqual({
      limits: DEFAULT_POOL_LIMITS,
      source: "default",
      error: null,
    });
  });

  test("a complete setting applies to every pool", () => {
    expect(resolvePoolLimits(JSON.stringify(starter))).toEqual({
      limits: starter,
      source: "benchmark",
      error: null,
    });
  });

  test("invalid or partial settings never change behaviour and report an error", () => {
    for (const value of [
      "not json",
      JSON.stringify({ workflow: 4 }),
      JSON.stringify({ ...starter, qualification: 0 }),
      JSON.stringify({ ...starter, extra: 1 }),
    ]) {
      const resolved = resolvePoolLimits(value);
      expect(resolved.limits).toEqual(DEFAULT_POOL_LIMITS);
      expect(resolved.error).not.toBeNull();
    }
  });
});
