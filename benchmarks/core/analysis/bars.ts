import type { Interval } from "./stats";

/**
 * Text bar charts for the Markdown reports, in the style of the TOON README's
 * accuracy tables: one fenced block per group, a title line, then one row per
 * tool, best first, with a 20-character bar and its figures aligned.
 *
 *   Companies, static filters · verified in top 5 (1 prompt)
 *     exa      ████████████████████  100.0%  (5/5)  95% CI 56.6-100.0
 *   → reacherx ░░░░░░░░░░░░░░░░░░░░  no results
 */

export const BAR_WIDTH = 20;
const FILLED = "█";
const EMPTY = "░";
const GAP = "  ";

/** A share from 0 to 1 as BAR_WIDTH characters: round(share × 20) filled, the rest empty. */
export function bar(share: number) {
  const filled = Math.round(Math.min(Math.max(share, 0), 1) * BAR_WIDTH);
  return FILLED.repeat(filled) + EMPTY.repeat(BAR_WIDTH - filled);
}

/**
 * A signed value from -1 to 1 either side of a centre line, each side half of
 * BAR_WIDTH: below zero fills leftwards from the line, above zero rightwards.
 */
export function signedBar(value: number) {
  const half = BAR_WIDTH / 2;
  const filled = Math.round(Math.min(Math.abs(value), 1) * half);
  const left =
    value < 0
      ? EMPTY.repeat(half - filled) + FILLED.repeat(filled)
      : EMPTY.repeat(half);
  const right =
    value > 0
      ? FILLED.repeat(filled) + EMPTY.repeat(half - filled)
      : EMPTY.repeat(half);
  return `${left}│${right}`;
}

export const percent = (share: number) => `${(share * 100).toFixed(1)}%`;

/** A Wilson interval is asymmetric, so it shows both bounds, never ±. */
export const wilsonText = ({ lower, upper }: Interval) =>
  `95% CI ${(lower * 100).toFixed(1)}-${(upper * 100).toFixed(1)}`;

export const promptCount = (prompts: number) =>
  `${prompts} prompt${prompts === 1 ? "" : "s"}`;

export type ChartRow = Readonly<{
  label: string;
  // What the bar draws: a share from 0 to 1, or -1 to 1 in a signed chart;
  // null when nothing was measured.
  value: number | null;
  // The value as printed, or the wording for nothing measured ("no results").
  shown: string;
  // Further figures, each in its own aligned column; "" leaves one empty.
  details?: readonly string[];
  // ReacherX's rows, marked with an arrow so they are found first.
  marked?: boolean;
}>;

/**
 * One group as the lines of a fenced block. Rows are sorted best first
 * (highest value, then rows with nothing measured), ties keeping their
 * order. Labels are padded so the bars line up; printed values are
 * right-aligned, and wording for nothing measured runs on into the empty
 * columns after it.
 */
export function chartBlock(
  title: string,
  rows: readonly ChartRow[],
  options: { signed?: boolean } = {}
) {
  const order = (row: ChartRow) => row.value ?? -Infinity;
  const sorted = [...rows].sort((a, b) =>
    order(a) === order(b) ? 0 : order(b) - order(a)
  );
  const labelWidth = Math.max(0, ...rows.map((row) => row.label.length));
  const valueWidth = Math.max(
    0,
    ...rows.flatMap((row) => (row.value === null ? [] : [row.shown.length]))
  );
  const columns = Math.max(0, ...rows.map((row) => row.details?.length ?? 0));
  // Where each detail column starts, after the printed value; a column
  // empty in every row takes no space.
  const starts: number[] = [];
  for (let column = 0, at = valueWidth; column < columns; column++) {
    const width = Math.max(
      ...rows.map((row) => row.details?.[column]?.length ?? 0)
    );
    if (width) at += GAP.length;
    starts.push(at);
    at += width;
  }
  const figures = (row: ChartRow) => {
    let line = row.value === null ? row.shown : row.shown.padStart(valueWidth);
    row.details?.forEach((text, column) => {
      if (text)
        line =
          line.padEnd(Math.max(starts[column], line.length + GAP.length)) +
          text;
    });
    return line;
  };
  const draw = options.signed ? signedBar : bar;
  return [
    "```",
    title,
    ...sorted.map((row) =>
      `${row.marked ? "→ " : "  "}${row.label.padEnd(labelWidth)} ${draw(row.value ?? 0)}${GAP}${figures(row)}`.trimEnd()
    ),
    "```",
  ];
}
