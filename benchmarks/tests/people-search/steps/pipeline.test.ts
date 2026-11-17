import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { syntheticDependencies } from "../../../people-search/dryRun/dryRun";
import { FileCheckpointStore } from "../../../core/execution/checkpoints";
import {
  accountUse,
  budgetBaselineSchema,
  type AccountReader,
} from "../../../core/steps/balances";
import { peopleSearchRates } from "../../../people-search/setup/rates";
import {
  segmentSchedule,
  type SegmentId,
} from "../../../people-search/setup/schedule";
import {
  DEFAULT_KEYWORD_POST_SEARCH_CALLS,
  runStep,
  segmentApprovalSchema,
  segmentRunId,
  type StepDependencies,
} from "../../../people-search/steps/pipeline";
import { workspaceCosts } from "../../../people-search/steps/reports";

const rates = () => peopleSearchRates("2026-11-15T00:00:00.000Z");

// Synthetic deployment, providers, judges and data only; nothing leaves the process.
async function setup(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "reacherx-pipeline-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const controller = new AbortController();
  // Deployment calls and model calls, in order.
  const timeline: string[] = [];
  const built = await syntheticDependencies(root, {
    signal: controller.signal,
    log: () => undefined,
    observe: (call) => timeline.push(call),
  });
  const deps: StepDependencies = {
    ...built.deps,
    judgeCall: async (model, input) => {
      timeline.push("model judge");
      return built.deps.judgeCall(model, input);
    },
    providerCalls: async (work) => {
      const calls = await built.deps.providerCalls(work);
      return {
        transport: calls.transport,
        call: async (step, model, request) => {
          timeline.push("model harness");
          return calls.call(step, model, request);
        },
      };
    },
  };
  return {
    root,
    deps,
    timeline,
    controller,
    synthetic: built.synthetic,
    env: built.deploymentEnv,
    atRest: Object.fromEntries(built.deploymentEnv),
  };
}

const changes = (timeline: readonly string[]) =>
  timeline.filter((call) => /^env (set|remove)/.test(call));

