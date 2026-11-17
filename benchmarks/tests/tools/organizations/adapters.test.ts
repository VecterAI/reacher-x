import assert from "node:assert/strict";
import test from "node:test";
import { replayTransport } from "../../../core/calls/http";
import { flagRepeats, identityKeys } from "../../../core/judging/identity";
import { searchAdapters } from "../../../people-search/tools/registry";
import { fixtureContext } from "../fixtures";
import {
  companyFilters,
  companyTask,
  organizationFixtures,
  savedModel,
} from "./responses";

// Every adapter whose declared capabilities include organizations has a fixture.
const supported = Object.values(searchAdapters).filter(
  (adapter) => adapter.capabilities.organization.status === "supported"
);

const search = (id: keyof typeof organizationFixtures) => {
  const fixture = organizationFixtures[id];
  return searchAdapters[id].search(
    companyTask,
    fixtureContext(
      replayTransport(fixture.exchanges),
      fixture.topK,
      fixture.secrets,
      companyFilters,
      savedModel("modelOutputs" in fixture ? fixture.modelOutputs : {})
    )
  );
};

test("every adapter that supports organizations has a saved company response", () => {
  assert.deepEqual(
    supported.map((adapter) => adapter.id).sort(),
    Object.keys(organizationFixtures).sort()
  );
});

for (const id of Object.keys(
  organizationFixtures
) as (keyof typeof organizationFixtures)[])
  test(`${id} company results map to organization entities`, async () => {
    const { expected } = organizationFixtures[id];
    const result = await search(id);
    assert.equal(result.candidates.length, 1);
    const [candidate] = result.candidates;
    assert.equal(candidate.rank, 1);
    const { entity } = candidate;
    if (entity.prospectType !== "organization")
      throw new Error("Expected an organization.");
    assert.equal(entity.name, "Northwind Example");
    assert.equal(entity.domain, expected.domain);
    assert.equal(entity.industry, expected.industry);
    assert.equal(entity.employeeCount, expected.employeeCount);
    assert.equal(entity.location, expected.location);
    // A company never carries a person's title or employer.
    assert.equal("title" in entity || "employer" in entity, false);
    if ("evidencePublishedAt" in expected)
      assert.deepEqual(
        entity.evidence.map((item) => item.publishedAt),
        [expected.evidencePublishedAt]
      );
    else assert.deepEqual(entity.evidence, []);
    // The company is identified by its domain, never by a name alone.
    assert.ok(
      identityKeys(entity).some(
        (key) => key.kind === "domain" && key.value === expected.domain
      )
    );
    assert.equal(result.receipt.toolId, id);
    assert.equal(result.receipt.taskId, companyTask.id);
  });

test("the same company returned by every tool is flagged as a repeat by identity", async () => {
  const results = await Promise.all(
    (
      Object.keys(organizationFixtures) as (keyof typeof organizationFixtures)[]
    ).map(async (id) => ({
      toolId: id,
      resultId: `${id}-1`,
      entity: (await search(id)).candidates[0].entity,
    }))
  );
  const flags = flagRepeats(results);
  assert.equal(flags.length, results.length);
  assert.ok(flags.every((flag) => flag.confidence === "identity"));
  assert.ok(
    flags.every((flag) => flag.repeatsTools.length === results.length - 1)
  );
});
