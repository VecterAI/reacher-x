import assert from "node:assert/strict";
import test from "node:test";
import {
  liveTransport,
  recordingTransport,
  replayTransport,
  type Exchange,
} from "../../core/http";

const SECRET = "synthetic-secret-value";

// A fetch stand-in; nothing leaves the process.
const fakeFetch = (async (
  input: string | URL | Request,
  init?: RequestInit
) => {
  const headers = new Headers(init?.headers);
  assert.equal(headers.get("x-api-key"), SECRET);
  assert.equal(String(input), "https://api.example.test/search?page=1");
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "x-treg-cost-micro": "1500",
      "x-treg-served-by": "provider-a",
      "set-cookie": "session=private",
    },
  });
}) as typeof fetch;

test("live exchanges keep provider metadata but never the secret or cookies", async () => {
  const saved: Exchange[] = [];
  const transport = recordingTransport(liveTransport(fakeFetch), (exchange) => {
    saved.push(exchange);
  });
  const exchange = await transport({
    step: "search",
    method: "POST",
    url: "https://api.example.test/search",
    query: { page: "1" },
    body: { q: "synthetic" },
    secretHeaders: { "x-api-key": SECRET },
  });
  assert.equal(saved.length, 1);
  assert.deepEqual(exchange.response.headers, {
    "x-treg-cost-micro": "1500",
    "x-treg-served-by": "provider-a",
  });
  assert.ok(!JSON.stringify(saved).includes(SECRET));
  assert.ok(!JSON.stringify(saved).includes("session=private"));
});

test("replay answers only the exact saved request, in order", async () => {
  const saved: Exchange = {
    step: "search",
    request: {
      method: "POST",
      url: "https://api.example.test/search",
      body: { q: "a" },
    },
    response: { status: 200, body: { results: [] }, headers: {} },
    latencyMs: 12,
  };
  const replay = replayTransport([saved]);
  await assert.rejects(
    replay({
      step: "search",
      method: "POST",
      url: saved.request.url,
      body: { q: "b" },
    }),
    /differs/
  );
  const again = replayTransport([saved]);
  const exchange = await again({
    step: "search",
    method: "POST",
    url: saved.request.url,
    body: { q: "a" },
    secretHeaders: { "x-api-key": SECRET },
  });
  assert.equal(exchange.latencyMs, 12);
  await assert.rejects(
    again({
      step: "search",
      method: "POST",
      url: saved.request.url,
      body: { q: "a" },
    }),
    /No saved response/
  );
});
