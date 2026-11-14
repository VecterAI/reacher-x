import { setTimeout as delay } from "node:timers/promises";
import {
  LEARNING_OFF_SETTING,
  type BenchmarkWorkspace,
  type ConvexReacherXDriver,
  type ExportedProspect,
  type LinkdApiUnits,
  type RecordedRunCosts,
  type RunStatus,
  type StopResult,
} from "./convex";
import { BudgetStop } from "./spend";
import type { LearningCondition } from "./types";

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
  // Consecutive polls without pending qualification or lesson writing that count as settled.
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
  // Runs before each poll; throws BudgetStop to end the workspace.
  checkBudget(): Promise<void>;
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
}>;
type MutableCycle = { -readonly [K in keyof CycleRecord]: CycleRecord[K] };

export type WorkspaceEnding =
  | "planned-cycles"
  | "cycle-failed"
  | "extra-cycle"
  | "workspace-halted"
  | "timed-out"
  | "status-unreadable"
  | "workspace-missing"
  | "budget-stop"
  | "interrupted";

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
}>;

export class WorkspaceRunError extends Error {}

const TERMINAL_STATES = new Set(["completed", "failed", "canceled"]);
const LABEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
// Clock difference allowed when recovering a workspace whose creation timed out.
const CLOCK_MARGIN_MS = 5 * 60_000;

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
      await hooks.checkBudget();
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
      const idle =
        status.counts.pending === 0 &&
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
  await hooks.checkBudget();
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
  await hooks.checkBudget();
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
  const stop = await driver.stop(workspace);
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

/**
 * Decision-point measurements (proposal 6.4). The first cycle includes the
 * workspace's setup, which only it needs. Active time counts only when the
 * cycle settled before the next one started (or was due to).
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
      activeMs:
        cycle.settledAt !== null &&
        (cycle.nextStartAt === null || cycle.settledAt <= cycle.nextStartAt)
          ? cycle.settledAt - cycle.startedAt
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
