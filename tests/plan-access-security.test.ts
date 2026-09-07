import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const plansSource = readFileSync("convex/plans.ts", "utf8");
const testerPlansSource = readFileSync("convex/testerPlans.ts", "utf8");

test("clients cannot directly assign themselves a paid plan", () => {
  assert.doesNotMatch(plansSource, /export const upgradeUserPlan/);
  assert.doesNotMatch(plansSource, /\bupgradePlan\s*\(/);
});

test("reusable email-based tester plan administration remains internal", () => {
  assert.match(
    testerPlansSource,
    /export const grantTesterPlanByEmail = internalMutation/
  );
  assert.match(
    testerPlansSource,
    /export const revokeTesterPlanByEmail = internalMutation/
  );
  assert.match(testerPlansSource, /refreshUserPlanFromBilling/);
});
