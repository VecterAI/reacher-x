import assert from "node:assert/strict";
import test from "node:test";
import { judgeCandidate, type CaseRecord } from "../../core/judging";
import type { JudgeCaller } from "../../core/judges";
import {
  drawLabelSample,
  judgeAgreement,
  parseLabelSheet,
  renderLabelBooklet,
  renderLabelSheet,
} from "../../core/labels";
import type { BenchmarkTask, Candidate, EntityType } from "../../core/types";

// Synthetic tasks, results and labels only.
const task = (entityType: EntityType): BenchmarkTask => ({
  id: entityType === "individual" ? "1" : "14",
  prompt: "Synthetic prompt",
  entityType,
  referenceDate: "2026-11-14T00:00:00Z",
  definitionNotes: [],
  criteria: [
    { id: "fit", requirement: "Synthetic requirement", required: true },
  ],
});

const candidate = (entityType: EntityType, name: string): Candidate => ({
  sourceId: `private-${name}`,
  rank: 3,
  discoveredAt: "2026-11-14T00:00:00Z",
  entity:
    entityType === "individual"
      ? {
          prospectType: "individual",
          name,
          profileUrl: `https://www.linkedin.com/in/${name}`,
          location: null,
          description: null,
          evidence: [],
          title: null,
          employer: null,
        }
      : {
          prospectType: "organization",
          name,
          profileUrl: null,
          location: null,
          description: null,
          evidence: [],
          domain: `${name}.example`,
          industry: null,
          employeeCount: null,
        },
});

const verdictCaller =
  (verdict: "met" | "not_met"): JudgeCaller =>
  async (model, input) => ({
    output: {
      caseId: input.caseId,
      criteria: [
        {
          criterionId: "fit",
          verdict,
          evidenceIds: input.entity.evidence.map((item) => item.id),
          explanation: "synthetic",
        },
      ],
    },
    modelObserved: model,
    costUsd: 0,
  });

const models = { primary: ["a", "b"], tieBreaker: "c" } as const;

async function judged(entityType: EntityType, name: string, match: boolean) {
  return judgeCandidate(
    task(entityType),
    "tool-x",
    candidate(entityType, name),
    {
      models,
      call: verdictCaller(match ? "met" : "not_met"),
      evidence: {
        collect: async () => ({
          evidence: [
            {
              id: "web-1",
              url: `https://news.example/${name}`,
              text: "Synthetic article.",
              publishedAt: "2026-11-04T00:00:00Z",
              retrievedAt: "2026-11-14T00:00:00Z",
            },
          ],
          searchesUsed: 1,
          receipt: {
            path: "benchmarks/.local/evidence/x.json",
            sha256: "0".repeat(64),
          },
        }),
      },
    }
  );
}

test("a judged case keeps the source private and records freshness from cited web evidence", async () => {
  const record = await judged("organization", "acme", true);
  assert.equal(record.toolId, "tool-x");
  assert.equal(record.sourceId, "private-acme");
  assert.equal(record.identity, "organization:domain:acme.example");
  assert.equal(record.panel.verifiedMatch, true);
  assert.equal(record.newestCitedEvidenceAgeDays, 10);
  const blind = JSON.stringify(record.input);
  for (const hidden of ["tool-x", "private-acme", '"rank"'])
    assert.ok(!blind.includes(hidden));
});

test("the label sample mixes people and companies and skips labelled cases", async () => {
  const records: CaseRecord[] = [];
  for (let index = 0; index < 6; index += 1) {
    records.push(await judged("individual", `p${index}`, index % 2 === 0));
    if (index < 2)
      records.push(await judged("organization", `c${index}`, true));
  }
  const sample = drawLabelSample(records, 6, 11);
  assert.equal(sample.length, 6);
  const companies = sample.filter(
    (r) => r.input.entity.prospectType === "organization"
  );
  // Only two companies exist, so people fill the rest.
  assert.equal(companies.length, 2);
  assert.deepEqual(
    sample.map((r) => r.caseId),
    drawLabelSample(records, 6, 11).map((r) => r.caseId)
  );
  const labelled = new Set(sample.map((r) => r.caseId));
  assert.ok(
    drawLabelSample(records, 2, 11, labelled).every(
      (r) => !labelled.has(r.caseId)
    )
  );

  const booklet = renderLabelBooklet(sample);
  for (const hidden of ["tool-x", "private-", "verifiedMatch", "met"])
    assert.ok(!booklet.includes(hidden), hidden);
});

test("the agreement gate pairs every human label with the panel verdict", async () => {
  const records = [
    await judged("individual", "a", true),
    await judged("individual", "b", false),
    await judged("organization", "c", true),
    await judged("organization", "d", false),
  ];
  const sheet = renderLabelSheet(records, ["l1", "l2"]);
  assert.throws(() => renderLabelSheet(records, ["Full Name"]), /not names/);
  const answers = ["yes", "no", "yes", "no", "yes", "no", "no", "no"];
  const lines = sheet.trim().split("\n");
  const filled = [
    lines[0],
    ...lines
      .slice(1)
      .map((line, index) =>
        line.replace(
          /,,$/,
          `,${answers[index]},"note, with comma\nand a line break"`
        )
      ),
  ].join("\n");
  const labels = parseLabelSheet(filled);
  assert.equal(labels[0].notes, "note, with comma\nand a line break");
  assert.equal(labels.length, 8);
  const report = judgeAgreement(labels, records, 0.7);
  // l1 agrees fully; l2 marks one match as "no".
  assert.deepEqual(
    report.perLabeller.map((item) => [item.labeller, item.kappa]),
    [
      ["l1", 1],
      ["l2", 0.5],
    ]
  );
  assert.equal(report.betweenLabellers?.cases, 4);
  assert.ok(report.kappa !== null && report.kappa >= 0.7);
  assert.equal(report.passes, true);
  assert.throws(() => parseLabelSheet(`${lines[0]}\n${lines[1]}`), /yes\/no/);
});
