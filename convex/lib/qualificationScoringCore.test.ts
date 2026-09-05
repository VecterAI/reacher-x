import { describe, expect, test } from "vitest";
import {
  calculateTargetingQualificationScore,
  reconcileQualificationCriterionResults,
  type QualificationCriterionResult,
} from "./qualificationScoringCore";
import type { WorkspaceTargetingSpec } from "./targetingSpecCore";

const spec: WorkspaceTargetingSpec = {
  version: 1,
  summary: "Find competitor users and prefer frustrated users.",
  criteria: [
    {
      id: "current_user",
      label: "Current user",
      description: "Direct first-person current usage evidence.",
      kind: "required",
      category: "intent",
      evidence: "activity",
      weight: 5,
      terms: ["I use"],
    },
    {
      id: "frustrated",
      label: "Frustrated user",
      description: "Dissatisfaction is helpful but not mandatory.",
      kind: "preferred",
      category: "intent",
      evidence: "activity",
      weight: 4,
      terms: ["frustrated"],
    },
    {
      id: "decision_maker",
      label: "Decision maker",
      description: "Can influence a purchasing decision.",
      kind: "preferred",
      category: "profile_fit",
      evidence: "profile",
      weight: 2,
      terms: ["founder"],
    },
    {
      id: "competitor_employee",
      label: "Competitor employee",
      description: "Exclude employees and official promotional accounts.",
      kind: "exclusion",
      category: "profile_fit",
      evidence: "either",
      weight: 5,
      terms: ["employee"],
    },
  ],
  searchHints: {
    entities: ["Origami.chat", "Gojiberry AI"],
    activityPhrases: ["I use", "frustrated"],
    roleTitles: [],
    locations: [],
    industries: [],
    companyNames: [],
    languageCodes: [],
    exclusionTerms: ["employee"],
  },
  searchFilters: {
    twitter: {},
    linkedinPeople: {},
    linkedinPosts: {},
  },
};

function result(
  criterionId: string,
  verdict: QualificationCriterionResult["verdict"],
  options: { confidence?: number; sourceIds?: string[] } = {}
): QualificationCriterionResult {
  return {
    criterionId,
    verdict,
    confidence: options.confidence ?? 0.9,
    rationale: `${criterionId}: ${verdict}`,
    sourceIds: options.sourceIds ?? [],
  };
}

function score(
  results: QualificationCriterionResult[],
  options: { sourceCount?: number; ageDays?: number; bot?: boolean } = {}
) {
  return calculateTargetingQualificationScore({
    spec,
    results,
    supportedSourceCount: options.sourceCount ?? 1,
    newestEvidenceAgeDays: options.ageDays ?? 3,
    isLikelyBot: options.bot ?? false,
    threshold: 70,
  });
}

