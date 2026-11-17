import assert from "node:assert/strict";
import test from "node:test";
import type {
  BenchmarkWorkspace,
  RunStatus,
} from "../../core/execution/convex";
import { BudgetStop } from "../../core/execution/spend";
import {
  WorkspaceRunError,
  cycleMeasurements,
  cycleOfProspect,
  resumeProblem,
  resumeWorkspace,
  runWorkspace,
  type WorkspaceHooks,
  type WorkspacePlan,
  type WorkspaceRunRecord,
} from "../../core/execution/workspaceRun";
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

test("the budget check gets the workspace once it exists, and a stop there ends the run", async () => {
  const seen: (string | null)[] = [];
  const deployment = fakeDeployment(
    { PROSPECTING_AUTO_RESCHEDULE: "0" },
    {
      "benchmarkPeopleSearch:runStatus": scripted([
        status({ workflowId: "wf1", workflowState: "inProgress" }),
      ]),
    }
  );
  const record = await runWorkspace(
    deployment.driver,
    { ...plan, cycles: 1 },
    {
      ...hooks().value,
      checkBudget: async (workspace) => {
        seen.push(workspace?.workspaceId ?? null);
        if (seen.length === 4)
          throw new BudgetStop("renidly:abc reached its approved credits.");
      },
    },
    options,
    fakeClock(T)
  );
  assert.deepEqual(seen, [null, "w1", "w1", "w1"]);
  assert.equal(record.ending, "budget-stop");
  assert.match(record.detail ?? "", /renidly:abc/);
  assert.ok(
    deployment.functionCalls().includes("benchmarkPeopleSearch:stopRun")
  );
});

/** The arguments of each call to one deployment function. */
const argsOf = (
  deployment: ReturnType<typeof fakeDeployment>,
  name: string
): Record<string, unknown>[] =>
  deployment.calls
    .filter((call) => call.args[0] === "run" && call.args[1] === name)
    .map((call) => JSON.parse(call.args[2] ?? "{}"));

test("a budget stop sets the LinkedIn kill switch before a stop that cancels running prospect work; a planned end does not", async () => {
  const budget = fakeDeployment(
    {},
    {
      "benchmarkPeopleSearch:runStatus": () =>
        status({ workflowId: "wf1", workflowState: "inProgress" }),
    }
  );
  let polls = 0;
  await runWorkspace(
    budget.driver,
    { ...plan, cycles: 1 },
    hooks([], () => {
      if (++polls === 3) throw new BudgetStop("renidly:abc reached it.");
    }).value,
    options,
    fakeClock(T)
  );
  const switched = budget.calls.findIndex(
    (call) =>
      call.args.join(" ") === "env set BENCHMARK_HALTED_WORKSPACE_ID" &&
      call.stdin === "w1\n"
  );
  const stopped = budget.calls.findIndex(
    (call) => call.args[1] === "benchmarkPeopleSearch:stopRun"
  );
  assert.ok(switched >= 0 && stopped > switched);
  assert.deepEqual(argsOf(budget, "benchmarkPeopleSearch:stopRun"), [
    { workspaceId: "w1", halt: true },
  ]);

  const planned = fakeDeployment(
    { PROSPECTING_AUTO_RESCHEDULE: "0" },
    {
      "benchmarkPeopleSearch:runStatus": scripted([
        status({ workflowId: "wf1", workflowState: "inProgress" }),
        status({ workflowId: "wf1", workflowState: "completed" }),
        status({ workflowId: "wf1", workflowState: "completed" }),
        status({ workflowId: "wf1", workflowState: "completed" }),
      ]),
    }
  );
  const record = await runWorkspace(
    planned.driver,
    { ...plan, cycles: 1 },
    hooks().value,
    options,
    fakeClock(T)
  );
  assert.equal(record.ending, "planned-cycles");
  assert.equal(planned.env.has("BENCHMARK_HALTED_WORKSPACE_ID"), false);
  assert.deepEqual(argsOf(planned, "benchmarkPeopleSearch:stopRun"), [
    { workspaceId: "w1" },
  ]);
});

