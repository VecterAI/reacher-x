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
  advanceTracked,
  budgetBaselineSchema,
  type AccountReader,
  type UsageAccount,
  type AccountReading,
} from "../../core/steps/balances";
import { WorkspaceGate } from "../../core/steps/keyGate";
import {
  StepHalted,
  UnitLedger,
  toJson,
  type StepStop,
} from "../../core/steps/units";
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
  heldForResume,
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

/**
 * LinkdAPI calls enrichment's keyword post search may make for one workspace
 * per cycle in a live step, unless its approval sets another number (or null
 * for none). Each enriched LinkedIn prospect's search takes up to 18 calls
 * (nine finance keywords, each with a full-history fallback), so 50 covers
 * about three prospects' full searches per cycle, against the smoke test's
 * 656 such calls in one cycle. A step-only setting: it is never part of the frozen run settings, so
 * the frozen plan is unchanged.
 */
export const DEFAULT_KEYWORD_POST_SEARCH_CALLS = 50;

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
  // The development-only keyword post-search cap per workspace cycle; null for none.
  keywordPostSearchCallsPerCycle: z
    .number()
    .int()
    .min(1)
    .max(100_000)
    .nullable()
    .default(DEFAULT_KEYWORD_POST_SEARCH_CALLS),
  // The development-only match limit per workspace cycle, applied through the
  // plan-limit gate; absent or null for none. Fixed for the step.
  matchLimitPerCycle: z
    .number()
    .int()
    .min(1)
    .max(100_000)
    .nullable()
    .default(null),
  // The development-only match limit per workspace over all its cycles (the
  // query's total), applied the same way; once reached, no further cycle
  // runs. Absent or null for none. Fixed for the step.
  matchLimitPerQuery: z
    .number()
    .int()
    .min(1)
    .max(100_000)
    .nullable()
    .default(null),
  // Runs only a first slice of the step: the named workspace units (for
  // example "w-p1-on"), each for at most `cycles` cycles (null for all its
  // planned cycles). The other workspaces stay pending, and competitors,
  // judges, labels and the decision wait for a run without a slice. A
  // workspace cut short of its planned cycles is held for review, never
  // reused as complete. Absent or null runs the whole step.
  slice: z
    .strictObject({
      workspaces: z.array(z.string().min(1)).min(1),
      cycles: z.number().int().min(1).nullable().default(null),
    })
    .nullable()
    .default(null),
  // Workspace units this step will not run, with the reason (for example
  // the pilot's prompt 6, dropped by the project lead on 20 Nov 2026 to save
  // budget). They are recorded as dropped by approval: never started and
  // never held, so the step completes over the units that ran. Only units
  // that never started can be dropped; the frozen work order is unchanged.
  drop: z
    .strictObject({
      workspaces: z.array(z.string().min(1)).min(1),
      reason: z.string().trim().min(1),
    })
    .nullable()
    .default(null),
});
export type SegmentApproval = z.infer<typeof segmentApprovalSchema>;

export const approvalPath = (segment: SegmentId) =>
  `benchmarks/.local/people-search/approvals/${segment}.json`;

export const segmentRunId = (planSha256: string, segment: SegmentId) =>
  `ps-${planSha256.slice(0, 12)}-${segment}`;

/**
 * The workspaces an approval's slice lets this run start, with their cycle
 * cap and the stop reason the run ends with; null for the whole step. The
 * schedule itself, and so the frozen run record, is never changed. A slice
 * naming a workspace the segment does not run is refused before anything runs.
 */
export function sliceOf(
  schedule: SegmentSchedule,
  slice: SegmentApproval["slice"]
) {
  if (!slice) return null;
  const ids = schedule.workspaces.map(workspaceUnitId);
  const unknown = slice.workspaces.filter((id) => !ids.includes(id));
  if (unknown.length)
    throw new RunnerStateError(
      `The slice in ${approvalPath(schedule.segment)} names ${unknown.join(", ")}, which ${schedule.segment} does not run; its workspaces are ${ids.join(", ")}.`
    );
  const workspaces = schedule.workspaces.filter((slot) =>
    slice.workspaces.includes(workspaceUnitId(slot))
  );
  const cycles = slice.cycles
    ? `at most ${slice.cycles} cycle(s) each`
    : "all planned cycles";
  return {
    workspaces,
    cycles: slice.cycles,
    reason: `Slice run (${approvalPath(schedule.segment)}): only ${workspaces.map(workspaceUnitId).join(", ")}, ${cycles}. The step's other workspaces, competitors, judges and decision are still pending.`,
  };
}

