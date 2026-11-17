import assert from "node:assert/strict";
import test from "node:test";
import { replayTransport } from "../../../core/calls/http";
import { flagRepeats, identityKeys } from "../../../core/judging/identity";
import { isComplete, toClayQuery } from "../../../people-search/tools/direct/clay";
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

test("Clay's unquoted-value rejection is retried with a hint to quote text values", async () => {
  const fixture = organizationFixtures.clay;
  const [reference, , run] = fixture.exchanges;
  const prompts: string[] = [];
  const outputs: Record<string, unknown> = {
    "query#1": { query: "unquoted query" },
    "query#2": { query: "synthetic companies query" },
  };
  const model = savedModel(outputs);
  const result = await searchAdapters.clay.search(
    companyTask,
    fixtureContext(
      replayTransport([
        reference,
        {
          step: "create#1",
          request: {
            method: "POST",
            url: run.request.url.replace(/\/search-1\/run$/, ""),
            body: { query: "unquoted query" },
          },
          response: {
            status: 400,
            body: {
              message: "Expected value but got IDENT (at line 1, col 41)",
            },
            headers: {},
          },
          latencyMs: 100,
        },
        { ...fixture.exchanges[1], step: "create#2" },
        { ...run, step: "run#2" },
      ]),
      fixture.topK,
      fixture.secrets,
      companyFilters,
      async (step, id, request) => {
        prompts.push(request.prompt);
        return model(step, id, request);
      }
    )
  );
  assert.equal(result.candidates.length, 1);
  assert.match(prompts[1], /unquoted: write it in single quotes/);
});

test("a Clay query cut off at an unescaped quote is asked for again, not sent", async () => {
  const fixture = organizationFixtures.clay;
  const [reference, create, run] = fixture.exchanges;
  const prompts: string[] = [];
  const model = savedModel({
    "query#1": { query: "select from companies where industry in (" },
    "query#2": { query: "synthetic companies query" },
  });
  const result = await searchAdapters.clay.search(
    companyTask,
    fixtureContext(
      // No create#1: the cut-off query never reaches Clay.
      replayTransport([
        reference,
        { ...create, step: "create#2" },
        { ...run, step: "run#2" },
      ]),
      fixture.topK,
      fixture.secrets,
      companyFilters,
      async (step, id, request) => {
        prompts.push(request.prompt);
        return model(step, id, request);
      }
    )
  );
  assert.equal(result.candidates.length, 1);
  assert.match(prompts[1], /cut off/);
});

test("single-quoted Clay values become double-quoted strings, and an open value is cut off", () => {
  assert.equal(
    toClayQuery(
      "select from companies where industry = 'Software Development' and country_name in ('United States','Canada')"
    ),
    'select from companies where industry = "Software Development" and country_name in ("United States","Canada")'
  );
  assert.equal(
    toClayQuery("industry = 'Women''s Health'"),
    'industry = "Women\'s Health"'
  );
  assert.equal(toClayQuery('industry = "Banking"'), 'industry = "Banking"');
  assert.equal(toClayQuery("country_name in ('United"), null);
  const quote = toClayQuery("name = '5\" Tools'");
  assert.equal(quote, 'name = "5\\" Tools"');
  assert.equal(isComplete(quote!), true);
  assert.equal(isComplete('name = "5\\" Tools'), false);
  const escaped = 'name = "The \\"Women\'s\\" Clinic"';
  assert.equal(toClayQuery(escaped), escaped);
});
