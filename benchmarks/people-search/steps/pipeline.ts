import { z } from "zod";
import type { Transport } from "../../core/calls/http";
import { rateSnapshotSchema } from "../../core/calls/rates";
import {
  FileCheckpointStore,
  RunnerStateError,
} from "../../core/execution/checkpoints";
import type { ConvexReacherXDriver } from "../../core/execution/convex";
import {
  LiveSessionError,
  hasOpenSession,
  runSettingsSchema,
  sessionFileIn,
  withLiveSession,
  type LiveSessionConfig,
} from "../../core/execution/liveSession";
import {
  BudgetStop,
  stepSpendApprovalSchema,
} from "../../core/execution/spend";
import type { Clock, WatchOptions } from "../../core/execution/workspaceRun";
import type { JudgeCaller } from "../../core/judging/judges";
import {
  StepBudget,
  accountUse,
  budgetBaselineSchema,
  type AccountReader,
  type UsageAccount,
  type AccountReading,
} from "../../core/steps/balances";
import { WorkspaceGate } from "../../core/steps/keyGate";
import { UnitLedger, toJson, type StepStop } from "../../core/steps/units";
import type { FrozenPlanRecord } from "../setup/freeze";
import { peopleSearchPlan } from "../setup/plan";
import {
  SEGMENTS,
  STEPS,
  STEP_SEGMENTS,
  segmentSchedule,
  type SegmentId,
  type SegmentSchedule,
  type Stage2Size,
  type StepId,
} from "../setup/schedule";
import {
  runCompetitorUnits,
  type CompetitorOutcome,
  type ProviderCalls,
} from "./competitors";
import {
  competitorTargets,
  humanLabels,
  reacherxTargets,
  runJudgingUnits,
  sheetCaseIds,
  type HumanLabels,
} from "./judging";
import {
  aggregateReport,
  decide,
  renderDecision,
  renderSegmentReport,
  segmentOutcomeSchema,
  type ReportContext,
  type SegmentOutcome,
} from "./reports";
import {
  recordedDataUse,
  runWorkspaceUnits,
  workspaceUnitId,
  type WorkspaceOutcome,
  type WorkspaceUnitResult,
} from "./workspaces";

/**
 * One live step (proposal 5.3): load the frozen plan and the step's approved
 * amount, run ReacherX one workspace at a time inside a live session whose
 * reset always runs, then the competitors one request at a time, then
 * judging, then the report and, at a decision point, the checkpoint report.
 * Every unit is checkpointed, so a rerun resumes without paying twice; a rerun
 * with nothing left to do only re-renders the reports and contacts nothing.
 * The dry run calls the same code with synthetic dependencies.
 */

const stage2SizeSchema = z.strictObject({
  staticPrompts: z.number().int(),
  cyclesPerWorkspace: z.number().int(),
  // The cycle cost stage 2's budget was based on; D4 checks against it.
  plannedCycleCostUsd: z.number().positive(),
});

/** The private per-step approval file (proposal 5.3 step 1). */
export const segmentApprovalSchema = z.strictObject({
  segment: z.enum(SEGMENTS),
  spend: stepSpendApprovalSchema,
  // Credit accounts (Renidly), approved in credits rather than dollars.
  credits: z
    .array(
      z.strictObject({
        accountId: z.string().min(1),
        maxCredits: z.number().finite().nonnegative(),
      })
    )
    .default([]),
  // Stage 2 only: the size approved at D3, or for the rest as set at D4.
  stage2: stage2SizeSchema.optional(),
});
export type SegmentApproval = z.infer<typeof segmentApprovalSchema>;

export const approvalPath = (segment: SegmentId) =>
  `benchmarks/.local/people-search/approvals/${segment}.json`;

export const segmentRunId = (planSha256: string, segment: SegmentId) =>
  `ps-${planSha256.slice(0, 12)}-${segment}`;

