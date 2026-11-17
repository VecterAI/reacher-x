import assert from "node:assert/strict";
import test from "node:test";
import { replayTransport } from "../../core/calls/http";
import { replayCall } from "../../core/calls/llm";
import type { BenchmarkTask } from "../../core/types";
import { firecrawlAdapter } from "../../people-search/tools/direct/firecrawl";
import { emptyFilters, fixtureContext } from "./fixtures";

// Synthetic search page and extraction only.
const task: BenchmarkTask = {
  id: "16",
  prompt: "Synthetic company prompt",
  entityType: "organization",
  referenceDate: "2026-11-14T00:00:00Z",
  definitionNotes: [],
  criteria: [{ id: "role", requirement: "Synthetic", required: true }],
};

const web = [
  {
    url: "https://agency.example/seo",
    title: "Example Agency",
    description: "SEO agency in Brazil.",
  },
  {
    url: "https://blog.example/list",
    title: "Top lists",
    description: "Not one company.",
  },
];

test("Firecrawl pages become companies through a replayed extraction, one per page", async () => {
  const transport = replayTransport([
    {
      step: "search",
      request: {
        method: "POST",
        url: "https://api.firecrawl.dev/v2/search",
        body: { query: task.prompt, limit: 10 },
      },
      response: {
        status: 200,
        body: { success: true, data: { web } },
        headers: {},
      },
      latencyMs: 500,
    },
  ]);
  const extracted = {
    result: 1,
    name: "Example Agency",
    title: null,
    employer: null,
    location: "São Paulo, Brazil",
    linkedinUrl: null,
    domain: "agency.example",
    industry: "Marketing",
    description: "SEO agency.",
  };
  // The prompt text must match exactly, so build it the way the adapter does.
  const prompt = JSON.stringify({
    request: task.prompt,
    type: "company",
    results: web.map((item, index) => ({
      result: index + 1,
      title: item.title,
      url: item.url,
      description: item.description,
    })),
  });
  const { candidates, usage, completedAfterMs, receipt } =
    await firecrawlAdapter.search(
      task,
      fixtureContext(
        transport,
        10,
        { FIRECRAWL_API_KEY: "synthetic" },
        emptyFilters("organization"),
        async (step, model, request) =>
          replayCall([
            {
              step: "extract",
              model,
              system: request.system,
              prompt,
              // A repeated page number is ignored; an out-of-range one too.
              output: {
                results: [
                  extracted,
                  { ...extracted, name: "Duplicate" },
                  { ...extracted, result: 9 },
                ],
              },
              modelObserved: "synthetic/model-1",
              costUsd: 0.0002,
              latencyMs: 300,
            },
          ])(step, model, request)
      )
    );
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].entity.name, "Example Agency");
  assert.equal(
    candidates[0].entity.prospectType === "organization" &&
      candidates[0].entity.domain,
    "agency.example"
  );
  // Credits were not reported, so the request stays unpriced rather than free.
  assert.deepEqual(usage[0], {
    provider: "firecrawl",
    unit: "request-without-credit-report",
    quantity: 1,
    reportedUsd: null,
  });
  assert.equal(completedAfterMs, 800);
  assert.deepEqual(receipt.unexpressed, []);
});
