import { z } from "zod";
import type { CaseRecord } from "./judgeCandidate";
import { seededRandom, shuffled } from "../random";
import { cohenKappa } from "../analysis/stats";

/**
 * Proposal 3.3 and 6.1: people label a blind sample, and the judges are used
 * only if their verified-match verdicts agree with those labels at or above
 * the frozen kappa threshold.
 */

/** A seeded draw mixing people and company results, skipping cases already labelled. */
export function drawLabelSample(
  records: readonly CaseRecord[],
  size: number,
  seed: number,
  alreadyLabelled: ReadonlySet<string> = new Set()
) {
  if (!Number.isInteger(size) || size < 1)
    throw new Error("The label sample needs a positive size.");
  const random = seededRandom(seed);
  const pool = [...records]
    .filter((record) => !alreadyLabelled.has(record.caseId))
    .sort((a, b) => a.caseId.localeCompare(b.caseId));
  const byType = (type: string) =>
    shuffled(
      pool.filter((record) => record.input.entity.prospectType === type),
      random
    );
  const people = byType("individual");
  const companies = byType("organization");
  // Half of each type where available; the other type fills any shortfall.
  const half = Math.ceil(size / 2);
  const takePeople = Math.min(
    people.length,
    Math.max(half, size - companies.length)
  );
  const takeCompanies = Math.min(companies.length, size - takePeople);
  return shuffled(
    [...people.slice(0, takePeople), ...companies.slice(0, takeCompanies)],
    random
  );
}

// Evidence is shown in full: people must see exactly what the judges saw.

/**
 * The private labelling booklet: exactly what the judges saw, nothing about
 * the tool, rank, score or the judges' verdicts.
 */
export function renderLabelBooklet(records: readonly CaseRecord[]) {
  const lines = [
    "# Blind labelling booklet",
    "",
    "For each case, decide whether the result meets every required criterion. Record yes or no in the label sheet.",
  ];
  for (const { input } of records) {
    const { entity } = input;
    const facts = Object.entries(entity)
      .filter(
        ([key, value]) =>
          key !== "evidence" && key !== "prospectType" && value !== null
      )
      .map(([key, value]) => `- ${key}: ${String(value)}`);
    lines.push(
      "",
      `## Case ${input.caseId}`,
      "",
      `Prompt: ${input.prompt}`,
      `Reference date: ${input.referenceDate}`,
      `Type: ${entity.prospectType === "individual" ? "person" : "company"}`,
      "",
      "Criteria:",
      ...input.criteria.map(
        (criterion) =>
          `- ${criterion.requirement}${criterion.required ? "" : " (optional)"}`
      ),
      ...input.definitionNotes.map((note) => `- Note: ${note}`),
      "",
      "Result:",
      ...facts,
      "",
      "Evidence:",
      ...(entity.evidence.length
        ? entity.evidence.map(
            (item) =>
              `- [${item.id}] ${item.url} (${item.publishedAt ?? "undated"}): ${item.text.replace(/\s+/g, " ").trim()}`
          )
        : ["- none supplied"])
    );
  }
  return `${lines.join("\n")}\n`;
}

const LABEL_HEADER = "caseId,labeller,match,notes";

export function renderLabelSheet(
  records: readonly CaseRecord[],
  labellers: readonly string[]
) {
  if (labellers.some((labeller) => !/^[a-z0-9-]+$/.test(labeller)))
    throw new Error("Labeller IDs are short lowercase codes, not names.");
  return `${[
    LABEL_HEADER,
    ...labellers.flatMap((labeller) =>
      records.map((record) => `${record.caseId},${labeller},,`)
    ),
  ].join("\n")}\n`;
}

const labelRowSchema = z.strictObject({
  caseId: z.uuid(),
  labeller: z.string().regex(/^[a-z0-9-]+$/),
  match: z.enum(["yes", "no"]),
  notes: z.string(),
});
export type HumanLabel = z.infer<typeof labelRowSchema>;

/** RFC 4180 records: quoted cells may hold commas, quotes and line breaks. */
function parseCsv(text: string) {
  const records: string[][] = [];
  let record: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted && char === '"' && text[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      record.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      record.push(current);
      records.push(record);
      record = [];
      current = "";
    } else current += char;
  }
  if (quoted) throw new Error("A label row has an unclosed quote.");
  record.push(current);
  records.push(record);
  return records.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

/** Reads a completed sheet. Every row must be labelled; a case is labelled once per labeller. */
export function parseLabelSheet(text: string): HumanLabel[] {
  const [header, ...rows] = parseCsv(text.replace(/^\uFEFF/, ""));
  if (header?.join(",").trim() !== LABEL_HEADER)
    throw new Error(`The label sheet header must be "${LABEL_HEADER}".`);
  const labels = rows.map((row, index) => {
    const [caseId, labeller, match, ...notes] = row;
    const parsed = labelRowSchema.safeParse({
      caseId: caseId?.trim(),
      labeller: labeller?.trim(),
      match: match?.trim().toLowerCase(),
      notes: notes.join(","),
    });
    if (!parsed.success)
      throw new Error(
        `Label row ${index + 2} needs a case, labeller and yes/no.`
      );
    return parsed.data;
  });
  const keys = labels.map((label) => `${label.caseId}:${label.labeller}`);
  if (new Set(keys).size !== keys.length)
    throw new Error("A labeller labelled the same case twice.");
  return labels;
}

export type AgreementReport = Readonly<{
  labels: number;
  kappa: number | null;
  perLabeller: readonly {
    labeller: string;
    labels: number;
    kappa: number | null;
  }[];
  // Agreement between people on cases both labelled, for context only.
  betweenLabellers: { cases: number; kappa: number | null } | null;
  minimumKappa: number;
  passes: boolean;
}>;

/** D2 gate: every human label paired with the panel's verified-match verdict for that case. */
export function judgeAgreement(
  labels: readonly HumanLabel[],
  records: readonly CaseRecord[],
  minimumKappa: number
): AgreementReport {
  const panel = new Map(
    records.map((record) => [
      record.caseId,
      record.panel.verifiedMatch ? "yes" : "no",
    ])
  );
  const unknown = labels.find((label) => !panel.has(label.caseId));
  if (unknown) throw new Error("A label refers to a case that was not judged.");
  const pairs = (subset: readonly HumanLabel[]) =>
    subset.map((label) => ({
      human: label.match,
      model: panel.get(label.caseId)!,
    }));
  const kappa = cohenKappa(pairs(labels));
  const labellers = [...new Set(labels.map((label) => label.labeller))].sort();
  const [first, second] = labellers;
  const overlap =
    second === undefined
      ? []
      : labels
          .filter((label) => label.labeller === first)
          .flatMap((label) => {
            const other = labels.find(
              (item) => item.labeller === second && item.caseId === label.caseId
            );
            return other ? [{ human: label.match, model: other.match }] : [];
          });
  return {
    labels: labels.length,
    kappa,
    perLabeller: labellers.map((labeller) => {
      const own = labels.filter((label) => label.labeller === labeller);
      return { labeller, labels: own.length, kappa: cohenKappa(pairs(own)) };
    }),
    betweenLabellers:
      labellers.length === 2
        ? { cases: overlap.length, kappa: cohenKappa(overlap) }
        : null,
    minimumKappa,
    passes: kappa !== null && kappa >= minimumKappa,
  };
}