export type StepAccounts = Readonly<{
  // Not shared with production: its spend is ReacherX's AI cost of record.
  deployment: UsageAccount;
  // The judges' and harness's own key; null when they share the deployment key.
  judge: UsageAccount | null;
  // The funded X and LinkedIn keys are also production's: their balances are
  // only sufficiency checks, and their use comes from the deployment's records.
  socialApi: AccountReader;
  renidly: AccountReader;
  treg: AccountReader;
}>;

export type StepDependencies = Readonly<{
  root: string;
  frozen: FrozenPlanRecord;
  readApproval(segment: SegmentId): Promise<SegmentApproval | null>;
  driver: ConvexReacherXDriver;
  session: Pick<LiveSessionConfig, "fundedKeys" | "deploymentOpenRouterKey">;
  userId: string;
  clock: Clock;
  watch: Omit<WatchOptions, "signal">;
  signal: AbortSignal;
  accounts: StepAccounts;
  providerCalls: ProviderCalls;
  harnessModel: string;
  secrets: Readonly<Record<string, string>>;
  judgeCall: JudgeCaller;
  evidence: Readonly<{ transport: Transport; apiKey: string }>;
  log(line: string): void;
}>;

export type SegmentResult = Readonly<{
  outcome: SegmentOutcome;
  report: string;
  decision: string | null;
  // Private files written for this segment.
  files: readonly string[];
}>;

async function readOutcome(
  root: string,
  planSha256: string,
  segment: SegmentId
) {
  const store = new FileCheckpointStore(
    root,
    segmentRunId(planSha256, segment)
  );
  const text = await store.readPrivate(store.runFile("outcome.json"));
  return text === null ? null : segmentOutcomeSchema.parse(JSON.parse(text));
}

const runRecordSchema = z.object({
  schedule: z.object({
    stage2: stage2SizeSchema.omit({ plannedCycleCostUsd: true }).nullable(),
  }),
  plannedCycleCostUsd: z.number().nullable(),
});

/**
 * The segment's schedule. Stage 2's size comes from the frozen run record once
 * the segment has started, otherwise from its approval; the rest of stage 2
 * also needs the size its first third ran with.
 */
async function scheduleFor(
  segment: SegmentId,
  store: FileCheckpointStore,
  earlier: readonly SegmentOutcome[],
  approval: SegmentApproval | null,
  seed: number
) {
  const frozenText = await store.readPrivate(store.runFile("frozen-run.json"));
  const frozen = frozenText
    ? runRecordSchema.parse(JSON.parse(frozenText))
    : null;
  let stage2: Stage2Size | undefined = frozen?.schedule.stage2 ?? undefined;
  if (!stage2 && approval?.stage2) {
    const { staticPrompts, cyclesPerWorkspace } = approval.stage2;
    stage2 = { staticPrompts, cyclesPerWorkspace };
  }
  if (segment === "stage2-first" && !stage2)
    throw new BudgetStop(
      `Stage 2 needs its size (stage2) in ${approvalPath(segment)}.`
    );
  const first = earlier.find((item) => item.segment === "stage2-first")?.stage2;
  return {
    schedule: segmentSchedule(segment, {
      runId: store.runId,
      seed,
      stage2,
      stage2First: first ?? undefined,
    }),
    plannedCycleCostUsd:
      frozen?.plannedCycleCostUsd ??
      approval?.stage2?.plannedCycleCostUsd ??
      null,
  };
}

/**
 * A segment is finished once every unit has settled and its closing balances
 * were read; until then a rerun of its step selects it again, reusing its
 * units and only reading what is missing.
 */
async function finished(
  root: string,
  planSha256: string,
  outcome: SegmentOutcome | null
) {
  if (outcome?.status !== "complete") return false;
  if (outcome.accounts) return outcome.accounts.end !== null;
  // Paid work leaves a baseline; then a closing summary is required.
  const store = new FileCheckpointStore(root, outcome.runId);
  return (await store.readPrivate(store.runFile(BASELINE_FILE))) === null;
}

const stepOf = (segment: SegmentId) =>
  STEPS.find((step) => {
    const segments: readonly SegmentId[] = STEP_SEGMENTS[step];
    return segments.includes(segment);
  })!;

