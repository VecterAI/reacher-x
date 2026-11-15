import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

/**
 * Re-scores round one of issue #122 from its saved answers and judge verdicts,
 * reproducing round one's Python report (harness/report.py on the
 * chore/122-benchmark-dev-setup branch, commit 06967826) value for value.
 * Proposal section 6.1, "Repeat round 1": run `compareRound1` on the private
 * round-one data folder and expect zero mismatches.
 *
 * Python semantics kept on purpose: `round()` is round-half-to-even on the exact
 * binary value, `sum()` of floats is Neumaier-compensated (Python 3.12+), dates
 * parse like `datetime.strptime`, and identities fold case like `str.casefold`.
 */

export type Round1Judge = "trial" | "final";

type Round1Query = Readonly<{
  query_id: string;
  category: string;
  track: string;
  // A short prompt is graded against its detailed twin's criteria.
  grade_as?: string;
}>;

// Round one's queries.jsonl (prompts left out) and config.json `not_run`, at
// commit 06967826. config.frozen.json in the data folder predates both.
const QUERIES: readonly Round1Query[] = [
  { query_id: "b2b_0014", category: "b2b", track: "public" },
  { query_id: "rec_0020", category: "recruiting", track: "public" },
  { query_id: "inf_0028", category: "influencer", track: "public" },
  { query_id: "det_0010", category: "deterministic", track: "public" },
  ...[
    "int_0001",
    "int_0002",
    "int_0003",
    "int_0004",
    "int_0005",
    "int_0006",
  ].map((query_id) => ({ query_id, category: "intent", track: "intent" })),
  ...[3, 4, 5, 6].map((twin) => ({
    query_id: `int_000${twin + 4}`,
    category: "intent",
    track: "intent_short",
    grade_as: `int_000${twin}`,
  })),
];
const NOT_RUN_QUERIES = ["rec_0020", "inf_0028", "det_0010"];
const NOT_RUN: Readonly<Record<string, readonly string[]>> = {
  reacherx: NOT_RUN_QUERIES,
  reacherx_topfit: NOT_RUN_QUERIES,
};
// Extra views of a tool's run that must never be read as a separate primary result.
const SECONDARY_VIEWS = new Set(["reacherx_topfit"]);
const STALE_AFTER_DAYS = 180;
const INTENT_SINCE = "2026-10-01";

// --- Saved files (lenient where round one's data varies) ----------------------

const configSchema = z.object({
  top_k: z.number().int().positive(),
  judge: z.object({ trial: z.string(), final: z.string() }),
});

const personSchema = z.object({
  rank: z.number().int(),
  name: z.string().nullish(),
  linkedin_url: z.string().nullish(),
  activity_date: z.string().nullish(),
});

const rawSchema = z.object({
  at: z.string().nullish(),
  status: z.unknown(),
  latency_s: z.number().nullish(),
  cost_usd: z.number().nullish(),
  credits: z.unknown(),
  raw_sha256: z.unknown(),
  persons: z.array(personSchema).default([]),
});
type RawResult = z.infer<typeof rawSchema>;

// The upstream PersonEvaluation fields the report reads. Criteria keep their
// raw shape: "verifiable" treats a missing confidence as not confident.
const evaluationSchema = z.object({
  criteria_results: z
    .array(
      z.object({
        criterion_id: z.string(),
        match: z.string(),
        confidence: z.string().nullish(),
      })
    )
    .nullish(),
  relevance_grade: z.number().default(0),
  utility_score: z.number().default(0),
  error: z.string().nullish(),
});
type Evaluation = z.infer<typeof evaluationSchema>;

const verdictSchema = z.object({
  at: z.string().nullish(),
  evaluation: evaluationSchema,
  searches: z.array(z.unknown()).nullish(),
  tokens: z.object({ input: z.number(), output: z.number() }),
});
type Verdict = z.infer<typeof verdictSchema>;

const criteriaSchema = z.object({
  criteria: z.array(
    z.object({
      id: z.string(),
      description: z.string().default(""),
      field_hint: z.string().default(""),
    })
  ),
});

async function readJson<T>(file: string, schema: z.ZodType<T>) {
  try {
    return schema.parse(JSON.parse(await readFile(file, "utf8")));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return null;
    throw error;
  }
}

// --- Python semantics ----------------------------------------------------------

