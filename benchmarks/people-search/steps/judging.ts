import { z } from "zod";
import { exchangeSchema, type Transport } from "../../core/calls/http";
import type { FileCheckpointStore } from "../../core/execution/checkpoints";
import { cycleOfProspect, type Clock } from "../../core/execution/workspaceRun";
import {
  tavilyEvidence,
  type EvidenceCache,
} from "../../core/judging/evidence";
import {
  judgeCandidate,
  type CaseRecord,
} from "../../core/judging/judgeCandidate";
import {
  blindInputSchema,
  judgmentSchema,
  type JudgeCaller,
  type PanelModels,
} from "../../core/judging/judges";
import {
  drawLabelSample,
  judgeAgreement,
  parseLabelSheet,
  renderLabelBooklet,
  renderLabelSheet,
  type AgreementReport,
} from "../../core/judging/labels";
import type { StepBudget } from "../../core/steps/balances";
import type { WorkspaceGate } from "../../core/steps/keyGate";
import { toJson, untilStopped, type UnitLedger } from "../../core/steps/units";
import type { BenchmarkTask, Candidate } from "../../core/types";
import {
  companiesBehindPeople,
  sampleRejected,
  selectReacherXTopK,
  toCandidate,
  VIA_PEOPLE_TOOL_ID,
} from "../run/reacherx";
import { peopleSearchPlan } from "../setup/plan";
import type { SegmentId } from "../setup/schedule";
import type { CompetitorOutcome } from "./competitors";
import type { WorkspaceOutcome } from "./workspaces";

/** Proposal 5.3 step 4: web evidence, the blind panel and the tie-break, one checkpointed unit per result. */

const panelSchema = z.object({
  primary: z.tuple([judgmentSchema, judgmentSchema]),
  tieBreaker: judgmentSchema.nullable(),
  verdicts: z.record(z.string(), z.enum(["met", "partly_met", "not_met"])),
  verifiedMatch: z.boolean(),
  modelsObserved: z.array(z.string()),
  costUsd: z.number().nullable(),
});

export const caseRecordSchema: z.ZodType<CaseRecord> = z.object({
  caseId: z.string(),
  taskId: z.string(),
  toolId: z.string(),
  sourceId: z.string(),
  rank: z.number().int(),
  identity: z.string().nullable(),
  webEvidence: z
    .object({
      searchesUsed: z.union([z.literal(0), z.literal(1), z.literal(2)]),
      receipt: z.object({ path: z.string(), sha256: z.string() }),
    })
    .nullable(),
  input: blindInputSchema,
  panel: panelSchema,
  newestCitedEvidenceAgeDays: z.number().nullable(),
});

export const judgedCaseSchema = z.object({
  unitId: z.string(),
  // A result in a tool's top K, or a person ReacherX rejected (proposal 5.7).
  kind: z.enum(["top", "rejected"]),
  segment: z.string(),
  taskId: z.string(),
  toolId: z.string(),
  learning: z.enum(["on", "off"]).nullable(),
  cycle: z.number().int().nullable(),
  // From the prompt's submission until the result was usable; null for rejected people.
  availableAfterMs: z.number().nullable(),
  record: caseRecordSchema,
});
export type JudgedCase = z.infer<typeof judgedCaseSchema>;

export type JudgeTarget = Readonly<
  Omit<JudgedCase, "record"> & { candidate: Candidate }
>;

/**
 * ReacherX's judged results for one workspace: for each cycle, the five
 * best-fit qualified entities of the task's type among the prospects that
 * cycle found, and up to three of that cycle's rejected prospects of the same
 * type. With one cycle this is the workspace's top 5; per cycle it gives the
 * cycle-by-cycle measures. Rejected prospects of the other type are not
 * judged, since they cannot meet the prompt. On a company prompt, the
 * companies behind the cycle's best-fit people are judged too, as a labelled
 * measure of their own.
 */
