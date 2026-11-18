import { z } from "zod";
import {
  exportedProspectSchema,
  linkdApiUnitsSchema,
  resumeResultSchema,
  runCostsSchema,
  stopResultSchema,
  type BenchmarkWorkspace,
  type ConvexReacherXDriver,
} from "../../core/execution/convex";
import {
  LiveSessionError,
  type LiveSession,
} from "../../core/execution/liveSession";
import { BudgetStop } from "../../core/execution/spend";
import {
  WORKSPACE_ENDINGS,
  resumeProblem,
  resumeWorkspace,
  runWorkspace,
  type Clock,
  type WatchOptions,
  type WorkspaceEnding,
  type WorkspaceRunRecord,
} from "../../core/execution/workspaceRun";
import type {
  AccountReader,
  StepBudget,
  UsageAccount,
} from "../../core/steps/balances";
import type { WorkspaceGate } from "../../core/steps/keyGate";
import {
  UnitFailed,
  toJson,
  untilStopped,
  type UnitLedger,
  type UnitOutcome,
} from "../../core/steps/units";
import type { ArtifactReference } from "../../core/types";
import type { WorkspaceSlot } from "../setup/schedule";

/** Proposal 5.3 step 2: ReacherX, one workspace at a time, one checkpointed unit each. */

const nullableNumber = z.number().nullable();

export const workspaceRunRecordSchema: z.ZodType<WorkspaceRunRecord> = z.object(
  {
    label: z.string(),
    workspace: z.object({
      workspaceId: z.string(),
      createdAt: z.number(),
      label: z.string(),
    }),
    learning: z.enum(["on", "off"]),
    plannedCycles: z.number().int(),
    submittedAt: z.number(),
    startedAt: z.number(),
    endedAt: z.number(),
    ending: z.enum(WORKSPACE_ENDINGS),
    detail: z.string().nullable(),
    cycles: z.array(
      z.object({
        cycle: z.number().int(),
        workflowId: z.string(),
        startedAt: z.number(),
        discoveryEndedAt: nullableNumber,
        outcome: z.string().nullable(),
        settledAt: nullableNumber,
        nextStartAt: nullableNumber,
        nextStartObserved: z.boolean(),
        spendAtStartUsd: nullableNumber,
        spendAtEndUsd: nullableNumber,
        pausedMs: z.number().optional(),
      })
    ),
    spend: z.object({
      atSubmitUsd: nullableNumber,
      beforeStartUsd: nullableNumber,
      afterUsd: nullableNumber,
    }),
    recorded: z.object({
      costs: runCostsSchema.nullable(),
      linkdApi: linkdApiUnitsSchema.nullable(),
    }),
    stop: stopResultSchema,
    prospects: z.array(exportedProspectSchema),
    resumed: z
      .array(
        z.object({
          after: z.enum(WORKSPACE_ENDINGS),
          afterDetail: z.string().nullable(),
          discoveryCompleted: z.boolean(),
          stoppedAt: z.number(),
          resumedAt: z.number(),
          endedAt: z.number(),
          ending: z.enum(WORKSPACE_ENDINGS),
          spend: z.object({
            atStopUsd: nullableNumber,
            atResumeUsd: nullableNumber,
            afterUsd: nullableNumber,
          }),
          recordedAtStop: z.object({
            costs: runCostsSchema.nullable(),
            linkdApi: linkdApiUnitsSchema.nullable(),
          }),
          requeued: resumeResultSchema.nullable(),
          matchLimitPerCycle: nullableNumber.optional(),
          matchLimitPerQuery: nullableNumber.optional(),
        })
      )
      .optional(),
    matchLimitPerCycle: nullableNumber.optional(),
    matchLimitPerQuery: nullableNumber.optional(),
    queryLimitReached: z
      .object({ cycle: z.number().int(), limit: z.number().int() })
      .optional(),
    latestWorkflowId: z.string().optional(),
  }
);

export const accountReadingSchema = z.object({
  accountId: z.string(),
  unit: z.enum(["usd", "credits"]),
  available: z.number(),
  spentToDate: nullableNumber,
  recordedAt: z.string(),
  note: z.string().nullable().default(null),
});

