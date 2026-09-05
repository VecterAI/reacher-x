import { afterEach, describe, expect, test, vi } from "vitest";
import { qualifyProspectCore } from "./qualificationCore";
import { robustGenerateObject } from "./ai";
import type { WorkspaceTargetingSpec } from "./targetingSpecCore";

vi.mock("./ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./ai")>()),
  robustGenerateObject: vi.fn(),
}));
const spec: WorkspaceTargetingSpec = {
  version: 1,
  summary: "Find current users to offer services",
  criteria: [
    {
      id: "usage",
      label: "Current use",
      description: "Currently uses the product",
      kind: "required",
      category: "intent",
      evidence: "activity",
      weight: 5,
      terms: [],
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
const text = "I use the product daily. No service offers, please.";
const candidateId = "social:twitter:123";
const params = {
  platform: "twitter" as const,
  evidencePosts: [
    {
      id_str: "123",
      url: "https://x.com/author/status/123",
      full_text: text,
      user: { id_str: "42" },
      created_at: "2026-09-04T12:00:00Z",
    },
  ],
  profileData: { id_str: "42" },
  targetingSpec: spec,
  discoveryQueries: [],
  totalKeywords: 1,
  icpDescription: spec.summary,
};
function response(
  verdict: "matched" | "partial" | "not_matched" = "matched",
  conflict = false,
  evidenceCandidateId = candidateId
) {
  return {
    object: {
      goalAssessment: {
        objective: spec.summary,
        rationale:
          "Compare the user's service offer with this author's stated preference",
        verdict: conflict ? "contradicted" : "unknown",
        candidateId: conflict ? candidateId : "",
        conflictingQuote: conflict ? "No service offers, please." : "",
      },
      criterionResults: [
        {
          criterionId: "usage",
          verdict,
          confidence: 1,
          rationale: "Direct use evidence",
          candidateIds: [candidateId],
        },
      ],
      evidenceDecisions: [
        {
          candidateId: evidenceCandidateId,
          supportsQualification: verdict !== "not_matched",
          supportingQuote:
            verdict !== "not_matched" ? "I use the product daily." : "",
        },
      ],
      reasoning: "Evidence assessment",
      isLikelyBot: false,
      botFlags: [],
    },
  } as Awaited<ReturnType<typeof robustGenerateObject>>;
}
afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});
describe("evidence-backed qualification verification", () => {
  test("a provisional positive is reviewed against the same evidence by the strong route", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T12:00:00Z"));
    vi.mocked(robustGenerateObject)
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response("matched", true));
    const result = await qualifyProspectCore(params);
    expect(result.qualified).toBe(false);
    expect(result.reasoning).toContain("Evidence contradicts");
    expect(robustGenerateObject).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(robustGenerateObject).mock.calls.map(([args]) => args.routing)
    ).toEqual(["reasoning", "onboarding"]);
    expect(
      vi
        .mocked(robustGenerateObject)
        .mock.calls.map(([args]) => args.nativeStructuredOutput)
    ).toEqual([true, false]);
    expect(
      vi.mocked(robustGenerateObject).mock.calls[1][0].fallbackRouting
    ).toBeUndefined();
    expect(vi.mocked(robustGenerateObject).mock.calls[1][0].prompt).toContain(
      text
    );
  });
  test("clear negative cases do not incur a second model pass", async () => {
    vi.mocked(robustGenerateObject).mockResolvedValueOnce(
      response("not_matched")
    );
    expect((await qualifyProspectCore(params)).qualified).toBe(false);
    expect(robustGenerateObject).toHaveBeenCalledTimes(1);
  });
  test("a first-pass provider failure rebuilds compatible strong-route parameters", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T12:00:00Z"));
    vi.mocked(robustGenerateObject)
      .mockRejectedValueOnce(new Error("First-pass provider unavailable"))
      .mockResolvedValueOnce(response());
    expect((await qualifyProspectCore(params)).qualified).toBe(true);
    const calls = vi.mocked(robustGenerateObject).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0].fallbackRouting).toBeUndefined();
    expect(calls[1][0].routing).toBe("onboarding");
    expect(calls[1][0].nativeStructuredOutput).toBe(false);
    expect(calls[1][0].fallbackRouting).toBeUndefined();
  });
  test("an evidence-backed first-pass false negative gets the same strong review", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T12:00:00Z"));
    vi.mocked(robustGenerateObject)
      .mockResolvedValueOnce(response("partial"))
      .mockResolvedValueOnce(response());
    expect((await qualifyProspectCore(params)).qualified).toBe(true);
    expect(robustGenerateObject).toHaveBeenCalledTimes(2);
  });
  test("preview already uses the strong route and is not evaluated twice", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T12:00:00Z"));
    vi.mocked(robustGenerateObject).mockResolvedValueOnce(response());
    expect(
      (await qualifyProspectCore({ ...params, routing: "onboarding" }))
        .qualified
    ).toBe(true);
    expect(robustGenerateObject).toHaveBeenCalledTimes(1);
  });
  test("a claimed essential activity match with broken source references is independently verified", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T12:00:00Z"));
    const provisional = response("matched", false, "invalid-source");
    vi.mocked(robustGenerateObject)
      .mockResolvedValueOnce(provisional)
      .mockResolvedValueOnce(response());
    expect((await qualifyProspectCore(params)).qualified).toBe(true);
    expect(robustGenerateObject).toHaveBeenCalledTimes(2);
  });
  test("verification cannot publish a claimed match whose sources remain invalid", async () => {
    const provisional = response("matched", false, "invalid-source");
    vi.mocked(robustGenerateObject).mockResolvedValue(provisional);
    const result = await qualifyProspectCore(params);
    expect(result.qualified).toBe(false);
    expect(result.qualificationSources).toEqual([]);
    expect(robustGenerateObject).toHaveBeenCalledTimes(2);
  });
  test("a verifier outage remains an evaluation failure, never a published first-pass positive", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T12:00:00Z"));
    vi.mocked(robustGenerateObject)
      .mockResolvedValueOnce(response())
      .mockRejectedValueOnce(new Error("Verifier unavailable"));
    await expect(qualifyProspectCore(params)).rejects.toThrow(
      "Verifier unavailable"
    );
    expect(robustGenerateObject).toHaveBeenCalledTimes(2);
  });
});
