import assert from "node:assert/strict";
import test from "node:test";
import { BudgetStop } from "../../../core/execution/spend";
import {
  EXA_CONTENTS,
  LINKED_PAGE_CHARS,
  LinkedPageReader,
} from "../../../people-search/quick-check/linkedPages";
import { fakeExa } from "./fakeReplay";

// Synthetic pages only; no request leaves the process.
const page = (url: string, ...sourcePostIds: string[]) => ({
  url,
  sourcePostIds,
});

test("linked pages become external articles the way qualification builds them", async () => {
  const exa = fakeExa({
    "https://a.example/one": {
      text: `${"x ".repeat(900)}end`,
      author: " Writer ",
    },
    "https://b.example/two": { text: "No author." },
  });
  const reader = new LinkedPageReader(exa.transport, "synthetic-key");
  const articles = await reader.read("pages#1", [
    page("https://a.example/one", "post-1", "post-2"),
    page("https://b.example/two", "post-1"),
  ]);
  assert.equal(articles.length, 2);
  assert.deepEqual(
    articles.map((item) => [item.sourcePostId, item.author]),
    [
      ["post-1", "Writer"],
      ["post-2", "Writer"],
    ]
  );
  assert.equal(articles[0].text.length, LINKED_PAGE_CHARS);
  const [request] = exa.requests;
  assert.equal(request.url, EXA_CONTENTS);
  assert.deepEqual(request.body, {
    urls: ["https://a.example/one", "https://b.example/two"],
    text: { maxCharacters: LINKED_PAGE_CHARS },
  });
  // The key travels as a secret header and is never part of a recorded request.
  assert.deepEqual(request.secretHeaders, { "x-api-key": "synthetic-key" });
  assert.equal(reader.spentUsd, 0.002);
});

test("the budget allows two pages per candidate and stops before passing the total", async () => {
  const exa = fakeExa({}, 0.4);
  const reader = new LinkedPageReader(exa.transport, "synthetic-key");
  await assert.rejects(
    reader.read("pages#1", [
      page("https://a.example/1", "p"),
      page("https://a.example/2", "p"),
      page("https://a.example/3", "p"),
    ]),
    BudgetStop
  );
  // Reported cost counts: $0.80 after the first candidate.
  await reader.read("pages#2", [
    page("https://a.example/1", "p"),
    page("https://a.example/2", "p"),
  ]);
  assert.equal(reader.spentUsd, 0.8);
  // The next estimate ($0.002) still fits; then $1.20 is reached.
  await reader.read("pages#3", [page("https://a.example/3", "p")]);
  const spent = reader.spentUsd;
  assert.ok(spent > 1.19 && spent <= 1.2 + 1e-9);
  await assert.rejects(
    reader.read("pages#4", [page("https://a.example/4", "p")]),
    /would pass the \$1\.20 limit/
  );
  assert.equal(exa.requests.length, 2);
  // Unreadable URLs cost nothing and send nothing.
  assert.deepEqual(
    await reader.read("pages#5", [page("javascript:alert(1)", "p")]),
    []
  );
  assert.equal(exa.requests.length, 2);
});

test("a failed page read yields no articles and is counted, not charged", async () => {
  const reader = new LinkedPageReader(
    async (request) => ({
      step: request.step,
      request: { method: request.method, url: request.url },
      response: { status: 500, body: null, headers: {} },
      latencyMs: 1,
    }),
    "synthetic-key"
  );
  assert.deepEqual(
    await reader.read("pages#1", [page("https://a.example/1", "p")]),
    []
  );
  assert.equal(reader.failedRequests, 1);
  assert.equal(reader.spentUsd, 0);
  assert.throws(
    () =>
      new LinkedPageReader(async () => {
        throw new Error();
      }, ""),
    BudgetStop
  );
});
