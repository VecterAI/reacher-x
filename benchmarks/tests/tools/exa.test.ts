import assert from "node:assert/strict";
import test from "node:test";
import { replayTransport } from "../../core/calls/http";
import type { BenchmarkTask } from "../../core/types";
import {
  exaAdapter,
  parseExaPeople,
} from "../../people-search/tools/direct/exa";
import { fixtureContext } from "./fixtures";

// Response shaped like Exa's people search; every value is synthetic.
const response = {
  results: [
    {
      id: "exa-result-1",
      url: "https://www.linkedin.com/in/synthetic-one",
      title: "Synthetic One - Backend Engineer",
      text: "Backend engineer in Amsterdam.",
      publishedDate: "2026-10-01T00:00:00.000Z",
      entities: [
        {
          type: "person",
          properties: {
            name: "Synthetic One",
            location: "Amsterdam, Netherlands",
            workHistory: [
              {
                title: "Former Role",
                company: { name: "Old Example" },
                dates: { from: "2019-01", to: "2022-01" },
              },
              {
                title: "Senior Backend Engineer",
                company: { name: "Example BV" },
                dates: { from: "2023-02", to: null },
              },
            ],
          },
        },
      ],
    },
    // No usable name: skipped, and ranks close up.
    { id: "exa-result-2", url: "https://example.com/page", entities: [] },
  ],
  costDollars: { total: 0.012 },
};

const task: BenchmarkTask = {
  id: "2",
  prompt: "Synthetic people prompt",
  entityType: "individual",
  referenceDate: "2026-11-14T00:00:00Z",
  definitionNotes: [],
  criteria: [{ id: "role", requirement: "Synthetic", required: true }],
};

test("Exa people results become typed people with their page as evidence", () => {
  const [first, ...rest] = parseExaPeople(response, "2026-11-14T00:00:00Z", 5);
  assert.equal(rest.length, 0);
  assert.equal(first.rank, 1);
  assert.equal(first.sourceId, "exa-result-1");
  assert.deepEqual(first.entity, {
    prospectType: "individual",
    name: "Synthetic One",
    profileUrl: "https://www.linkedin.com/in/synthetic-one",
    title: "Senior Backend Engineer",
    employer: "Example BV",
    location: "Amsterdam, Netherlands",
    description: "Synthetic One - Backend Engineer",
    evidence: [
      {
        id: "exa-1",
        url: "https://www.linkedin.com/in/synthetic-one",
        text: "Backend engineer in Amsterdam.",
        publishedAt: "2026-10-01T00:00:00.000Z",
        retrievedAt: "2026-11-14T00:00:00Z",
      },
    ],
  });
});

test("the Exa adapter replays a saved exchange and reports its cost and latency", async () => {
  const transport = replayTransport([
    {
      step: "search",
      request: {
        method: "POST",
        url: "https://api.exa.ai/search",
        body: {
          query: task.prompt,
          type: "auto",
          category: "people",
          numResults: 10,
          contents: { text: { maxCharacters: 1500 } },
        },
      },
      response: { status: 200, body: response, headers: {} },
      latencyMs: 840,
    },
  ]);
  const result = await exaAdapter.search(
    task,
    fixtureContext(transport, 10, { EXA_API_KEY: "synthetic" })
  );
  assert.equal(result.candidates.length, 1);
  assert.deepEqual(result.usage, [
    { provider: "exa", unit: "request", quantity: 1, reportedUsd: 0.012 },
  ]);
  assert.equal(result.completedAfterMs, 840);
  await assert.rejects(
    exaAdapter.search(task, fixtureContext(transport, 10, {})),
    /EXA_API_KEY is not set/
  );
});
