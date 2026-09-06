import { describe, expect, test } from "vitest";
import {
  hasDiscoveryEntityCoverage,
  resolvePeopleQueryStage,
} from "./discoveryQueryPlanningCore";
import { buildLegacyWorkspaceTargetingSpec } from "./targetingSpecCore";
const spec = buildLegacyWorkspaceTargetingSpec({
  description: "Find software trainers",
  profiles: [],
});
const base = {
  ...spec,
  searchHints: { ...spec.searchHints, roleTitles: ["Software Trainer"] },
  criteria: [
    {
      id: "use",
      label: "Recording use",
      description: "Creates tutorials",
      kind: "required" as const,
      category: "intent" as const,
      evidence: "either" as const,
      weight: 5,
      terms: [],
    },
  ],
};
describe("query planning coverage and stage guards", () => {
  test("a generic role cannot be strict proof of a required practical workflow", () => {
    expect(resolvePeopleQueryStage(" software trainer ", "strict", base)).toBe(
      "broad"
    );
    expect(resolvePeopleQueryStage("software trainer", "balanced", base)).toBe(
      "broad"
    );
  });
  test("preserves strict role-based recruiting when role fit is the actual requirement", () => {
    expect(
      resolvePeopleQueryStage("software trainer", "strict", {
        ...base,
        criteria: base.criteria.map((c) => ({
          ...c,
          category: "profile_fit",
          evidence: "profile",
        })),
      })
    ).toBe("strict");
    expect(
      resolvePeopleQueryStage("recorded software tutorials", "strict", base)
    ).toBe("strict");
  });
  test("recognizes named entities across quotes/case, without substring false matches", () => {
    expect(
      hasDiscoveryEntityCoverage(['"Screen Studio"'], ["screen studio"])
    ).toBe(true);
    expect(hasDiscoveryEntityCoverage(["training videos"], ["AI"])).toBe(false);
    expect(
      hasDiscoveryEntityCoverage(["using Screen Studio"], ["Screen Studio"])
    ).toBe(false);
    expect(hasDiscoveryEntityCoverage(["C++"], ["C++"])).toBe(true);
    expect(
      hasDiscoveryEntityCoverage(["software tutorials"], ["Screen Studio"])
    ).toBe(false);
    expect(hasDiscoveryEntityCoverage(["software tutorials"], [])).toBe(true);
  });
});
