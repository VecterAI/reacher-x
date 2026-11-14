import assert from "node:assert/strict";
import test from "node:test";
import {
  BudgetStop,
  SpendGuard,
  keyFingerprint,
  openRouterKeySpend,
  summarizeUsage,
  type SpendReader,
} from "../../core/spend";

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

test("unreadable spend stops the step without exposing the key", async () => {
  const key = "sk-test-not-a-real-key";
  const failing = openRouterKeySpend(key, async () =>
    Response.json({ error: "unauthorized" }, { status: 401 })
  );
  await assert.rejects(failing.read(), (error: Error) => {
    assert.ok(error instanceof BudgetStop);
    assert.ok(!error.message.includes(key));
    return true;
  });
  const working = openRouterKeySpend(key, async () =>
    Response.json({ data: { usage: 2.5 } })
  );
  assert.equal((await working.read()).cumulativeUsd, 2.5);
  assert.equal(working.accountId, `openrouter:${keyFingerprint(key)}`);
});