/** Runs the step's next unfinished segment; when all are finished, re-renders the last. */
export async function runStep(step: StepId, deps: StepDependencies) {
  const segments: readonly SegmentId[] = STEP_SEGMENTS[step];
  let segment = segments.at(-1)!;
  for (const candidate of segments)
    if (
      !(await finished(
        deps.root,
        deps.frozen.planSha256,
        await readOutcome(deps.root, deps.frozen.planSha256, candidate)
      ))
    ) {
      segment = candidate;
      break;
    }
  return runSegment(segment, deps);
}

async function earlierOutcomes(
  root: string,
  planSha256: string,
  segment: SegmentId
) {
  const outcomes: SegmentOutcome[] = [];
  for (const earlier of SEGMENTS.slice(0, SEGMENTS.indexOf(segment))) {
    const outcome = await readOutcome(root, planSha256, earlier);
    if (outcome?.status !== "complete")
      throw new RunnerStateError(
        `Finish the ${stepOf(earlier)} step before ${segment}; it needs those results.`
      );
    if (!(await finished(root, planSha256, outcome)))
      throw new RunnerStateError(
        `The closing balances of ${earlier} were not read, so its costs are incomplete. Run pnpm benchmark --live ${stepOf(earlier)} again to read them before ${segment}.`
      );
    outcomes.push(outcome);
  }
  return outcomes;
}

function segmentAccounts(schedule: SegmentSchedule, accounts: StepAccounts) {
  const harness = accounts.judge ?? accounts.deployment;
  const used = [
    accounts.deployment,
    ...(schedule.judges || schedule.competitorTasks.length ? [harness] : []),
    ...(schedule.workspaces.length
      ? [accounts.socialApi, accounts.renidly]
      : []),
    ...(schedule.competitorTasks.length ? [accounts.treg] : []),
  ];
  return used.filter(
    (account, index) =>
      used.findIndex((other) => other.accountId === account.accountId) === index
  );
}

const BASELINE_FILE = "budget-baseline.json";
const FINAL_READ_ATTEMPTS = 3;
const FINAL_READ_WAIT_MS = 10_000;

/** The step's closing balances, tried a few times; null when they stay unreadable. */
async function finalReadings(
  accounts: readonly AccountReader[],
  clock: Clock
): Promise<AccountReading[] | null> {
  for (let attempt = 1; attempt <= FINAL_READ_ATTEMPTS; attempt++) {
    try {
      return await Promise.all(accounts.map((account) => account.read()));
    } catch {
      if (attempt < FINAL_READ_ATTEMPTS) await clock.sleep(FINAL_READ_WAIT_MS);
    }
  }
  return null;
}