test("the smoke step runs every phase, resets the deployment, and a rerun only re-renders", async (t) => {
  const { root, deps, timeline, env, atRest } = await setup(t);
  const { outcome, report, decision, files } = await runStep("smoke", deps);
  assert.equal(outcome.status, "complete");
  assert.equal(outcome.workspaces.length, 1);
  assert.equal(outcome.competitors.length, 8);
  assert.ok(outcome.cases.some((item) => item.toolId === "reacherx"));
  assert.ok(outcome.cases.some((item) => item.kind === "rejected"));
  assert.equal(outcome.decision?.point, "D1");
  assert.match(report, /## Verified matches in each tool's top 5/);
  assert.match(decision ?? "", /# D1 checkpoint/);
  // The keyword post-search cap was on during the workspace, reported, and
  // cleared after.
  assert.equal(outcome.settings?.keywordPostSearchLimit, 50);
  assert.match(
    report,
    /Keyword post-search cap: in force for this step, at most 50/
  );
  assert.ok(timeline.includes("env set BENCHMARK_KEYWORD_POST_SEARCH_LIMIT"));
  assert.equal(env.has("BENCHMARK_KEYWORD_POST_SEARCH_LIMIT"), false);
  assert.deepEqual(Object.fromEntries(env), atRest);
  assert.match(
    await readFile(join(root, files[1]), "utf8"),
    /# Step smoke: complete/
  );

  // No judge or harness model call while the workspace ran.
  const prepared = timeline.indexOf(
    "run benchmarkPeopleSearch:prepareWorkspace"
  );
  const stopped = timeline.indexOf("run benchmarkPeopleSearch:stopRun");
  assert.ok(prepared >= 0 && stopped > prepared);
  assert.ok(
    !timeline.slice(prepared, stopped).some((call) => call.startsWith("model"))
  );
  assert.ok(timeline.slice(stopped).includes("model judge"));

  // Nothing left to do: no approval, deployment, provider or model is needed.
  timeline.length = 0;
  const unavailable = async () => {
    throw new Error("Not available on a rerun.");
  };
  const again = await runStep("smoke", {
    ...deps,
    readApproval: async () => null,
    judgeCall: unavailable,
    providerCalls: unavailable,
  });
  assert.equal(again.outcome.status, "complete");
  assert.equal(again.outcome.units.executed, 0);
  assert.equal(again.outcome.units.reused, outcome.units.executed);
  assert.deepEqual(timeline, []);
  assert.equal(
    again.report.split("\n").slice(4).join("\n"),
    report.split("\n").slice(4).join("\n")
  );
});

test("Ctrl+C mid-workspace resets the deployment; resuming never repeats started work", async (t) => {
  const { deps, timeline, controller, env, atRest } = await setup(t);
  let polls = 0;
  const interrupting: StepDependencies = {
    ...deps,
    driver: new Proxy(deps.driver, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (property !== "status" || typeof value !== "function") return value;
        return (...args: unknown[]) => {
          // Interrupt a few polls into the cycle.
          if (++polls === 5) controller.abort();
          return value.apply(target, args);
        };
      },
    }),
  };
  const first = await runStep("smoke", interrupting);
  assert.equal(first.outcome.status, "interrupted");
  assert.equal(first.outcome.decision, null);
  assert.match(first.outcome.review[0].reason, /ended early \(interrupted\)/);
  assert.ok(first.outcome.notReached > 0);
  assert.deepEqual(Object.fromEntries(env), atRest);
  assert.ok(timeline.includes("run benchmarkPeopleSearch:stopRun"));

  // Resume with a fresh signal; Exa fails this time and is held for review too.
  timeline.length = 0;
  let exaRequests = 0;
  const resumed = await runStep("smoke", {
    ...deps,
    signal: new AbortController().signal,
    providerCalls: async (work) => {
      const calls = await deps.providerCalls(work);
      return {
        ...calls,
        transport: async (request) => {
          const exchange = await calls.transport(request);
          if (!request.url.includes("exa.ai")) return exchange;
          exaRequests += 1;
          return {
            ...exchange,
            response: {
              status: 500,
              body: { error: "synthetic" },
              headers: {},
            },
          };
        },
      };
    },
  });
  assert.equal(resumed.outcome.status, "complete");
  // The interrupted workspace was not started again, so no live session opened.
  assert.ok(!timeline.includes("run benchmarkPeopleSearch:prepareWorkspace"));
  assert.deepEqual(changes(timeline), []);
  assert.deepEqual(resumed.outcome.review.map((item) => item.unitId).sort(), [
    "t-exa-p14",
    "w-p14-on",
  ]);
  assert.equal(exaRequests, 1);
  assert.equal(
    resumed.outcome.decision?.rows.find(
      (row) => row.condition === "Everything recorded correctly"
    )?.status,
    "fail"
  );

  // A third run repeats neither.
  const third = await runStep("smoke", {
    ...deps,
    signal: new AbortController().signal,
  });
  assert.equal(third.outcome.units.executed, 0);
  assert.equal(exaRequests, 1);
});

test("a step is refused before the deployment changes when a balance is below its approval", async (t) => {
  const { deps, timeline, synthetic } = await setup(t);
  // One dollar, in the cents SocialAPI reports.
  synthetic.socialApiCents = 100;
  const { outcome } = await runStep("smoke", deps);
  assert.equal(outcome.status, "budget-stop");
  assert.match(
    outcome.stopReason ?? "",
    /socialapi:\w+ has \$1\.00 available; the approval still needs \$25\.00/
  );
  assert.deepEqual(changes(timeline), []);
  assert.equal(outcome.units.executed, 0);
});

test("reaching the approved spend stops the step, and the reset still runs", async (t) => {
  const { deps, env, atRest } = await setup(t);
  const { outcome } = await runStep("smoke", {
    ...deps,
    readApproval: async (segment) => {
      const approval = await deps.readApproval(segment);
      return (
        approval && {
          ...approval,
          spend: {
            ...approval.spend,
            accountLimits: approval.spend.accountLimits.map((limit) =>
              limit.accountId.startsWith("openrouter:")
                ? { ...limit, maxAdditionalUsd: 0.1 }
                : limit
            ),
          },
        }
      );
    },
  });
  assert.equal(outcome.status, "budget-stop");
  assert.match(outcome.stopReason ?? "", /reached its approved amount/);
  assert.match(outcome.review[0].reason, /budget-stop/);
  assert.deepEqual(Object.fromEntries(env), atRest);
});

