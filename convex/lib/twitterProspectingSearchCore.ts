export const TWITTER_PROSPECTING_SEARCH_MODES = ["exact", "raw"] as const;

export type TwitterProspectingSearchMode =
  (typeof TWITTER_PROSPECTING_SEARCH_MODES)[number];

export type TwitterProspectingQueryPlan = {
  query: string;
  searchMode: TwitterProspectingSearchMode;
};

type TwitterQueryStat = {
  query: string;
  postsFound: number;
  success: boolean;
};

const EXACT_PHRASE_MIN_WORDS = 2;
const EXACT_PHRASE_MAX_WORDS = 5;
const TRAILING_CONNECTORS = new Set([
  "a",
  "an",
  "and",
  "at",
  "for",
  "from",
  "in",
  "my",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "your",
]);

function normalizeQuery(query: string) {
  return query.replace(/\s+/g, " ").trim();
}

function hasSearchOperatorSyntax(query: string) {
  return (
    /[()]/.test(query) ||
    /(^|\s)(?:AND|OR)(?=\s|$)/i.test(query) ||
    /(^|\s)-?[a-z_]+:/i.test(query)
  );
}

export function stripTwitterExactPhraseQuotes(query: string) {
  const normalized = normalizeQuery(query);
  if (
    normalized.length >= 2 &&
    normalized.startsWith('"') &&
    normalized.endsWith('"')
  ) {
    return normalized.slice(1, -1).trim();
  }
  return normalized;
}

export function resolveTwitterProspectingSearchMode(args: {
  query: string;
  requestedMode?: TwitterProspectingSearchMode;
}): TwitterProspectingSearchMode {
  if (args.requestedMode !== "exact") {
    return "raw";
  }

  const query = stripTwitterExactPhraseQuotes(args.query);
  const words = query.split(/\s+/).filter(Boolean);
  const lastWord = words[words.length - 1]
    ?.replace(/[^a-z]/gi, "")
    .toLowerCase();

  if (
    words.length < EXACT_PHRASE_MIN_WORDS ||
    words.length > EXACT_PHRASE_MAX_WORDS ||
    !lastWord ||
    TRAILING_CONNECTORS.has(lastWord) ||
    hasSearchOperatorSyntax(query)
  ) {
    return "raw";
  }

  return "exact";
}

export function partitionTwitterProspectingQueries(
  plans: TwitterProspectingQueryPlan[]
) {
  const exact: string[] = [];
  const raw: string[] = [];

  for (const plan of plans) {
    const query = normalizeQuery(plan.query);
    if (!query) continue;
    if (plan.searchMode === "exact") {
      exact.push(query);
    } else {
      raw.push(query);
    }
  }

  return { exact, raw };
}

export function getTwitterExactFallbackQueries(stats: TwitterQueryStat[]) {
  return Array.from(
    new Set(
      stats
        .filter((stat) => stat.success && stat.postsFound === 0)
        .map((stat) => stripTwitterExactPhraseQuotes(stat.query))
        .filter(Boolean)
    )
  );
}
