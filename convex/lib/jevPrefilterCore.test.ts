import { describe, expect, test } from "vitest";
import type { JevAnswer } from "./jevClient";
import type { WorkspaceTargetingSpec } from "./targetingSpecCore";
import {
  evaluateJevHardFailSignals,
  JEV_PREFILTER_HARD_FAIL_CONFIDENCE,
} from "./jevPrefilterCore";

const spec: WorkspaceTargetingSpec = {
  version: 1,
  summary: "Find founders using competitors.",
  criteria: [
    {
      id: "target_role",
      label: "Target role",
      description: "Founder or owner.",
      kind: "required",
      category: "profile_fit",
      evidence: "profile",
      weight: 5,
      terms: ["founder"],
    },
    {
      id: "competitor_fit",
      label: "Competitor fit",
      description: "Uses a competing product.",
      kind: "required",
      category: "intent",
      evidence: "activity",
      weight: 5,
      terms: ["switching"],
    },
    {
      id: "competitor_employee",
      label: "Competitor employee",
      description: "Exclude competitor employees.",
      kind: "exclusion",
      category: "profile_fit",
      evidence: "either",
      weight: 5,
      terms: ["employee"],
    },
  ],
  searchHints: {
    entities: [],
    activityPhrases: [],
    roleTitles: [],
    locations: [],
    industries: [],
    companyNames: [],
    languageCodes: [],
    exclusionTerms: [],
  },
};

function choice(
  choice: string,
  options: { confidence?: number; probabilities?: Record<string, number> } = {}
): JevAnswer {
  return {
    type: "choice",
    choice,
    confidence: options.confidence,
    probabilities: options.probabilities,
  };
}

function noul(noul: number): JevAnswer {
  return { type: "noul", noul };
}

describe("evaluateJevHardFailSignals", () => {
  test("passes when no hard-fail signals are present", () => {
    const decision = evaluateJevHardFailSignals({
      targetingSpec: spec,
      answers: {
        criterion_target_role: choice("matched", { confidence: 0.9 }),
        criterion_competitor_fit: choice("partial", { confidence: 0.6 }),
        criterion_competitor_employee: choice("not_matched", {
          confidence: 0.98,
        }),
        likely_bot: noul(0.05),
      },
    });
    expect(decision.decision).toBe("would_pass");
    expect(decision.reasons).toEqual([]);
    expect(decision.botProbability).toBeCloseTo(0.05);
  });

  test("kills on a high-confidence exclusion match", () => {
    const decision = evaluateJevHardFailSignals({
      targetingSpec: spec,
      answers: {
        criterion_competitor_employee: choice("matched", {
          confidence: JEV_PREFILTER_HARD_FAIL_CONFIDENCE,
        }),
        likely_bot: noul(0.02),
      },
    });
    expect(decision.decision).toBe("would_kill");
    expect(decision.reasons[0].kind).toBe("exclusion_match");
    expect(decision.reasons[0].criterionId).toBe("competitor_employee");
    expect(decision.reasonCodes).toEqual([
      "exclusion:competitor_employee@0.90",
    ]);
  });

  test("kills on a high-confidence required miss", () => {
    const decision = evaluateJevHardFailSignals({
      targetingSpec: spec,
      answers: {
        criterion_target_role: choice("not_matched", { confidence: 0.94 }),
        likely_bot: noul(0.02),
      },
    });
    expect(decision.decision).toBe("would_kill");
    expect(decision.reasons[0].kind).toBe("required_miss");
    expect(decision.reasonCodes).toEqual(["required:target_role@0.94"]);
  });

  test("kills on a near-certain bot probability", () => {
    const decision = evaluateJevHardFailSignals({
      targetingSpec: spec,
      answers: { likely_bot: noul(0.96) },
    });
    expect(decision.decision).toBe("would_kill");
    expect(decision.reasons[0].kind).toBe("likely_bot");
    expect(decision.reasonCodes).toEqual(["bot@0.96"]);
  });

  test("borderline confidence does not kill", () => {
    const decision = evaluateJevHardFailSignals({
      targetingSpec: spec,
      answers: {
        criterion_competitor_employee: choice("matched", { confidence: 0.89 }),
        criterion_target_role: choice("not_matched", { confidence: 0.88 }),
        likely_bot: noul(0.89),
      },
    });
    expect(decision.decision).toBe("would_pass");
    expect(decision.reasons).toEqual([]);
  });

  test("missing or malformed answers degrade to pass", () => {
    const decision = evaluateJevHardFailSignals({
      targetingSpec: spec,
      answers: {
        criterion_target_role: choice("banana"),
        likely_bot: { type: "choice", choice: "matched" },
      },
    });
    expect(decision.decision).toBe("would_pass");
    expect(decision.reasons).toEqual([]);
    expect(decision.botProbability).toBe(0);
  });
});