test("an outage holds only a few units for review, then halts the step", async (t) => {
  const { deps, env, atRest } = await setup(t);
  let judgeCalls = 0;
  const { outcome } = await runStep("smoke", {
    ...deps,
    judgeCall: async () => {
      judgeCalls += 1;
      throw new Error("Synthetic outage.");
    },
  });
  assert.equal(outcome.status, "halted");
  assert.match(outcome.stopReason ?? "", /3 unit\(s\) in a row failed/);
  assert.equal(outcome.review.length, 3);
  assert.ok(outcome.review.every((item) => item.unitId.startsWith("j-")));
  // Both primary judges run at once, so each failed unit made two calls.
  assert.equal(judgeCalls, 6);
  assert.ok(outcome.notReached > 0);
  assert.equal(outcome.competitors.length, 8);
  assert.deepEqual(Object.fromEntries(env), atRest);
});

test("X and LinkedIn cost come from the deployment's records, and a tool with no results is a row of zeros", async (t) => {
  const { root, deps } = await setup(t);
  const { outcome, report, files } = await runStep("smoke", {
    ...deps,
    // Exa answers with no results this time.
    providerCalls: async (work) => {
      const calls = await deps.providerCalls(work);
      return {
        ...calls,
        transport: async (request) => {
          const exchange = await calls.transport(request);
          return request.url.includes("exa.ai")
            ? {
                ...exchange,
                response: { ...exchange.response, body: { results: [] } },
              }
            : exchange;
        },
      };
    },
  });
  const aggregate = JSON.parse(
    await readFile(join(root, files[2]), "utf8")
  ) as {
    rows: { toolId: string; returned: number; verifiedMatches: number }[];
  };
  const exa = aggregate.rows.find((row) => row.toolId === "exa");
  assert.deepEqual([exa?.returned, exa?.verifiedMatches], [0, 0]);
  assert.match(report, /\| exa \| 1 \| 0 \| 0 \| no results \|/);
  const [workspace] = outcome.workspaces;
  const costs = workspaceCosts(workspace, rates());
  // 300 recorded tweets or users at $0.20 per 1,000.
  assert.equal(costs.xItems, 300);
  assert.equal(costs.xUsd?.toFixed(4), "0.0600");
  assert.equal(costs.linkedInCredits, 11);
  // Production also spends from the shared SocialAPI key, so its balance fell further.
  assert.ok((costs.xBalanceChange ?? 0) > (costs.xUsd ?? 0));
  const accounts = outcome.accounts!;
  assert.deepEqual(accounts.shared, [
    deps.accounts.socialApi.accountId,
    deps.accounts.renidly.accountId,
  ]);
  assert.equal(accounts.spent?.[deps.accounts.socialApi.accountId], undefined);
  assert.match(report, /shared with production/);
  assert.match(report, /300 items, \$0\.060/);
});

test("a failed closing balance read leaves costs incomplete until a rerun reads them", async (t) => {
  const { deps, timeline } = await setup(t);
  const treg = deps.accounts.treg;
  const first = await runStep("smoke", {
    ...deps,
    accounts: {
      ...deps.accounts,
      // Readable for the opening checks, unreadable once judging has started.
      treg: {
        ...treg,
        read: () =>
          timeline.includes("model judge")
            ? Promise.reject(new Error("Synthetic outage."))
            : treg.read(),
      },
    },
  });
  assert.equal(first.outcome.status, "complete");
  assert.equal(first.outcome.accounts?.end, null);
  assert.equal(first.outcome.stepUsd, null);
  const cost = first.outcome.decision?.rows.find((row) =>
    row.condition.startsWith("A cycle's cost")
  );
  assert.equal(cost?.status, "unknown");
  assert.equal(first.outcome.decision?.canContinue, false);
  assert.match(first.decision ?? "", /Spend this step: unknown/);
  assert.match(first.report, /closing balance read failed/);

  // A rerun has nothing left to run but reads the closing balances again.
  const again = await runStep("smoke", {
    ...deps,
    readApproval: async () => null,
  });
  assert.ok(again.outcome.accounts?.end);
  assert.equal(typeof again.outcome.stepUsd, "number");
  assert.equal(
    again.outcome.decision?.rows.find((row) =>
      row.condition.startsWith("A cycle's cost")
    )?.status,
    "pass"
  );
});