describe("targeting qualification scoring", () => {
  test("a claimed activity match without verified source IDs cannot pass a required gate", () => {
    const evaluated = score([
      result("current_user", "matched"),
      result("frustrated", "matched", { sourceIds: ["unrelated-source"] }),
      result("decision_maker", "matched"),
      result("competitor_employee", "not_matched"),
    ]);
    expect(evaluated.qualified).toBe(false);
    expect(evaluated.hardFailureCriterionIds).toContain("current_user");
  });
  test("preferred profile location changes rank without rejecting a useful adjacent match", () => {
    const locationSpec: WorkspaceTargetingSpec = {
      ...spec,
      criteria: [
        ...spec.criteria,
        {
          id: "location",
          label: "Preferred location",
          description: "Preferred market",
          kind: "preferred",
          category: "profile_fit",
          evidence: "profile",
          weight: 4,
          terms: [],
        },
      ],
    };
    const evaluate = (verdict: QualificationCriterionResult["verdict"]) =>
      calculateTargetingQualificationScore({
        spec: locationSpec,
        results: [
          result("current_user", "matched", { sourceIds: ["post-1"] }),
          result("frustrated", "matched", { sourceIds: ["post-1"] }),
          result("decision_maker", "matched"),
          result("competitor_employee", "not_matched"),
          result("location", verdict),
        ],
        supportedSourceCount: 1,
        newestEvidenceAgeDays: 3,
        isLikelyBot: false,
        threshold: 70,
      });
    const exact = evaluate("matched");
    for (const verdict of ["partial", "unknown", "not_matched"] as const) {
      const adjacent = evaluate(verdict);
      expect(adjacent.qualified).toBe(true);
      expect(adjacent.breakdown.profileFit).toBeLessThan(
        exact.breakdown.profileFit
      );
      expect(adjacent.breakdown.total).toBeLessThan(exact.breakdown.total);
    }
  });
  test("qualifies a verified current user even when frustration is unknown", () => {
    const evaluated = score([
      result("current_user", "matched", { sourceIds: ["post-1"] }),
      result("frustrated", "unknown"),
      result("decision_maker", "unknown"),
      result("competitor_employee", "not_matched"),
    ]);

    expect(evaluated.breakdown.total).toBeGreaterThanOrEqual(70);
    expect(evaluated.qualified).toBe(true);
  });

  test("rewards dissatisfaction and additional verified evidence", () => {
    const userOnly = score([
      result("current_user", "matched", { sourceIds: ["post-1"] }),
      result("frustrated", "unknown"),
      result("decision_maker", "unknown"),
      result("competitor_employee", "not_matched"),
    ]);
    const frustrated = score(
      [
        result("current_user", "matched", { sourceIds: ["post-1"] }),
        result("frustrated", "matched", { sourceIds: ["post-2"] }),
        result("decision_maker", "matched"),
        result("competitor_employee", "not_matched"),
      ],
      { sourceCount: 2 }
    );

    expect(frustrated.breakdown.total).toBeGreaterThan(
      userOnly.breakdown.total
    );
    expect(frustrated.qualified).toBe(true);
  });

  test.each(["partial", "not_matched", "unknown"] as const)(
    "treats a %s required criterion as a hard failure",
    (verdict) => {
      const evaluated = score([
        result("current_user", verdict, { sourceIds: ["post-1"] }),
        result("frustrated", "matched", { sourceIds: ["post-1"] }),
        result("decision_maker", "matched"),
        result("competitor_employee", "not_matched"),
      ]);

      expect(evaluated.qualified).toBe(false);
      expect(evaluated.hardFailureCriterionIds).toContain("current_user");
    }
  );

  test("applies a confident exclusion as a hard failure", () => {
    const evaluated = score([
      result("current_user", "matched", { sourceIds: ["post-1"] }),
      result("frustrated", "matched", { sourceIds: ["post-1"] }),
      result("decision_maker", "matched"),
      result("competitor_employee", "matched", { confidence: 0.95 }),
    ]);

    expect(evaluated.qualified).toBe(false);
    expect(evaluated.hardFailureCriterionIds).toContain("competitor_employee");
  });

  test("requires verified prospect-authored evidence and rejects bots", () => {
    const results = [
      result("current_user", "matched", { sourceIds: ["post-1"] }),
      result("frustrated", "matched", { sourceIds: ["post-1"] }),
      result("decision_maker", "matched"),
      result("competitor_employee", "not_matched"),
    ];

    expect(
      score(results, { sourceCount: 0 }).hardFailureCriterionIds
    ).toContain("verified_evidence");
    expect(score(results, { bot: true }).hardFailureCriterionIds).toContain(
      "authenticity"
    );
  });

  test("reconciles missing, duplicate, and over-confident model output", () => {
    const reconciled = reconcileQualificationCriterionResults({
      spec,
      results: [
        result("current_user", "matched", {
          confidence: 2,
          sourceIds: ["post-1", "post-1"],
        }),
      ],
    });

    expect(reconciled).toHaveLength(spec.criteria.length);
    expect(reconciled[0]).toMatchObject({
      confidence: 1,
      sourceIds: ["post-1"],
    });
    expect(reconciled[1]).toMatchObject({
      criterionId: "frustrated",
      verdict: "unknown",
      confidence: 0,
    });
  });
});