async function runSegment(
  segment: SegmentId,
  deps: StepDependencies
): Promise<SegmentResult> {
  const { frozen } = deps;
  const store = new FileCheckpointStore(
    deps.root,
    segmentRunId(frozen.planSha256, segment)
  );
  return store.withLock(async () => {
    if (await hasOpenSession(sessionFileIn(store)))
      throw new LiveSessionError(
        "A previous live step was not reset. Run pnpm benchmark --reset and review it first."
      );
    const earlier = await earlierOutcomes(
      deps.root,
      frozen.planSha256,
      segment
    );
    const previous = await readOutcome(deps.root, frozen.planSha256, segment);
    const tasks = new Map(frozen.tasks.map((task) => [task.id, task]));
    const rates = rateSnapshotSchema.parse(
      await store.readArtifact(frozen.rateSnapshot)
    );
    const settings = runSettingsSchema.parse(
      await store.readArtifact(frozen.runtimeSnapshot)
    );
    const approval = await deps.readApproval(segment);
    const { schedule, plannedCycleCostUsd } = await scheduleFor(
      segment,
      store,
      earlier,
      approval,
      frozen.seed
    );
    const ledger = new UnitLedger(store);
    await ledger.open(
      toJson({
        schemaVersion: 1,
        planSha256: frozen.planSha256,
        segment,
        harnessModel: deps.harnessModel,
        judges: {
          primary: peopleSearchPlan.models.judges,
          tieBreaker: peopleSearchPlan.models.tieBreaker,
        },
        schedule,
        plannedCycleCostUsd,
      })
    );

    const accounts = segmentAccounts(schedule, deps.accounts);
    const harnessAccount = (deps.accounts.judge ?? deps.accounts.deployment)
      .accountId;
    const baselinePath = store.runFile(BASELINE_FILE);
    const dataIds = {
      x: deps.accounts.socialApi.accountId,
      linkedIn: deps.accounts.renidly.accountId,
    };
    const sharedIds = [dataIds.x, dataIds.linkedIn];
    // Opened on first paid work; a rerun with nothing to do needs no approval.
    const opened: { budget: StepBudget | null; start: AccountReading[] } = {
      budget: null,
      start: [],
    };
    const openBudget = async () => {
      if (opened.budget) return opened.budget;
      if (!approval)
        throw new BudgetStop(
          `This step needs its spend approval in ${approvalPath(segment)}.`
        );
      const next = new StepBudget(
        approval.spend,
        approval.credits,
        accounts,
        sharedIds
      );
      const saved = await store.readPrivate(baselinePath);
      const result = await next.open(
        saved === null ? null : budgetBaselineSchema.parse(JSON.parse(saved)),
        // What earlier attempts of this step already used, by the deployment's records.
        recordedDataUse(
          (previous?.workspaces ?? []).map((item) => item.record),
          dataIds
        )
      );
      if (saved === null)
        await store.writePrivate(baselinePath, JSON.stringify(result.baseline));
      opened.start = result.readings;
      opened.budget = next;
      return next;
    };

    const gate = new WorkspaceGate();
    // No new unit starts once the step is interrupted, over budget or halted;
    // later phases still collect the units already finished.
    const stopping = new AbortController();
    const interrupted = () => stopping.abort();
    if (deps.signal.aborted) stopping.abort();
    deps.signal.addEventListener("abort", interrupted);
    // Held in an object because the phases set it through stopWith.
    const ended: {
      stop: { status: "budget-stop" | "halted"; reason: string } | null;
    } = { stop: null };
    const stopWith = (reason: StepStop | null) => {
      if (!reason || ended.stop) return;
      ended.stop = {
        status: reason instanceof BudgetStop ? "budget-stop" : "halted",
        reason: reason.message,
      };
      stopping.abort();
    };
    const signal = stopping.signal;
    let workspaceResults: WorkspaceUnitResult[] = [];
    let competitors: Awaited<ReturnType<typeof runCompetitorUnits>> | null =
      null;
    let judging: Awaited<ReturnType<typeof runJudgingUnits>> | null = null;
    let settingsInEffect = previous?.settings ?? null;
    // Judged-result units this segment scheduled; null until known.
    let judgeTargets: string[] | null = null;
    // Keeps the balance decreases seen so far, so a resume counts from them.
    const saveBudget = async () => {
      if (opened.budget)
        await store.writePrivate(
          baselinePath,
          JSON.stringify(opened.budget.baseline())
        );
    };
    try {
      const workspacePhase = {
        ledger,
        driver: deps.driver,
        userId: deps.userId,
        watch: { ...deps.watch, signal },
        clock: deps.clock,
        signal,
        gate,
        budget: openBudget,
        deployment: deps.accounts.deployment,
        x: deps.accounts.socialApi,
        linkedIn: deps.accounts.renidly,
        log: deps.log,
      };
      const states = await Promise.all(
        schedule.workspaces.map((slot) => ledger.state(workspaceUnitId(slot)))
      );
      let ran: Awaited<ReturnType<typeof runWorkspaceUnits>>;
      if (
        !signal.aborted &&
        states.some((state) => state === "new" || state === "pending")
      ) {
        // Balances are checked before the deployment is touched.
        await openBudget();
        ran = await withLiveSession(
          deps.driver,
          sessionFileIn(store),
          { runId: store.runId, settings, ...deps.session },
          (session) => {
            // Production parity and the pool limits in effect, as confirmed (proposal 5.5).
            settingsInEffect = session.confirmed;
            return runWorkspaceUnits(
              schedule.workspaces,
              workspacePhase,
              session
            );
          },
          () => new Date(deps.clock.now())
        );
      } else
        ran = await runWorkspaceUnits(
          schedule.workspaces,
          workspacePhase,
          null
        );
      workspaceResults = ran.results;
      stopWith(ran.stopped);

      competitors = await runCompetitorUnits(
        schedule.competitorTasks.map((id) => tasks.get(id)!),
        {
          ledger,
          signal,
          clock: deps.clock,
          gate,
          budget: openBudget,
          accountIds: [harnessAccount, deps.accounts.treg.accountId],
          providerCalls: deps.providerCalls,
          harnessModel: deps.harnessModel,
          secrets: deps.secrets,
          log: deps.log,
        }
      );
      stopWith(competitors.stopped);
      await saveBudget();

      await saveBudget();

      if (schedule.judges) {
        const ownWorkspaces = completed(workspaceResults);
        const judgedWorkspaces = [
          ...earlier
            .filter((item) =>
              schedule.judgesWorkspacesOf.includes(item.segment)
            )
            .flatMap((item) => item.workspaces),
          ...ownWorkspaces,
        ];
        const targets = [
          ...judgedWorkspaces.flatMap((workspace) =>
            reacherxTargets(
              workspace,
              tasks.get(workspace.taskId)!,
              segment,
              frozen.seed
            )
          ),
          ...completedCompetitors(competitors).flatMap((outcome) =>
            competitorTargets(outcome, segment)
          ),
        ];
        judgeTargets = targets.map((target) => target.unitId);
        judging = await runJudgingUnits(targets, tasks, {
          ledger,
          store,
          signal,
          clock: deps.clock,
          gate,
          budget: openBudget,
          accountIds: [harnessAccount],
          models: {
            primary: peopleSearchPlan.models.judges,
            tieBreaker: peopleSearchPlan.models.tieBreaker,
          },
          judgeCall: deps.judgeCall,
          evidence: deps.evidence,
          log: deps.log,
        });
        stopWith(judging.stopped);
      }
    } catch (error) {
      if (!(error instanceof BudgetStop)) throw error;
      stopWith(error);
    } finally {
      deps.signal.removeEventListener("abort", interrupted);
    }
    await saveBudget();

    const workspaces = completed(workspaceResults);
    const competitorOutcomes = competitors
      ? completedCompetitors(competitors)
      : [];
    const cases = judging?.judged ?? [];
    const notReached =
      workspaceResults.filter((item) => item.outcome === null).length +
      (competitors?.notReached ?? 0) +
      (judging?.notReached ?? 0);
    const status =
      ended.stop?.status ??
      (deps.signal.aborted || notReached ? "interrupted" : "complete");

    let labels: HumanLabels | null = previous?.labels ?? null;
    if (status === "complete" && schedule.humanLabels) {
      const smoke = earlier.find((item) => item.segment === "smoke");
      const pool =
        segment === "pilot" ? [...(smoke?.cases ?? []), ...cases] : cases;
      const pilotSheet =
        segment === "main"
          ? await store.readPrivate(
              "benchmarks/.local/people-search/labels/pilot/sheet.csv"
            )
          : null;
      labels = await humanLabels(
        store,
        segment,
        pool.map((item) => item.record),
        schedule.humanLabels,
        frozen.seed,
        pilotSheet ? sheetCaseIds(pilotSheet) : new Set()
      );
    }

    // Closing balances after paid work, or to complete an earlier attempt
    // whose closing read failed. If they stay unreadable the costs are marked
    // incomplete, and cost-based decisions wait for a rerun to read them.
    let accountsSummary = previous?.accounts ?? null;
    const savedBaseline = await store.readPrivate(baselinePath);
    // Also when an earlier attempt stopped after its last unit but before
    // writing its outcome, so no closing summary exists yet.
    if (
      savedBaseline !== null &&
      (opened.budget || !accountsSummary || accountsSummary.end === null)
    ) {
      const baseline = budgetBaselineSchema.parse(JSON.parse(savedBaseline));
      const end = await finalReadings(accounts, deps.clock);
      const use = end ? accountUse(baseline, end) : null;
      const startFromBaseline = baseline.balances.map(
        ({ accountId, available }) => ({
          accountId,
          unit:
            accounts.find((account) => account.accountId === accountId)?.unit ??
            ("usd" as const),
          available,
          spentToDate: null,
          recordedAt: "",
          note: null,
        })
      );
      accountsSummary = {
        start: [
          ...(previous?.accounts?.start ??
            (opened.start.length ? opened.start : startFromBaseline)),
        ],
        end,
        spent: use?.spent ?? null,
        balanceChange: use?.balanceChange ?? null,
        shared: sharedIds,
      };
    }
    const exaUsd = competitorOutcomes
      .flatMap((item) => item.usage)
      .filter((usage) => usage.provider === "exa")
      .reduce((sum, usage) => sum + (usage.reportedUsd ?? 0), 0);
    // Dollars spent: guarded accounts' own spend (not the shared keys'
    // balances), X data by the deployment's records, and Exa's reported cost.
    const guardedUsd = Object.entries(accountsSummary?.spent ?? {})
      .filter(
        ([accountId]) =>
          !sharedIds.includes(accountId) &&
          accounts.find((account) => account.accountId === accountId)?.unit ===
            "usd"
      )
      .reduce((sum, [, spent]) => sum + spent, 0);
    const xUsd = recordedDataUse(
      workspaces.map((item) => item.record),
      dataIds
    )[dataIds.x];
    const stepUsd =
      accountsSummary && accountsSummary.end === null
        ? null
        : guardedUsd + exaUsd + xUsd;

    const review = [
      ...workspaceResults.flatMap((item) =>
        item.outcome?.status === "needs-review"
          ? [
              {
                unitId: workspaceUnitId(item.slot),
                reason: item.outcome.reason,
              },
            ]
          : []
      ),
      ...(competitors?.review ?? []),
      ...(judging?.review ?? []),
    ];
    const outcome: SegmentOutcome = segmentOutcomeSchema.parse({
      segment,
      runId: store.runId,
      status,
      stopReason:
        ended.stop?.reason ??
        (status === "interrupted" ? "The step was interrupted." : null),
      settings: settingsInEffect,
      judgeTargets,
      stage2: schedule.stage2,
      units: { ...ledger.tally },
      workspaces,
      translations: competitors?.translations ?? [],
      competitors: competitorOutcomes,
      cases,
      review,
      notReached,
      accounts: accountsSummary,
      labels,
      decision: null,
      stepUsd,
    });
    const context: ReportContext = {
      planSha256: frozen.planSha256,
      seed: frozen.seed,
      rates,
      earlier,
      plannedCycleCostUsd,
    };
    const decided: SegmentOutcome = {
      ...outcome,
      decision: decide(outcome, context, schedule.decisionPoint),
    };
    const report = renderSegmentReport(decided, context);
    const decision = renderDecision(decided, context);
    const files = [
      store.runFile("outcome.json"),
      store.runFile("report.md"),
      store.runFile("aggregate.json"),
      ...(decision
        ? [store.runFile(`decision-${decided.decision!.point}.md`)]
        : []),
    ];
    await store.writePrivate(files[0], JSON.stringify(decided));
    await store.writePrivate(files[1], report);
    await store.writePrivate(
      files[2],
      JSON.stringify(aggregateReport(decided, context), null, 2)
    );
    if (decision) await store.writePrivate(files[3], decision);
    return { outcome: decided, report, decision, files };
  });
}

function completed(
  results: readonly WorkspaceUnitResult[]
): WorkspaceOutcome[] {
  return results.flatMap((item) =>
    item.outcome?.status === "completed" ? [item.outcome.value] : []
  );
}

function completedCompetitors(
  competitors: Awaited<ReturnType<typeof runCompetitorUnits>>
): CompetitorOutcome[] {
  return competitors.results.flatMap((item) =>
    item.outcome?.status === "completed" ? [item.outcome.value] : []
  );
}
