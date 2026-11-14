import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildBlindInput, validateJudgment } from "./judges";
import { verifyProposal } from "./proposal";
import { summarizeUsage } from "./spend";
import {
  entitySchema,
  requireEntityType,
  type BenchmarkTask,
  type Candidate,
} from "./types";

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

test("grants do not erase comparable usage cost and missing prices remain unpriced", () => {
  const report = summarizeUsage([
    {
      provider: "synthetic-priced",
      quantity: 1,
      unit: "request",
      valuation: {
        status: "priced",
        normalUsd: 2,
        rateReference: "frozen-rate",
      },
      funding: { grantUnitsUsed: 1, cashUsd: 0 },
    },
    {
      provider: "synthetic-unpriced",
      quantity: 43,
      unit: "credit",
      valuation: { status: "unpriced", reason: "No verified rate" },
      funding: { grantUnitsUsed: 43, cashUsd: null },
    },
  ]);
  assert.equal(report.pricedUsageUsd, 2);
  assert.deepEqual(report.unpricedUsage, [
    { provider: "synthetic-unpriced", quantity: 43, unit: "credit" },
  ]);
  assert.equal(report.knownCashUsd, 0);
  assert.equal(report.cashComplete, false);
});

test("changed proposal bytes invalidate the plan's source reference", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "reacherx-proposal-contract-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bytes = Buffer.from("synthetic proposal fixture");
  const reference = {
    path: "proposal.pdf",
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
  await writeFile(join(root, reference.path), bytes);
  await verifyProposal(root, reference);
  await writeFile(join(root, reference.path), "changed fixture");
  await assert.rejects(verifyProposal(root, reference), /proposal changed/);
});