/**
 * The workspaces an approval drops, each with its reason; empty when it
 * drops none. A unit the segment does not run, one that already started
 * (any checkpoint), or one also named in a slice is refused before anything
 * runs.
 */
export async function droppedBy(
  schedule: SegmentSchedule,
  approval: Pick<SegmentApproval, "drop" | "slice"> | null,
  ledger: Pick<UnitLedger, "state">
): Promise<SegmentOutcome["dropped"]> {
  const drop = approval?.drop;
  if (!drop) return [];
  const path = approvalPath(schedule.segment);
  const ids = schedule.workspaces.map(workspaceUnitId);
  const unknown = drop.workspaces.filter((id) => !ids.includes(id));
  if (unknown.length)
    throw new RunnerStateError(
      `The drop in ${path} names ${unknown.join(", ")}, which ${schedule.segment} does not run; its workspaces are ${ids.join(", ")}.`
    );
  const started: string[] = [];
  for (const id of drop.workspaces) {
    const state = await ledger.state(id);
    if (state !== "new") started.push(`${id} (${state})`);
  }
  if (started.length)
    throw new RunnerStateError(
      `The drop in ${path} names ${started.join(", ")}; only a workspace that never started can be dropped.`
    );
  const sliced = drop.workspaces.filter((id) =>
    approval?.slice?.workspaces.includes(id)
  );
  if (sliced.length)
    throw new RunnerStateError(
      `${path} both drops and slices ${sliced.join(", ")}.`
    );
  return schedule.workspaces
    .filter((slot) => drop.workspaces.includes(workspaceUnitId(slot)))
    .map((slot) => ({
      unitId: workspaceUnitId(slot),
      taskId: slot.taskId,
      learning: slot.learning,
      reason: drop.reason,
    }));
}

/**
 * The main step runs a first cycle for every prompt the pilot did not run
 * (schedule.ts, amended 20 Nov 2026). Refused before anything runs when the
 * pilot's outcome disagrees: a prompt the pilot dropped that main does not
 * run, or one both would run.
 */
