import { z } from "zod";
import {
  exportedProspectSchema,
  linkdApiUnitsSchema,
  runCostsSchema,
  stopResultSchema,
  type ConvexReacherXDriver,
} from "../../core/execution/convex";
import {
  LiveSessionError,
  type LiveSession,
} from "../../core/execution/liveSession";
import { BudgetStop } from "../../core/execution/spend";
import {
  WORKSPACE_ENDINGS,
  runWorkspace,
  type Clock,
  type WatchOptions,
  type WorkspaceEnding,
  type WorkspaceRunRecord,
} from "../../core/execution/workspaceRun";
import type { AccountReader, StepBudget } from "../../core/steps/balances";
import type { WorkspaceGate } from "../../core/steps/keyGate";
import {
  untilStopped,
  type UnitLedger,
  type UnitOutcome,
} from "../../core/steps/units";
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
  records: readonly WorkspaceRunRecord[],
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
  deployment: AccountReader;
  // SocialAPI and Renidly: shared with production, so their balances are
  // only checked for sufficiency before each workspace and recorded.
  x: AccountReader;
  linkedIn: AccountReader;
  log(line: string): void;
}>;

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
  session: LiveSession | null
) {
  const results: WorkspaceUnitResult[] = [];
  const dataIds = [phase.x.accountId, phase.linkedIn.accountId];
  // Workspaces whose recorded X and LinkedIn use counts against the approval.
  const ran: WorkspaceRunRecord[] = [];
  const recorded = () =>
    recordedDataUse(ran, {
      x: phase.x.accountId,
      linkedIn: phase.linkedIn.accountId,
    });
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
      let before: z.infer<typeof accountReadingSchema>[] = [];
      if (state === "new" || state === "pending") {
        if (phase.signal.aborted || !session) {
          results.push({ slot, outcome: null });
          continue;
        }
        const budget = await phase.budget();
        await budget.check([phase.deployment.accountId]);
        budget.checkRecorded(recorded());
        before = await budget.ensureAvailable(dataIds, recorded());
        phase.log(`Workspace ${slot.label}: ${slot.cycles} cycle(s).`);
      }
      let ending: WorkspaceEnding | null = null;
      let finished: WorkspaceRunRecord | null = null;
      const outcome = await phase.ledger.run(
        spec,
        workspaceOutcomeSchema,
        async () => {
          if (!session) throw new Error("No live session is open.");
          const budget = await phase.budget();
          const record = await runWorkspace(
            phase.driver,
            {
              label: slot.label,
              userId: phase.userId,
              prompt: slot.prompt,
              useCaseKey: slot.useCaseKey,
              learning: slot.learning,
              cycles: slot.cycles,
            },
            {
              readSpendUsd: () =>
                phase.deployment.spend
                  .read()
                  .then((snapshot) => snapshot.cumulativeUsd)
                  .catch(() => null),
              // Only the deployment key between polls: the X and LinkedIn
              // providers rate-limit per key, and the workspace uses them.
              checkBudget: () => budget.check([phase.deployment.accountId]),
              track: phase.gate.tracking(session.trackWorkspace),
            },
            { ...phase.watch, signal: phase.signal },
            phase.clock
          );
          ending = record.ending;
          finished = record;
          const after = await budget.read(dataIds).catch(() => []);
          return {
            taskId: slot.taskId,
            learning: slot.learning,
            label: slot.label,
            record,
            accountsBefore: before,
            accountsAfter: after,
          };
        },
        ({ record }) =>
          HARNESS_ENDINGS.includes(record.ending)
            ? `The workspace ended early (${record.ending})${record.detail ? `: ${record.detail}` : "."}`
            : null
      );
      // Recorded use counts whether the workspace finished or is held for review.
      if (outcome.status === "completed") ran.push(outcome.value.record);
      else if (finished) ran.push(finished);
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