export const workspaceOutcomeSchema = z.object({
  taskId: z.string(),
  learning: z.enum(["on", "off"]),
  label: z.string(),
  record: workspaceRunRecordSchema,
  // The X and LinkedIn account balances just before and after the workspace.
  // Those keys are also production's, so the change is recorded as the
  // account's change, never as the workspace's cost; that comes from the
  // deployment's own records (record.recorded).
  accountsBefore: z.array(accountReadingSchema),
  accountsAfter: z.array(accountReadingSchema),
});
export type WorkspaceOutcome = z.infer<typeof workspaceOutcomeSchema>;

/**
 * X and LinkedIn use the deployment recorded for these workspaces: SocialAPI
 * dollars (its own estimate, $0.20 per 1,000 tweets or users) and LinkdAPI
 * units. The deployment's OpenRouter key is not shared with production, so
 * its spend is measured directly; these two keys are, so their use is taken
 * from ReacherX's records instead.
 */
export function recordedDataUse(
  records: readonly Pick<WorkspaceRunRecord, "recorded">[],
  accounts: Readonly<{ x: string; linkedIn: string }>
) {
  return {
    [accounts.x]: records.reduce(
      (sum, record) =>
        sum + (record.recorded.costs?.providers.socialapi?.usd ?? 0),
      0
    ),
    [accounts.linkedIn]: records.reduce(
      (sum, record) => sum + (record.recorded.linkdApi?.billableUnits ?? 0),
      0
    ),
  };
}

// Endings the harness caused rather than the product: the workspace's data is
// incomplete, so it is kept for review and left out of the results.
const HARNESS_ENDINGS: readonly WorkspaceEnding[] = [
  "budget-stop",
  "interrupted",
  "status-unreadable",
  "workspace-missing",
];

export const workspaceUnitId = (
  slot: Pick<WorkspaceSlot, "taskId" | "learning">
) => `w-${slot.taskId}-${slot.learning}`;

export type WorkspacePhase = Readonly<{
  ledger: UnitLedger;
  driver: ConvexReacherXDriver;
  userId: string;
  watch: WatchOptions;
  clock: Clock;
  signal: AbortSignal;
  gate: WorkspaceGate;
  // Opens the step's budget on first use; only paid work needs it.
  budget: () => Promise<StepBudget>;
  // Its spend is the workspace's AI cost of record; checked between polls.
  deployment: UsageAccount;
  // SocialAPI and Renidly: shared with production, so their balances are
  // only checked for sufficiency before each workspace and recorded.
  x: AccountReader;
  linkedIn: AccountReader;
  // Re-reads the approval file between status polls and applies increases.
  refreshApproval?: () => Promise<void>;
  log(line: string): void;
}>;

/**
 * The in-cycle guard: the deployment key's spend, then the X and LinkedIn
 * use the deployment recorded for the earlier workspaces and this one,
 * against their approved amounts. Records that stay unreadable for
 * `maxFailures` checks in a row stop the workspace too.
 */
export function workspaceBudgetCheck(
  phase: Readonly<{
    driver: ConvexReacherXDriver;
    deployment: Pick<UsageAccount, "accountId">;
    x: Pick<AccountReader, "accountId">;
    linkedIn: Pick<AccountReader, "accountId">;
  }>,
  budget: Pick<StepBudget, "check" | "checkRecorded">,
  earlier: readonly Pick<WorkspaceRunRecord, "recorded">[],
  maxFailures: number,
  refreshApproval?: () => Promise<void>
) {
  let failures = 0;
  return async (workspace: BenchmarkWorkspace | null) => {
    // An approval raised mid-step applies from this poll on.
    await refreshApproval?.();
    await budget.check([phase.deployment.accountId]);
    if (!workspace) return;
    let recorded: WorkspaceRunRecord["recorded"];
    try {
      const [costs, linkdApi] = await Promise.all([
        phase.driver.runCosts(workspace, workspace.createdAt),
        phase.driver.linkdApiUnitsSince(workspace.createdAt),
      ]);
      recorded = { costs, linkdApi };
      failures = 0;
    } catch {
      failures += 1;
      if (failures >= maxFailures)
        throw new BudgetStop(
          `The deployment's X and LinkedIn records could not be read ${failures} times in a row.`
        );
      return;
    }
    budget.checkRecorded(
      recordedDataUse([...earlier, { recorded }], {
        x: phase.x.accountId,
        linkedIn: phase.linkedIn.accountId,
      })
    );
  };
}

const heldReceiptSchema = z.object({
  reason: z.string(),
  receipt: workspaceOutcomeSchema,
});

