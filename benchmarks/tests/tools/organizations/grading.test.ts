import assert from "node:assert/strict";
import test from "node:test";
import { replayTransport } from "../../../core/calls/http";
import {
  buildBlindInput,
  type JudgeCaller,
} from "../../../core/judging/judges";
import { judgeCandidate } from "../../../core/judging/judgeCandidate";
import { drawLabelSample } from "../../../core/judging/labels";
import { searchAdapters } from "../../../people-search/tools/registry";
import { fixtureContext } from "../fixtures";
import {
  companyFilters,
  companyTask,
  organizationFixtures,
  savedModel,
} from "./responses";

// Synthetic company results from the saved responses, graded by stub judges.
const ids = Object.keys(
  organizationFixtures
) as (keyof typeof organizationFixtures)[];

async function candidateFrom(id: (typeof ids)[number]) {
  const fixture = organizationFixtures[id];
  const result = await searchAdapters[id].search(
    companyTask,
    fixtureContext(
      replayTransport(fixture.exchanges),
      fixture.topK,
      fixture.secrets,
      companyFilters,
      savedModel("modelOutputs" in fixture ? fixture.modelOutputs : {})
    )
  );
  return result.candidates[0];
}

/** Every criterion met, citing the first evidence item when there is one. */
const agreeingJudges: JudgeCaller = async (model, input) => ({
  output: {
    caseId: input.caseId,
    criteria: input.criteria.map((criterion) => ({
      criterionId: criterion.id,
      verdict: "met",
      evidenceIds: input.entity.evidence.slice(0, 1).map((item) => item.id),
      explanation: "Synthetic.",
    })),
  },
  modelObserved: model,
  costUsd: 0.001,
});

const models = {
  primary: ["synthetic/judge-a", "synthetic/judge-b"] as const,
  tieBreaker: "synthetic/judge-c",
};

test("company results are judged as companies, never as people", async () => {
  const peopleTask = { ...companyTask, entityType: "individual" as const };
  for (const id of ids) {
    const candidate = await candidateFrom(id);
    const input = buildBlindInput(companyTask, candidate);
    assert.equal(input.entity.prospectType, "organization", id);
    assert.equal(input.entity.name, "Northwind Example", id);
    assert.throws(
      () => buildBlindInput(peopleTask, candidate),
      /entity type does not match/,
      id
    );
  }
});

test("a judged company keeps its identity and dated evidence for freshness", async () => {
  const records = [];
  for (const id of ids) {
    const record = await judgeCandidate(
      companyTask,
      id,
      await candidateFrom(id),
      {
        models,
        call: agreeingJudges,
      }
    );
    assert.equal(record.panel.verifiedMatch, true, id);
    assert.equal(record.panel.tieBreaker, null, id);
    assert.match(record.identity ?? "", /^organization:/, id);
    records.push(record);
  }
  // Exa's page is dated 1 September 2026: 74 days before the reference date.
  assert.equal(records[ids.indexOf("exa")].newestCitedEvidenceAgeDays, 74);
  // Firecrawl's search page has no date, so freshness is unknown, not zero.
  assert.equal(
    records[ids.indexOf("firecrawl")].newestCitedEvidenceAgeDays,
    null
  );
  // Company results take their share of the human label sample.
  const sample = drawLabelSample(records, 4, 1);
  assert.ok(
    sample.every(
      (record) => record.input.entity.prospectType === "organization"
    )
  );
  assert.equal(sample.length, 4);
});
