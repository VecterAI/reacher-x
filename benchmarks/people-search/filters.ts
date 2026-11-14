import { z } from "zod";
import type { StructuredCall } from "../core/calls/llm";
import { entityTypeSchema, type BenchmarkTask } from "../core/types";

/**
 * Proposal 2.2: one shared, logged step turns each prompt into filters that
 * every filter-based tool then maps to its native parameters. Each frozen
 * criterion must be covered by at least one non-empty field, so no
 * requirement is dropped before the tools see it.
 */
const terms = z.array(z.string().trim().min(1));

export const SENIORITIES = [
  "owner",
  "founder",
  "c_suite",
  "partner",
  "vp",
  "head",
  "director",
  "manager",
  "senior",
  "entry",
] as const;

export const filterSetSchema = z.strictObject({
  entityType: entityTypeSchema,
  // Free-text terms for tools that search by query rather than filters.
  keywords: terms,
  person: z.strictObject({
    titles: terms,
    seniorities: z.array(z.enum(SENIORITIES)),
    locations: terms,
    minYearsExperience: z.number().int().positive().nullable(),
  }),
  company: z.strictObject({
    // Headquarters.
    locations: terms,
    industries: terms,
    employeeRange: z
      .strictObject({
        min: z.number().int().nonnegative().nullable(),
        max: z.number().int().positive().nullable(),
      })
      .refine(
        (range) =>
          range.min === null || range.max === null || range.min <= range.max,
        "The employee range minimum exceeds its maximum."
      )
      .nullable(),
    fundingStages: terms,
    technologies: terms,
  }),
  signals: z.strictObject({
    // The signal window, counted back from the reference date.
    withinDays: z.number().int().positive().nullable(),
    postedAbout: terms,
    mentions: terms,
    joinedNewEmployer: z.boolean(),
    fundingAnnounced: z.boolean(),
    hiringFor: terms,
  }),
  coverage: z
    .array(
      z.strictObject({
        criterionId: z.string().min(1),
        fields: z.array(z.string().min(1)).min(1),
      })
    )
    .min(1),
});
export type FilterSet = z.infer<typeof filterSetSchema>;

/** Field paths a filter set can express, such as "person.titles". */
export const FILTER_FIELDS = [
  "keywords",
  "person.titles",
  "person.seniorities",
  "person.locations",
  "person.minYearsExperience",
  "company.locations",
  "company.industries",
  "company.employeeRange",
  "company.fundingStages",
  "company.technologies",
  "signals.withinDays",
  "signals.postedAbout",
  "signals.mentions",
  "signals.joinedNewEmployer",
  "signals.fundingAnnounced",
  "signals.hiringFor",
] as const;
export type FilterField = (typeof FILTER_FIELDS)[number];

export function fieldValue(filters: FilterSet, field: FilterField): unknown {
  const [group, key] = field.split(".") as [keyof FilterSet, string?];
  const value = filters[group];
  return key ? (value as Record<string, unknown>)[key] : value;
}

const isSet = (value: unknown) =>
  Array.isArray(value)
    ? value.length > 0
    : value !== null && value !== false && value !== undefined;

/** Fields that carry a requirement in this filter set. */
export function usedFields(filters: FilterSet): FilterField[] {
  return FILTER_FIELDS.filter((field) => isSet(fieldValue(filters, field)));
}

/** Rejects a translation that loses a criterion, invents one, or cites an empty field. */
export function validateFilterSet(
  task: BenchmarkTask,
  value: unknown
): FilterSet {
  const filters = filterSetSchema.parse(value);
  if (filters.entityType !== task.entityType)
    throw new Error(
      "The filters target a different entity type than the task."
    );
  const criteria = new Set(task.criteria.map((criterion) => criterion.id));
  const covered = filters.coverage.map((item) => item.criterionId);
  if (
    new Set(covered).size !== covered.length ||
    covered.length !== criteria.size ||
    covered.some((id) => !criteria.has(id))
  )
    throw new Error("Every criterion must be covered exactly once.");
  const used = new Set<string>(usedFields(filters));
  for (const item of filters.coverage)
    if (item.fields.some((field) => !used.has(field)))
      throw new Error(
        `Criterion ${item.criterionId} points to a filter field that is empty or unknown.`
      );
  return filters;
}

const WINDOWED_SIGNALS: readonly FilterField[] = [
  "signals.postedAbout",
  "signals.mentions",
  "signals.joinedNewEmployer",
  "signals.fundingAnnounced",
  "signals.hiringFor",
];

/**
 * What one tool could not express; recorded in its receipt, never silently
 * dropped. The time window counts as expressed only when the tool also
 * expresses every signal the window applies to.
 */
export function unexpressedFields(
  filters: FilterSet,
  supported: readonly FilterField[]
): FilterField[] {
  const used = usedFields(filters);
  const missing = used.filter((field) => !supported.includes(field));
  const windowLost = used.some(
    (field) => WINDOWED_SIGNALS.includes(field) && missing.includes(field)
  );
  return windowLost &&
    used.includes("signals.withinDays") &&
    !missing.includes("signals.withinDays")
    ? used.filter(
        (field) => missing.includes(field) || field === "signals.withinDays"
      )
    : missing;
}

const SYSTEM = `You turn one search request into structured search filters for a benchmark of people and company search tools.
Use only what the request and its criteria state; never add requirements. Leave a field empty when nothing implies it.
Locations are written out, e.g. "London, United Kingdom". Employee ranges use whole numbers.
signals.withinDays is the time window in days for any signal (90 days, 6 months = 182, 12 months = 365).
In coverage, list every criterion ID exactly once with the field paths that express it, using these paths:
${FILTER_FIELDS.join(", ")}.`;

export type FilterTranslation = Readonly<{
  taskId: string;
  model: string;
  modelObserved: string;
  costUsd: number | null;
  filters: FilterSet;
}>;

/** The shared translation step. Its output is saved and frozen before tools run. */
export async function translateTask(
  task: BenchmarkTask,
  model: string,
  call: StructuredCall
): Promise<FilterTranslation> {
  const response = await call(model, {
    system: SYSTEM,
    prompt: JSON.stringify({
      request: task.prompt,
      entityType: task.entityType,
      referenceDate: task.referenceDate,
      definitionNotes: task.definitionNotes,
      criteria: task.criteria,
    }),
    schema: filterSetSchema,
  });
  return {
    taskId: task.id,
    model,
    modelObserved: response.modelObserved,
    costUsd: response.costUsd,
    filters: validateFilterSet(task, response.output),
  };
}