export function reacherxTargets(
  outcome: WorkspaceOutcome,
  task: BenchmarkTask,
  segment: SegmentId,
  seed: number
): JudgeTarget[] {
  const { record } = outcome;
  const cycleOf = cycleOfProspect(record.cycles);
  const eligible = record.prospects.filter(
    (prospect) =>
      prospect.prospectType === task.entityType &&
      Boolean(prospect.displayName?.trim())
  );
  const base = {
    segment,
    taskId: task.id,
    toolId: "reacherx",
    learning: outcome.learning,
  };
  const prefix = `j-reacherx-${task.id}-${outcome.learning}`;
  const targets: JudgeTarget[] = [];
  for (const cycle of record.cycles) {
    const found = eligible.filter(
      (prospect) => cycleOf(prospect) === cycle.cycle
    );
    selectReacherXTopK(found, task.entityType, 5).forEach((prospect, index) => {
      const candidate = toCandidate(prospect, index + 1);
      if (candidate)
        targets.push({
          ...base,
          unitId: `${prefix}-c${cycle.cycle}-q${index + 1}`,
          kind: "top",
          cycle: cycle.cycle,
          availableAfterMs:
            (prospect.qualifiedAt ?? prospect.createdAt) - record.submittedAt,
          candidate,
        });
    });
    // On a company prompt, also the companies behind the cycle's qualified people.
    if (task.entityType === "organization")
      companiesBehindPeople(
        record.prospects.filter(
          (prospect) =>
            prospect.prospectType === "individual" &&
            cycleOf(prospect) === cycle.cycle
        ),
        // Every company is judged (agreed 18 Nov 2026); the top 5 count in the comparison.
        Number.POSITIVE_INFINITY
      ).forEach(({ prospect, candidate }) =>
        targets.push({
          ...base,
          toolId: VIA_PEOPLE_TOOL_ID,
          unitId: `${prefix}-c${cycle.cycle}-v${candidate.rank}`,
          kind: "top",
          cycle: cycle.cycle,
          availableAfterMs:
            (prospect.qualifiedAt ?? prospect.createdAt) - record.submittedAt,
          candidate,
        })
      );
  }
  const perCycle = new Map<number, number>();
  for (const { cycle, prospect } of sampleRejected(
    eligible,
    cycleOf,
    seed,
    peopleSearchPlan.judging.rejectedSamplePerPromptCycle
  )) {
    const index = (perCycle.get(cycle) ?? 0) + 1;
    perCycle.set(cycle, index);
    const candidate = toCandidate(prospect, index);
    if (candidate)
      targets.push({
        ...base,
        unitId: `${prefix}-c${cycle}-x${index}`,
        kind: "rejected",
        cycle,
        availableAfterMs: null,
        candidate,
      });
  }
  return targets;
}

/** A competitor's judged results: its top K as returned. */
export function competitorTargets(
  outcome: CompetitorOutcome,
  segment: SegmentId
): JudgeTarget[] {
  return outcome.candidates.map((candidate) => ({
    unitId: `j-${outcome.toolId}-${outcome.taskId}-r${candidate.rank}`,
    kind: "top",
    segment,
    taskId: outcome.taskId,
    toolId: outcome.toolId,
    learning: null,
    cycle: null,
    availableAfterMs: outcome.completedAfterMs,
    candidate,
  }));
}

const EVIDENCE_DIR = "benchmarks/.local/people-search/evidence";

/** Saved web searches, shared by every run of this checkout so one search is never paid twice. */
export function fileEvidenceCache(store: FileCheckpointStore): EvidenceCache {
  return {
    async read(key) {
      const text = await store.readPrivate(`${EVIDENCE_DIR}/${key}.json`);
      return text === null ? null : exchangeSchema.parse(JSON.parse(text));
    },
    write: (key, exchange) =>
      store.saveFrozenJson(`${EVIDENCE_DIR}/${key}.json`, toJson(exchange)),
  };
}

export type JudgingPhase = Readonly<{
  ledger: UnitLedger;
  store: FileCheckpointStore;
  signal: AbortSignal;
  clock: Clock;
  gate: WorkspaceGate;
  budget: () => Promise<StepBudget>;
  // The account judge calls spend on.
  accountIds: readonly string[];
  models: PanelModels;
  judgeCall: JudgeCaller;
  evidence: Readonly<{ transport: Transport; apiKey: string }>;
  log(line: string): void;
}>;

