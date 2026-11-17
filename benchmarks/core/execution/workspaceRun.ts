import { setTimeout as delay } from "node:timers/promises";
import {
  LEARNING_OFF_SETTING,
  type BenchmarkWorkspace,
  type ConvexReacherXDriver,
  type ExportedProspect,
  type LinkdApiUnits,
  type RecordedRunCosts,
  type ResumeResult,
  type RunStatus,
  type StopResult,
} from "./convex";
import { BudgetStop } from "./spend";
import type { LearningCondition } from "../types";

/**
 * Proposal 5.3 step 2: one ReacherX workspace from creation to pause. The
 * deployment schedules its own cycles; the runner counts them by workflow,
 * turns automatic cycles off once the last planned cycle has started, cancels
 * any next cycle scheduled anyway, waits for the last qualification and lesson
 * writing, and records each cycle's timing and the deployment key's spend.
 * Times come from the deployment where it reports them (cycle starts) and
 * from this machine's polls otherwise, so the machine clock must be synced.
 */

export type Clock = Readonly<{
  now(): number;
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}>;

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms, signal) => delay(ms, undefined, { signal }),
};

export type WorkspacePlan = Readonly<{
  // Unique within the run; the workspace is named after it.
  label: string;
  userId: string;
  prompt: string;
  useCaseKey: string;
  learning: LearningCondition;
  cycles: number;
}>;

export type WatchOptions = Readonly<{
  pollMs: number;
  // Consecutive polls without pending qualification or lesson writing (and,
  // under a match limit, unparked enrichment) that count as settled.
  settlePolls: number;
  startTimeoutMs: number;
  // Longest from a cycle's start until it settles or the next cycle starts.
  maxCycleMs: number;
  // The gap the deployment schedules after a cycle; projects the last cycle's period.
  scheduledGapMs: number;
  // Wait before the final spend reading, because key usage is reported with a delay.
  spendSettleMs: number;
  maxPollFailures: number;
  signal?: AbortSignal;
}>;

export type WorkspaceHooks = Readonly<{
  // Cumulative spend of the deployment's OpenRouter key, or null when unreadable.
  readSpendUsd(): Promise<number | null>;
  // Runs before each poll, with the workspace once it exists; throws
  // BudgetStop to end the workspace.
  checkBudget(workspace: BenchmarkWorkspace | null): Promise<void>;
  // Records the workspace before it can spend, and clears it once stopped cleanly.
  track(workspace: BenchmarkWorkspace | null): Promise<void>;
}>;

export type CycleRecord = Readonly<{
  cycle: number;
  workflowId: string;
  startedAt: number;
  // First poll that saw the cycle's workflow finished, and how it finished.
  discoveryEndedAt: number | null;
  outcome: string | null;
  // First of the quiet polls after discovery ended.
  settledAt: number | null;
  // When the next cycle started; for the last cycle, when it was scheduled or would have been.
  nextStartAt: number | null;
  nextStartObserved: boolean;
  spendAtStartUsd: number | null;
  spendAtEndUsd: number | null;
  // A cycle resumed after the harness stopped it: the time it stood paused,
  // which its active time leaves out.
  pausedMs?: number;
}>;
type MutableCycle = { -readonly [K in keyof CycleRecord]: CycleRecord[K] };

export const WORKSPACE_ENDINGS = [
  "planned-cycles",
  "cycle-failed",
  "extra-cycle",
  "workspace-halted",
  "timed-out",
  "status-unreadable",
  "workspace-missing",
  "budget-stop",
  "interrupted",
] as const;
export type WorkspaceEnding = (typeof WORKSPACE_ENDINGS)[number];

/**
 * One continuation of a workspace the harness had stopped (`pnpm benchmark
 * --live <step> --resume-held`): the same workspace and cycle, run again so
 * its qualification, enrichment and lesson writing finish. No discovery cycle
 * starts in a continuation.
 */
