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

export interface JudgePanel {
  evaluate(input: BlindInput): Promise<{
    primary: readonly [Judgment, Judgment];
    tieBreaker: Judgment | null;
    modelsObserved: readonly string[];
  }>;
}
