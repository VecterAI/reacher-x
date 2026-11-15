import { z } from "zod";
import { RunnerStateError } from "../../core/execution/checkpoints";
import type { FileCheckpointStore } from "../../core/execution/checkpoints";
import {
  frozenPlanSchema,
  getPlanDigest,
  sha256Schema,
  type FrozenPlan,
} from "../../core/setup/manifest";
import { entitySchema, timestampSchema } from "../../core/types";
import { buildTasks, criteriaStatus } from "./criteria";
import { peopleSearchPlan } from "./plan";
import { peopleSearchRates } from "./rates";

// Proposal 2.1 and 3.4: before live runs, freeze the criteria, definitions and
// reference date, and confirm a qualifying example exists for every prompt.
// Examples are real people or companies, so they stay in the private folder.
const FROZEN_DIR = "benchmarks/.local/people-search/frozen";
export const FROZEN_PLAN_PATH = `${FROZEN_DIR}/plan.json`;

const referenceExampleSchema = entitySchema.refine(
  (entity) => entity.evidence.length > 0,
  "A reference example needs at least one piece of evidence."
);

export const freezeInputSchema = z.strictObject({
  referenceDate: timestampSchema,
  seed: z.number().int().nonnegative().safe(),
  // Keyed by prompt number, as in the plan ("1" to "20").
  referenceExamples: z.record(z.string(), referenceExampleSchema),
});
export type FreezeInput = z.infer<typeof freezeInputSchema>;

export type FrozenPlanRecord = FrozenPlan & { planSha256: string };

const frozenRecordSchema = frozenPlanSchema.extend({
  planSha256: sha256Schema,
});

/**
 * The frozen plan for a live step: its digest and every frozen artifact are
 * rechecked, and it must name the approved proposal and prompts with the
 * criteria in force when it was frozen.
 */
export async function loadFrozenPlan(
  store: FileCheckpointStore
): Promise<FrozenPlanRecord> {
  const text = await store.readPrivate(FROZEN_PLAN_PATH);
  if (text === null)
    throw new RunnerStateError(
      "No frozen plan. Freeze it first with pnpm benchmark --freeze <file>."
    );
  const plan = frozenRecordSchema.parse(JSON.parse(text));
  if (getPlanDigest(plan) !== plan.planSha256)
    throw new RunnerStateError(
      "The frozen plan's digest does not match its contents."
    );
  const approved = buildTasks(plan.referenceDate);
  if (
    plan.planId !== peopleSearchPlan.id ||
    plan.sourceProposal.sha256 !== peopleSearchPlan.sourceProposal.sha256 ||
    plan.tasks.length !== approved.length ||
    plan.tasks.some(
      (task, index) =>
        task.id !== approved[index].id ||
        task.prompt !== approved[index].prompt ||
        task.entityType !== approved[index].entityType
    )
  )
    throw new RunnerStateError(
      "The frozen plan does not match the approved proposal and prompts."
    );
  for (const artifact of [
    plan.rateSnapshot,
    plan.runtimeSnapshot,
    ...plan.referenceExamples.map((example) => example.artifact),
  ])
    await store.readArtifact(artifact);
  // The frozen criteria are used even if the draft in code changes later.
  return plan;
}

/**
 * Writes the reference examples, rates and run settings as private artifacts,
 * then the frozen plan with its digest. A frozen plan is never overwritten;
 * freezing the same input again returns the same plan.
 */
export async function freezePlan(
  store: FileCheckpointStore,
  input: FreezeInput,
  options: { allowDraftCriteria?: boolean } = {}
): Promise<FrozenPlanRecord> {
  if (criteriaStatus === "draft" && !options.allowDraftCriteria)
    throw new RunnerStateError(
      "The criteria are still a draft. Agree them before freezing the plan."
    );
  const tasks = buildTasks(input.referenceDate);
  const examples = new Map(
    Object.entries(input.referenceExamples).map(([key, entity]) => [
      key,
      entity,
    ])
  );
  // Check every example before writing any, so bad input leaves nothing frozen.
  const pairs = tasks.map((task, index) => ({
    task,
    entity: examples.get(String(peopleSearchPlan.prompts[index].id)),
  }));
  const missing = pairs
    .filter(({ task, entity }) => entity?.prospectType !== task.entityType)
    .map(({ task }) => String(Number(task.id.slice(1))));
  const known = new Set(peopleSearchPlan.prompts.map(({ id }) => String(id)));
  const unknown = [...examples.keys()].filter((key) => !known.has(key));
  if (missing.length || unknown.length)
    throw new RunnerStateError(
      `Each prompt needs one qualifying example of its type. Missing or wrong type: ${missing.join(", ") || "none"}; unknown prompts: ${unknown.join(", ") || "none"}.`
    );
  const referenceExamples: FrozenPlan["referenceExamples"] = [];
  for (const { task, entity } of pairs)
    if (entity)
      referenceExamples.push({
        taskId: task.id,
        artifact: await store.saveFrozenJson(
          `${FROZEN_DIR}/examples/${task.id}.json`,
          entity
        ),
      });

  const plan = frozenPlanSchema.parse({
    planId: peopleSearchPlan.id,
    sourceProposal: {
      path: peopleSearchPlan.sourceProposal.path,
      sha256: peopleSearchPlan.sourceProposal.sha256,
    },
    referenceDate: input.referenceDate,
    seed: input.seed,
    tasks,
    referenceExamples,
    rateSnapshot: await store.saveFrozenJson(
      `${FROZEN_DIR}/rates.json`,
      peopleSearchRates(input.referenceDate)
    ),
    runtimeSnapshot: await store.saveFrozenJson(`${FROZEN_DIR}/runtime.json`, {
      ...peopleSearchPlan.execution.runSettings,
      production: { ...peopleSearchPlan.execution.runSettings.production },
      runOnly: { ...peopleSearchPlan.execution.runSettings.runOnly },
    }),
  });
  const record = { ...plan, planSha256: getPlanDigest(plan) };
  await store.saveFrozenJson(FROZEN_PLAN_PATH, record);
  return record;
}
