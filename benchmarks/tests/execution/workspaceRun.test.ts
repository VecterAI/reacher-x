import assert from "node:assert/strict";
import test from "node:test";
import type { BenchmarkWorkspace, RunStatus } from "../../core/convex";
import { BudgetStop } from "../../core/spend";
import {
  WorkspaceRunError,
  cycleMeasurements,
  cycleOfProspect,
  runWorkspace,
  type WorkspaceHooks,
  type WorkspacePlan,
} from "../../core/workspaceRun";
import { fakeClock, fakeDeployment, status } from "./fakeDeployment";

// Synthetic statuses and spend only.
const T = 1_000_000;
const POLL = 30_000;
const options = {
  pollMs: POLL,
  settlePolls: 2,
  startTimeoutMs: 600_000,
  maxCycleMs: 5_400_000,
  scheduledGapMs: 600_000,
  spendSettleMs: 60_000,
  maxPollFailures: 3,
};
const plan: WorkspacePlan = {
  label: "run-1_6_on",
  userId: "u1",
  prompt: "Synthetic prompt",
  useCaseKey: "sales",
  learning: "on",
  cycles: 2,
};

function scripted(statuses: NonNullable<RunStatus>[]) {
  let index = 0;
  return () => statuses[Math.min(index++, statuses.length - 1)];
}

function hooks(spend: number[] = [], budget: () => void = () => undefined) {
  const tracked: (string | null)[] = [];
  const readings = [...spend];
  const value: WorkspaceHooks = {
    readSpendUsd: async () => readings.shift() ?? null,
    checkBudget: async () => budget(),
    track: async (workspace: BenchmarkWorkspace | null) => {
      tracked.push(workspace?.workspaceId ?? null);
    },
  };
  return { value, tracked };
}

const round = (value: number | null) =>
  value === null ? null : Math.round(value * 100) / 100;

test("two cycles: automatic cycles stop at the last one, and the run waits for qualification and lessons", async () => {
  const wf2Start = T + 6 * POLL - 10_000;
  const deployment = fakeDeployment(
    { PROSPECTING_AUTO_RESCHEDULE: "0" },
    {
      "benchmarkPeopleSearch:runStatus": scripted([
        status(),
        status({
          workflowId: "wf1",
          workflowState: "inProgress",
          workflowStartedAt: T + 20_000,
        }),
        status({ workflowId: "wf1", workflowState: "inProgress" }),
        status({
          workflowId: "wf1",
          workflowState: "completed",
          nextRunAt: wf2Start,
          counts: { total: 5, pending: 3 },
        }),
        status({
          workflowId: "wf1",
          workflowState: "completed",
          counts: { total: 5 },
        }),
        status({
          workflowId: "wf1",
          workflowState: "completed",
          counts: { total: 5 },
        }),
        status({
          workflowId: "wf2",
          workflowState: "inProgress",
          workflowStartedAt: wf2Start,
          counts: { total: 5 },
        }),
        status({
          workflowId: "wf2",
          workflowState: "completed",
          counts: { total: 9, pending: 2 },
          pendingLessonWrites: 1,
        }),
        status({
          workflowId: "wf2",
          workflowState: "completed",
          counts: { total: 9 },
        }),
        status({
          workflowId: "wf2",
          workflowState: "completed",
          counts: { total: 9 },
        }),
      ]),
    }
  );
  // Before submit, before start, first cycle seen, second cycle seen, after.
  const { value, tracked } = hooks([0, 0.05, 0.06, 0.4, 0.75]);
  const record = await runWorkspace(
    deployment.driver,
    plan,
    value,
    options,
    fakeClock(T)
  );

  assert.equal(record.ending, "planned-cycles");
  assert.deepEqual(tracked, ["w1", null]);
  assert.equal(deployment.env.get("PROSPECTING_AUTO_RESCHEDULE"), "0");
  const autoWrites = deployment.calls
    .filter(
      (call) =>
        call.args[2] === "PROSPECTING_AUTO_RESCHEDULE" && call.args[1] === "set"
    )
    .map((call) => call.stdin);
  assert.deepEqual(autoWrites, ["1\n", "0\n"]);
  const functions = deployment.functionCalls();
  assert.equal(
    functions.filter(
      (name) => name === "benchmarkPeopleSearch:cancelScheduledCycles"
    ).length,
    1
  );
  const stopAt = functions.indexOf("benchmarkPeopleSearch:stopRun");
  assert.ok(stopAt >= 0);
  assert.ok(
    stopAt < functions.indexOf("benchmarkPeopleSearch:exportCandidates")
  );

  const measured = cycleMeasurements("6", record).map((cycle) => ({
    ...cycle,
    costUsd: round(cycle.costUsd),
  }));
  assert.deepEqual(measured, [
    // Includes the workspace's setup; settled 100 s after it started.
    { taskId: "6", cycle: 1, costUsd: 0.4, activeMs: 100_000, gapMs: 150_000 },
    // The last cycle's period runs to when the next was due.
    {
      taskId: "6",
      cycle: 2,
      costUsd: 0.35,
      activeMs: T + 8 * POLL - wf2Start,
      gapMs: T + 7 * POLL + 600_000 - wf2Start,
    },
  ]);
});