test("a segment whose closing balances were not read is selected again before its step moves on", async (t) => {
  const { root, deps, timeline } = await setup(t);
  // Earlier steps stand in as finished outcomes; main's closing read failed at first.
  const earlier = async (segment: SegmentId, end: null | []) => {
    const store = new FileCheckpointStore(
      root,
      segmentRunId(deps.frozen.planSha256, segment)
    );
    await store.withLock(() =>
      store.writePrivate(
        store.runFile("outcome.json"),
        JSON.stringify({
          segment,
          runId: store.runId,
          status: "complete",
          stopReason: null,
          settings: null,
          stage2: null,
          units: { executed: 0, reused: 0 },
          workspaces: [],
          translations: [],
          competitors: [],
          cases: [],
          review: [],
          notReached: 0,
          accounts:
            end === null
              ? {
                  start: [],
                  end: null,
                  spent: null,
                  balanceChange: null,
                  shared: [],
                }
              : null,
          labels: null,
          decision: null,
          stepUsd: end === null ? null : 0,
        })
      )
    );
  };
  await earlier("smoke", []);
  await earlier("pilot", []);
  await earlier("main", null);
  await assert.rejects(
    runStep("stage2", deps),
    /closing balances of main were not read.*pnpm benchmark --live main again/
  );
  await earlier("main", []);

  // Every closing read fails once the first third's workspaces have all stopped.
  const workspaces = segmentSchedule("stage2-first", {
    runId: "x",
    seed: deps.frozen.seed,
    stage2: { staticPrompts: 2, cyclesPerWorkspace: 5 },
  }).workspaces.length;
  const stopped = () =>
    timeline.filter((call) => call === "run benchmarkPeopleSearch:stopRun")
      .length;
  const failing = <Account extends AccountReader>(
    account: Account
  ): Account => ({
    ...account,
    read: () =>
      stopped() >= workspaces
        ? Promise.reject(new Error("Synthetic outage."))
        : account.read(),
  });
  const first = await runStep("stage2", {
    ...deps,
    accounts: {
      ...deps.accounts,
      deployment: failing(deps.accounts.deployment),
      socialApi: failing(deps.accounts.socialApi),
      renidly: failing(deps.accounts.renidly),
    },
  });
  assert.equal(first.outcome.segment, "stage2-first");
  assert.equal(first.outcome.status, "complete");
  assert.equal(first.outcome.accounts?.end, null);

  // Rerun: the same part again, reusing every unit and only reading the balances.
  const again = await runStep("stage2", deps);
  assert.equal(again.outcome.segment, "stage2-first");
  assert.equal(again.outcome.units.executed, 0);
  assert.ok(again.outcome.accounts?.end);

  // Now finished, so the step moves on to the rest (stopped at once here).
  const stoppedSignal = new AbortController();
  stoppedSignal.abort();
  const next = await runStep("stage2", {
    ...deps,
    signal: stoppedSignal.signal,
  });
  assert.equal(next.outcome.segment, "stage2-rest");
});

test("a step that stopped before writing its outcome still reads its closing balances", async (t) => {
  const { root, deps } = await setup(t);
  const { files } = await runStep("smoke", deps);
  // The process died after the last unit's checkpoint, before outcome.json.
  await rm(join(root, files[0]));
  const unavailable = async () => {
    throw new Error("Not available on a rerun.");
  };
  const rerun = await runStep("smoke", {
    ...deps,
    readApproval: async () => null,
    judgeCall: unavailable,
    providerCalls: unavailable,
  });
  assert.equal(rerun.outcome.units.executed, 0);
  assert.ok(rerun.outcome.accounts?.end?.length);
  assert.ok(rerun.outcome.accounts?.start.length);

  // An outcome without a closing summary, after paid work, is not finished.
  const store = new FileCheckpointStore(root, rerun.outcome.runId);
  await store.withLock(() =>
    store.writePrivate(
      files[0],
      JSON.stringify({ ...rerun.outcome, accounts: null })
    )
  );
  await assert.rejects(runStep("pilot", deps), /closing balances of smoke/);
  const reread = await runStep("smoke", {
    ...deps,
    readApproval: async () => null,
  });
  assert.ok(reread.outcome.accounts?.end?.length);
  const stopping = new AbortController();
  stopping.abort();
  const next = await runStep("pilot", { ...deps, signal: stopping.signal });
  assert.equal(next.outcome.segment, "pilot");
});