// A one-cycle workspace the guard stopped mid-qualification, as recorded then.
const STOPPED_AT = T + 40 * 60_000;
const heldRecord: WorkspaceRunRecord = {
  label: "run-1_14_on",
  workspace: { workspaceId: "w1", createdAt: T - 60_000, label: "run-1_14_on" },
  learning: "on",
  plannedCycles: 1,
  submittedAt: T - 70_000,
  startedAt: T,
  endedAt: STOPPED_AT,
  ending: "budget-stop",
  detail: "renidly:abc reached its approved credits.",
  cycles: [
    {
      cycle: 1,
      workflowId: "wf1",
      startedAt: T + 3_000,
      discoveryEndedAt: null,
      outcome: null,
      settledAt: null,
      nextStartAt: null,
      nextStartObserved: false,
      spendAtStartUsd: 1.0,
      spendAtEndUsd: 2.2,
    },
  ],
  spend: { atSubmitUsd: 0.9, beforeStartUsd: 1.0, afterUsd: 2.2 },
  recorded: {
    costs: null,
    linkdApi: {
      billableUnits: 472,
      successes: 472,
      events: 496,
      capped: false,
    },
  },
  stop: {
    stopped: true,
    cancelFailed: false,
    monitorsDeleted: 0,
    monitorFailures: [],
  },
  prospects: [],
};

test("a held workspace continues its own cycle: no discovery, the pause left out of active time, spend combined", async () => {
  const RESUME_AT = STOPPED_AT + 24 * 3_600_000;
  const deployment = fakeDeployment(
    { PROSPECTING_AUTO_RESCHEDULE: "1" },
    {
      "benchmarkPeopleSearch:runStatus": scripted([
        // Before the resume: paused at the stopped cycle.
        status({
          workspaceStatus: "paused",
          workflowId: "wf1",
          workflowState: "canceled",
          counts: { total: 443, pending: 131, qualified: 235 },
        }),
        status({
          workflowId: "wf1",
          workflowState: "canceled",
          counts: { total: 443, pending: 60, enrichmentWaiting: 235 },
        }),
        status({
          workflowId: "wf1",
          workflowState: "canceled",
          counts: { total: 443, enrichmentWaiting: 12 },
          pendingLessonWrites: 40,
        }),
        status({
          workflowId: "wf1",
          workflowState: "canceled",
          counts: { total: 443 },
        }),
        status({
          workflowId: "wf1",
          workflowState: "canceled",
          counts: { total: 443 },
        }),
      ]),
      "benchmarkPeopleSearch:linkdApiUnitsSince": () => ({
        billableUnits: 900,
        successes: 900,
        events: 950,
        capped: false,
      }),
    }
  );
  // At the resume, then after.
  const { value, tracked } = hooks([2.3, 3.1]);
  const record = await resumeWorkspace(
    deployment.driver,
    heldRecord,
    value,
    options,
    fakeClock(RESUME_AT)
  );
  assert.equal(record.ending, "planned-cycles");
  assert.deepEqual(tracked, ["w1", null]);
  // Automatic cycles off before the resume, and nothing that starts discovery.
  assert.equal(deployment.env.get("PROSPECTING_AUTO_RESCHEDULE"), "0");
  const functions = deployment.functionCalls();
  for (const name of [
    "benchmarkPeopleSearch:prepareWorkspace",
    "benchmarkPeopleSearch:startWorkspace",
  ])
    assert.ok(!functions.includes(name));
  assert.deepEqual(
    argsOf(deployment, "benchmarkPeopleSearch:resumeHeldWorkspace"),
    [{ workspaceId: "w1", workflowId: "wf1" }]
  );
  // Settled normally, so a plain stop.
  assert.deepEqual(argsOf(deployment, "benchmarkPeopleSearch:stopRun"), [
    { workspaceId: "w1" },
  ]);

  const [cycle] = record.cycles;
  assert.equal(record.cycles.length, 1);
  assert.equal(cycle.pausedMs, RESUME_AT - STOPPED_AT);
  assert.equal(cycle.outcome, "canceled");
  assert.equal(cycle.spendAtEndUsd, 3.1);
  const [measured] = cycleMeasurements("p14", record);
  // Active: the cycle's start to the stop, then the resume to the first of
  // the two quiet polls (two polls after it).
  assert.equal(measured.activeMs, STOPPED_AT - (T + 3_000) + 2 * POLL);
  // Combined cost: the whole cycle on the key, with setup.
  assert.equal(round(measured.costUsd), round(3.1 - 0.9));
  assert.deepEqual(record.spend, {
    atSubmitUsd: 0.9,
    beforeStartUsd: 1.0,
    afterUsd: 3.1,
  });
  assert.equal(record.recorded.linkdApi?.billableUnits, 900);
  assert.equal(record.resumed?.length, 1);
  const [resumed] = record.resumed!;
  assert.equal(resumed.after, "budget-stop");
  assert.equal(resumed.discoveryCompleted, false);
  assert.deepEqual(resumed.spend, {
    atStopUsd: 2.2,
    atResumeUsd: 2.3,
    afterUsd: 3.1,
  });
  assert.equal(resumed.recordedAtStop.linkdApi?.billableUnits, 472);
  assert.equal(resumed.stoppedAt, STOPPED_AT);
  assert.equal(resumed.resumedAt, RESUME_AT);
});

