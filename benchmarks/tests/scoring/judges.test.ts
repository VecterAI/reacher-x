import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBlindInput,
  evaluateWithPanel,
  validateJudgment,
  type JudgeCaller,
} from "../../core/judges";
import {
  entitySchema,
  requireEntityType,
  type BenchmarkTask,
  type Candidate,
} from "../../core/types";

const task: BenchmarkTask = {
  id: "synthetic-company",
  prompt: "Find companies headquartered in Example City.",
  entityType: "organization",
  referenceDate: "2026-11-14T00:00:00Z",
  definitionNotes: [],
  criteria: [
    {
      id: "location",
      requirement: "Headquartered in Example City",
      required: true,
    },
  ],
};

const candidate: Candidate = {
  sourceId: "private-provider-id",
  rank: 1,
  discoveredAt: "2026-11-14T00:00:00Z",
  entity: {
    prospectType: "organization",
    name: "Synthetic Company",
    domain: "example.com",
    profileUrl: "https://example.com/about",
    location: "Example City",
    description: "Synthetic fixture only.",
    industry: null,
    employeeCount: null,
    evidence: [
      {
        id: "source-1",
        url: "https://example.com/about",
        text: "Our headquarters are in Example City.",
        publishedAt: null,
        retrievedAt: "2026-11-14T00:00:00Z",
      },
    ],
  },
};

test("blind inputs exclude provider identity, ranking, fit scores and provider verdicts", () => {
  const raw = {
    ...candidate,
    provider: "private-provider-marker",
    fitScore: 100,
    matchReason: "private-verdict-marker",
  };
  const input = buildBlindInput(task, raw);
  const serialized = JSON.stringify(input);
  for (const privateValue of [
    raw.sourceId,
    raw.provider,
    raw.matchReason,
    '"rank"',
    '"fitScore"',
  ])
    assert.ok(!serialized.includes(privateValue));
  assert.equal(input.entity.prospectType, "organization");
  assert.equal(input.entity.evidence[0].publishedAt, null);
  assert.notEqual(input.caseId, buildBlindInput(task, raw).caseId);
});

test("organization tasks cannot silently grade an employee instead", () => {
  assert.throws(
    () => requireEntityType(candidate.entity, "individual"),
    /entity type/
  );
  assert.throws(
    () => buildBlindInput({ ...task, entityType: "individual" }, candidate),
    /entity type/
  );
  assert.equal(
    entitySchema.safeParse({ ...candidate.entity, qualificationScore: 100 })
      .success,
    false
  );
});

test("judgments reject missing criteria, duplicate criteria and invented evidence", () => {
  const input = buildBlindInput(task, candidate);
  const criterion = {
    criterionId: "location",
    verdict: "met",
    evidenceIds: ["source-1"],
    explanation: "Headquarters confirmed.",
  };
  assert.equal(
    validateJudgment(input, { caseId: input.caseId, criteria: [criterion] })
      .caseId,
    input.caseId
  );
  assert.throws(() =>
    validateJudgment(input, { caseId: input.caseId, criteria: [] })
  );
  assert.throws(
    () =>
      validateJudgment(input, {
        caseId: input.caseId,
        criteria: [criterion, criterion],
      }),
    /exactly the criteria/
  );
  assert.throws(
    () =>
      validateJudgment(input, {
        caseId: input.caseId,
        criteria: [{ ...criterion, evidenceIds: ["invented"] }],
      }),
    /not supplied/
  );
});

test("the tie-breaker runs only on disagreement and decides the match", async () => {
  const input = buildBlindInput(task, candidate);
  const verdictBy: Record<string, "met" | "not_met"> = {
    a: "met",
    b: "not_met",
    c: "met",
  };
  const called: string[] = [];
  const call: JudgeCaller = async (model) => {
    called.push(model);
    return {
      output: {
        caseId: input.caseId,
        criteria: [
          {
            criterionId: "location",
            verdict: verdictBy[model],
            evidenceIds: [],
            explanation: "synthetic",
          },
        ],
      },
      modelObserved: model,
      costUsd: 0.001,
    };
  };
  const disputed = await evaluateWithPanel(
    input,
    { primary: ["a", "b"], tieBreaker: "c" },
    call
  );
  assert.deepEqual(called.sort(), ["a", "b", "c"]);
  assert.equal(disputed.verifiedMatch, true);
  assert.equal(disputed.costUsd, 0.003);

  called.length = 0;
  const agreed = await evaluateWithPanel(
    input,
    { primary: ["a", "c"], tieBreaker: "b" },
    call
  );
  assert.deepEqual(called.sort(), ["a", "c"]);
  assert.equal(agreed.tieBreaker, null);
});