export type ResumeRecord = Readonly<{
  // What had stopped it, as recorded then.
  after: WorkspaceEnding;
  afterDetail: string | null;
  // Whether the cycle's discovery had finished before that stop; when not,
  // it was cut off by the stop and is not repeated.
  discoveryCompleted: boolean;
  stoppedAt: number;
  resumedAt: number;
  endedAt: number;
  ending: WorkspaceEnding;
  // The deployment key's cumulative spend at the stop, at the resume and after.
  spend: Readonly<{
    atStopUsd: number | null;
    atResumeUsd: number | null;
    afterUsd: number | null;
  }>;
  // The deployment's own records for the workspace up to the stop.
  recordedAtStop: Readonly<{
    costs: RecordedRunCosts | null;
    linkdApi: LinkdApiUnits | null;
  }>;
  // What the deployment requeued; null when the resume call failed.
  requeued: ResumeResult | null;
  // The match limit per cycle in force for this continuation, set by the
  // step from its live session; absent in records made before the limit
  // existed, when none could apply.
  matchLimitPerCycle?: number | null;
}>;

export type WorkspaceRunRecord = Readonly<{
  label: string;
  workspace: BenchmarkWorkspace;
  learning: LearningCondition;
  plannedCycles: number;
  // Local times: the prompt's submission (speed is measured from here), start, end.
  submittedAt: number;
  startedAt: number;
  endedAt: number;
  ending: WorkspaceEnding;
  detail: string | null;
  cycles: readonly CycleRecord[];
  spend: Readonly<{
    atSubmitUsd: number | null;
    beforeStartUsd: number | null;
    afterUsd: number | null;
  }>;
  // What the app recorded itself; the key's spend stays the cost of record.
  recorded: Readonly<{
    costs: RecordedRunCosts | null;
    linkdApi: LinkdApiUnits | null;
  }>;
  stop: StopResult;
  prospects: readonly ExportedProspect[];
  // Continuations after harness stops, oldest first; absent for a workspace
  // that ran without one.
  resumed?: readonly ResumeRecord[];
  // The match limit per cycle in force from the workspace's start until any
  // continuation, set by the step from its live session; absent in records
  // made before the limit existed, when none could apply.
  matchLimitPerCycle?: number | null;
}>;

export class WorkspaceRunError extends Error {}

// Endings where work already running is cut off as far as the deployment
// allows: the LinkedIn kill switch first, then a stop that also cancels the
// prospects' running qualification and enrichment workflows.
const FIRM_STOP_ENDINGS: readonly WorkspaceEnding[] = [
  "budget-stop",
  "interrupted",
];

/** Stops the workspace, firmly after a budget stop or an interruption. */
async function stopWorkspace(
  driver: ConvexReacherXDriver,
  workspace: BenchmarkWorkspace,
  ending: WorkspaceEnding
) {
  const halt = FIRM_STOP_ENDINGS.includes(ending);
  // Best effort: the stop below must happen even if the switch cannot be set.
  if (halt) await driver.haltLinkedIn(workspace).catch(() => undefined);
  return driver.stop(workspace, { halt });
}

const TERMINAL_STATES = new Set(["completed", "failed", "canceled"]);
const LABEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
// Clock difference allowed when recovering a workspace whose creation timed out.
const CLOCK_MARGIN_MS = 5 * 60_000;

/**
 * Qualification and enrichment still to finish. Work the match limit parked
 * for the rest of the cycle counts as finished, so a cycle that reached its
 * limit settles once the work already running is done.
 */
function openWork(status: NonNullable<RunStatus>) {
  const parked = status.matchLimit?.parked;
  return {
    pending: status.counts.pending - (parked?.pending ?? 0),
    enrichmentWaiting:
      status.counts.enrichmentWaiting - (parked?.enrichmentWaiting ?? 0),
  };
}

async function prepare(
  driver: ConvexReacherXDriver,
  plan: WorkspacePlan,
  submittedAt: number
) {
  try {
    return await driver.prepare({
      userId: plan.userId,
      label: plan.label,
      prompt: plan.prompt,
      useCaseKey: plan.useCaseKey,
    });
  } catch (error) {
    // The CLI can fail after the workspace was created; never create a second one.
    const found = await driver
      .findPrepared({
        userId: plan.userId,
        label: plan.label,
        since: submittedAt - CLOCK_MARGIN_MS,
      })
      .catch(() => null);
    if (!found) throw error;
    return found;
  }
}