/** Python `round(x, digits)`: half-to-even on the exact binary value of x. */
export function pyRound(value: number, digits: number) {
  if (!Number.isFinite(value) || value === 0) return value;
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, Math.abs(value));
  const high = view.getUint32(0);
  const biased = (high >>> 20) & 0x7ff;
  // BigInt() calls, not literals: the repository targets ES2017.
  const [one, two] = [BigInt(1), BigInt(2)];
  let mantissa =
    (BigInt(high & 0xfffff) << BigInt(32)) | BigInt(view.getUint32(4));
  if (biased) mantissa |= one << BigInt(52);
  // |value| = mantissa * 2^exponent exactly.
  const exponent = (biased || 1) - 1075;
  const scaled = mantissa * BigInt(10) ** BigInt(digits);
  const numerator = exponent > 0 ? scaled << BigInt(exponent) : scaled;
  const denominator = exponent < 0 ? one << BigInt(-exponent) : one;
  let quotient = numerator / denominator;
  const twiceRest = two * (numerator % denominator);
  if (
    twiceRest > denominator ||
    (twiceRest === denominator && quotient % two === one)
  )
    quotient += one;
  return Math.sign(value) * Number(`${quotient}e-${digits}`);
}

/** Python 3.12+ `sum()` of floats (Neumaier compensated summation). */
export function pySum(values: readonly number[]) {
  let high = 0;
  let low = 0;
  for (const value of values) {
    const total = high + value;
    low +=
      Math.abs(high) >= Math.abs(value)
        ? high - total + value
        : value - total + high;
    high = total;
  }
  return low && Number.isFinite(low) ? high + low : high;
}

