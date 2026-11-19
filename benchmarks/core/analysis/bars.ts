import type { Interval } from "./stats";

/**
 * Text bar charts for the Markdown reports: one fenced block per group, a
 * title line, a header row with its underline, then one row per tool, best
 * first, with a 20-character bar and its figures in aligned columns.
 *
 *   Companies, static filters · verified in top 5 (1 prompt)
 *
 *     Tool      Match rate             Score  Hits  95% CI
 *     ────────  ────────────────────  ──────  ────  ──────────────
 *     exa       ████████████████████  100.0%  5/5   56.6% - 100.0%
 *     apollo    ░░░░░░░░░░░░░░░░░░░░    0.0%  0/5    0.0% - 43.4%
 *   → reacherx  ░░░░░░░░░░░░░░░░░░░░     n/a  0/0   no results
 */

export const BAR_WIDTH = 20;
const FILLED = "█";
const EMPTY = "░";
const GAP = "  ";
const RULE = "─";

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
  `${(lower * 100).toFixed(1)}% - ${(upper * 100).toFixed(1)}%`;

export const promptCount = (prompts: number) =>
  `${prompts} prompt${prompts === 1 ? "" : "s"}`;

export type ChartRow = Readonly<{
  label: string;
  // What the bar draws: a share from 0 to 1, or -1 to 1 in a signed chart;
  // null when nothing was measured.
  value: number | null;
  // The value as printed, or the wording for nothing measured ("no results").
  shown: string;
  // Further figures, one per column after the value; "" leaves one empty.
  details?: readonly string[];
  // ReacherX's rows, marked with an arrow so they are found first.
  marked?: boolean;
}>;

// The label, bar and value columns come before the details.
const FIXED = 3;
const VALUE = 2;
const NOT_MEASURED = "n/a";
// A range in a detail column, "lo% - hi%" or "lo% to hi%": its bounds line up.
const RANGE = /% (?:-|to) /;

/**
 * One group as the lines of a fenced block: the title, a blank line, a
 * header row with its underline, then one row per tool. `headers` names the
 * label, bar and value columns, then one column per detail. Rows are sorted
 * best first (highest value, then rows with nothing measured), ties keeping
 * their order. Columns are two spaces apart and padded so they line up; the
 * value is right-aligned and the rest left-aligned, a range lining up on its
 * separator. A row with nothing measured shows n/a as its value and its
 * wording in the last column. A detail column empty in every row is left
 * out, header and all.
 */
export function chartBlock(
  title: string,
  headers: readonly string[],
  rows: readonly ChartRow[],
  options: { signed?: boolean } = {}
) {
  if (
    headers.length < FIXED ||
    rows.some((row) => FIXED + (row.details?.length ?? 0) > headers.length)
  )
    throw new Error(`Chart "${title}" needs a header for every column.`);
  const order = (row: ChartRow) => row.value ?? -Infinity;
  const sorted = [...rows].sort((a, b) =>
    order(a) === order(b) ? 0 : order(b) - order(a)
  );
  const draw = options.signed ? signedBar : bar;
  const last = headers.length - 1;
  const cells = sorted.map((row) => {
    const line = [
      row.label,
      draw(row.value ?? 0),
      row.value === null ? NOT_MEASURED : row.shown,
      ...headers.slice(FIXED).map((_, column) => row.details?.[column] ?? ""),
    ];
    // After anything the row already has there; with no detail columns,
    // in place of n/a.
    if (row.value === null)
      line[last] =
        last === VALUE
          ? row.shown
          : [line[last], row.shown].filter(Boolean).join(", ");
    return line;
  });
  for (let column = FIXED; column < headers.length; column++) {
    const at = (line: string[]) => line[column].search(RANGE);
    const lower = Math.max(0, ...cells.map(at));
    for (const line of cells)
      if (at(line) >= 0)
        line[column] = line[column].padStart(
          line[column].length + lower - at(line)
        );
  }
  const shown = headers.map(
    (_, column) => column < FIXED || cells.some((line) => line[column])
  );
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...cells.map((line) => line[column].length))
  );
  const row = (prefix: string, line: readonly string[]) =>
    `${prefix}${line
      .flatMap((text, column) =>
        shown[column]
          ? [
              column === VALUE
                ? text.padStart(widths[column])
                : text.padEnd(widths[column]),
            ]
          : []
      )
      .join(GAP)}`.trimEnd();
  return [
    "```",
    title,
    "",
    row("  ", headers),
    row(
      "  ",
      widths.map((width) => RULE.repeat(width))
    ),
    ...cells.map((line, index) =>
      row(sorted[index].marked ? "→ " : "  ", line)
    ),
    "```",
  ];
}