export async function runJudgingUnits(
  targets: readonly JudgeTarget[],
  tasks: ReadonlyMap<string, BenchmarkTask>,
  phase: JudgingPhase
) {
  const judged: JudgedCase[] = [];
  const review: { unitId: string; reason: string }[] = [];
  const evidence = tavilyEvidence({
    transport: phase.evidence.transport,
    apiKey: phase.evidence.apiKey,
    cache: fileEvidenceCache(phase.store),
    retrievedAt: () => new Date(phase.clock.now()).toISOString(),
  });
  const call = phase.gate.judge(phase.judgeCall);
  if (targets.length) phase.log(`Judging ${targets.length} result(s).`);
  const stopped = await untilStopped(async () => {
    for (const target of targets) {
      const task = tasks.get(target.taskId)!;
      const state = await phase.ledger.state(target.unitId);
      if (state === "new" || state === "pending") {
        if (phase.signal.aborted) continue;
        await (await phase.budget()).check(phase.accountIds);
      }
      const { candidate, ...meta } = target;
      const outcome = await phase.ledger.run(
        {
          id: target.unitId,
          taskId: target.taskId,
          toolId: target.toolId,
          learning: target.learning,
          cycle: target.cycle,
          input: toJson({ ...meta, candidate }),
        },
        judgedCaseSchema,
        async () => ({
          ...meta,
          record: await judgeCandidate(task, target.toolId, candidate, {
            models: phase.models,
            call,
            evidence,
          }),
        })
      );
      if (outcome.status === "completed") judged.push(outcome.value);
      else {
        review.push({ unitId: target.unitId, reason: outcome.reason });
        phase.ledger.haltAfter(3, target.unitId, outcome.reason);
      }
    }
  });
  // Every target is judged, held for review, or not reached.
  const notReached = targets.length - judged.length - review.length;
  return { judged, review, notReached, stopped };
}

const LABELLERS = ["l1", "l2"];
const labelsDir = (segment: SegmentId) =>
  `benchmarks/.local/people-search/labels/${segment}`;

/** Case IDs listed in a label sheet, labelled or not. */
export function sheetCaseIds(sheet: string) {
  return new Set(
    sheet
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.split(",")[0]?.trim())
      .filter((id): id is string => Boolean(id))
  );
}

export type HumanLabels = Readonly<{
  sheetPath: string;
  bookletPath: string;
  cases: number;
  agreement: AgreementReport | null;
}>;

/**
 * Proposal 3.3 and 6.1: the first time, draws a blind sample and writes the
 * private booklet and label sheet; once both people have filled the sheet,
 * a later run of the step measures agreement with the panel. A sheet is never
 * overwritten.
 */
export async function humanLabels(
  store: FileCheckpointStore,
  segment: SegmentId,
  records: readonly CaseRecord[],
  size: number,
  seed: number,
  alreadyLabelled: ReadonlySet<string>
): Promise<HumanLabels> {
  const dir = labelsDir(segment);
  const sheetPath = `${dir}/sheet.csv`;
  const bookletPath = `${dir}/booklet.md`;
  const sheet = await store.readPrivate(sheetPath);
  if (sheet === null) {
    const sample = drawLabelSample(records, size, seed, alreadyLabelled);
    await store.writePrivate(bookletPath, renderLabelBooklet(sample));
    await store.writePrivate(sheetPath, renderLabelSheet(sample, LABELLERS));
    return { sheetPath, bookletPath, cases: sample.length, agreement: null };
  }
  const cases = sheetCaseIds(sheet).size;
  let labels;
  try {
    labels = parseLabelSheet(sheet);
  } catch {
    // Not every row is labelled yet.
    return { sheetPath, bookletPath, cases, agreement: null };
  }
  return {
    sheetPath,
    bookletPath,
    cases,
    agreement: judgeAgreement(
      labels,
      records,
      peopleSearchPlan.judging.minHumanAgreementKappa
    ),
  };
}
