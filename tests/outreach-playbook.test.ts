import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOutreachPlaybookMessage,
  fetchOutreachPlaybookMarkdown,
  getOutreachPlaybookMessage,
  OUTREACH_PLAYBOOK_URL,
} from "../shared/lib/outreachPlaybook";

const SAMPLE_GUIDE = `# How to reach out and actually get replies

## Research like you mean it

Know what they recently posted before writing.
`;

function createFetchStub(response: {
  ok: boolean;
  text?: string;
  headers?: Record<string, string>;
}) {
  const calls: string[] = [];
  const stub = (async (url: string | URL) => {
    calls.push(String(url));
    return {
      ok: response.ok,
      headers: new Map(Object.entries(response.headers ?? {})),
      text: async () => response.text ?? "",
    };
  }) as unknown as typeof fetch;
  return { stub, calls };
}

test("playbook message always carries the outreach copy ban list", () => {
  const message = buildOutreachPlaybookMessage(SAMPLE_GUIDE);

  assert.match(message, /## Outreach Copy Rules \(CRITICAL\)/);
  assert.match(message, /Never use em dashes/);
  assert.match(message, /"Your point"/);
  assert.match(message, /"Saw you"/);
  assert.match(message, /"Saw your post"/);
  assert.match(message, /"I saw your profile"/);
  assert.match(message, /"Hope this finds you well"/);
});

test("playbook message includes the guide text when available", () => {
  const message = buildOutreachPlaybookMessage(SAMPLE_GUIDE);

  assert.match(message, /## Outreach Playbook/);
  assert.match(message, /Research like you mean it/);
  // Voice wording must not claim a learning status; an absent voice context
  // is not evidence that style learning is pending.
  assert.match(message, /this draft used your default voice/);
  assert.doesNotMatch(message, /until their style is learned/);
});

test("playbook message degrades to the ban list when the guide is unavailable", () => {
  for (const missing of [null, "", "   "]) {
    const message = buildOutreachPlaybookMessage(missing);

    assert.match(message, /## Outreach Copy Rules \(CRITICAL\)/);
    assert.doesNotMatch(message, /## Outreach Playbook/);
  }
});

test("guide fetch hits the published blog markdown route", async () => {
  const { stub, calls } = createFetchStub({ ok: true, text: SAMPLE_GUIDE });

  const result = await fetchOutreachPlaybookMarkdown(stub);

  assert.equal(result, SAMPLE_GUIDE);
  assert.deepEqual(calls, [OUTREACH_PLAYBOOK_URL]);
});

test("guide fetch returns null on failure or empty responses", async () => {
  const failing = (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
  const notOk = createFetchStub({ ok: false }).stub;
  const empty = createFetchStub({ ok: true, text: "  " }).stub;

  assert.equal(await fetchOutreachPlaybookMarkdown(failing), null);
  assert.equal(await fetchOutreachPlaybookMarkdown(notOk), null);
  assert.equal(await fetchOutreachPlaybookMarkdown(empty), null);
});

test("guide fetch rejects oversized responses without reading them", async () => {
  const oversizedHeader = createFetchStub({
    ok: true,
    text: "should not be read",
    headers: { "content-length": String(65_000) },
  });
  const oversizedBody = createFetchStub({
    ok: true,
    text: "x".repeat(65_000),
  }).stub;

  assert.equal(await fetchOutreachPlaybookMarkdown(oversizedHeader.stub), null);
  assert.deepEqual(oversizedHeader.calls, [OUTREACH_PLAYBOOK_URL]);
  assert.equal(await fetchOutreachPlaybookMarkdown(oversizedBody), null);
});

test("playbook message survives a failed guide fetch", async () => {
  const failing = (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;

  const message = await getOutreachPlaybookMessage(failing);

  assert.match(message, /## Outreach Copy Rules \(CRITICAL\)/);
  assert.doesNotMatch(message, /## Outreach Playbook/);
});