async function watchCycles(
  driver: ConvexReacherXDriver,
  workspace: BenchmarkWorkspace,
  plan: WorkspacePlan,
  hooks: WorkspaceHooks,
  options: WatchOptions,
  clock: Clock,
  cycles: MutableCycle[],
  firstCycleSpendUsd: number | null
): Promise<{ ending: WorkspaceEnding; detail: string | null }> {
  let deadline = clock.now() + options.startTimeoutMs;
  let automatic = plan.cycles > 1;
  let failures = 0;
  // A streak of idle polls with an unchanged prospect count.
  let quiet = null as { since: number; polls: number; total: number } | null;
  for (;;) {
    options.signal?.throwIfAborted();
    try {
      await hooks.checkBudget(workspace);
    } catch (error) {
      if (error instanceof BudgetStop)
        return { ending: "budget-stop", detail: error.message };
      throw error;
    }
    let status: RunStatus;
    try {
      status = await driver.status(workspace);
      failures = 0;
    } catch {
      failures += 1;
      if (failures >= options.maxPollFailures)
        return {
          ending: "status-unreadable",
          detail: `${failures} status reads failed in a row.`,
        };
      await clock.sleep(options.pollMs, options.signal);
      continue;
    }
    if (!status) return { ending: "workspace-missing", detail: null };
    const now = clock.now();

    const previous = cycles.at(-1);
    if (status.workflowId && status.workflowId !== previous?.workflowId) {
      const spend = await hooks.readSpendUsd();
      const startedAt = status.workflowStartedAt ?? now;
      if (previous) {
        // If its end was never seen between polls, it stays unknown and untimed.
        previous.outcome ??= "unknown";
        previous.nextStartAt = startedAt;
        previous.nextStartObserved = true;
        previous.spendAtEndUsd = spend;
      }
      cycles.push({
        cycle: cycles.length + 1,
        workflowId: status.workflowId,
        startedAt,
        discoveryEndedAt: null,
        outcome: null,
        settledAt: null,
        nextStartAt: null,
        nextStartObserved: false,
        spendAtStartUsd: previous ? spend : firstCycleSpendUsd,
        spendAtEndUsd: null,
      });
      quiet = null;
      if (cycles.length > plan.cycles)
        return {
          ending: "extra-cycle",
          detail: `Cycle ${cycles.length} started although ${plan.cycles} were planned.`,
        };
      deadline = now + options.maxCycleMs;
      if (cycles.length === plan.cycles && automatic) {
        await driver.setSetting("PROSPECTING_AUTO_RESCHEDULE", "0");
        automatic = false;
      }
    }

    const cycle = cycles.at(-1);
    if (!cycle) {
      if (now > deadline)
        return {
          ending: "timed-out",
          detail: "The first cycle did not start.",
        };
      await clock.sleep(options.pollMs, options.signal);
      continue;
    }
    const final = cycle.cycle === plan.cycles;
    if (
      cycle.discoveryEndedAt === null &&
      status.workflowState !== null &&
      TERMINAL_STATES.has(status.workflowState)
    ) {
      cycle.discoveryEndedAt = now;
      cycle.outcome = status.workflowState;
      if (final) {
        // Any next cycle scheduled anyway is canceled; the workspace keeps
        // running so qualification and lesson writing finish.
        const scheduled = status.nextRunAt;
        await driver.cancelScheduledCycles(workspace);
        cycle.nextStartAt = scheduled ?? now + options.scheduledGapMs;
      }
      if (status.workflowState !== "completed")
        return {
          ending: "cycle-failed",
          detail: `Cycle ${cycle.cycle} ended as ${status.workflowState}.`,
        };
    }
    if (
      !final &&
      cycle.discoveryEndedAt !== null &&
      status.workspaceStatus !== "running"
    )
      return {
        ending: "workspace-halted",
        detail: `The workspace is ${status.workspaceStatus ?? "unset"}${
          status.pauseReason ? ` (${status.pauseReason})` : ""
        }, so no next cycle will start.`,
      };

    if (cycle.discoveryEndedAt !== null && cycle.settledAt === null) {
      const open = openWork(status);
      // Under a match limit the cycle's own matches must also be enriched;
      // without one, enrichment is not waited for, as before.
      const idle =
        open.pending === 0 &&
        (status.matchLimit === null || open.enrichmentWaiting === 0) &&
        status.pendingLessonWrites === 0 &&
        !status.truncated;
      if (!idle) quiet = null;
      else if (quiet !== null && quiet.total === status.counts.total)
        quiet = { ...quiet, polls: quiet.polls + 1 };
      else quiet = { since: now, polls: 1, total: status.counts.total };
      if (quiet && quiet.polls >= options.settlePolls)
        cycle.settledAt = quiet.since;
    }
    if (final && cycle.settledAt !== null)
      return { ending: "planned-cycles", detail: null };
    if (now > deadline)
      return {
        ending: "timed-out",
        detail: `Cycle ${cycle.cycle} did not settle or hand over in time.`,
      };
    await clock.sleep(options.pollMs, options.signal);
  }
}

