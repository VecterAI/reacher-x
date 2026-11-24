import type { CaseRecord } from "../judging/judgeCandidate";
import { canonicalJson, identifierSchema, jsonSchema } from "../setup/manifest";
import type { AggregateReport } from "./report";

/**
 * Proposal 3.4: each vendor sees its own results for 3 days before
 * publication and can point out a genuine setup mistake. A preview holds one
 * tool's aggregate rows, the requests it was sent and the results it returned
 * with their verdicts. It may name the entities that tool returned, so it is
 * written only to private storage and shared with that vendor alone.
 */

export const VENDOR_PREVIEW_DAYS = 3;
const DAY_MS = 86_400_000;

export type PreviewReceipt = Readonly<{ toolId: string; taskId: string }> &
  Readonly<Record<string, unknown>>;

export function buildVendorPreview(args: {
  runId: string;
  toolId: string;
  createdAt: Date;
  report: AggregateReport;
  cases: readonly CaseRecord[];
  receipts?: readonly PreviewReceipt[];
}) {
  const toolId = identifierSchema.parse(args.toolId);
  const rows = args.report.rows.filter((row) => row.toolId === toolId);
  const own = args.cases
    .filter((record) => record.toolId === toolId)
    .sort(
      (a, b) =>
        a.taskId.localeCompare(b.taskId, undefined, { numeric: true }) ||
        a.rank - b.rank
    );
  if (rows.length === 0 && own.length === 0)
    throw new Error(`No results for ${toolId} in this run.`);
  const results = own.map((record) => {
    const { evidence, ...facts } = record.input.entity;
    return {
      taskId: record.taskId,
      prompt: record.input.prompt,
      rank: record.rank,
      // Facts the tool returned; evidence text stays with the judges' records.
      entity: { ...facts, evidenceItems: evidence.length },
      verdicts: record.input.criteria.map((criterion) => ({
        requirement: criterion.requirement,
        required: criterion.required,
        verdict: record.panel.verdicts[criterion.id] ?? "not graded",
      })),
      verifiedMatch: record.panel.verifiedMatch,
    };
  });
  const preview = {
    runId: identifierSchema.parse(args.runId),
    toolId,
    createdAt: args.createdAt.toISOString(),
    previewEndsAt: new Date(
      args.createdAt.getTime() + VENDOR_PREVIEW_DAYS * DAY_MS
    ).toISOString(),
    planSha256: args.report.planSha256,
    rows,
    requests: (args.receipts ?? []).filter(
      (receipt) => receipt.toolId === toolId
    ),
    results,
  };
  // Nothing from another tool may reach this vendor.
  if (
    [...preview.rows, ...preview.requests].some(
      (item) => item.toolId !== toolId
    )
  )
    throw new Error("A preview holds another tool's data.");
  return preview;
}

export type VendorPreview = ReturnType<typeof buildVendorPreview>;

export function renderVendorPreview(preview: VendorPreview) {
  const cell = (value: unknown) =>
    String(value ?? "")
      .replace(/\s+/g, " ")
      .replace(/\|/g, "\\|");
  const lines = [
    `# ${preview.toolId}: results preview for ${preview.runId}`,
    "",
    `Shared with this vendor only, until ${preview.previewEndsAt}. Please point out any setup mistake in the requests below; scores cannot be changed.`,
    "",
    "## Totals",
    "",
    "| Prompt | Category | Returned | Verified |",
    "| --- | --- | ---: | ---: |",
    ...preview.rows.map(
      (row) =>
        `| ${cell(row.taskId)} | ${cell(row.category)} | ${row.returned} | ${row.verifiedMatches} |`
    ),
    "",
    "## Requests sent",
    "",
    ...preview.requests.map(
      (receipt) =>
        `- Prompt ${cell(receipt.taskId)}: \`${cell(JSON.stringify(receipt))}\``
    ),
    "",
    "## Results returned",
  ];
  for (const result of preview.results)
    lines.push(
      "",
      `### Prompt ${cell(result.taskId)}, rank ${result.rank}: ${cell(result.entity.name)}`,
      "",
      `Verified match: ${result.verifiedMatch ? "yes" : "no"}`,
      "",
      ...result.verdicts.map(
        (item) =>
          `- ${cell(item.requirement)}${item.required ? "" : " (optional)"}: ${item.verdict}`
      )
    );
  return `${lines.join("\n")}\n`;
}

/** Writes one vendor's preview under the private folder (Markdown and JSON). Call under the runner lock. */
export async function writeVendorPreview(
  store: { writePrivate(path: string, data: string): Promise<void> },
  directory: string,
  preview: VendorPreview
) {
  if (!directory.startsWith("benchmarks/.local/"))
    throw new Error("Vendor previews are private files.");
  const base = `${directory}/${preview.runId}/${preview.toolId}`;
  await store.writePrivate(
    `${base}.json`,
    canonicalJson(jsonSchema.parse(preview))
  );
  await store.writePrivate(`${base}.md`, renderVendorPreview(preview));
  return { json: `${base}.json`, markdown: `${base}.md` };
}