export function checkMainAgainstPilot(
  schedule: SegmentSchedule,
  pilot: Pick<SegmentOutcome, "workspaces" | "review" | "dropped">
) {
  // Main reuses the pilot's learning-on cycle 1 for a pilot prompt, so only
  // a prompt whose learning-on workspace ran counts as covered.
  const ran = new Set([
    ...pilot.workspaces
      .filter((item) => item.learning === "on")
      .map((item) => item.taskId),
    ...pilot.review.flatMap(
      (item) => /^w-(p\d+)-on$/.exec(item.unitId)?.[1] ?? []
    ),
  ]);
  const main = new Set(schedule.workspaces.map((slot) => slot.taskId));
  const missing = [...new Set(pilot.dropped.map((item) => item.taskId))].filter(
    (taskId) => !ran.has(taskId) && !main.has(taskId)
  );
  const twice = [...ran].filter((taskId) => main.has(taskId));
  if (missing.length || twice.length)
    throw new RunnerStateError(
      [
        ...(missing.length
          ? [
              `The pilot dropped ${missing.join(", ")}, but the main step does not run its first cycle.`,
            ]
          : []),
        ...(twice.length
          ? [
              `The pilot ran ${twice.join(", ")}, which the main step would run again.`,
            ]
          : []),
        "Update PILOT_PROMPTS_DROPPED in benchmarks/people-search/setup/schedule.ts to match the pilot before the main step.",
      ].join(" ")
    );
}

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
  // `--resume-held`: continue workspaces the harness stopped (a budget stop
  // or an interruption) at the cycle they stopped in, instead of leaving
  // them held for review. Never starts a new discovery cycle for them.
  resumeHeld?: boolean;
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
    if (segment === "main") {
      const pilot = earlier.find((item) => item.segment === "pilot");
      if (pilot) checkMainAgainstPilot(schedule, pilot);
    }
    const slice = sliceOf(schedule, approval?.slice ?? null);
    const ledger = new UnitLedger(store);
    // Drops recorded by an earlier run of this step stay dropped, so a
    // report-only rerun never turns them back into runnable work.
    const approved = await droppedBy(schedule, approval, ledger);
    const dropped = [
      ...(previous?.dropped ?? []).filter(
        (item) => !approved.some((next) => next.unitId === item.unitId)
      ),
      ...approved,
    ];
    // The schedule stays whole in the frozen record; dropped units never run.
    const runnable = schedule.workspaces.filter(
      (slot) => !dropped.some((item) => item.unitId === workspaceUnitId(slot))
    );
    // The workspaces this run may start or continue.
    const slots = slice?.workspaces ?? runnable;
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

    // Mid-step approval changes: increases apply between status polls; a
    // missing or invalid file keeps the approval in force. Logged on change.
    let lastApprovalNote: string | null = null;
    const note = (line: string) => {
      if (line !== lastApprovalNote) deps.log(line);
      lastApprovalNote = line;
    };
    const refreshApproval = async () => {
      if (!opened.budget) return;
      let next: SegmentApproval | null;
      try {
        next = await deps.readApproval(segment);
      } catch (error) {
        note(
          `${error instanceof Error ? error.message : "The approval file could not be read."} The approval in force is kept.`
        );
        return;
      }
      if (!next) {
        note(
          `${approvalPath(segment)} is missing; the approval in force is kept.`
        );
        return;
      }
      const { raised, kept } = opened.budget.raise(next.spend, next.credits);
      if (raised.length || kept.length)
        note(
          [
            ...(raised.length
              ? [`Approval raised mid-step: ${raised.join("; ")}.`]
              : []),
            ...(kept.length ? [`Not lowered: ${kept.join("; ")}.`] : []),
          ].join(" ")
        );
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
        refreshApproval,
        slice: slice && {
          workspaces: slice.workspaces.map(workspaceUnitId),
          cycles: slice.cycles,
        },
        log: deps.log,
      };
      const states = await Promise.all(
        slots.map((slot) => ledger.state(workspaceUnitId(slot)))
      );
      const held = deps.resumeHeld
        ? await heldForResume(slots, ledger)
        : { ready: new Map(), problems: [] };
      if (deps.resumeHeld) {
        for (const problem of held.problems)
          deps.log(`Not resumed: ${problem}`);
        if (!held.ready.size)
          throw new RunnerStateError(
            `--resume-held found no held workspace to continue in ${segment}${
              held.problems.length ? `: ${held.problems.join(" ")}` : "."
            } Run the step without it.`
          );
      }
      let ran: Awaited<ReturnType<typeof runWorkspaceUnits>>;
      if (
        !signal.aborted &&
        (held.ready.size > 0 ||
          states.some((state) => state === "new" || state === "pending"))
      ) {
        // Balances are checked before the deployment is touched.
        await openBudget();
        ran = await withLiveSession(
          deps.driver,
          sessionFileIn(store),
          {
            runId: store.runId,
            settings,
            // openBudget above refused the step without an approval.
            keywordPostSearchLimit: approval
              ? approval.keywordPostSearchCallsPerCycle
              : DEFAULT_KEYWORD_POST_SEARCH_CALLS,
            matchLimitPerCycle: approval?.matchLimitPerCycle ?? null,
            matchLimitPerQuery: approval?.matchLimitPerQuery ?? null,
            ...deps.session,
          },
          (session) => {
            // Production parity and the pool limits in effect, as confirmed (proposal 5.5).
            settingsInEffect = session.confirmed;
            return runWorkspaceUnits(
              runnable,
              workspacePhase,
              session,
              held.ready
            );
          },
          () => new Date(deps.clock.now())
        );
      } else ran = await runWorkspaceUnits(runnable, workspacePhase, null);
      workspaceResults = ran.results;
      stopWith(ran.stopped);
      // A slice ends after its workspaces; nothing else in the step runs.
      if (slice) stopWith(new StepHalted(slice.reason));

      competitors = await runCompetitorUnits(
        (slice ? [] : schedule.competitorTasks).map((id) => tasks.get(id)!),
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

      if (schedule.judges && !slice) {
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
      // The closing reading joins the tracked decreases, so a top-up before
      // a later resume cannot restore allowance already used.
      if (end)
        await store.writePrivate(
          baselinePath,
          JSON.stringify(advanceTracked(baseline, end))
        );
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
      // Opening balances are the step's first start, the same interval as
      // the change; this attempt's own reading is used only when it is that.
      const opening = startFromBaseline.map(
        (first) =>
          opened.start.find(
            (reading) =>
              reading.accountId === first.accountId &&
              reading.available === first.available
          ) ?? first
      );
      accountsSummary = {
        start: [...(previous?.accounts?.start ?? opening)],
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
      dropped,
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
