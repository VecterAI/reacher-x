import { describe, expect, test } from "vitest";
import type { JevAnswer } from "./jevClient";
import type { QualificationCandidate } from "./qualificationEvidenceCore";
import type { QualificationCriterionResult } from "./qualificationScoringCore";
import type { WorkspaceTargetingSpec } from "./targetingSpecCore";
import {
  aggregateJevComparisons,
  buildJevQualificationQuestions,
  buildJevQualificationState,
  compareJevReplayWithStored,
  formatJevEvalReport,
  JEV_DEFAULT_TEXT_CAP_CHARS,
  JEV_MAX_STATE_CHARS,
  mapJevAnswersToQualification,
  replayJevQualification,
  summarizeJevStability,
  type JevReplayComparison,
  type StoredQualificationSnapshot,
} from "./jevEvalCore";

const NOW = Date.parse("2026-09-26T00:00:00.000Z");
const CURRENT_DATE = "2026-09-26";

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
    entities: ["Origami.chat"],
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

function candidate(
  index: number,
  overrides: Partial<QualificationCandidate> = {}
): QualificationCandidate {
  return {
    candidateId: `social:twitter:${100 + index}`,
    evidenceKind: "social_content",
    platform: "twitter",
    contentType: "post",
    sourceId: String(100 + index),
    sourceUrl: `https://x.com/example/status/${100 + index}`,
    authorId: "author-1",
    text: `I use Origami.chat daily and I am frustrated with exports. Post ${index}.`,
    publishedAt: new Date(NOW - 3 * 24 * 60 * 60 * 1000).toISOString(),
    discoveryQueries: ["I use"],
    sourcePost: {
      id_str: String(100 + index),
      full_text: "I use Origami.chat daily.",
      favorite_count: 5,
      retweet_count: 1,
    },
    ...overrides,
  };
}

const twoCandidates = [candidate(0), candidate(1)];