test("a cycle beyond the plan is recorded and the workspace stopped at once", async () => {
  const deployment = fakeDeployment(
    {},
    {
      "benchmarkPeopleSearch:runStatus": scripted([
        status({
          workflowId: "wf1",
          workflowState: "inProgress",
          workflowStartedAt: T,
        }),
        status({ workflowId: "wf1", workflowState: "completed" }),
        status({
          workflowId: "wf2",
          workflowState: "inProgress",
          workflowStartedAt: T + 2 * POLL,
        }),
      ]),
    }
  );
  const record = await runWorkspace(
    deployment.driver,
    { ...plan, cycles: 1 },
    hooks().value,
    options,
    fakeClock(T)
  );
  assert.equal(record.ending, "extra-cycle");
  assert.equal(record.cycles.length, 2);
  assert.equal(record.cycles[0].nextStartObserved, true);
  assert.ok(
    deployment.functionCalls().includes("benchmarkPeopleSearch:stopRun")
  );
});

test("a failed cycle or a halted workspace ends the run with the reason recorded", async () => {
  const failed = fakeDeployment(
    {},
    {
      "benchmarkPeopleSearch:runStatus": scripted([
        status({
          workflowId: "wf1",
          workflowState: "inProgress",
          workflowStartedAt: T,
        }),
        status({
          workflowId: "wf1",
          workflowState: "failed",
          workspaceStatus: "stopped",
        }),
      ]),
    }
  );
  const first = await runWorkspace(
    failed.driver,
    plan,
    hooks().value,
    options,
    fakeClock(T)
  );
  assert.equal(first.ending, "cycle-failed");
  assert.match(first.detail!, /ended as failed/);

  const halted = fakeDeployment(
    {},
    {
      "benchmarkPeopleSearch:runStatus": scripted([
        status({
          workflowId: "wf1",
          workflowState: "inProgress",
          workflowStartedAt: T,
        }),
        status({
          workflowId: "wf1",
          workflowState: "completed",
          workspaceStatus: "limit_reached",
        }),
      ]),
    }
  );
  const second = await runWorkspace(
    halted.driver,
    plan,
    hooks().value,
    options,
    fakeClock(T)
  );
  assert.equal(second.ending, "workspace-halted");
  assert.match(second.detail!, /limit_reached/);
});

test("a budget stop or an interruption still stops, measures and exports the workspace", async () => {
  let polls = 0;
  const budget = fakeDeployment(
    {},
    {
      "benchmarkPeopleSearch:runStatus": () =>
        status({
          workflowId: "wf1",
          workflowState: "inProgress",
          workflowStartedAt: T,
        }),
    }
  );
  const { value, tracked } = hooks([], () => {
    if (++polls === 3)
      throw new BudgetStop("openrouter:abc reached its approved amount.");
  });
  const stopped = await runWorkspace(
    budget.driver,
    plan,
    value,
    options,
    fakeClock(T)
  );
  assert.equal(stopped.ending, "budget-stop");
  assert.deepEqual(tracked, ["w1", null]);
  assert.ok(
    budget.functionCalls().includes("benchmarkPeopleSearch:exportCandidates")
  );

  const controller = new AbortController();
  const interrupted = fakeDeployment(
    {},
    {
      "benchmarkPeopleSearch:runStatus": () => {
        controller.abort();
        return status();
      },
    }
  );
  const record = await runWorkspace(
    interrupted.driver,
    plan,
    hooks().value,
    { ...options, signal: controller.signal },
    fakeClock(T)
  );
  assert.equal(record.ending, "interrupted");
  assert.ok(
    interrupted.functionCalls().includes("benchmarkPeopleSearch:stopRun")
  );
});

