export const TWITTER_PROSPECTING_SEARCH_MODES = ["exact", "raw"] as const;

export type TwitterProspectingSearchMode =
  (typeof TWITTER_PROSPECTING_SEARCH_MODES)[number];

export type TwitterProspectingQueryPlan = {
  query: string;
  searchMode: TwitterProspectingSearchMode;
  sinceId?: string;
};

export type TwitterQueryStat = {
  query: string;
  postsFound: number;
  newProspectsFound?: number;
  pagesFetched?: number;
  newestPostId?: string;
  success: boolean;
  error?: string;
};

export type UnsavedTwitterSearchResult<TPost extends { id_str: string }> = {
  queryStats: TwitterQueryStat[];
  posts: TPost[];
  matchedQueriesByPostId: Record<string, string[]>;
};

export function getTwitterProspectingPageLimit(args: {
  processingMode?: "normal" | "preview";
  configuredPagesPerQuery: number;
}) {
  // Setup preview only needs a small representative sample. Persisting several
  // full pages per query can make the synchronous approval mutation exceed
  // Convex's per-function read budget when it promotes the preview candidates.
  return args.processingMode === "preview"
    ? 1
    : Math.max(1, Math.floor(args.configuredPagesPerQuery));
}

export function limitTwitterProspectingPostsForPersistence<T>(args: {
  posts: T[];
  processingMode?: "normal" | "preview";
  previewLimit: number;
}) {
  return args.processingMode === "preview"
    ? args.posts.slice(0, Math.max(0, Math.floor(args.previewLimit)))
    : args.posts;
}

const EXACT_PHRASE_MIN_WORDS = 2;
const EXACT_PHRASE_MAX_WORDS = 5;
const TWITTER_SEARCH_BOUNDARY_OPERATOR =
  /(^|\s)(?:since|until|since_time|until_time|since_id|max_id):/i;
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

function normalizeTwitterPostId(value: string | undefined) {
  const normalized = value?.trim();
  return normalized && /^\d+$/.test(normalized) ? normalized : undefined;
}

function compareDecimalIds(left: string, right: string) {
  return left.length - right.length || left.localeCompare(right);
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

export function buildTwitterProspectingProviderQuery(args: {
  query: string;
  searchMode: TwitterProspectingSearchMode;
  sinceTimestampSeconds: number;
  sinceId?: string;
}) {
  const normalized = normalizeQuery(args.query);
  const query =
    args.searchMode === "exact"
      ? `"${stripTwitterExactPhraseQuotes(normalized)}"`
      : normalized;

  if (!query || TWITTER_SEARCH_BOUNDARY_OPERATOR.test(query)) {
    return query;
  }

  const sinceId = normalizeTwitterPostId(args.sinceId);
  if (sinceId) {
    return `${query} since_id:${sinceId}`;
  }

  return `${query} since_time:${Math.max(0, Math.floor(args.sinceTimestampSeconds))}`;
}

export function getNewestTwitterPostId(
  posts: Array<{ id_str: string }>
): string | undefined {
  let newest: string | undefined;

  for (const post of posts) {
    const postId = normalizeTwitterPostId(post.id_str);
    if (!postId || (newest && compareDecimalIds(postId, newest) <= 0)) {
      continue;
    }
    newest = postId;
  }

  return newest;
}

export function getNextTwitterSearchCursor(args: {
  hasMore: boolean;
  nextCursor?: string;
  pagePostCount: number;
  seenCursors: ReadonlySet<string>;
}): string | undefined {
  const nextCursor = args.nextCursor?.trim();
  if (
    !args.hasMore ||
    !nextCursor ||
    args.pagePostCount <= 0 ||
    args.seenCursors.has(nextCursor)
  ) {
    return undefined;
  }
  return nextCursor;
}

export function attributeNewTwitterProspectsToQueries(args: {
  createdTwitterUserIds: string[];
  matches: Array<{ twitterUserId?: string; queries: string[] }>;
}): Record<string, number> {
  const createdUserIds = new Set(
    args.createdTwitterUserIds.map((userId) => userId.trim()).filter(Boolean)
  );
  const usersByQuery = new Map<string, Set<string>>();

  for (const match of args.matches) {
    const twitterUserId = match.twitterUserId?.trim();
    if (!twitterUserId || !createdUserIds.has(twitterUserId)) {
      continue;
    }

    for (const rawQuery of match.queries) {
      const query = normalizeQuery(rawQuery);
      if (!query) continue;
      const users = usersByQuery.get(query) ?? new Set<string>();
      users.add(twitterUserId);
      usersByQuery.set(query, users);
    }
  }

  return Object.fromEntries(
    Array.from(usersByQuery.entries()).map(([query, users]) => [
      query,
      users.size,
    ])
  );
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
    query.includes('"') ||
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
      exact.push(stripTwitterExactPhraseQuotes(query));
    } else {
      raw.push(query);
    }
  }

  return { exact, raw };
}

export function mergeTwitterProspectingSearchResults<
  TPost extends { id_str: string },
>(
  results: UnsavedTwitterSearchResult<TPost>[]
): UnsavedTwitterSearchResult<TPost> {
  const postsById = new Map<string, TPost>();
  const matchedQueriesByPostId = new Map<string, Set<string>>();

  for (const result of results) {
    for (const post of result.posts) {
      if (!postsById.has(post.id_str)) {
        postsById.set(post.id_str, post);
      }

      const matchedQueries =
        matchedQueriesByPostId.get(post.id_str) ?? new Set<string>();
      for (const query of result.matchedQueriesByPostId[post.id_str] ?? []) {
        matchedQueries.add(query);
      }
      matchedQueriesByPostId.set(post.id_str, matchedQueries);
    }
  }

  return {
    queryStats: results.flatMap((result) => result.queryStats),
    posts: Array.from(postsById.values()),
    matchedQueriesByPostId: Object.fromEntries(
      Array.from(matchedQueriesByPostId.entries()).map(([postId, queries]) => [
        postId,
        Array.from(queries),
      ])
    ),
  };
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
