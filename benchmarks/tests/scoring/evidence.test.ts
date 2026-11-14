import assert from "node:assert/strict";
import test from "node:test";
import {
  evidenceQueries,
  tavilyEvidence,
  type EvidenceCache,
} from "../../core/evidence";
import type { Exchange, Transport } from "../../core/http";
import type { BenchmarkEntity, BenchmarkTask } from "../../core/types";

// Synthetic entity, task and search responses only.
const entity: BenchmarkEntity = {
  prospectType: "organization",
  name: "Example Climate",
  profileUrl: null,
  location: "Berlin, Germany",
  description: null,
  evidence: [],
  domain: "climate.example",
  industry: null,
  employeeCount: null,
};

const task: BenchmarkTask = {
  id: "19",
  prompt: "Synthetic",
  entityType: "organization",
  referenceDate: "2026-11-14T00:00:00Z",
  definitionNotes: [],
  criteria: [
    { id: "sector", requirement: "Climate technology company", required: true },
    { id: "hiring", requirement: "Hiring data scientists", required: true },
    { id: "nice", requirement: "Optional detail", required: false },
  ],
};

function memoryCache(): EvidenceCache & { size: () => number } {
  const store = new Map<string, Exchange>();
  return {
    size: () => store.size,
    read: async (key) => store.get(key) ?? null,
    write: async (key, exchange) => {
      store.set(key, exchange);
      return { path: `benchmarks/.local/evidence/${key}.json`, sha256: key };
    },
  };
}

test("evidence queries confirm identity, then target the required criteria", () => {
  assert.deepEqual(evidenceQueries(entity, task), [
    '"Example Climate" climate.example Berlin, Germany',
    '"Example Climate" Climate technology company; Hiring data scientists',
  ]);
});

test("searches are cached across tools and never request a generated answer", async () => {
  const bodies: unknown[] = [];
  const transport: Transport = async (request) => {
    bodies.push(request.body);
    return {
      step: request.step,
      request: { method: request.method, url: request.url, body: request.body },
      response: {
        status: 200,
        body: {
          results: [
            {
              url: "https://news.example/a",
              title: "Hiring",
              content: "Data scientist roles.",
              published_date: "Mon, 03 Nov 2026 10:00:00 GMT",
            },
            {
              url: "https://news.example/b",
              title: "No date",
              content: "Text.",
              published_date: "not a date",
            },
          ],
        },
        headers: {},
      },
      latencyMs: 50,
    };
  };
  const cache = memoryCache();
  const provider = tavilyEvidence({
    transport,
    apiKey: "synthetic",
    cache,
    retrievedAt: () => "2026-11-14T00:00:00Z",
  });
  const first = await provider.collect(entity, task);
  assert.equal(first.searchesUsed, 2);
  assert.equal(first.evidence[0].publishedAt, "2026-11-03T10:00:00.000Z");
  assert.equal(first.evidence[1].publishedAt, null);
  assert.ok(
    bodies.every(
      (body) => (body as { include_answer: boolean }).include_answer === false
    )
  );
  const again = await provider.collect(entity, task);
  assert.equal(again.searchesUsed, 0);
  assert.equal(bodies.length, 2);
  assert.equal(cache.size(), 2);
});