/**
 * Creates, starts, watches, stops and exports one workspace. After the start
 * it always stops the workspace and returns a record, whatever ended the
 * watch; only a failed stop or export throws, leaving the workspace tracked
 * for the session reset.
 */
export async function runWorkspace(
  driver: ConvexReacherXDriver,
  plan: WorkspacePlan,
  hooks: WorkspaceHooks,
  options: WatchOptions,
  clock: Clock = systemClock
): Promise<WorkspaceRunRecord> {
  if (!LABEL_PATTERN.test(plan.label))
    throw new WorkspaceRunError(
      "Workspace labels use letters, digits, '-' and '_', at most 80 characters."
    );
  if (!Number.isInteger(plan.cycles) || plan.cycles < 1)
    throw new WorkspaceRunError("A workspace runs at least one cycle.");
  const activity = await driver.activity();
  if (activity.truncated || activity.workspaceIds.length)
    throw new WorkspaceRunError(
      `Only one workspace may run at a time. Active: ${
        activity.truncated
          ? "too many to list"
          : activity.workspaceIds.join(", ")
      }.`
    );

  // Setup is paid, so nothing is created once the step is stopping or over budget.
  options.signal?.throwIfAborted();
  await hooks.checkBudget(null);
  const atSubmitUsd = await hooks.readSpendUsd();
  const submittedAt = clock.now();
  const workspace = await prepare(driver, plan, submittedAt);
  await hooks.track(workspace);

  await driver.setLearning(workspace, plan.learning);
  const named = await driver.getSetting(LEARNING_OFF_SETTING);
  if (
    plan.learning === "off" ? named !== workspace.workspaceId : named !== null
  )
    throw new WorkspaceRunError("The learning condition was not confirmed.");
  // Automatic cycles only when another cycle must follow the first.
  const automatic = plan.cycles > 1 ? "1" : "0";
  await driver.setSetting("PROSPECTING_AUTO_RESCHEDULE", automatic);
  if ((await driver.getSetting("PROSPECTING_AUTO_RESCHEDULE")) !== automatic)
    throw new WorkspaceRunError("The cycle schedule was not confirmed.");

  // Not started yet: if this throws, the session reset stops the tracked workspace.
  options.signal?.throwIfAborted();
  await hooks.checkBudget(workspace);
  const beforeStartUsd = await hooks.readSpendUsd();
  const startedAt = clock.now();

  const cycles: MutableCycle[] = [];
  let watched: { ending: WorkspaceEnding; detail: string | null };
  try {
    await driver.start(workspace).catch((error: unknown) => {
      // One attempt only; the CLI can fail after the deployment started it.
      throw Object.assign(new WorkspaceRunError("The start call failed."), {
        cause: error,
      });
    });
    watched = await watchCycles(
      driver,
      workspace,
      plan,
      hooks,
      options,
      clock,
      cycles,
      beforeStartUsd
    );
  } catch (error) {
    // Interrupted, the start failed or a driver call failed: still stop, measure and export.
    watched = {
      ending: "interrupted",
      detail: options.signal?.aborted
        ? "The step was interrupted."
        : error instanceof Error
          ? error.message
          : "The watch failed.",
    };
  }
  const endedAt = clock.now();
  const stop = await stopWorkspace(driver, workspace, watched.ending);
  if (!stop.cancelFailed && stop.monitorFailures.length === 0)
    await hooks.track(null);

  if (!options.signal?.aborted)
    await clock
      .sleep(options.spendSettleMs, options.signal)
      .catch(() => undefined);
  const afterUsd = await hooks.readSpendUsd();
  const last = cycles.at(-1);
  if (last && last.spendAtEndUsd === null) last.spendAtEndUsd = afterUsd;
  const costs = await driver
    .runCosts(workspace, workspace.createdAt)
    .catch(() => null);
  const linkdApi = await driver
    .linkdApiUnitsSince(workspace.createdAt)
    .catch(() => null);
  const prospects = await driver.exportCandidates(workspace);
  return {
    label: plan.label,
    workspace,
    learning: plan.learning,
    plannedCycles: plan.cycles,
    submittedAt,
    startedAt,
    endedAt,
    ending: watched.ending,
    detail: watched.detail,
    cycles,
    spend: { atSubmitUsd, beforeStartUsd, afterUsd },
    recorded: { costs, linkdApi },
    stop,
    prospects,
  };
}