/** A held workspace that `--resume-held` may continue. */
export type HeldWorkspace = Readonly<{
  receipt: ArtifactReference;
  outcome: WorkspaceOutcome;
}>;

/**
 * The scheduled workspaces held for review that can be continued, and why
 * the others cannot. Only reads local checkpoints.
 */
export async function heldForResume(
  slots: readonly WorkspaceSlot[],
  ledger: UnitLedger
) {
  const ready = new Map<string, HeldWorkspace>();
  const problems: string[] = [];
  for (const slot of slots) {
    const id = workspaceUnitId(slot);
    if ((await ledger.state(id)) !== "needs-review") continue;
    const held = await ledger.held(id);
    const parsed = held ? heldReceiptSchema.safeParse(held.value) : null;
    if (!held || !parsed?.success) {
      problems.push(`${id}: its review receipt holds no workspace record.`);
      continue;
    }
    const problem = resumeProblem(parsed.data.receipt.record);
    if (problem) problems.push(`${id}: ${problem}`);
    else ready.set(id, { receipt: held.receipt, outcome: parsed.data.receipt });
  }
  return { ready, problems };
}

/** The record with `fields` added to its latest continuation. */
function withLatestContinuation(
  record: WorkspaceRunRecord,
  fields: Partial<NonNullable<WorkspaceRunRecord["resumed"]>[number]>
): WorkspaceRunRecord {
  const resumed = record.resumed;
  if (!resumed?.length) return record;
  return {
    ...record,
    resumed: resumed.map((entry, index) =>
      index === resumed.length - 1 ? { ...entry, ...fields } : entry
    ),
  };
}

export type WorkspaceUnitResult = Readonly<{
  slot: WorkspaceSlot;
  outcome: UnitOutcome<WorkspaceOutcome> | null;
}>;

/**
 * Runs the scheduled workspaces in order. A workspace already completed is
 * reused; one not yet started starts only while the step is not stopping and
 * a live session is open. A workspace that could not be confirmed stopped
 * ends the phase, so nothing else runs beside it; the session reset stops it.
 */