/** `statistics.median`. */
function median(values: readonly number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

// `datetime.strptime` patterns for %Y-%m-%dT%H:%M:%S, %Y-%m-%d and %Y-%m, tried in
// order on the first 19, 10 and 7 characters. The whole slice must match.
const Y = String.raw`(\d{4})`;
const M = "(1[0-2]|0[1-9]|[1-9])";
const D = "(3[01]|[12]\\d|0[1-9]|[1-9]| [1-9])";
const DATE_FORMATS = [
  {
    length: 19,
    pattern: new RegExp(
      `^${Y}-${M}-${D}T(2[0-3]|[01]\\d|\\d):([0-5]\\d|\\d):(6[01]|[0-5]\\d|\\d)`,
      "i"
    ),
  },
  { length: 10, pattern: new RegExp(`^${Y}-${M}-${D}`, "i") },
  { length: 7, pattern: new RegExp(`^${Y}-${M}`, "i") },
];

/** Round one's parse_date: a naive datetime as milliseconds, or null. */
export function parseDate(text: string | null | undefined) {
  if (!text) return null;
  for (const { length, pattern } of DATE_FORMATS) {
    const slice = text.slice(0, length);
    const match = pattern.exec(slice);
    if (!match || match[0].length !== slice.length) continue;
    const [year, month, day = 1, hour = 0, minute = 0, second = 0] = match
      .slice(1)
      .filter((part) => part !== undefined)
      .map(Number);
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(hour, minute, second);
    // datetime rejects year 0, impossible days and leap seconds.
    if (year < 1 || date.getUTCDate() !== day || second > 59) continue;
    return date.getTime();
  }
  return null;
}

/** `str.casefold`, close enough for telling names apart. */
const casefold = (text: string) =>
  Array.from(text, (char) =>
    char === "ı" ? char : char === "ẞ" ? "ss" : char.toUpperCase().toLowerCase()
  ).join("");

/** Round one's identity(): LinkedIn slug, else the folded name, else the rank. */
export function identity(person: z.infer<typeof personSchema>) {
  const linkedin = (person.linkedin_url ?? "")
    .toLowerCase()
    .replace(/\/+$/, "");
  const slug = /linkedin\.com\/in\/([^/?#]+)/.exec(linkedin);
  if (slug) return `li:${slug[1]}`;
  const name = casefold((person.name ?? "").normalize("NFKC")).split(",")[0];
  const key = Array.from(name)
    .filter((char) => /[\p{L}\p{N}]/u.test(char))
    .join("");
  return key ? `name:${key}` : `rank:${person.rank}`;
}

// Python's \b is Unicode-aware, so a letter of any script counts as a word character.
const POST_WORDS = /(?<![\p{L}\p{N}_])post(s|ed)?(?![\p{L}\p{N}_])|social/iu;

const slugModel = (model: string) =>
  model.replaceAll("/", "__").replaceAll(":", "_");

function isVerifiable(evaluation: Evaluation) {
  const criteria = evaluation.criteria_results ?? [];
  if (evaluation.error || !criteria.length) return false;
  const confident = criteria.filter(
    (item) => item.confidence === "high" || item.confidence === "medium"
  ).length;
  return confident * 2 >= criteria.length;
}

function isIntentHit(evaluation: Evaluation, ids: ReadonlySet<string>) {
  if (!ids.size || evaluation.error) return false;
  const got = new Map(
    (evaluation.criteria_results ?? []).map((item) => [
      item.criterion_id,
      item.match,
    ])
  );
  return [...ids].every((id) => got.get(id) === "met");
}

// --- Upstream metric math --------------------------------------------------------
// Ported from People Search Bench by LessieAI (benchmark/metrics.py, MIT license).

const RELEVANCE_THRESHOLD = 0.5;

type QueryMetrics = Readonly<{
  category: string;
  numResults: number;
  numQualified: number;
  taskSuccess: boolean;
  ndcg: Readonly<Record<5 | 10 | 25, number>>;
  precision: Readonly<Record<5 | 10 | 25, number>>;
  coverage: number;
  utility: number;
}>;

const CUTOFFS = [5, 10, 25] as const;

function dcg(grades: readonly number[], k: number) {
  let total = 0;
  grades.slice(0, k).forEach((grade, index) => {
    total += grade / Math.log2(index + 2);
  });
  return total;
}

/** nDCG@k against a padded ideal of k perfect results. */
export function ndcg(grades: readonly number[], k: number) {
  if (!grades.length) return 0;
  const ideal = dcg(Array<number>(k).fill(1), k);
  return ideal === 0 ? 0 : dcg(grades, k) / ideal;
}

function precisionAt(grades: readonly number[], k: number) {
  const top = grades.slice(0, k);
  if (!top.length) return 0;
  return (
    top.filter((grade) => grade >= RELEVANCE_THRESHOLD).length / top.length
  );
}

const byCutoff = (score: (k: number) => number) =>
  ({ 5: score(5), 10: score(10), 25: score(25) }) as const;

export function computeQueryMetrics(
  category: string,
  evaluations: readonly Evaluation[],
  requestedK: number
): QueryMetrics {
  const grades = evaluations.map((item) => item.relevance_grade);
  const numQualified = grades.filter(
    (grade) => grade >= RELEVANCE_THRESHOLD
  ).length;
  const utilities = evaluations
    .filter((item) => item.error == null)
    .map((item) => item.utility_score);
  return {
    category,
    numResults: evaluations.length,
    numQualified,
    taskSuccess: numQualified >= 1,
    ndcg: byCutoff((k) => ndcg(grades, k)),
    precision: byCutoff((k) => precisionAt(grades, k)),
    coverage: numQualified
      ? Math.min(numQualified / Math.max(requestedK, 1), 1)
      : 0,
    utility: utilities.length ? pySum(utilities) / utilities.length : 0,
  };
}

const mean = (values: readonly number[], count: number) =>
  pySum(values) / count;

/** Upstream compute_platform_scores, as DimensionScores.model_dump(). */
export function computePlatformScores(
  platform: string,
  metrics: readonly QueryMetrics[],
  totalQueries: number
) {
  const empty = {
    platform,
    total_queries: 0,
    completed_queries: 0,
    task_completion_rate: 0,
    relevance_precision: 0,
    effective_coverage: 0,
    information_utility: 0,
    ndcg_at_k: {} as Record<string, number>,
    precision_at_k: {} as Record<string, number>,
    mean_qualified_results: 0,
    by_category: {} as Record<string, Record<string, number>>,
    consistency_score: 0,
    median_latency_s: null as number | null,
    p95_latency_s: null as number | null,
    overall: 0,
  };
  if (totalQueries === 0) return empty;

  // Queries missing from the list count as zero.
  const padding = Array<number>(
    Math.max(totalQueries - metrics.length, 0)
  ).fill(0);
  const padded = (pick: (item: QueryMetrics) => number) => [
    ...metrics.map(pick),
    ...padding,
  ];
  const completion =
    metrics.filter((item) => item.taskSuccess).length / totalQueries;
  const meanNdcg = byCutoff(
    (k) =>
      mean(
        padded((item) => item.ndcg[k as 5]),
        totalQueries
      ) * 100
  );
  const relevance = meanNdcg[10];
  const coverage =
    completion *
    mean(
      padded((item) => item.coverage),
      totalQueries
    ) *
    100;
  const utilities = metrics
    .map((item) => item.utility)
    .filter((value) => value > 0);
  const utility = utilities.length
    ? (pySum(utilities) / utilities.length) * 100
    : 0;

  const byCategory: Record<string, Record<string, number>> = {};
  const categories = [
    ...new Set(metrics.map((item) => item.category).filter(Boolean)),
  ].sort();
  for (const category of categories) {
    const group = metrics.filter((item) => item.category === category);
    const count = group.length;
    const groupUtilities = group
      .map((item) => item.utility)
      .filter((value) => value > 0);
    byCategory[category] = {
      relevance_precision: pyRound(
        mean(
          group.map((item) => item.ndcg[10]),
          count
        ) * 100,
        2
      ),
      effective_coverage: pyRound(
        mean(
          group.map((item) => item.coverage),
          count
        ) * 100,
        2
      ),
      information_utility: pyRound(
        groupUtilities.length
          ? (pySum(groupUtilities) / groupUtilities.length) * 100
          : 0,
        2
      ),
      task_completion_rate: pyRound(
        (group.filter((item) => item.taskSuccess).length / count) * 100,
        2
      ),
      mean_qualified_results: pyRound(
        mean(
          group.map((item) => item.numQualified),
          count
        ),
        1
      ),
      num_queries: count,
    };
  }

  let consistency = 100;
  const scores = Object.values(byCategory).map(
    (item) => item.relevance_precision
  );
  if (scores.length >= 2) {
    const average = mean(scores, scores.length);
    // Python's `** 0.5`; sqrt is the correctly rounded value.
    consistency =
      average > 0
        ? Math.max(
            0,
            1 -
              Math.sqrt(
                mean(
                  scores.map((score) => (score - average) * (score - average)),
                  scores.length
                )
              ) /
                average
          ) * 100
        : 0;
  }

  const roundAll = (values: Readonly<Record<number, number>>) =>
    Object.fromEntries(CUTOFFS.map((k) => [String(k), pyRound(values[k], 2)]));
  return {
    ...empty,
    total_queries: totalQueries,
    completed_queries: metrics.filter((item) => item.numResults > 0).length,
    task_completion_rate: pyRound(completion * 100, 2),
    relevance_precision: pyRound(relevance, 2),
    effective_coverage: pyRound(coverage, 2),
    information_utility: pyRound(utility, 2),
    ndcg_at_k: roundAll(meanNdcg),
    precision_at_k: roundAll(
      byCutoff(
        (k) =>
          (pySum(metrics.map((item) => item.precision[k as 5])) /
            totalQueries) *
          100
      )
    ),
    mean_qualified_results: pyRound(
      mean(
        padded((item) => item.numQualified),
        totalQueries
      ),
      1
    ),
    by_category: byCategory,
    consistency_score: pyRound(consistency, 2),
    overall: pyRound((relevance + coverage + utility) / 3, 2),
  };
}

// --- Round one report ------------------------------------------------------------

export type Round1Options = Readonly<{
  // Only answers and verdicts saved at or before this time count, so a saved
  // report can be rebuilt from the data as it was when it was written.
  asOf?: string;
}>;

/**
 * Rebuilds results/<judge>_top<topK>.json (without its timestamp). "final" uses
 * the committed report rules. "trial" uses the pilot rules that wrote
 * trial_top3.json before the harness was committed: every question of a track
 * counts (unanswered ones as zero) and the later per-row `intent_verified` and
 * `overall` and per-tool `queries_scored`, `pending`, `role` and `not_run` are absent.
 */
export async function rescoreRound1(
  dataDir: string,
  judge: Round1Judge,
  topK: number,
  options: Round1Options = {}
) {
  const config = await readJson(
    join(dataDir, "config.frozen.json"),
    configSchema
  );
  if (!config) throw new Error("Round one config.frozen.json is missing.");
  const pilot = judge === "trial";
  const model = config.judge[judge];
  const cutoff = options.asOf ? Date.parse(options.asOf) : Infinity;
  const existed = (at: string | null | undefined) =>
    !at || Date.parse(at) <= cutoff;
  const isIntent = (track: string) =>
    pilot ? track === "intent" : track.startsWith("intent");
  const notRun = (tool: string) => (pilot ? [] : (NOT_RUN[tool] ?? []));

  const raws = new Map<string, RawResult>();
  const rawDir = join(dataDir, "raw");
  for (const tool of await readdir(rawDir, { withFileTypes: true })) {
    if (!tool.isDirectory()) continue;
    for (const file of await readdir(join(rawDir, tool.name))) {
      if (!file.endsWith(".json")) continue;
      const raw = await readJson(join(rawDir, tool.name, file), rawSchema);
      if (raw && existed(raw.at))
        raws.set(`${tool.name}/${file.slice(0, -5)}`, raw);
    }
  }
  const tools = [
    ...new Set([...raws.keys()].map((key) => key.split("/")[0])),
  ].sort();

  const intentIds = async (queryId: string) => {
    const file = join(
      dataDir,
      "cache",
      "criteria",
      slugModel(model),
      `${queryId}.json`
    );
    const cached = await readJson(file, criteriaSchema);
    return new Set(
      (cached?.criteria ?? [])
        .filter((item) =>
          POST_WORDS.test(`${item.field_hint} ${item.description}`)
        )
        .map((item) => item.id)
    );
  };

  const rows = [];
  const groups = new Map<
    string,
    { tool: string; track: string; metrics: QueryMetrics[] }
  >();
  const missing: string[] = [];

  for (const query of QUERIES) {
    for (const tool of tools) {
      // Not run: left out of every average, not scored as zero.
      if (notRun(tool).includes(query.query_id)) continue;
      const raw = raws.get(`${tool}/${query.query_id}`);
      if (!raw) continue;
      const persons = raw.persons.slice(0, topK);
      const verdicts: Verdict[] = [];
      for (const person of persons) {
        const rank = String(person.rank).padStart(2, "0");
        const verdict = await readJson(
          join(
            dataDir,
            "verdicts",
            slugModel(model),
            tool,
            query.query_id,
            `${rank}.json`
          ),
          verdictSchema
        );
        if (verdict && existed(verdict.at)) verdicts.push(verdict);
        else missing.push(`${tool}/${query.query_id}#${person.rank}`);
      }
      const intent = isIntent(query.track);
      const ids = intent
        ? await intentIds(
            pilot ? query.query_id : (query.grade_as ?? query.query_id)
          )
        : new Set<string>();
      const metrics = computeQueryMetrics(
        query.category,
        verdicts.map((verdict) => verdict.evaluation),
        config.top_k
      );
      const groupKey = `${tool}\u0000${query.track}`;
      const group = groups.get(groupKey) ?? {
        tool,
        track: query.track,
        metrics: [],
      };
      group.metrics.push(metrics);
      groups.set(groupKey, group);

      const runAt =
        parseDate(raw.at) ??
        Date.now() - new Date().getTimezoneOffset() * 60_000;
      const limit = intent
        ? parseDate(INTENT_SINCE)!
        : runAt - STALE_AFTER_DAYS * 86_400_000;
      const cost = raw.cost_usd || 0;
      const qualified = metrics.numQualified;
      rows.push({
        tool,
        query_id: query.query_id,
        track: query.track,
        category: query.category,
        status: raw.status ?? null,
        returned: persons.length,
        unique: new Set(persons.map(identity)).size,
        criteria_passing: qualified,
        verifiable: verdicts.filter((verdict) =>
          isVerifiable(verdict.evaluation)
        ).length,
        intent_verified: intent
          ? verdicts.filter((verdict) => isIntentHit(verdict.evaluation, ids))
              .length
          : null,
        stale_or_unknown: persons.filter((person) => {
          const date = parseDate(person.activity_date);
          return date === null || date < limit;
        }).length,
        overall: pyRound(computePlatformScores(tool, [metrics], 1).overall, 2),
        ndcg_10: pyRound(metrics.ndcg[10], 4),
        utility: pyRound(metrics.utility, 4),
        latency_s: raw.latency_s ?? null,
        cost_usd: pyRound(cost, 4),
        credits: raw.credits ?? null,
        cost_per_usable_usd: qualified ? pyRound(cost / qualified, 4) : null,
        raw_sha256: raw.raw_sha256 ?? null,
        judge_tokens: {
          input: pySum(verdicts.map((verdict) => verdict.tokens.input)),
          output: pySum(verdicts.map((verdict) => verdict.tokens.output)),
        },
        tavily_searches: pySum(
          verdicts.map((verdict) => verdict.searches?.length ?? 0)
        ),
      });
    }
  }

  const summary: Record<string, Record<string, Record<string, unknown>>> = {};
  for (const key of [...groups.keys()].sort()) {
    const { tool, track, metrics } = groups.get(key)!;
    const skipped = notRun(tool);
    const inTrack = QUERIES.filter((query) => query.track === track);
    const totalQueries = pilot ? inTrack.length : metrics.length;
    const mine = rows.filter((row) => row.tool === tool && row.track === track);
    const latencies = mine.flatMap((row) =>
      row.latency_s ? [row.latency_s] : []
    );
    const totalCost = pyRound(pySum(mine.map((row) => row.cost_usd)), 4);
    const usable = pySum(mine.map((row) => row.criteria_passing));
    const scores: Record<string, unknown> = {
      ...computePlatformScores(tool, metrics, totalQueries),
      ...(pilot
        ? {}
        : {
            // Only questions with collected results count; a run that returned nobody still counts.
            queries_scored: totalQueries,
            pending: inTrack
              .filter(
                (query) =>
                  !skipped.includes(query.query_id) &&
                  !raws.has(`${tool}/${query.query_id}`)
              )
              .map((query) => query.query_id)
              .sort(),
            role: SECONDARY_VIEWS.has(tool) ? "secondary" : "primary",
            not_run: inTrack
              .filter((query) => skipped.includes(query.query_id))
              .map((query) => query.query_id)
              .sort(),
          }),
      median_latency_s: latencies.length ? pyRound(median(latencies), 2) : null,
      total_cost_usd: totalCost,
      cost_per_usable_usd: usable ? pyRound(totalCost / usable, 4) : null,
    };
    if (isIntent(track)) {
      const hits = pySum(mine.map((row) => row.intent_verified ?? 0));
      const returned = pySum(mine.map((row) => row.returned));
      scores.intent_verified = hits;
      scores.intent_precision = pyRound(
        (100 * hits) / Math.max(returned, 1),
        1
      );
      scores.cost_per_intent_hit_usd = hits
        ? pyRound(totalCost / hits, 4)
        : null;
    }
    (summary[track] ??= {})[tool] = scores;
  }

  return {
    judge: model,
    top_k_scored: topK,
    // The pilot report had no per-row intent_verified or overall yet.
    rows: rows.map(
      ({
        intent_verified,
        overall,
        ...row
      }): typeof row & { intent_verified?: number | null; overall?: number } =>
        pilot ? row : { ...row, intent_verified, overall }
    ),
    summary,
    missing_verdicts: missing,
  };
}

// --- Comparison ------------------------------------------------------------------

export type Round1Mismatch = Readonly<{
  file: string;
  // JSON path such as summary.public.exa.overall; never a person's details.
  path: string;
  expected: unknown;
  actual: unknown;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Compares leaf values; returns how many were compared. */
function compareValues(
  expected: unknown,
  actual: unknown,
  path: string,
  report: (path: string, expected: unknown, actual: unknown) => void
): number {
  if (Array.isArray(expected) && Array.isArray(actual)) {
    let count = 0;
    for (
      let index = 0;
      index < Math.max(expected.length, actual.length);
      index++
    )
      count += compareValues(
        expected[index],
        actual[index],
        `${path}[${index}]`,
        report
      );
    return count;
  }
  if (isRecord(expected) && isRecord(actual)) {
    let count = 0;
    for (const key of new Set([
      ...Object.keys(expected),
      ...Object.keys(actual),
    ]))
      count += compareValues(
        expected[key],
        actual[key],
        path ? `${path}.${key}` : key,
        report
      );
    return count;
  }
  if (expected !== actual) report(path, expected, actual);
  return 1;
}

const savedReportSchema = z.looseObject({ at: z.string() });

/**
 * Re-scores every saved results/<judge>_top<k>.json from the data as it was when
 * that file was written, and lists every value that differs (timestamps aside).
 */
export async function compareRound1(dataDir: string) {
  const resultsDir = join(dataDir, "results");
  const files = (await readdir(resultsDir))
    .filter((file) => /^(trial|final)_top\d+\.json$/.test(file))
    .sort();
  const mismatches: Round1Mismatch[] = [];
  let compared = 0;
  for (const file of files) {
    const [, judge, topK] = /^(trial|final)_top(\d+)/.exec(file)!;
    const { at, ...expected } = savedReportSchema.parse(
      JSON.parse(await readFile(join(resultsDir, file), "utf8"))
    );
    const actual = await rescoreRound1(
      dataDir,
      judge as Round1Judge,
      Number(topK),
      { asOf: at }
    );
    compared += compareValues(
      expected,
      actual,
      "",
      (path, expectedValue, actualValue) =>
        mismatches.push({
          file,
          path,
          expected: expectedValue,
          actual: actualValue,
        })
    );
  }
  return { files, compared, mismatches };
}