test("a continuation that sees a new discovery cycle, or reaches the budget, stops at once", async () => {
  const paused = status({
    workspaceStatus: "paused",
    workflowId: "wf1",
    workflowState: "canceled",
  });
  const extra = fakeDeployment(
    {},
    {
      "benchmarkPeopleSearch:runStatus": scripted([
        paused,
        status({ workflowId: "wf2", workflowState: "inProgress" }),
      ]),
    }
  );
  const record = await resumeWorkspace(
    extra.driver,
    heldRecord,
    hooks().value,
    options,
    fakeClock(T)
  );
  assert.equal(record.ending, "extra-cycle");
  assert.equal(
    extra
      .functionCalls()
      .filter((name) => name === "benchmarkPeopleSearch:stopRun").length,
    1
  );

  let checks = 0;
  const budget = fakeDeployment(
    {},
    {
      "benchmarkPeopleSearch:runStatus": scripted([
        paused,
        status({
          workflowId: "wf1",
          workflowState: "canceled",
          counts: { pending: 5 },
        }),
      ]),
    }
  );
  const stopped = await resumeWorkspace(
    budget.driver,
    heldRecord,
    hooks([], () => {
      if (++checks === 4) throw new BudgetStop("renidly:abc reached it again.");
    }).value,
    options,
    fakeClock(T)
  );
  assert.equal(stopped.ending, "budget-stop");
  assert.equal(stopped.resumed?.[0].ending, "budget-stop");
  // Still resumable: a second continuation would take over from here.
  assert.equal(resumeProblem(stopped), null);
  assert.deepEqual(argsOf(budget, "benchmarkPeopleSearch:stopRun"), [
    { workspaceId: "w1", halt: true },
  ]);
  assert.equal(budget.env.get("BENCHMARK_HALTED_WORKSPACE_ID"), "w1");
});

test("only a stopped last cycle is continued, and never while its discovery is running or over budget", async () => {
  assert.match(
    resumeProblem({ ...heldRecord, ending: "timed-out" }) ?? "",
    /only a budget stop, an interruption or unreadable status/
  );
  assert.equal(
    resumeProblem({ ...heldRecord, ending: "status-unreadable" }),
    null
  );
  assert.match(
    resumeProblem({
      ...heldRecord,
      stop: { ...heldRecord.stop, monitorFailures: ["m1"] },
    }) ?? "",
    /not confirmed stopped/
  );
  assert.match(
    resumeProblem({ ...heldRecord, plannedCycles: 2 }) ?? "",
    /cycle 1 of 2/
  );
  assert.match(
    resumeProblem({ ...heldRecord, cycles: [] }) ?? "",
    /never started/
  );

  // Discovery still running: refused before anything is resumed.
  const running = fakeDeployment(
    {},
    {
      "benchmarkPeopleSearch:runStatus": () =>
        status({ workflowId: "wf1", workflowState: "inProgress" }),
    }
  );
  await assert.rejects(
    resumeWorkspace(
      running.driver,
      heldRecord,
      hooks().value,
      options,
      fakeClock(T)
    ),
    WorkspaceRunError
  );
  assert.ok(
    !running
      .functionCalls()
      .includes("benchmarkPeopleSearch:resumeHeldWorkspace")
  );

  // Over budget already: nothing changes on the deployment.
  const spent = fakeDeployment({});
  await assert.rejects(
    resumeWorkspace(
      spent.driver,
      heldRecord,
      hooks([], () => {
        throw new BudgetStop("renidly:abc reached its approved credits.");
      }).value,
      options,
      fakeClock(T)
    ),
    BudgetStop
  );
  assert.deepEqual(spent.functionCalls(), [
    "benchmarkPeopleSearch:deploymentActivity",
  ]);
  assert.ok(!spent.calls.some((call) => call.args[1] === "set"));
});