export async function runWorkspaceUnits(
  slots: readonly WorkspaceSlot[],
  phase: WorkspacePhase,
  session: LiveSession | null,
  // Held workspaces to continue (`--resume-held`), by unit ID.
  resumable: ReadonlyMap<string, HeldWorkspace> = new Map()
) {
  const results: WorkspaceUnitResult[] = [];
  const dataIds = [phase.x.accountId, phase.linkedIn.accountId];
  // Workspaces whose recorded X and LinkedIn use counts against the
  // approval: each one's latest record, by unit ID, so none counts twice.
  const ran = new Map<string, WorkspaceRunRecord>();
  const others = (unitId: string) =>
    [...ran].flatMap(([id, record]) => (id === unitId ? [] : [record]));
  const recorded = (records: readonly WorkspaceRunRecord[]) =>
    recordedDataUse(records, {
      x: phase.x.accountId,
      linkedIn: phase.linkedIn.accountId,
    });
  // Continuing held workspaces: every completed or held workspace's use
  // counts from the start; each is replaced as its own turn finishes.
  if (resumable.size)
    for (const slot of slots) {
      const id = workspaceUnitId(slot);
      const done = await phase.ledger.completed(id, workspaceOutcomeSchema);
      const held = resumable.get(id);
      if (done) ran.set(id, done.record);
      else if (held) ran.set(id, held.outcome.record);
    }
  const stopped = await untilStopped(async () => {
    for (const slot of slots) {
      const spec = {
        id: workspaceUnitId(slot),
        taskId: slot.taskId,
        toolId: "reacherx",
        learning: slot.learning,
        cycle: null,
        input: { ...slot },
      };
      const state = await phase.ledger.state(spec.id);
      const held =
        state === "needs-review" ? resumable.get(spec.id) : undefined;
      let before: z.infer<typeof accountReadingSchema>[] = [];
      if (state === "new" || state === "pending" || held) {
        if (phase.signal.aborted || !session) {
          results.push({ slot, outcome: null });
          continue;
        }
        // A held workspace's earlier use counts against the approval too.
        const used = recorded(
          held ? [...others(spec.id), held.outcome.record] : others(spec.id)
        );
        const budget = await phase.budget();
        await budget.check([phase.deployment.accountId]);
        budget.checkRecorded(used);
        before = await budget.ensureAvailable(dataIds, used);
        phase.log(
          held
            ? `Workspace ${slot.label}: resuming its cycle after ${held.outcome.record.ending}; no new discovery cycle.`
            : `Workspace ${slot.label}: ${slot.cycles} cycle(s).`
        );
      }
      let ending: WorkspaceEnding | null = null;
      let finished: WorkspaceRunRecord | null = null;
      const work = async () => {
        if (!session) throw new Error("No live session is open.");
        const budget = await phase.budget();
        const hooks = {
          readSpendUsd: () =>
            phase.deployment.spend
              .read()
              .then((snapshot) => snapshot.cumulativeUsd)
              .catch(() => null),
          // The deployment key's spend and the deployment's own X and
          // LinkedIn records; the providers' balance endpoints are not
          // read between polls, because they rate-limit per key.
          checkBudget: workspaceBudgetCheck(
            phase,
            budget,
            others(spec.id),
            phase.watch.maxPollFailures,
            phase.refreshApproval
          ),
          track: phase.gate.tracking(session.trackWorkspace),
        };
        const watch = { ...phase.watch, signal: phase.signal };
        // The match limits this session confirmed belong to the run or the
        // continuation they governed, since a step's sessions can differ.
        const limit = {
          matchLimitPerCycle: session.matchLimitPerCycle,
          matchLimitPerQuery: session.matchLimitPerQuery,
        };
        const record = held
          ? withLatestContinuation(
              await resumeWorkspace(
                phase.driver,
                held.outcome.record,
                hooks,
                watch,
                phase.clock
              ),
              limit
            )
          : {
              ...(await runWorkspace(
                phase.driver,
                {
                  label: slot.label,
                  userId: phase.userId,
                  prompt: slot.prompt,
                  useCaseKey: slot.useCaseKey,
                  learning: slot.learning,
                  cycles: slot.cycles,
                },
                hooks,
                watch,
                phase.clock
              )),
              ...limit,
            };
        ending = record.ending;
        finished = record;
        const after = await budget.read(dataIds).catch(() => []);
        return {
          taskId: slot.taskId,
          learning: slot.learning,
          label: slot.label,
          record,
          // A continued workspace keeps the readings from its first start.
          accountsBefore: held ? held.outcome.accountsBefore : before,
          accountsAfter: after,
        };
      };
      const review = ({ record }: WorkspaceOutcome) =>
        HARNESS_ENDINGS.includes(record.ending)
          ? `The workspace ended early (${record.ending})${record.detail ? `: ${record.detail}` : "."}`
          : null;
      const outcome = held
        ? await phase.ledger.resume(
            spec,
            held.receipt,
            workspaceOutcomeSchema,
            // A continuation that fails keeps the held record as its receipt,
            // so it can be continued again after review.
            () =>
              work().catch((error: unknown) => {
                throw new UnitFailed(
                  error instanceof Error
                    ? error.message
                    : "The continuation failed.",
                  toJson(held.outcome),
                  { cause: error }
                );
              }),
            review
          )
        : await phase.ledger.run(spec, workspaceOutcomeSchema, work, review);
      // Recorded use counts whether the workspace finished or is held for review.
      if (outcome.status === "completed")
        ran.set(spec.id, outcome.value.record);
      else if (finished) ran.set(spec.id, finished);
      results.push({ slot, outcome });
      if (outcome.status === "needs-review")
        phase.log(
          `Workspace ${slot.label} is held for review: ${outcome.reason}`
        );
      // A workspace not confirmed stopped (interrupted before its start, or a
      // failed stop) ends the phase; the session reset stops it.
      if (phase.gate.active) {
        if (phase.signal.aborted) break;
        throw new LiveSessionError(
          `Workspace ${slot.label} was not confirmed stopped; the session reset stops it.`
        );
      }
      // A workspace that reached the approved spend stops the step there.
      if (ending === "budget-stop")
        throw new BudgetStop(
          outcome.status === "needs-review"
            ? outcome.reason
            : "The approved spend was reached."
        );
      // Each workspace is costly and a failure is often the deployment's, so
      // the first one stops the step.
      if (outcome.status === "needs-review" && !phase.signal.aborted)
        phase.ledger.haltAfter(1, spec.id, outcome.reason);
    }
  });
  return { results, stopped };
}
