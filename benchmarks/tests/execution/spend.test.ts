import assert from "node:assert/strict";
import test from "node:test";
import {
  BudgetStop,
  SpendGuard,
  keyFingerprint,
  openRouterKeySpend,
  summarizeUsage,
  type SpendReader,
} from "../../core/execution/spend";
import type { HttpRequest, Transport } from "../../core/calls/http";

test("grants do not erase comparable usage cost and missing prices remain unpriced", () => {
  const report = summarizeUsage([
    {
      provider: "synthetic-priced",
      quantity: 1,
      unit: "request",
      valuation: {
        status: "priced",
        normalUsd: 2,
        rateReference: "frozen-rate",
      },
      funding: { grantUnitsUsed: 1, cashUsd: 0 },
    },
    {
      provider: "synthetic-unpriced",
      quantity: 43,
      unit: "credit",
      valuation: { status: "unpriced", reason: "No verified rate" },
      funding: { grantUnitsUsed: 43, cashUsd: null },
    },
  ]);
  assert.equal(report.pricedUsageUsd, 2);
  assert.deepEqual(report.unpricedUsage, [
    { provider: "synthetic-unpriced", quantity: 43, unit: "credit" },
  ]);
  assert.equal(report.knownCashUsd, 0);
  assert.equal(report.cashComplete, false);
});

// A reader whose cumulative spend the test controls; nothing reaches a provider.
function fakeReader(accountId: string, values: number[]): SpendReader {
  return {
    accountId,
    read: async () => ({
      accountId,
      recordedAt: "2026-11-14T00:00:00Z",
      cumulativeUsd: values.shift() ?? Number.NaN,
    }),
  };
}

const approval = (maxAdditionalUsd: number) => ({
  approvalReference: "D1 smoke test",
  approvedAt: "2026-11-14T00:00:00Z",
  accountLimits: [{ accountId: "openrouter:a", maxAdditionalUsd }],
});

test("the guard measures spend from the step's baseline and stops at the limit", async () => {
  const guard = new SpendGuard(approval(1), [
    fakeReader("openrouter:a", [10, 10.4, 11]),
  ]);
  await guard.start();
  assert.deepEqual(await guard.check(), {
    "openrouter:a": 0.40000000000000036,
  });
  await assert.rejects(guard.check(), BudgetStop);
});

test("every paid account needs exactly one approved limit", () => {
  assert.throws(
    () => new SpendGuard(approval(1), [fakeReader("openrouter:b", [])]),
    BudgetStop
  );
  // A duplicated reader must not stand in for an unread second account.
  const twoAccounts = {
    ...approval(1),
    accountLimits: [
      { accountId: "openrouter:a", maxAdditionalUsd: 1 },
      { accountId: "openrouter:b", maxAdditionalUsd: 1 },
    ],
  };
  assert.throws(
    () =>
      new SpendGuard(twoAccounts, [
        fakeReader("openrouter:a", []),
        fakeReader("openrouter:a", []),
      ]),
    BudgetStop
  );
});

// Answers like the provider would; the key only ever travels in secret headers.
const answering =
  (status: number, body: unknown, seen: HttpRequest[] = []): Transport =>
  async (request) => {
    seen.push(request);
    return {
      step: request.step,
      request: { method: request.method, url: request.url },
      response: { status, body, headers: {} },
      latencyMs: 1,
    };
  };

test("unreadable spend stops the step without exposing the key", async () => {
  const key = "sk-test-not-a-real-key";
  const failing = openRouterKeySpend(
    key,
    answering(401, { error: "unauthorized" })
  );
  await assert.rejects(failing.read(), (error: Error) => {
    assert.ok(error instanceof BudgetStop);
    assert.ok(!error.message.includes(key));
    return true;
  });
  const seen: HttpRequest[] = [];
  const working = openRouterKeySpend(
    key,
    answering(200, { data: { usage: 2.5 } }, seen)
  );
  assert.equal((await working.read()).cumulativeUsd, 2.5);
  assert.equal(working.accountId, `openrouter:${keyFingerprint(key)}`);
  assert.equal(seen[0].url, "https://openrouter.ai/api/v1/key");
  assert.equal(seen[0].headers, undefined);
});

test("a resumed step keeps its first baseline, and a check can cover some accounts only", async () => {
  const twoAccounts = {
    ...approval(1),
    accountLimits: [
      { accountId: "openrouter:a", maxAdditionalUsd: 1 },
      { accountId: "socialapi:b", maxAdditionalUsd: 1 },
    ],
  };
  const first = new SpendGuard(twoAccounts, [
    fakeReader("openrouter:a", [10]),
    fakeReader("socialapi:b", [-50]),
  ]);
  const baselines = await first.start();
  // The second attempt starts later, after 0.6 was already spent.
  const resumed = new SpendGuard(twoAccounts, [
    fakeReader("openrouter:a", [10.6, 11.2]),
    fakeReader("socialapi:b", []),
  ]);
  await resumed.start(baselines);
  assert.deepEqual(Object.keys(await resumed.check(["openrouter:a"])), [
    "openrouter:a",
  ]);
  await assert.rejects(resumed.check(["openrouter:a"]), BudgetStop);
});
