import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  entitySchema,
  criterionSchema,
  requireEntityType,
  timestampSchema,
  type BenchmarkTask,
  type Candidate,
} from "./types";

export const blindInputSchema = z.strictObject({
  caseId: z.uuid(),
  prompt: z.string().min(1),
  referenceDate: timestampSchema,
  definitionNotes: z.array(z.string()),
  criteria: z
    .array(criterionSchema)
    .min(1)
    .refine(
      (criteria) =>
        new Set(criteria.map((criterion) => criterion.id)).size ===
        criteria.length,
      "Criterion IDs must be unique."
    ),
  entity: entitySchema,
});
export type BlindInput = z.infer<typeof blindInputSchema>;

export const judgmentSchema = z.strictObject({
  caseId: z.uuid(),
  criteria: z
    .array(
      z.strictObject({
        criterionId: z.string().min(1),
        verdict: z.enum(["met", "partly_met", "not_met"]),
        evidenceIds: z.array(z.string()),
        explanation: z.string(),
      })
    )
    .min(1),
});
export type Judgment = z.infer<typeof judgmentSchema>;

/** Allowlist the judging payload. Keep the caseId-to-source mapping in private storage. */
export function buildBlindInput(
  task: BenchmarkTask,
  candidate: Candidate
): BlindInput {
  requireEntityType(candidate.entity, task.entityType);
  return blindInputSchema.parse({
    caseId: randomUUID(),
    prompt: task.prompt,
    referenceDate: task.referenceDate,
    definitionNotes: [...task.definitionNotes],
    criteria: task.criteria.map(({ id, requirement, required }) => ({
      id,
      requirement,
      required,
    })),
    entity: candidate.entity,
  });
}

export function validateJudgment(input: BlindInput, output: unknown): Judgment {
  const judgment = judgmentSchema.parse(output);
  const expected = new Set(input.criteria.map((criterion) => criterion.id));
  const observed = new Set(
    judgment.criteria.map((criterion) => criterion.criterionId)
  );
  if (
    judgment.caseId !== input.caseId ||
    observed.size !== judgment.criteria.length ||
    observed.size !== expected.size ||
    [...observed].some((id) => !expected.has(id))
  ) {
    throw new Error(
      "Judgment must grade exactly the criteria of the supplied case."
    );
  }
  const evidenceIds = new Set(
    input.entity.evidence.map((evidence) => evidence.id)
  );
  if (
    judgment.criteria.some((criterion) =>
      criterion.evidenceIds.some((id) => !evidenceIds.has(id))
    )
  ) {
    throw new Error("Judgment cites evidence that was not supplied.");
  }
  return judgment;
}

/** One model call returning raw output plus the model the provider reports serving. */
export type JudgeCaller = (
  model: string,
  input: BlindInput
) => Promise<{
  output: unknown;
  modelObserved: string;
  costUsd: number | null;
}>;

export type PanelModels = Readonly<{
  primary: readonly [string, string];
  tieBreaker: string;
}>;

export type PanelResult = Readonly<{
  primary: readonly [Judgment, Judgment];
  tieBreaker: Judgment | null;
  // Final verdict per criterion: the shared primary verdict, or the tie-breaker's.
  verdicts: Readonly<Record<string, Judgment["criteria"][number]["verdict"]>>;
  verifiedMatch: boolean;
  modelsObserved: readonly string[];
  costUsd: number | null;
}>;

const verdictsOf = (judgment: Judgment) =>
  new Map(
    judgment.criteria.map((criterion) => [
      criterion.criterionId,
      criterion.verdict,
    ])
  );

/**
 * Two primary judges grade every criterion; the tie-breaker grades the case
 * only when they disagree on any criterion, and decides those criteria. A
 * verified match has every required criterion met.
 */
export async function evaluateWithPanel(
  input: BlindInput,
  models: PanelModels,
  call: JudgeCaller
): Promise<PanelResult> {
  const judge = async (model: string) => {
    const response = await call(model, input);
    return { judgment: validateJudgment(input, response.output), ...response };
  };
  const [first, second] = await Promise.all(models.primary.map(judge));
  const a = verdictsOf(first.judgment);
  const b = verdictsOf(second.judgment);
  const disputed = input.criteria.filter(
    (criterion) => a.get(criterion.id) !== b.get(criterion.id)
  );
  const third = disputed.length ? await judge(models.tieBreaker) : null;
  const c = third ? verdictsOf(third.judgment) : null;
  const verdicts = Object.fromEntries(
    input.criteria.map((criterion) => [
      criterion.id,
      (a.get(criterion.id) === b.get(criterion.id) ? a : c!).get(criterion.id)!,
    ])
  );
  const responses = [first, second, ...(third ? [third] : [])];
  return {
    primary: [first.judgment, second.judgment],
    tieBreaker: third?.judgment ?? null,
    verdicts,
    verifiedMatch: input.criteria.every(
      (criterion) => !criterion.required || verdicts[criterion.id] === "met"
    ),
    modelsObserved: responses.map((response) => response.modelObserved),
    costUsd: responses.every((response) => response.costUsd !== null)
      ? responses.reduce((sum, response) => sum + response.costUsd!, 0)
      : null,
  };
}