// Harness endings after which the same workspace may be continued. A run
// whose status could not be read was stopped like any other, at its cycle.
const RESUMABLE_ENDINGS: readonly WorkspaceEnding[] = [
  "budget-stop",
  "interrupted",
  "status-unreadable",
];

/** Why a held workspace cannot be continued, or null when it can. */
export function resumeProblem(record: WorkspaceRunRecord): string | null {
  if (!RESUMABLE_ENDINGS.includes(record.ending))
    return `it ended ${record.ending}; only a budget stop, an interruption or unreadable status can be continued.`;
  if (
    !record.stop.stopped ||
    record.stop.cancelFailed ||
    record.stop.monitorFailures.length
  )
    return "it was not confirmed stopped.";
  if (!record.cycles.length)
    return "its first cycle never started, so there is nothing to continue.";
  if (record.cycles.length !== record.plannedCycles)
    return `it stopped in cycle ${record.cycles.length} of ${record.plannedCycles}; only the last planned cycle can be continued.`;
  return null;
}

/**
 * Watches a continuation until the cycle's qualification, enrichment and
 * lesson writing settle. A new discovery workflow, which must never start
 * here, ends it at once.
 */
async function watchContinuation(
  driver: ConvexReacherXDriver,
  workspace: BenchmarkWorkspace,
  workflowId: string,
  hooks: WorkspaceHooks,
  options: WatchOptions,
  clock: Clock
): Promise<{
  ending: WorkspaceEnding;
  detail: string | null;
  settledAt: number | null;
}> {
  const deadline = clock.now() + options.maxCycleMs;
  let failures = 0;
  let quiet = null as { since: number; polls: number; total: number } | null;
  for (;;) {
    options.signal?.throwIfAborted();
    try {
      await hooks.checkBudget(workspace);
    } catch (error) {
      if (error instanceof BudgetStop)
        return {
          ending: "budget-stop",
          detail: error.message,
          settledAt: null,
        };
      throw error;
    }
    let status: RunStatus;
    try {
      status = await driver.status(workspace);
      failures = 0;
    } catch {
      failures += 1;
      if (failures >= options.maxPollFailures)
        return {
          ending: "status-unreadable",
          detail: `${failures} status reads failed in a row.`,
          settledAt: null,
        };
      await clock.sleep(options.pollMs, options.signal);
      continue;
    }
    if (!status)
      return { ending: "workspace-missing", detail: null, settledAt: null };
    const now = clock.now();
    if (status.workflowId !== workflowId)
      return {
        ending: "extra-cycle",
        detail: "A discovery cycle started during the continuation.",
        settledAt: null,
      };
    if (status.workspaceStatus !== "running")
      return {
        ending: "workspace-halted",
        detail: `The workspace is ${status.workspaceStatus ?? "unset"}${
          status.pauseReason ? ` (${status.pauseReason})` : ""
        }, so its remaining work stopped.`,
        settledAt: null,
      };
    const open = openWork(status);
    const idle =
      open.pending === 0 &&
      open.enrichmentWaiting === 0 &&
      status.pendingLessonWrites === 0 &&
      !status.truncated;
    if (!idle) quiet = null;
    else if (quiet !== null && quiet.total === status.counts.total)
      quiet = { ...quiet, polls: quiet.polls + 1 };
    else quiet = { since: now, polls: 1, total: status.counts.total };
    if (quiet && quiet.polls >= options.settlePolls)
      return { ending: "planned-cycles", detail: null, settledAt: quiet.since };
    if (now > deadline)
      return {
        ending: "timed-out",
        detail: "The continued cycle did not settle in time.",
        settledAt: null,
      };
    await clock.sleep(options.pollMs, options.signal);
  }
}