const savedBaseline = async (root: string, runId: string) => {
  const store = new FileCheckpointStore(root, runId);
  return budgetBaselineSchema.parse(
    JSON.parse(
      await readFile(join(root, store.runFile("budget-baseline.json")), "utf8")
    )
  );
};

test("the closing reading is kept in the spend tracker, so a later top-up frees nothing", async (t) => {
  const { root, deps, synthetic } = await setup(t);
  const { outcome, files } = await runStep("smoke", deps);
  const treg = deps.accounts.treg.accountId;
  const closing = outcome.accounts!.end!.find(
    (item) => item.accountId === treg
  )!;
  const first = (await savedBaseline(root, outcome.runId)).tracked.find(
    (item) => item.accountId === treg
  )!;
  assert.equal(first.last, closing.available);

  // A late charge, then a crash before outcome.json: the recovery's closing
  // read, with no budget opened, is tracked too.
  await rm(join(root, files[0]));
  synthetic.tregBalance -= 1;
  await runStep("smoke", { ...deps, readApproval: async () => null });
  const after = await savedBaseline(root, outcome.runId);
  const tracked = after.tracked.find((item) => item.accountId === treg)!;
  assert.equal(tracked.used.toFixed(3), (first.used + 1).toFixed(3));
  assert.equal(tracked.last, synthetic.tregBalance);

  // A top-up before any later resume leaves the use where it was.
  synthetic.tregBalance += 50;
  const use = accountUse(after, [await deps.accounts.treg.read()]);
  assert.equal(use.spent[treg].toFixed(3), tracked.used.toFixed(3));
});

test("a resumed step's opening balances are the first start's, matching its change", async (t) => {
  const { root, deps, controller } = await setup(t);
  let polls = 0;
  const first = await runStep("smoke", {
    ...deps,
    driver: new Proxy(deps.driver, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (property !== "status" || typeof value !== "function") return value;
        return (...args: unknown[]) => {
          if (++polls === 5) controller.abort();
          return value.apply(target, args);
        };
      },
    }),
  });
  assert.equal(first.outcome.status, "interrupted");
  // No earlier opening summary survives, so the resume must not use its own.
  await rm(join(root, first.files[0]));
  const resumed = await runStep("smoke", {
    ...deps,
    signal: new AbortController().signal,
  });
  const baseline = await savedBaseline(root, resumed.outcome.runId);
  const { start, end, balanceChange } = resumed.outcome.accounts!;
  const deployment = deps.accounts.deployment.accountId;
  const opening = start.find((item) => item.accountId === deployment)!;
  const firstStart = baseline.balances.find(
    (item) => item.accountId === deployment
  )!;
  assert.equal(opening.available, firstStart.available);
  for (const item of start) {
    const closing = end!.find(
      (reading) => reading.accountId === item.accountId
    )!;
    assert.equal(
      balanceChange![item.accountId].toFixed(6),
      (item.available - closing.available).toFixed(6)
    );
  }
});

test("the keyword post-search cap is step-only: 50 calls per workspace cycle unless the approval sets another or none", () => {
  const approval = {
    segment: "smoke",
    spend: {
      approvalReference: "Synthetic approval",
      approvedAt: "2026-11-16T09:00:00Z",
      accountLimits: [{ accountId: "openrouter:a", maxAdditionalUsd: 1 }],
    },
  };
  assert.equal(DEFAULT_KEYWORD_POST_SEARCH_CALLS, 50);
  assert.equal(
    segmentApprovalSchema.parse(approval).keywordPostSearchCallsPerCycle,
    50
  );
  for (const value of [40, null])
    assert.equal(
      segmentApprovalSchema.parse({
        ...approval,
        keywordPostSearchCallsPerCycle: value,
      }).keywordPostSearchCallsPerCycle,
      value
    );
  for (const value of [0, 2.5, "100"])
    assert.equal(
      segmentApprovalSchema.safeParse({
        ...approval,
        keywordPostSearchCallsPerCycle: value,
      }).success,
      false
    );
});

