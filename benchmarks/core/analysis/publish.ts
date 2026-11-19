import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { identifierSchema, sha256Schema } from "../setup/manifest";
import { entityTypeSchema } from "../types";
import {
  renderJson,
  renderMarkdown,
  type AggregateReport,
  type MarkdownOptions,
} from "./report";

/**
 * Proposal 3.4: personal data never goes into the repository; only totals and
 * scores do. Public results are written only after the report passes a strict
 * aggregate schema and a scan for personal fields and identifying text. Any
 * failure writes nothing.
 */

export class PersonalDataError extends Error {}

const count = z.number().int().nonnegative();
const amount = z.number().finite().nonnegative();
const interval = z.strictObject({
  lower: z.number().min(0).max(1),
  upper: z.number().min(0).max(1),
  confidence: z.literal(0.95),
});
/**
 * The approved values public metadata may take: the plan's prompts,
 * categories (keys or labels), tools, provider and unit names, and a run ID
 * pattern built from step names. Anything else, such as a person's name in a
 * label, is refused.
 */
export type PublicVocabulary = Readonly<{
  runId: RegExp;
  taskIds: readonly string[];
  categories: readonly string[];
  toolIds: readonly string[];
  providers: readonly string[];
  units: readonly string[];
}>;

const approved = (values: readonly string[], field: string) => {
  const allowed = new Set(values);
  return z
    .string()
    .refine((value) => allowed.has(value), `${field} is not an approved value`);
};

function aggregateReportSchema(vocabulary: PublicVocabulary) {
  return z.strictObject({
    runId: identifierSchema.refine(
      (value) => vocabulary.runId.test(value),
      "runId is not an approved run ID"
    ),
    planSha256: sha256Schema,
    rows: z.array(
      z.strictObject({
        taskId: approved(vocabulary.taskIds, "taskId"),
        category: approved(vocabulary.categories, "category"),
        entityType: entityTypeSchema,
        toolId: approved(vocabulary.toolIds, "toolId"),
        returned: count,
        verifiedMatches: count,
        precision: z.strictObject({
          successes: count,
          trials: count,
          interval: interval.extend({ method: z.literal("wilson") }).nullable(),
        }),
        speed: z.strictObject({
          requestLatencyMs: amount,
          firstVerifiedMatchMs: amount.nullable(),
          fifthVerifiedMatchMs: amount.nullable(),
          activeProcessingMs: amount,
          scheduledWaitMs: amount,
        }),
        usage: z.strictObject({
          pricedUsageUsd: amount,
          unpricedUsage: z.array(
            z.strictObject({
              provider: approved(vocabulary.providers, "provider"),
              quantity: amount,
              unit: approved(vocabulary.units, "unit"),
            })
          ),
          knownCashUsd: amount,
          cashComplete: z.boolean(),
        }),
      })
    ),
  });
}

// Field names that only ever hold a person's or company's details.
const PERSONAL_KEYS = new Set(
  [
    "name",
    "displayName",
    "firstName",
    "lastName",
    "profileUrl",
    "url",
    "domain",
    "website",
    "email",
    "phone",
    "linkedin",
    "twitter",
    "handle",
    "title",
    "employer",
    "company",
    "location",
    "description",
    "evidence",
    "text",
    "reasoning",
    "sourceId",
    "prospectId",
    "caseId",
    "identity",
    "entity",
  ].map((key) => key.toLowerCase())
);

const IDENTIFYING_TEXT = [
  /https?:\/\//i,
  /\bwww\./i,
  /[^\s@]+@[^\s@]+\.[a-z]{2,}/i,
  /\blinkedin\.com\b/i,
  /\b(?:x|twitter)\.com\b/i,
];

/** Every path holding a personal field or identifying text; empty when the value is aggregate-only. */
export function personalDataFindings(value: unknown, path = "$"): string[] {
  if (typeof value === "string")
    return IDENTIFYING_TEXT.some((pattern) => pattern.test(value))
      ? [`${path}: identifying text`]
      : [];
  if (Array.isArray(value))
    return value.flatMap((item, index) =>
      personalDataFindings(item, `${path}[${index}]`)
    );
  if (value !== null && typeof value === "object")
    return Object.entries(value).flatMap(([key, item]) => [
      ...(PERSONAL_KEYS.has(key.toLowerCase())
        ? [`${path}.${key}: personal field`]
        : []),
      ...personalDataFindings(item, `${path}.${key}`),
    ]);
  return [];
}

/** The validated report, or a PersonalDataError naming where personal data appeared. */
export function assertAggregateOnly(
  report: unknown,
  vocabulary: PublicVocabulary
): AggregateReport {
  const findings = personalDataFindings(report);
  const parsed = aggregateReportSchema(vocabulary).safeParse(report);
  if (!parsed.success)
    findings.push(
      ...parsed.error.issues.map(
        (issue) => `$.${issue.path.join(".")}: ${issue.message}`
      )
    );
  if (findings.length)
    throw new PersonalDataError(
      `Public results refused: ${findings.slice(0, 10).join("; ")}`
    );
  return parsed.data!;
}

/**
 * Writes `<runId>.md` and `<runId>.json` to the public results folder
 * (relative to the repository root). Both files are rendered from the
 * validated report and the Markdown is scanned again before anything is written.
 */
export async function writePublicResults(
  root: string,
  directory: string,
  report: unknown,
  vocabulary: PublicVocabulary,
  options: MarkdownOptions = {}
) {
  if (directory.startsWith("benchmarks/.local") || directory.includes(".."))
    throw new PersonalDataError("Public results go to the public folder only.");
  const safe = assertAggregateOnly(report, vocabulary);
  const markdown = renderMarkdown(safe, options);
  const json = renderJson(safe);
  const leaked = IDENTIFYING_TEXT.find((pattern) => pattern.test(markdown));
  if (leaked)
    throw new PersonalDataError(
      "Public results refused: the rendered report holds identifying text."
    );
  const folder = join(root, directory);
  await mkdir(folder, { recursive: true });
  const paths = {
    markdown: `${directory}/${safe.runId}.md`,
    json: `${directory}/${safe.runId}.json`,
  };
  await writeFile(join(root, paths.markdown), markdown);
  await writeFile(join(root, paths.json), json);
  return paths;
}