test("learning off names only this workspace, and one cycle never turns automatic cycles on", async () => {
  const deployment = fakeDeployment(
    {},
    {
      "benchmarkPeopleSearch:runStatus": scripted([
        status({
          workflowId: "wf1",
          workflowState: "inProgress",
          workflowStartedAt: T,
        }),
        status({ workflowId: "wf1", workflowState: "completed" }),
        status({ workflowId: "wf1", workflowState: "completed" }),
      ]),
    }
  );
  let learningAtStart: string | undefined;
  const calls = deployment.calls;
  const record = await runWorkspace(
    deployment.driver,
    { ...plan, learning: "off", cycles: 1 },
    {
      ...hooks().value,
      checkBudget: async () => {
        learningAtStart ??= deployment.env.get(
          "BENCHMARK_LEARNING_OFF_WORKSPACE_IDS"
        );
      },
    },
    options,
    fakeClock(T)
  );
  assert.equal(record.ending, "planned-cycles");
  assert.equal(learningAtStart, "w1");
  const autoSet = calls.findIndex(
    (call) => call.args[2] === "PROSPECTING_AUTO_RESCHEDULE"
  );
  const start = calls.findIndex(
    (call) => call.args[1] === "benchmarkPeopleSearch:startWorkspace"
  );
  assert.ok(autoSet >= 0 && autoSet < start);
  assert.equal(calls[autoSet].stdin, "0\n");
});

test("a workspace created by a failed prepare call is recovered, not created twice", async () => {
  let prepares = 0;
  const deployment = fakeDeployment(
    {},
    {
      "benchmarkPeopleSearch:prepareWorkspace": () => {
        prepares += 1;
        throw new Error("timeout");
      },
      "benchmarkPeopleSearch:findRunWorkspace": () => ({
        workspaceId: "w7",
        createdAt: 5,
      }),
      "benchmarkPeopleSearch:runStatus": scripted([
        status({
          workflowId: "wf1",
          workflowState: "completed",
          workflowStartedAt: T,
        }),
      ]),
    }
  );
  const record = await runWorkspace(
    deployment.driver,
    { ...plan, cycles: 1 },
    hooks().value,
    options,
    fakeClock(T)
  );
  assert.equal(prepares, 1);
  assert.equal(record.workspace.workspaceId, "w7");
});

test("another active workspace stops the run before anything is created", async () => {
  const deployment = fakeDeployment(
    {},
    {
      "benchmarkPeopleSearch:deploymentActivity": () => ({
        workspaceIds: ["w9"],
        truncated: false,
      }),
    }
  );
  await assert.rejects(
    runWorkspace(deployment.driver, plan, hooks().value, options, fakeClock(T)),
    (error: unknown) =>
      error instanceof WorkspaceRunError && /w9/.test(error.message)
  );
  assert.deepEqual(deployment.functionCalls(), [
    "benchmarkPeopleSearch:deploymentActivity",
  ]);
});

test("prospects are placed in the cycle that was running when they were found", () => {
  const cycles = [1_000, 5_000].map((startedAt, index) => ({
    cycle: index + 1,
    workflowId: `wf${index + 1}`,
    startedAt,
    discoveryEndedAt: null,
    outcome: null,
    settledAt: null,
    nextStartAt: null,
    nextStartObserved: false,
    spendAtStartUsd: null,
    spendAtEndUsd: null,
  }));
  const cycleOf = cycleOfProspect(cycles);
  assert.deepEqual(
    [500, 1_000, 4_999, 5_000, 9_000].map((createdAt) =>
      cycleOf({ createdAt })
    ),
    [null, 1, 1, 2, 2]
  );
});

test("a stopping step or a spent budget creates nothing, and a failed start still stops and exports", async () => {
  const aborted = fakeDeployment({});
  await assert.rejects(
    runWorkspace(
      aborted.driver,
      plan,
      hooks().value,
      { ...options, signal: AbortSignal.abort() },
      fakeClock(T)
    )
  );
  const overBudget = fakeDeployment({});
  await assert.rejects(
    runWorkspace(
      overBudget.driver,
      plan,
      hooks([], () => {
        throw new BudgetStop("over");
      }).value,
      options,
      fakeClock(T)
    ),
    BudgetStop
  );
  for (const { functionCalls } of [aborted, overBudget])
    assert.ok(
      !functionCalls().includes("benchmarkPeopleSearch:prepareWorkspace")
    );

  const failedStart = fakeDeployment(
    {},
    {
      "benchmarkPeopleSearch:startWorkspace": () => {
        throw new Error("cli");
      },
    }
  );
  const record = await runWorkspace(
    failedStart.driver,
    plan,
    hooks().value,
    options,
    fakeClock(T)
  );
  assert.equal(record.ending, "interrupted");
  assert.match(record.detail!, /start call failed/);
  const functions = failedStart.functionCalls();
  assert.ok(functions.includes("benchmarkPeopleSearch:stopRun"));
  assert.ok(functions.includes("benchmarkPeopleSearch:exportCandidates"));
});
