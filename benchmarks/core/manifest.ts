import { createHash } from "node:crypto";
import { z } from "zod";
import { criterionSchema, entityTypeSchema, timestampSchema } from "./types";
import { stepSpendApprovalSchema } from "./spend";

export const identifierSchema = z
  .string()
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/);
export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
export const jsonSchema = z.json();
export type JsonValue = z.infer<typeof jsonSchema>;

export const artifactSchema = z.strictObject({
  path: z
    .string()
    .refine(
      (path) =>
        path.startsWith("benchmarks/.local/") &&
        path
          .split("/")
          .every(
            (part) =>
              /^[a-zA-Z0-9_.-]+$/.test(part) && part !== "." && part !== ".."
          )
    ),
  sha256: sha256Schema,
});

const taskSchema = z
  .strictObject({
    id: identifierSchema,
    prompt: z.string().min(1),
    entityType: entityTypeSchema,
    referenceDate: timestampSchema,
    criteria: z.array(criterionSchema).min(1),
    definitionNotes: z.array(z.string()),
  })
  .refine(
    (task) =>
      new Set(task.criteria.map((criterion) => criterion.id)).size ===
      task.criteria.length,
    "Criterion IDs must be unique."
  );

const frozenPlanSchema = z.strictObject({
  planId: identifierSchema,
  sourceProposal: z.strictObject({
    path: z.string().regex(/^docs\/benchmark\/[a-z0-9-]+\.pdf$/),
    sha256: sha256Schema,
  }),
  referenceDate: timestampSchema,
  seed: z.number().int().nonnegative().safe(),
  tasks: z.array(taskSchema).min(1),
  referenceExamples: z
    .array(
      z.strictObject({ taskId: identifierSchema, artifact: artifactSchema })
    )
    .min(1),
  rateSnapshot: artifactSchema,
  runtimeSnapshot: artifactSchema,
});
type FrozenPlan = z.infer<typeof frozenPlanSchema>;

export const runManifestSchema = frozenPlanSchema
  .extend({
    schemaVersion: z.literal(1),
    runId: identifierSchema,
    planSha256: sha256Schema,
    step: z.enum(["smoke", "pilot", "main", "stage2", "replay"]),
    execution: z.discriminatedUnion("mode", [
      z.strictObject({ mode: z.literal("offline") }),
      z.strictObject({
        mode: z.literal("live"),
        spendApproval: stepSpendApprovalSchema,
      }),
    ]),
  })
  .superRefine((manifest, ctx) => {
    const taskIds = new Set(manifest.tasks.map((task) => task.id));
    if (taskIds.size !== manifest.tasks.length)
      ctx.addIssue({ code: "custom", message: "Task IDs must be unique." });
    if (
      manifest.tasks.some(
        (task) => task.referenceDate !== manifest.referenceDate
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "All tasks must use the frozen reference date.",
      });
    const examples = new Set(
      manifest.referenceExamples.map((example) => example.taskId)
    );
    if (
      [...taskIds].some((id) => !examples.has(id)) ||
      [...examples].some((id) => !taskIds.has(id))
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Each task requires a reference example; unknown tasks are not allowed.",
      });
    if (manifest.planSha256 !== getPlanDigest(manifest))
      ctx.addIssue({
        code: "custom",
        message: "The frozen plan digest does not match its contents.",
      });
  });
export type RunManifest = z.infer<typeof runManifestSchema>;

export const workUnitSchema = z.strictObject({
  id: identifierSchema,
  runId: identifierSchema,
  taskId: identifierSchema,
  toolId: identifierSchema,
  input: artifactSchema,
  learning: z.enum(["on", "off"]).nullable(),
  cycle: z.number().int().positive().nullable(),
});
export type WorkUnit = z.infer<typeof workUnitSchema>;

export const offlineRunFileSchema = z
  .strictObject({
    manifest: runManifestSchema,
    units: z.array(workUnitSchema).min(1),
  })
  .superRefine(({ manifest, units }, ctx) => {
    if (manifest.execution.mode !== "offline")
      ctx.addIssue({
        code: "custom",
        message: "This runner only accepts offline execution.",
      });
    if (new Set(units.map((unit) => unit.id)).size !== units.length)
      ctx.addIssue({
        code: "custom",
        message: "Work unit IDs must be unique.",
      });
    const tasks = new Set(manifest.tasks.map((task) => task.id));
    if (
      units.some(
        (unit) => unit.runId !== manifest.runId || !tasks.has(unit.taskId)
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Work units must belong to this run and its frozen tasks.",
      });
  });
export type OfflineRunFile = z.infer<typeof offlineRunFileSchema>;

const checkpointBase = { unit: workUnitSchema, updatedAt: timestampSchema };
export const checkpointSchema = z.discriminatedUnion("status", [
  z.strictObject({ ...checkpointBase, status: z.literal("pending") }),
  z.strictObject({
    ...checkpointBase,
    status: z.literal("started"),
    startedAt: timestampSchema,
  }),
  z.strictObject({
    ...checkpointBase,
    status: z.literal("completed"),
    result: artifactSchema,
  }),
  z.strictObject({
    ...checkpointBase,
    status: z.literal("needs-review"),
    receipt: artifactSchema.nullable(),
  }),
]);
export type Checkpoint = z.infer<typeof checkpointSchema>;

/** Sort object keys so property insertion order cannot change a frozen plan's identity. */
export function canonicalJson(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

export function hashBytes(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function getPlanDigest(plan: FrozenPlan) {
  const {
    planId,
    sourceProposal,
    referenceDate,
    seed,
    tasks,
    referenceExamples,
    rateSnapshot,
    runtimeSnapshot,
  } = plan;
  return hashBytes(
    canonicalJson({
      planId,
      sourceProposal,
      referenceDate,
      seed,
      tasks,
      referenceExamples,
      rateSnapshot,
      runtimeSnapshot,
    })
  );
}
