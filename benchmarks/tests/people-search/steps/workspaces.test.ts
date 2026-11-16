import assert from "node:assert/strict";
import test from "node:test";
import type { RecordedRunCosts } from "../../../core/execution/convex";
import { BudgetStop } from "../../../core/execution/spend";
import { workspaceBudgetCheck } from "../../../people-search/steps/workspaces";
import { fakeDeployment } from "../../execution/fakeDeployment";

// Synthetic accounts and records only.
const accounts = {
  deployment: { accountId: "openrouter:a" },
  x: { accountId: "socialapi:b" },
  linkedIn: { accountId: "renidly:c" },
};
const approved: Record<string, number> = {
  "socialapi:b": 0.5,
  "renidly:c": 300,
};
const workspace = { workspaceId: "w1", createdAt: 1_000, label: "run-1" };
const costs = (usd: number): RecordedRunCosts => ({
  providers: { socialapi: { usd, requests: 1, billableUnits: 1 } },
  llmUsdRecorded: 0,
  llmCallsRecorded: 0,
  capped: false,
});
const linkdApi = (billableUnits: number) => ({
  billableUnits,
  successes: billableUnits,
  events: billableUnits,
  capped: false,
});

function setup(recorded: { x: number; linkedIn: number } | "unreadable") {
  const checked: string[][] = [];
  const failing = () => {
    throw new Error("unreadable");
  };
  const { driver } = fakeDeployment(
    {},
    recorded === "unreadable"
      ? {
          "benchmarkPeopleSearch:runCosts": failing,
          "benchmarkPeopleSearch:linkdApiUnitsSince": failing,
        }
      : {
          "benchmarkPeopleSearch:runCosts": () => costs(recorded.x),
          "benchmarkPeopleSearch:linkdApiUnitsSince": () =>
            linkdApi(recorded.linkedIn),
        }
  );
  const budget = {
    check: async (ids?: readonly string[]) => {
      checked.push([...(ids ?? [])]);
    },
    checkRecorded: (use: Readonly<Record<string, number>>) => {
      for (const [id, limit] of Object.entries(approved))
        if ((use[id] ?? 0) >= limit)
          throw new BudgetStop(`${id} reached its approved amount.`);
    },
  };
  return { driver, budget, checked };
}

test("before the workspace exists, only the deployment key is checked", async () => {
  const { driver, budget, checked } = setup({ x: 9, linkedIn: 9_999 });
  const check = workspaceBudgetCheck({ driver, ...accounts }, budget, [], 3);
  await check(null);
  assert.deepEqual(checked, [["openrouter:a"]]);
});

test("LinkedIn units past the approval stop the workspace, counting earlier workspaces", async () => {
  const { driver, budget } = setup({ x: 0.1, linkedIn: 120 });
  const earlier = [{ recorded: { costs: null, linkdApi: linkdApi(200) } }];
  await assert.rejects(
    workspaceBudgetCheck(
      { driver, ...accounts },
      budget,
      earlier,
      3
    )(workspace),
    (error: unknown) =>
      error instanceof BudgetStop && /renidly:c/.test(error.message)
  );
  // Within the approval, the check passes.
  await workspaceBudgetCheck({ driver, ...accounts }, budget, [], 3)(workspace);
});

test("X use past the approval stops the workspace", async () => {
  const { driver, budget } = setup({ x: 0.6, linkedIn: 0 });
  await assert.rejects(
    workspaceBudgetCheck({ driver, ...accounts }, budget, [], 3)(workspace),
    (error: unknown) =>
      error instanceof BudgetStop && /socialapi:b/.test(error.message)
  );
});

test("records unreadable for several checks in a row stop the workspace", async () => {
  const { driver, budget } = setup("unreadable");
  const check = workspaceBudgetCheck({ driver, ...accounts }, budget, [], 3);
  await check(workspace);
  await check(workspace);
  await assert.rejects(
    check(workspace),
    (error: unknown) =>
      error instanceof BudgetStop && /3 times in a row/.test(error.message)
  );
});
