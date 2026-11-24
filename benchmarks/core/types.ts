import { z } from "zod";

export const timestampSchema = z.iso.datetime({ offset: true });
export const entityTypeSchema = z.enum(["individual", "organization"]);
export type EntityType = z.infer<typeof entityTypeSchema>;
export type LearningCondition = "on" | "off";

export const evidenceSchema = z.strictObject({
  id: z.string().min(1),
  url: z.url({ protocol: /^https?$/ }),
  text: z.string(),
  publishedAt: timestampSchema.nullable(),
  retrievedAt: timestampSchema,
});
export type Evidence = z.infer<typeof evidenceSchema>;

const entityFields = {
  name: z.string().min(1),
  profileUrl: z.url({ protocol: /^https?$/ }).nullable(),
  location: z.string().nullable(),
  description: z.string().nullable(),
  evidence: z.array(evidenceSchema),
};

// Factual attributes only. Provider scores and generated match explanations stay private.
export const entitySchema = z.discriminatedUnion("prospectType", [
  z.strictObject({
    ...entityFields,
    prospectType: z.literal("individual"),
    title: z.string().nullable(),
    employer: z.string().nullable(),
  }),
  z.strictObject({
    ...entityFields,
    prospectType: z.literal("organization"),
    domain: z.string().min(1).nullable(),
    industry: z.string().nullable(),
    employeeCount: z.number().int().nonnegative().nullable(),
  }),
]);
export type BenchmarkEntity = z.infer<typeof entitySchema>;

export const criterionSchema = z.strictObject({
  id: z.string().min(1),
  requirement: z.string().min(1),
  required: z.boolean(),
});
export type Criterion = Readonly<z.infer<typeof criterionSchema>>;

export type BenchmarkTask = Readonly<{
  id: string;
  prompt: string;
  entityType: EntityType;
  referenceDate: string;
  criteria: readonly Criterion[];
  definitionNotes: readonly string[];
}>;

export type Candidate = Readonly<{
  sourceId: string;
  rank: number;
  discoveredAt: string;
  entity: BenchmarkEntity;
}>;

/** Private files referenced by checkpoints, never embedded in public reports. */
export type ArtifactReference = Readonly<{ path: string; sha256: string }>;

export function requireEntityType(
  entity: BenchmarkEntity,
  expected: EntityType
) {
  if (entity.prospectType !== expected) {
    throw new Error(
      "The result entity type does not match the benchmark task."
    );
  }
}