test("the match limit is step-only: none unless the approval sets a positive whole number", () => {
  const approval = {
    segment: "smoke",
    spend: {
      approvalReference: "Synthetic approval",
      approvedAt: "2026-11-17T09:00:00Z",
      accountLimits: [{ accountId: "openrouter:a", maxAdditionalUsd: 1 }],
    },
  };
  assert.equal(segmentApprovalSchema.parse(approval).matchLimitPerCycle, null);
  for (const value of [20, null])
    assert.equal(
      segmentApprovalSchema.parse({ ...approval, matchLimitPerCycle: value })
        .matchLimitPerCycle,
      value
    );
  for (const value of [0, -1, 2.5, "20"])
    assert.equal(
      segmentApprovalSchema.safeParse({
        ...approval,
        matchLimitPerCycle: value,
      }).success,
      false
    );
});

test("an approved match limit is set for the step, reported, and cleared after", async (t) => {
  const { deps, timeline, env, atRest } = await setup(t);
  const { outcome, report } = await runStep("smoke", {
    ...deps,
    readApproval: async (segment) => {
      const approval = await deps.readApproval(segment);
      return approval && { ...approval, matchLimitPerCycle: 20 };
    },
  });
  assert.equal(outcome.status, "complete");
  // Recorded on the workspace run it governed, never as a step setting.
  assert.equal(outcome.workspaces[0].record.matchLimitPerCycle, 20);
  assert.ok(outcome.settings && !("matchLimitPerCycle" in outcome.settings));
  assert.match(
    report,
    /Match limit: 20 per cycle, applied through the plan-limit gate \(agreed by the project lead, 17 Nov 2026/
  );
  // Set before jobs were unpaused, and removed by the reset.
  const set = timeline.indexOf("env set BENCHMARK_MATCH_LIMIT_PER_CYCLE");
  assert.ok(set >= 0);
  assert.ok(set < timeline.indexOf("env set PAUSE_AUTONOMOUS_JOBS"));
  assert.equal(env.has("BENCHMARK_MATCH_LIMIT_PER_CYCLE"), false);
  assert.deepEqual(Object.fromEntries(env), atRest);
});

const withOpenRouterLimit = (
  approval: Awaited<ReturnType<StepDependencies["readApproval"]>>,
  usd: number
) =>
  approval && {
    ...approval,
    spend: {
      ...approval.spend,
      accountLimits: approval.spend.accountLimits.map((limit) =>
        limit.accountId.startsWith("openrouter:")
          ? { ...limit, maxAdditionalUsd: usd }
          : limit
      ),
    },
  };

test("--resume-held continues the budget-stopped workspace's cycle without discovery, then the step finishes", async (t) => {
  const { root, deps, timeline, env, atRest } = await setup(t);
  const stopped = await runStep("smoke", {
    ...deps,
    readApproval: async (segment) =>
      withOpenRouterLimit(await deps.readApproval(segment), 0.1),
  });
  assert.equal(stopped.outcome.status, "budget-stop");
  assert.match(stopped.outcome.review[0].reason, /budget-stop/);
  // The kill switch was set for the stop and the reset removed it.
  assert.ok(timeline.includes("env set BENCHMARK_HALTED_WORKSPACE_ID"));
  assert.deepEqual(Object.fromEntries(env), atRest);

  // Without the flag the held workspace is never repeated.
  timeline.length = 0;
  const plain = await runStep("smoke", {
    ...deps,
    signal: new AbortController().signal,
  });
  assert.ok(
    !timeline.includes("run benchmarkPeopleSearch:resumeHeldWorkspace")
  );
  assert.equal(plain.outcome.workspaces.length, 0);

  // With it (and a raised approval), the same workspace finishes its cycle.
  timeline.length = 0;
  const resumed = await runStep("smoke", {
    ...deps,
    signal: new AbortController().signal,
    resumeHeld: true,
  });
  assert.ok(timeline.includes("run benchmarkPeopleSearch:resumeHeldWorkspace"));
  for (const call of [
    "run benchmarkPeopleSearch:prepareWorkspace",
    "run benchmarkPeopleSearch:startWorkspace",
  ])
    assert.ok(!timeline.includes(call));
  assert.equal(resumed.outcome.status, "complete");
  assert.deepEqual(resumed.outcome.review, []);
  const [workspace] = resumed.outcome.workspaces;
  assert.equal(workspace.record.ending, "planned-cycles");
  assert.equal(workspace.record.cycles.length, 1);
  assert.equal(workspace.record.resumed?.[0].after, "budget-stop");
  assert.ok((workspace.record.cycles[0].pausedMs ?? 0) > 0);
  assert.ok(resumed.outcome.cases.some((item) => item.toolId === "reacherx"));
  assert.equal(resumed.outcome.competitors.length, 8);
  assert.equal(resumed.outcome.decision?.point, "D1");
  assert.match(
    resumed.report,
    /\| planned-cycles \(resumed after a budget stop\) \|/
  );
  assert.match(
    resumed.report,
    /Resumed workspaces \(spend before and after the stop, combined\)/
  );
  assert.match(resumed.report, /No new discovery cycle started/);
  assert.match(
    resumed.decision ?? "",
    /was resumed after a budget stop; its cycle cost and active time combine the attempts/
  );
  assert.deepEqual(Object.fromEntries(env), atRest);
  // The held checkpoint was kept, not replaced without a trace.
  const runDir = join(
    root,
    "benchmarks/.local/runs",
    segmentRunId(deps.frozen.planSha256, "smoke"),
    "held"
  );
  assert.ok(
    (await readdir(runDir)).some((name) =>
      name.startsWith("w-p14-on.before-resume-")
    )
  );

  // Nothing is left to continue.
  await assert.rejects(
    runStep("smoke", {
      ...deps,
      signal: new AbortController().signal,
      resumeHeld: true,
    }),
    /--resume-held found no held workspace/
  );
});

test("a workspace stopped without a match limit and continued with one is reported as it ran", async (t) => {
  const { deps } = await setup(t);
  const stopped = await runStep("smoke", {
    ...deps,
    readApproval: async (segment) =>
      withOpenRouterLimit(await deps.readApproval(segment), 0.1),
  });
  assert.equal(stopped.outcome.status, "budget-stop");

  // The continuation's approval adds a limit; the earlier run keeps none.
  const resumed = await runStep("smoke", {
    ...deps,
    signal: new AbortController().signal,
    resumeHeld: true,
    readApproval: async (segment) => {
      const approval = await deps.readApproval(segment);
      return approval && { ...approval, matchLimitPerCycle: 20 };
    },
  });
  assert.equal(resumed.outcome.status, "complete");
  const [workspace] = resumed.outcome.workspaces;
  assert.equal(workspace.record.matchLimitPerCycle, null);
  assert.equal(workspace.record.resumed?.at(-1)?.matchLimitPerCycle, 20);
  assert.match(
    resumed.report,
    /Match limit: not the same for every workspace run/
  );
  assert.match(
    resumed.report,
    /- \S+: no match limit during its cycle; match limit 20 per cycle from the \d{1,2} [A-Z][a-z]{2} resume\./
  );
  // No step-level line claims the limit for the cycle that ran without it.
  assert.doesNotMatch(resumed.report, /^Match limit: 20 per cycle/m);
});

test("a raised approval file applies between polls; an invalid one keeps the approval in force", async (t) => {
  const { deps } = await setup(t);
  const lines: string[] = [];
  let reads = 0;
  const { outcome } = await runStep("smoke", {
    ...deps,
    log: (line) => lines.push(line),
    readApproval: async (segment) => {
      reads += 1;
      const approval = await deps.readApproval(segment);
      // The step opens with too little; the file is then broken, then raised.
      if (reads === 1) return withOpenRouterLimit(approval, 0.1);
      if (reads === 2)
        throw new Error("The approval in the file is not valid.");
      if (reads === 3) return withOpenRouterLimit(approval, 0.05);
      return withOpenRouterLimit(approval, 5);
    },
  });
  assert.equal(outcome.status, "complete");
  assert.ok(
    lines.some((line) =>
      /not valid\. The approval in force is kept\./.test(line)
    )
  );
  assert.ok(
    lines.some((line) =>
      /Not lowered: openrouter:\w+ stays at \$0\.10/.test(line)
    )
  );
  assert.equal(
    lines.filter((line) =>
      /Approval raised mid-step: openrouter:\w+ from \$0\.10 to \$5\.00/.test(
        line
      )
    ).length,
    1
  );
});