/**
 * Continues a workspace the harness stopped (a budget stop or an
 * interruption) at the cycle it stopped in, inside the step's live session:
 * the deployment requeues the cycle's unfinished qualification, enrichment and
 * lesson writing without starting discovery, the runner waits for them to
 * settle (with the same budget guard), then stops and exports the workspace.
 * Returns the workspace's record with this continuation added: its spend and
 * records run from the original start, and the pause is left out of the
 * cycle's active time. Like runWorkspace, after the resume call it always
 * stops the workspace.
 */
export async function resumeWorkspace(
  driver: ConvexReacherXDriver,
  held: WorkspaceRunRecord,
  hooks: WorkspaceHooks,
  options: WatchOptions,
  clock: Clock = systemClock
): Promise<WorkspaceRunRecord> {
  const problem = resumeProblem(held);
  if (problem)
    throw new WorkspaceRunError(`This workspace cannot be resumed: ${problem}`);
  const { workspace } = held;
  const last = held.cycles.at(-1)!;
  const activity = await driver.activity();
  if (activity.truncated || activity.workspaceIds.length)
    throw new WorkspaceRunError(
      `Only one workspace may run at a time. Active: ${
        activity.truncated
          ? "too many to list"
          : activity.workspaceIds.join(", ")
      }.`
    );
  options.signal?.throwIfAborted();
  // The earlier attempt's use counts, so this refuses before anything changes.
  await hooks.checkBudget(workspace);
  await hooks.track(workspace);

  await driver.setLearning(workspace, held.learning);
  const named = await driver.getSetting(LEARNING_OFF_SETTING);
  if (
    held.learning === "off" ? named !== workspace.workspaceId : named !== null
  )
    throw new WorkspaceRunError("The learning condition was not confirmed.");
  // A continuation never schedules a cycle; the deployment refuses otherwise.
  await driver.setSetting("PROSPECTING_AUTO_RESCHEDULE", "0");
  if ((await driver.getSetting("PROSPECTING_AUTO_RESCHEDULE")) !== "0")
    throw new WorkspaceRunError("Automatic cycles were not confirmed off.");
  const before = await driver.status(workspace);
  if (
    !before ||
    before.workspaceStatus !== "paused" ||
    before.workflowId !== last.workflowId ||
    before.workflowState === null ||
    !TERMINAL_STATES.has(before.workflowState)
  )
    throw new WorkspaceRunError(
      "The workspace is not paused at the cycle it stopped in, so it is not resumed."
    );

  options.signal?.throwIfAborted();
  await hooks.checkBudget(workspace);
  const atResumeUsd = await hooks.readSpendUsd();
  const resumedAt = clock.now();
  let requeued: ResumeResult | null = null;
  let watched: Awaited<ReturnType<typeof watchContinuation>>;
  try {
    requeued = await driver
      .resume(workspace, last.workflowId)
      .catch((error: unknown) => {
        throw Object.assign(new WorkspaceRunError("The resume call failed."), {
          cause: error,
        });
      });
    watched = await watchContinuation(
      driver,
      workspace,
      last.workflowId,
      hooks,
      options,
      clock
    );
  } catch (error) {
    watched = {
      ending: "interrupted",
      detail: options.signal?.aborted
        ? "The step was interrupted."
        : error instanceof Error
          ? error.message
          : "The watch failed.",
      settledAt: null,
    };
  }
  const endedAt = clock.now();
  const stop = await stopWorkspace(driver, workspace, watched.ending);
  if (!stop.cancelFailed && stop.monitorFailures.length === 0)
    await hooks.track(null);

  if (!options.signal?.aborted)
    await clock
      .sleep(options.spendSettleMs, options.signal)
      .catch(() => undefined);
  const afterUsd = await hooks.readSpendUsd();
  const costs = await driver
    .runCosts(workspace, workspace.createdAt)
    .catch(() => null);
  const linkdApi = await driver
    .linkdApiUnitsSince(workspace.createdAt)
    .catch(() => null);
  const prospects = await driver.exportCandidates(workspace);
  return {
    ...held,
    endedAt,
    ending: watched.ending,
    detail: watched.detail,
    cycles: held.cycles.map((cycle) =>
      cycle === last
        ? {
            ...cycle,
            outcome: cycle.outcome ?? before.workflowState,
            settledAt: watched.settledAt,
            spendAtEndUsd: afterUsd,
            pausedMs: (cycle.pausedMs ?? 0) + (resumedAt - held.endedAt),
          }
        : cycle
    ),
    spend: { ...held.spend, afterUsd },
    recorded: { costs, linkdApi },
    stop,
    prospects,
    resumed: [
      ...(held.resumed ?? []),
      {
        after: held.ending,
        afterDetail: held.detail,
        discoveryCompleted: last.discoveryEndedAt !== null,
        stoppedAt: held.endedAt,
        resumedAt,
        endedAt,
        ending: watched.ending,
        spend: { atStopUsd: held.spend.afterUsd, atResumeUsd, afterUsd },
        recordedAtStop: held.recorded,
        requeued,
      },
    ],
  };
}