function choiceAnswer(
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

function noulAnswer(noul: number): JevAnswer {
  return { type: "noul", noul };
}

function supportAnswers(
  probabilities: number[],
  overrides: Record<string, JevAnswer> = {}
): Record<string, JevAnswer> {
  const answers: Record<string, JevAnswer> = {};
  probabilities.forEach((probability, index) => {
    answers[`support_${index}`] = noulAnswer(probability);
  });
  return { ...answers, ...overrides };
}

function rawFor(
  answers: Record<string, JevAnswer>,
  candidates: QualificationCandidate[] = twoCandidates
) {
  return mapJevAnswersToQualification({
    targetingSpec: spec,
    candidates,
    answers,
  });
}

describe("buildJevQualificationState", () => {
  test("projects profile keys and truncates candidate text to the cap", () => {
    const longText = "x".repeat(5000);
    const bundle = buildJevQualificationState({
      icpDescription: "Find people who already use our product.",
      targetingSpec: spec,
      profileData: {
        name: "Example User",
        screen_name: "example",
        description: "Indie founder",
        secretInternalField: "should-not-leak",
        nested: { deep: true },
      },
      candidates: [candidate(0, { text: longText })],
      currentUtcDate: CURRENT_DATE,
    });

    const profile = bundle.state.prospect_profile as Record<string, unknown>;
    expect(profile.name).toBe("Example User");
    expect(profile.screen_name).toBe("example");
    expect(profile.secretInternalField).toBeUndefined();
    expect(profile.nested).toBeUndefined();

    const sources = bundle.state.candidate_sources as Array<{
      candidate_id: string;
      text: string;
    }>;
    expect(sources).toHaveLength(1);
    expect(sources[0].candidate_id).toBe("social:twitter:100");
    expect(sources[0].text.length).toBeLessThanOrEqual(
      JEV_DEFAULT_TEXT_CAP_CHARS + 1
    );
    expect(sources[0].text.endsWith("…")).toBe(true);
    expect(bundle.state.current_date_utc).toBe(CURRENT_DATE);
    expect(bundle.state.workspace_objective).toBe(
      "Find people who already use our product."
    );
  });

  test("shrinks candidate text until the serialized state fits the budget", () => {
    const manyCandidates = Array.from({ length: 80 }, (_, index) =>
      candidate(index, { text: "y".repeat(1200) })
    );
    const bundle = buildJevQualificationState({
      icpDescription: "Budget check.",
      targetingSpec: spec,
      profileData: { name: "Example User" },
      candidates: manyCandidates,
      currentUtcDate: CURRENT_DATE,
    });
    expect(bundle.approxChars).toBeLessThanOrEqual(JEV_MAX_STATE_CHARS);
    expect(bundle.textCapChars).toBeLessThan(JEV_DEFAULT_TEXT_CAP_CHARS);
  });
});

describe("buildJevQualificationQuestions", () => {
  test("creates one choice question per criterion plus goal, bot, and support questions", () => {
    const questions = buildJevQualificationQuestions({
      targetingSpec: spec,
      candidates: twoCandidates,
    });

    expect(Object.keys(questions)).toHaveLength(
      spec.criteria.length + 2 + twoCandidates.length
    );
    for (const criterion of spec.criteria) {
      const question = questions[`criterion_${criterion.id}`];
      expect(question.type).toBe("choice");
      if (question.type === "choice") {
        expect(Object.keys(question.criteria).sort()).toEqual([
          "matched",
          "not_matched",
          "partial",
          "unknown",
        ]);
      }
    }
    expect(questions.goal_assessment.type).toBe("choice");
    expect(questions.likely_bot.type).toBe("noul");
    expect(questions.support_0.type).toBe("noul");
    expect(questions.support_1.type).toBe("noul");
  });

  test("adds exclusion semantics to exclusion criteria only", () => {
    const questions = buildJevQualificationQuestions({
      targetingSpec: spec,
      candidates: [],
    });
    const exclusion = questions.criterion_competitor_employee;
    const required = questions.criterion_current_user;
    if (exclusion.type !== "choice" || required.type !== "choice") {
      throw new Error("Expected choice questions");
    }
    expect(exclusion.instructions).toContain("exclusion criterion");
    expect(required.instructions).not.toContain("exclusion criterion");
    expect(required.instructions).toContain("activity criterion");
  });
});

describe("mapJevAnswersToQualification", () => {
  test("maps choice and noul answers into qualification decisions", () => {
    const raw = rawFor({
      criterion_current_user: choiceAnswer("matched", { confidence: 0.92 }),
      criterion_frustrated: choiceAnswer("partial", { confidence: 0.8 }),
      criterion_decision_maker: choiceAnswer("not_matched", {
        confidence: 0.7,
      }),
      criterion_competitor_employee: choiceAnswer("not_matched", {
        confidence: 0.99,
      }),
      goal_assessment: choiceAnswer("compatible", { confidence: 0.9 }),
      likely_bot: noulAnswer(0.05),
      ...supportAnswers([0.9, 0.2]),
    });

    expect(raw.criterionResults).toHaveLength(4);
    const currentUser = raw.criterionResults.find(
      (result) => result.criterionId === "current_user"
    );
    expect(currentUser?.verdict).toBe("matched");
    expect(currentUser?.confidence).toBeCloseTo(0.92);
    expect(currentUser?.sourceIds).toEqual(["100"]);

    const decisionMaker = raw.criterionResults.find(
      (result) => result.criterionId === "decision_maker"
    );
    expect(decisionMaker?.sourceIds).toEqual([]);

    expect(raw.evidenceDecisions[0].supportsQualification).toBe(true);
    expect(raw.evidenceDecisions[1].supportsQualification).toBe(false);
    expect(raw.isLikelyBot).toBe(false);
    expect(raw.goalAssessment.verdict).toBe("compatible");
  });

  test("falls back to unknown with zero confidence on missing or invalid answers", () => {
    const raw = rawFor({
      criterion_frustrated: choiceAnswer("banana"),
      ...supportAnswers([0.9, 0.9], {
        goal_assessment: choiceAnswer("contradicted"),
      }),
    });

    const currentUser = raw.criterionResults.find(
      (result) => result.criterionId === "current_user"
    );
    const frustrated = raw.criterionResults.find(
      (result) => result.criterionId === "frustrated"
    );
    expect(currentUser?.verdict).toBe("unknown");
    expect(currentUser?.confidence).toBe(0);
    expect(frustrated?.verdict).toBe("unknown");
    expect(frustrated?.confidence).toBe(0);
    expect(raw.goalAssessment.verdict).toBe("contradicted");
  });
});

describe("replayJevQualification", () => {
  function fullAnswers(
    overrides: Record<string, JevAnswer> = {}
  ): Record<string, JevAnswer> {
    return {
      criterion_current_user: choiceAnswer("matched", { confidence: 0.95 }),
      criterion_frustrated: choiceAnswer("matched", { confidence: 0.9 }),
      criterion_decision_maker: choiceAnswer("matched", { confidence: 0.85 }),
      criterion_competitor_employee: choiceAnswer("not_matched", {
        confidence: 0.99,
      }),
      goal_assessment: choiceAnswer("compatible", { confidence: 0.95 }),
      likely_bot: noulAnswer(0.02),
      ...supportAnswers([0.95, 0.9]),
      ...overrides,
    };
  }

  test("reproduces a qualified outcome when verdicts and support align", () => {
    const replay = replayJevQualification({
      targetingSpec: spec,
      candidates: twoCandidates,
      answers: fullAnswers(),
      now: NOW,
      threshold: 70,
    });

    expect(replay.supportedSourceCount).toBe(2);
    expect(replay.hardFailureCriterionIds).toEqual([]);
    expect(replay.total).toBeGreaterThanOrEqual(70);
    expect(replay.qualified).toBe(true);
  });

  test("a matched exclusion with confidence fails the qualification gate", () => {
    const replay = replayJevQualification({
      targetingSpec: spec,
      candidates: twoCandidates,
      answers: fullAnswers({
        criterion_competitor_employee: choiceAnswer("matched", {
          confidence: 0.9,
        }),
      }),
      now: NOW,
      threshold: 70,
    });

    expect(replay.hardFailureCriterionIds).toContain("competitor_employee");
    expect(replay.qualified).toBe(false);
  });

  test("bot detection blocks qualification", () => {
    const replay = replayJevQualification({
      targetingSpec: spec,
      candidates: twoCandidates,
      answers: fullAnswers({ likely_bot: noulAnswer(0.8) }),
      now: NOW,
      threshold: 70,
    });

    expect(replay.raw.isLikelyBot).toBe(true);
    expect(replay.hardFailureCriterionIds).toContain("authenticity");
    expect(replay.qualified).toBe(false);
  });

  test("activity matches without supported sources reconcile to unknown", () => {
    const replay = replayJevQualification({
      targetingSpec: spec,
      candidates: twoCandidates,
      answers: fullAnswers({ ...supportAnswers([0.05, 0.05]) }),
      now: NOW,
      threshold: 70,
    });

    expect(replay.supportedSourceCount).toBe(0);
    const currentUser = replay.criterionResults.find(
      (result) => result.criterionId === "current_user"
    );
    expect(currentUser?.verdict).toBe("unknown");
    expect(replay.hardFailureCriterionIds).toContain("verified_evidence");
    expect(replay.qualified).toBe(false);
  });
});

describe("compareJevReplayWithStored", () => {
  const usage = { cost: 0.0012, inputTokens: 1500, outputTokens: 40 };

  function stored(
    overrides: Partial<StoredQualificationSnapshot> = {}
  ): StoredQualificationSnapshot {
    return {
      status: "qualified",
      score: 88,
      breakdown: {
        profileFit: 30,
        signalQuality: 25,
        intentStrength: 20,
        recency: 13,
        total: 88,
      },
      criterionResults: [
        {
          criterionId: "current_user",
          verdict: "matched",
          confidence: 0.9,
          rationale: "Uses the product.",
          sourceIds: ["100"],
        },
        {
          criterionId: "frustrated",
          verdict: "not_matched",
          confidence: 0.7,
          rationale: "No frustration signal.",
          sourceIds: [],
        },
      ],
      isLikelyBot: false,
      sourceIds: ["100"],
      ...overrides,
    };
  }

  function replay(
    overrides: Partial<Parameters<typeof replayJevQualification>[0]> = {}
  ) {
    return replayJevQualification({
      targetingSpec: spec,
      candidates: twoCandidates,
      answers: {
        criterion_current_user: choiceAnswer("matched", { confidence: 0.9 }),
        criterion_frustrated: choiceAnswer("partial", { confidence: 0.8 }),
        criterion_decision_maker: choiceAnswer("matched", { confidence: 0.8 }),
        criterion_competitor_employee: choiceAnswer("not_matched", {
          confidence: 0.95,
        }),
        goal_assessment: choiceAnswer("compatible", { confidence: 0.9 }),
        likely_bot: noulAnswer(0.03),
        ...supportAnswers([0.9, 0.9]),
      },
      now: NOW,
      threshold: 70,
      ...overrides,
    });
  }

  test("counts criterion agreement, support differences, and score deltas", () => {
    const comparison = compareJevReplayWithStored({
      prospectId: "p1",
      stored: stored(),
      replay: replay(),
      candidates: twoCandidates,
      answers: {
        criterion_current_user: choiceAnswer("matched", { confidence: 0.9 }),
        criterion_frustrated: choiceAnswer("partial", { confidence: 0.8 }),
        criterion_decision_maker: choiceAnswer("matched", { confidence: 0.8 }),
        criterion_competitor_employee: choiceAnswer("not_matched", {
          confidence: 0.95,
        }),
        goal_assessment: choiceAnswer("compatible", { confidence: 0.9 }),
        likely_bot: noulAnswer(0.03),
        support_0: noulAnswer(0.9),
        support_1: noulAnswer(0.9),
      },
      sentQuestionIds: [
        "criterion_current_user",
        "criterion_frustrated",
        "criterion_decision_maker",
        "criterion_competitor_employee",
        "goal_assessment",
        "likely_bot",
        "support_0",
        "support_1",
      ],
      usage,
      latencyMs: 180,
      stateChars: 12000,
      questionCount: 8,
    });

    expect(comparison.criterionTotal).toBe(2);
    expect(comparison.criterionAgree).toBe(1);
    const frustrated = comparison.criterionComparisons.find(
      (entry) => entry.criterionId === "frustrated"
    );
    expect(frustrated?.stored).toBe("not_matched");
    expect(frustrated?.jev).toBe("partial");
    expect(frustrated?.agree).toBe(false);

    expect(comparison.supportTotal).toBe(2);
    expect(comparison.supportAgree).toBe(1);
    expect(comparison.botAgree).toBe(true);
    expect(comparison.statusStored).toBe("qualified");
    expect(comparison.statusAgree).toBe(true);
    expect(comparison.scoreStored).toBe(88);
    expect(comparison.scoreDelta).toBe(Math.abs(88 - comparison.scoreJev));
    expect(comparison.goalVerdict).toBe("compatible");
  });

  test("reports null agreement when stored bot or status data is missing", () => {
    const comparison = compareJevReplayWithStored({
      prospectId: "p2",
      stored: stored({
        isLikelyBot: null,
        status: "pending",
        score: undefined,
      }),
      replay: replay(),
      candidates: twoCandidates,
      answers: {},
      sentQuestionIds: ["goal_assessment"],
      usage,
      latencyMs: 150,
      stateChars: 9000,
      questionCount: 8,
    });

    expect(comparison.botAgree).toBeNull();
    expect(comparison.statusStored).toBeNull();
    expect(comparison.statusAgree).toBeNull();
    expect(comparison.scoreDelta).toBeNull();
    expect(comparison.missingAnswerCount).toBe(1);
  });
});

describe("aggregateJevComparisons and report", () => {
  const usage = { cost: 0.0008, inputTokens: 900, outputTokens: 30 };

  function comparisonFixture(
    prospectId: string,
    overrides: Partial<JevReplayComparison> = {}
  ): JevReplayComparison {
    return {
      prospectId,
      criterionComparisons: [
        {
          criterionId: "current_user",
          stored: "matched",
          jev: "matched",
          jevConfidence: 0.9,
          agree: true,
        },
        {
          criterionId: "frustrated",
          stored: "not_matched",
          jev: "partial",
          jevConfidence: 0.6,
          agree: false,
        },
      ],
      criterionAgree: 1,
      criterionTotal: 2,
      botStored: false,
      botJev: false,
      botAgree: true,
      supportStoredSourceIds: ["100"],
      supportJevSourceIds: ["100"],
      supportRows: [
        { sourceId: "100", jevProbability: 0.9, storedVerified: true },
      ],
      supportAgree: 1,
      supportTotal: 1,
      statusStored: "qualified",
      statusJev: "qualified",
      statusAgree: true,
      scoreStored: 88,
      scoreJev: 86,
      scoreDelta: 2,
      breakdownStored: null,
      breakdownJev: {
        profileFit: 30,
        signalQuality: 24,
        intentStrength: 20,
        recency: 12,
        total: 86,
      },
      meanJevConfidence: 0.75,
      goalVerdict: "compatible",
      stateChars: 11000,
      questionCount: 8,
      missingAnswerCount: 0,
      lowConfidenceAnswerCount: 0,
      usage,
      latencyMs: 200,
      cost: usage.cost,
      ...overrides,
    };
  }

  test("aggregates counts across comparisons", () => {
    const summary = aggregateJevComparisons([
      comparisonFixture("p1"),
      comparisonFixture("p2"),
    ]);
    expect(summary.prospectCount).toBe(2);
    expect(summary.criterionAgree).toBe(2);
    expect(summary.criterionTotal).toBe(4);
    expect(summary.statusAgree).toBe(2);
    expect(summary.totalCost).toBeCloseTo(0.0016);
    expect(summary.disagreementSamples).toHaveLength(2);
    expect(summary.disagreementSamples[0].criterionId).toBe("frustrated");
  });

  test("formats a readable report", () => {
    const summary = aggregateJevComparisons([comparisonFixture("p1")]);
    const report = formatJevEvalReport({
      workspaceName: "Demo Workspace",
      workspaceId: "ws-1",
      jevModel: "typesafe/jev-1.13",
      summary,
      stability: { agree: 4, total: 4 },
    });
    expect(report).toContain("[JevEval] Replay report");
    expect(report).toContain("Demo Workspace");
    expect(report).toContain("Criterion verdict agreement: 50.0% (1/2)");
    expect(report).toContain(
      "Final qualification outcome agreement: 100.0% (1/1)"
    );
    expect(report).toContain("Self-stability");
    expect(report).toContain("frustrated: stored=not_matched jev=partial");
  });
});

describe("summarizeJevStability", () => {
  function results(
    entries: Array<[string, QualificationCriterionResult["verdict"]]>
  ): QualificationCriterionResult[] {
    return entries.map(([criterionId, verdict]) => ({
      criterionId,
      verdict,
      confidence: 0.9,
      rationale: "",
      sourceIds: [],
    }));
  }

  test("counts identical verdicts as stable", () => {
    const stability = summarizeJevStability({
      first: results([
        ["a", "matched"],
        ["b", "partial"],
      ]),
      second: results([
        ["a", "matched"],
        ["b", "partial"],
      ]),
    });
    expect(stability).toEqual({ agree: 2, total: 2 });
  });

  test("counts drifted verdicts as unstable", () => {
    const stability = summarizeJevStability({
      first: results([
        ["a", "matched"],
        ["b", "unknown"],
      ]),
      second: results([
        ["a", "matched"],
        ["b", "matched"],
      ]),
    });
    expect(stability).toEqual({ agree: 1, total: 2 });
  });
});
