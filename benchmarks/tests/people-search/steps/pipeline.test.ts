import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
} from "node:fs/promises";
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
  checkMainAgainstPilot,
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
  assert.match(report, /^ {2}exa +░{20} +n\/a {2}0\/0 +\$.+ {2}no results$/m);
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

test("the match limits are step-only: none unless the approval sets a positive whole number", () => {
  const approval = {
    segment: "smoke",
    spend: {
      approvalReference: "Synthetic approval",
      approvedAt: "2026-11-17T09:00:00Z",
      accountLimits: [{ accountId: "openrouter:a", maxAdditionalUsd: 1 }],
    },
  };
  for (const field of ["matchLimitPerCycle", "matchLimitPerQuery"] as const) {
    assert.equal(segmentApprovalSchema.parse(approval)[field], null);
    for (const value of [20, null])
      assert.equal(
        segmentApprovalSchema.parse({ ...approval, [field]: value })[field],
        value
      );
    for (const value of [0, -1, 2.5, "20"])
      assert.equal(
        segmentApprovalSchema.safeParse({ ...approval, [field]: value })
          .success,
        false
      );
  }
});

test("approved match limits are set for the step, reported, and cleared after", async (t) => {
  const { deps, timeline, env, atRest } = await setup(t);
  const { outcome, report } = await runStep("smoke", {
    ...deps,
    readApproval: async (segment) => {
      const approval = await deps.readApproval(segment);
      return (
        approval && {
          ...approval,
          matchLimitPerCycle: 20,
          matchLimitPerQuery: 100,
        }
      );
    },
  });
  assert.equal(outcome.status, "complete");
  // Recorded on the workspace run they governed, never as step settings.
  const { record } = outcome.workspaces[0];
  assert.equal(record.matchLimitPerCycle, 20);
  assert.equal(record.matchLimitPerQuery, 100);
  assert.ok(outcome.settings && !("matchLimitPerCycle" in outcome.settings));
  assert.ok(!("matchLimitPerQuery" in outcome.settings));
  assert.match(
    report,
    /Match limit: 20 per cycle, applied through the plan-limit gate \(agreed by the project lead, 17 Nov 2026/
  );
  assert.match(report, /Match limit per query: 100 matches per workspace/);
  // Set before jobs were unpaused, and removed by the reset.
  for (const name of [
    "BENCHMARK_MATCH_LIMIT_PER_CYCLE",
    "BENCHMARK_MATCH_LIMIT_PER_QUERY",
  ]) {
    const set = timeline.indexOf(`env set ${name}`);
    assert.ok(set >= 0);
    assert.ok(set < timeline.indexOf("env set PAUSE_AUTONOMOUS_JOBS"));
    assert.equal(env.has(name), false);
  }
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

test("a slice is step-only: none unless the approval names workspaces, with an optional cycle cap", () => {
  const approval = {
    segment: "pilot",
    spend: {
      approvalReference: "Synthetic approval",
      approvedAt: "2026-11-19T09:00:00Z",
      accountLimits: [{ accountId: "openrouter:a", maxAdditionalUsd: 1 }],
    },
  };
  assert.equal(segmentApprovalSchema.parse(approval).slice, null);
  assert.deepEqual(
    segmentApprovalSchema.parse({
      ...approval,
      slice: { workspaces: ["w-p01-on"] },
    }).slice,
    { workspaces: ["w-p01-on"], cycles: null }
  );
  for (const slice of [
    { workspaces: [] },
    { workspaces: ["w-p01-on"], cycles: 0 },
    { workspaces: ["w-p01-on"], cycles: 1.5 },
    { workspaces: ["w-p01-on"], cycles: 1, extra: true },
  ])
    assert.equal(
      segmentApprovalSchema.safeParse({ ...approval, slice }).success,
      false
    );
});

const sliced =
  (
    deps: StepDependencies,
    slice: NonNullable<
      Awaited<ReturnType<StepDependencies["readApproval"]>>
    >["slice"]
  ): StepDependencies["readApproval"] =>
  async (segment) => {
    const approval = await deps.readApproval(segment);
    return (
      approval && (segment === "pilot" ? { ...approval, slice } : approval)
    );
  };

test("a pilot slice runs only the first cycle of one workspace, holds it, and leaves the rest pending", async (t) => {
  const { root, deps, timeline, env, atRest } = await setup(t);
  assert.equal((await runStep("smoke", deps)).outcome.status, "complete");
  const runDir = join(
    root,
    "benchmarks/.local/runs",
    segmentRunId(deps.frozen.planSha256, "pilot")
  );
  const frozenRun = () => readFile(join(runDir, "frozen-run.json"), "utf8");

  timeline.length = 0;
  const slice = await runStep("pilot", {
    ...deps,
    readApproval: sliced(deps, { workspaces: ["w-p01-on"], cycles: 1 }),
  });
  assert.equal(slice.outcome.status, "halted");
  assert.match(
    slice.outcome.stopReason ?? "",
    /^Slice run .*only w-p01-on, at most 1 cycle\(s\) each/
  );
  assert.equal(slice.outcome.decision, null);
  // One workspace, one cycle, no judges; the deployment is reset.
  const prepared = (calls: readonly string[]) =>
    calls.filter(
      (call) => call === "run benchmarkPeopleSearch:prepareWorkspace"
    ).length;
  assert.equal(prepared(timeline), 1);
  assert.ok(!timeline.some((call) => call.startsWith("model")));
  assert.ok(timeline.includes("env set PROSPECTING_AUTO_RESCHEDULE"));
  assert.deepEqual(Object.fromEntries(env), atRest);
  assert.deepEqual(slice.outcome.workspaces, []);
  assert.deepEqual(
    slice.outcome.review.map((item) => item.unitId),
    ["w-p01-on"]
  );
  assert.match(
    slice.outcome.review[0].reason,
    /Slice: ran 1 of 4 planned cycle\(s\)/
  );
  assert.deepEqual((await readdir(join(runDir, "checkpoints"))).sort(), [
    "w-p01-on.json",
  ]);
  const held = JSON.parse(
    await readFile(
      join(
        root,
        JSON.parse(
          await readFile(join(runDir, "checkpoints/w-p01-on.json"), "utf8")
        ).receipt.path
      ),
      "utf8"
    )
  );
  assert.equal(held.receipt.record.plannedCycles, 1);
  assert.equal(held.receipt.record.cycles.length, 1);
  // The frozen run record is the whole pilot's, unchanged by the slice.
  const frozen = await frozenRun();
  assert.equal(
    JSON.parse(frozen).schedule.workspaces.length,
    segmentSchedule("pilot", { runId: "x", seed: 7 }).workspaces.length
  );

  // Rerunning the slice contacts nothing; --resume-held cannot extend it.
  timeline.length = 0;
  const again = await runStep("pilot", {
    ...deps,
    readApproval: sliced(deps, { workspaces: ["w-p01-on"], cycles: 1 }),
  });
  assert.equal(again.outcome.status, "halted");
  assert.deepEqual(changes(timeline), []);
  await assert.rejects(
    runStep("pilot", {
      ...deps,
      resumeHeld: true,
      readApproval: sliced(deps, { workspaces: ["w-p01-on"], cycles: 1 }),
    }),
    /only a budget stop, an interruption or unreadable status can be continued/
  );

  // Its LinkedIn use counts against the step's approval although it is held.
  const used: number = held.receipt.record.recorded.linkdApi.billableUnits;
  assert.ok(used > 0);
  timeline.length = 0;
  const capped = await runStep("pilot", {
    ...deps,
    readApproval: async (segment) => {
      const approval = await sliced(deps, {
        workspaces: ["w-p01-off"],
        cycles: null,
      })(segment);
      return (
        approval && {
          ...approval,
          credits: approval.credits.map((item) => ({
            ...item,
            maxCredits: used,
          })),
        }
      );
    },
  });
  assert.equal(capped.outcome.status, "budget-stop");
  assert.match(capped.outcome.stopReason ?? "", /renidly:/);
  assert.equal(prepared(timeline), 0);

  // Without a slice the step stops at the held workspace, so the pilot can
  // never look complete without it.
  timeline.length = 0;
  const unsliced = await runStep("pilot", deps);
  assert.equal(unsliced.outcome.status, "halted");
  assert.match(
    unsliced.outcome.stopReason ?? "",
    /w-p01-on ran only as a slice \(1 of 4 cycles\)/
  );
  assert.equal(prepared(timeline), 0);

  // The rest of the pilot runs as another slice under the same frozen record;
  // the held workspace is not repeated.
  timeline.length = 0;
  const rest = await runStep("pilot", {
    ...deps,
    readApproval: sliced(deps, {
      workspaces: ["w-p01-off", "w-p06-off", "w-p06-on"],
      cycles: null,
    }),
  });
  assert.equal(prepared(timeline), 3);
  assert.equal(await frozenRun(), frozen);
  assert.deepEqual(rest.outcome.review, []);
  assert.deepEqual(
    rest.outcome.workspaces.map((item) => item.record.cycles.length),
    [4, 4, 4]
  );

  // Moved aside after review (never deleted), it runs again in full.
  await mkdir(join(runDir, "held"), { recursive: true });
  await rename(
    join(runDir, "checkpoints/w-p01-on.json"),
    join(runDir, "held/w-p01-on.slice.json")
  );
  timeline.length = 0;
  const full = await runStep("pilot", deps);
  assert.equal(prepared(timeline), 1);
  assert.equal(full.outcome.status, "complete");
  assert.deepEqual(full.outcome.review, []);
  assert.deepEqual(
    full.outcome.workspaces.map((item) => item.record.cycles.length),
    [4, 4, 4, 4]
  );
  assert.deepEqual(Object.fromEntries(env), atRest);
});

test("a slice naming a workspace the step does not run is refused before anything changes", async (t) => {
  const { deps, timeline } = await setup(t);
  await runStep("smoke", deps);
  timeline.length = 0;
  await assert.rejects(
    runStep("pilot", {
      ...deps,
      readApproval: sliced(deps, { workspaces: ["w-p02-on"], cycles: 1 }),
    }),
    /names w-p02-on, which pilot does not run; its workspaces are w-p01-on, w-p01-off, w-p06-off, w-p06-on/
  );
  assert.deepEqual(changes(timeline), []);
});

const PILOT_DROP = {
  workspaces: ["w-p06-off", "w-p06-on"],
  reason: "Budget: the pilot finishes with prompt 1 only",
};

const dropping =
  (
    deps: StepDependencies,
    extra: Partial<
      NonNullable<Awaited<ReturnType<StepDependencies["readApproval"]>>>
    > = {}
  ): StepDependencies["readApproval"] =>
  async (segment) => {
    const approval = await deps.readApproval(segment);
    return (
      approval &&
      (segment === "pilot"
        ? { ...approval, drop: PILOT_DROP, ...extra }
        : approval)
    );
  };

test("a drop needs workspaces and a reason", () => {
  const approval = {
    segment: "pilot",
    spend: {
      approvalReference: "Synthetic approval",
      approvedAt: "2026-11-20T09:00:00Z",
      accountLimits: [{ accountId: "openrouter:a", maxAdditionalUsd: 1 }],
    },
  };
  assert.equal(segmentApprovalSchema.parse(approval).drop, null);
  assert.deepEqual(
    segmentApprovalSchema.parse({ ...approval, drop: PILOT_DROP }).drop,
    PILOT_DROP
  );
  for (const drop of [
    { workspaces: ["w-p06-on"] },
    { workspaces: ["w-p06-on"], reason: "  " },
    { workspaces: [], reason: "Budget" },
    ["w-p06-on"],
  ])
    assert.equal(
      segmentApprovalSchema.safeParse({ ...approval, drop }).success,
      false
    );
});

test("a pilot dropping prompt 6 finishes w-p01-off's interrupted cycle with --resume-held, then completes with judges and D2", async (t) => {
  const { deps, controller, timeline, env, atRest } = await setup(t);
  assert.equal((await runStep("smoke", deps)).outcome.status, "complete");

  // Unknown or slice-overlapping units are refused before anything changes.
  timeline.length = 0;
  await assert.rejects(
    runStep("pilot", {
      ...deps,
      readApproval: dropping(deps, {
        drop: { ...PILOT_DROP, workspaces: ["w-p02-on"] },
      }),
    }),
    /drop in .*pilot\.json names w-p02-on, which pilot does not run/
  );
  await assert.rejects(
    runStep("pilot", {
      ...deps,
      readApproval: dropping(deps, {
        slice: { workspaces: ["w-p06-on"], cycles: null },
      }),
    }),
    /both drops and slices w-p06-on/
  );
  assert.deepEqual(changes(timeline), []);

  // Interrupted once w-p01-off (the second workspace) is in its cycle 2.
  let prepared = 0;
  const cycles = new Set<string>();
  const interrupting: StepDependencies = {
    ...deps,
    readApproval: dropping(deps),
    driver: new Proxy(deps.driver, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (typeof value !== "function") return value;
        if (property === "prepare")
          return (...args: unknown[]) => {
            prepared += 1;
            return value.apply(target, args);
          };
        if (property !== "status") return value;
        return async (...args: unknown[]) => {
          const status = await value.apply(target, args);
          if (prepared === 2 && status?.workflowId) {
            cycles.add(status.workflowId);
            if (cycles.size === 2) controller.abort();
          }
          return status;
        };
      },
    }),
  };
  const first = await runStep("pilot", interrupting);
  assert.equal(first.outcome.status, "interrupted");
  assert.deepEqual(
    first.outcome.review.map((item) => item.unitId),
    ["w-p01-off"]
  );
  assert.equal(prepared, 2);

  // A unit that already ran can no longer be dropped.
  await assert.rejects(
    runStep("pilot", {
      ...deps,
      signal: new AbortController().signal,
      readApproval: dropping(deps, {
        drop: { ...PILOT_DROP, workspaces: ["w-p01-on"] },
      }),
    }),
    /names w-p01-on \(completed\); only a workspace that never started can be dropped/
  );

  timeline.length = 0;
  const resumed = await runStep("pilot", {
    ...deps,
    signal: new AbortController().signal,
    resumeHeld: true,
    readApproval: dropping(deps),
  });
  assert.ok(!timeline.includes("run benchmarkPeopleSearch:prepareWorkspace"));
  assert.ok(timeline.includes("run benchmarkPeopleSearch:resumeHeldWorkspace"));
  assert.equal(resumed.outcome.status, "complete");
  assert.deepEqual(resumed.outcome.review, []);
  assert.deepEqual(
    resumed.outcome.dropped.map((item) => item.unitId),
    PILOT_DROP.workspaces
  );
  const off = resumed.outcome.workspaces.find(
    (item) => item.learning === "off"
  )!;
  assert.equal(off.record.ending, "fewer-cycles");
  assert.equal(off.record.cycles.length, 2);
  assert.ok(
    resumed.outcome.cases.some(
      (item) => item.toolId === "reacherx" && item.learning === "off"
    )
  );
  assert.equal(resumed.outcome.decision?.point, "D2");
  assert.match(resumed.decision ?? "", /# D2 checkpoint/);
  assert.match(resumed.report, /Units: .*2 dropped by approval\./);
  assert.match(
    resumed.report,
    /Dropped by approval: w-p06-off, w-p06-on never ran and are not held for review\. Reason: Budget: the pilot finishes with prompt 1 only\./
  );
  assert.match(
    resumed.report,
    /_p01_off: 2 of 4 cycles; it was resumed after an interruption in cycle 2.*cycles 3 to 4 never ran/
  );
  assert.match(
    resumed.report,
    /- p01: learning on 4 cycle\(s\), learning off 2 cycle\(s\)\./
  );
  assert.match(resumed.report, /Human labels: /);
  assert.deepEqual(Object.fromEntries(env), atRest);
});

test("the main step runs prompt 6's first cycle when the pilot dropped it, and refuses a pilot that ran it", () => {
  const main = segmentSchedule("main", { runId: "x", seed: 7 });
  assert.ok(main.workspaces.some((slot) => slot.taskId === "p06"));
  assert.ok(!main.workspaces.some((slot) => slot.taskId === "p01"));
  const pilot = { workspaces: [], review: [], dropped: [] };
  const ranP01 = {
    ...pilot,
    review: [{ unitId: "w-p01-on", reason: "held" }],
    dropped: PILOT_DROP.workspaces.map((unitId) => ({
      unitId,
      taskId: "p06",
      learning: unitId.endsWith("on") ? ("on" as const) : ("off" as const),
      reason: PILOT_DROP.reason,
    })),
  };
  checkMainAgainstPilot(main, ranP01);
  assert.throws(
    () =>
      checkMainAgainstPilot(main, {
        ...pilot,
        review: [{ unitId: "w-p06-on", reason: "held" }],
      }),
    /The pilot ran p06, which the main step would run again/
  );
  assert.throws(
    () =>
      checkMainAgainstPilot(
        {
          ...main,
          workspaces: main.workspaces.filter((slot) => slot.taskId !== "p06"),
        },
        ranP01
      ),
    /The pilot dropped p06, but the main step does not run its first cycle/
  );
  // Only learning-on covers a prompt: main reuses the pilot's learning-on cycle 1.
  assert.throws(
    () =>
      checkMainAgainstPilot(main, {
        ...ranP01,
        review: [{ unitId: "w-p01-off", reason: "held" }],
        dropped: [
          ...ranP01.dropped,
          {
            unitId: "w-p01-on",
            taskId: "p01",
            learning: "on" as const,
            reason: PILOT_DROP.reason,
          },
        ],
      }),
    /The pilot dropped p01, but the main step does not run its first cycle/
  );
});
