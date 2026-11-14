import assert from "node:assert/strict";
import test from "node:test";
import { priceUsage, type RateSnapshot } from "../../core/rates";

// Synthetic rates, not frozen benchmark prices.
const snapshot: RateSnapshot = {
  recordedAt: "2026-11-14T00:00:00Z",
  rates: [
    {
      provider: "routed",
      unit: "call",
      usdPerUnit: "reported",
      reference: "provider header",
    },
    {
      provider: "credits",
      unit: "credit",
      usdPerUnit: 0.001,
      reference: "list price",
    },
  ],
  funding: [
    { provider: "routed", source: "grant" },
    { provider: "credits", source: "cash" },
  ],
};

test("frozen rates price usage, grants cover cash, and missing prices stay unpriced", () => {
  const [routed, credits, missingReport, noRate] = priceUsage(
    [
      { provider: "routed", unit: "call", quantity: 1, reportedUsd: 0.02 },
      { provider: "credits", unit: "credit", quantity: 50, reportedUsd: null },
      { provider: "routed", unit: "call", quantity: 1, reportedUsd: null },
      { provider: "unknown", unit: "credit", quantity: 3, reportedUsd: null },
    ],
    snapshot
  );
  assert.deepEqual(routed.valuation, {
    status: "priced",
    normalUsd: 0.02,
    rateReference: "provider header",
  });
  assert.deepEqual(routed.funding, { grantUnitsUsed: 1, cashUsd: 0 });
  assert.equal(
    credits.valuation.status === "priced" && credits.valuation.normalUsd,
    0.05
  );
  assert.deepEqual(credits.funding, { grantUnitsUsed: 0, cashUsd: 0.05 });
  assert.equal(missingReport.valuation.status, "unpriced");
  assert.equal(noRate.valuation.status, "unpriced");
  assert.deepEqual(noRate.funding, { grantUnitsUsed: null, cashUsd: null });
});