/**
 * Decision-point measurements (proposal 6.4). The first cycle includes the
 * workspace's setup, which only it needs. Active time counts only when the
 * cycle settled before the next one started (or was due to); a resumed
 * cycle's pause is left out of it, while its cost runs from its start to the
 * continuation's end on the deployment key, which nothing else uses.
 */
export function cycleMeasurements(taskId: string, record: WorkspaceRunRecord) {
  const { atSubmitUsd, beforeStartUsd } = record.spend;
  const setupUsd =
    atSubmitUsd !== null && beforeStartUsd !== null
      ? beforeStartUsd - atSubmitUsd
      : null;
  return record.cycles.map((cycle) => {
    const own =
      cycle.spendAtStartUsd !== null && cycle.spendAtEndUsd !== null
        ? cycle.spendAtEndUsd - cycle.spendAtStartUsd
        : null;
    return {
      taskId,
      cycle: cycle.cycle,
      costUsd:
        cycle.cycle === 1
          ? own !== null && setupUsd !== null
            ? own + setupUsd
            : null
          : own,
      // A resumed cycle's pause is not active time.
      activeMs:
        cycle.settledAt !== null &&
        (cycle.nextStartAt === null ||
          cycle.settledAt - (cycle.pausedMs ?? 0) <= cycle.nextStartAt)
          ? cycle.settledAt - cycle.startedAt - (cycle.pausedMs ?? 0)
          : null,
      gapMs:
        cycle.nextStartAt !== null ? cycle.nextStartAt - cycle.startedAt : null,
    };
  });
}

/** Proposal 5.7: prospects carry no cycle, so each is placed by when it was found. */
export function cycleOfProspect(cycles: readonly CycleRecord[]) {
  return (prospect: Pick<ExportedProspect, "createdAt">) =>
    cycles.findLast((cycle) => cycle.startedAt <= prospect.createdAt)?.cycle ??
    null;
}
