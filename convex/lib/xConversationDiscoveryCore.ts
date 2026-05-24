import type { TwitterPost } from "../integrations/twitter/searchPosts";
import {
  summarizeTwitterPost,
  type TwitterPostSummary,
} from "../../shared/lib/twitter/contracts";

const PAIN_TERMS = [
  "struggling",
  "stuck",
  "problem",
  "pain",
  "issue",
  "blocked",
  "frustrated",
  "hard",
];

const HELP_TERMS = [
  "need",
  "help",
  "advice",
  "recommend",
  "looking for",
  "anyone",
  "suggest",
];

const BUYING_INTENT_TERMS = [
  "tool",
  "software",
  "platform",
  "using",
  "tried",
  "switched",
  "workflow",
];

const LOW_SIGNAL_TERMS = [
  "gm",
  "lol",
  "lfg",
  "nice",
  "awesome",
  "wow",
  "same",
  "this",
];

export type SeedScoreBreakdown = {
  topicalFit: number;
  freshness: number;
  engagement: number;
  authorQuality: number;
  replyLikelihood: number;
  total: number;
};

export type ReplyCandidateScoreBreakdown = {
  topicalFit: number;
  painSignal: number;
  intentSignal: number;
  authorQuality: number;
  penalties: number;
  total: number;
};

export type ConversationSeedDraft = {
  rootTweetId: string;
  conversationId: string;
  rootAuthorId?: string;
  rootAuthorUsername?: string;
  rootTweetData: TwitterPost;
  rootTweetSummary?: TwitterPostSummary;
  sourceSearchQuery?: string;
  sourceKeyword?: string;
  seedScore: number;
  seedScoreBreakdown: SeedScoreBreakdown;
  promotionReason: string;
};

export type ReplyDiscoveryDecision = {
  accepted: boolean;
  matchedQueries: string[];
  score: number;
  scoreBreakdown: ReplyCandidateScoreBreakdown;
  acceptanceReason?: string;
  discardReason?: string;
  discoverySnippet: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeText(value: string) {
  return normalizeWhitespace(value.toLowerCase());
}

function stripSearchOperators(value: string) {
  return value
    .replace(
      /\b(from|filter|since_time|since_id|max_id|conversation_id):\S+/gi,
      " "
    )
    .replace(/[()"]/g, " ")
    .replace(/\bOR\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: Array<string | undefined | null>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );
}

function countMatches(text: string, terms: string[]) {
  return terms.reduce((count, term) => {
    return count + (text.includes(term) ? 1 : 0);
  }, 0);
}

function buildThemeTerms(source?: string, matchedQueries?: string[]) {
  const raw = uniqueStrings([source, ...(matchedQueries ?? [])])
    .flatMap((value) => stripSearchOperators(value).split(/\s+/))
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length >= 4)
    .filter((value) => !PAIN_TERMS.includes(value))
    .filter((value) => !HELP_TERMS.includes(value))
    .filter((value) => !BUYING_INTENT_TERMS.includes(value));

  return Array.from(new Set(raw)).slice(0, 3);
}

export function getTwitterPostText(
  post: Pick<TwitterPost, "full_text" | "text">
) {
  return normalizeWhitespace(post.full_text || post.text || "");
}

export function getTwitterPostAuthorId(post: Pick<TwitterPost, "user">) {
  return post.user?.id_str || undefined;
}

export function getTwitterPostAuthorUsername(post: Pick<TwitterPost, "user">) {
  return post.user?.screen_name || undefined;
}

export function buildConversationSeedDraft(args: {
  post: TwitterPost;
  matchedQueries?: string[];
  sourceKeyword?: string;
  nowMs?: number;
}): ConversationSeedDraft | null {
  const text = getTwitterPostText(args.post);
  const tweetId = args.post.id_str?.trim();
  if (!tweetId || !text) {
    return null;
  }
  if (
    args.post.in_reply_to_status_id_str &&
    args.post.in_reply_to_status_id_str !== tweetId
  ) {
    return null;
  }

  const createdAtMs = Date.parse(args.post.tweet_created_at || "");
  const nowMs = args.nowMs ?? Date.now();
  const ageHours = Number.isFinite(createdAtMs)
    ? Math.max(0, (nowMs - createdAtMs) / (1000 * 60 * 60))
    : 24 * 30;
  const replyCount = args.post.reply_count ?? 0;
  const engagementCount =
    replyCount +
    (args.post.favorite_count ?? 0) * 0.1 +
    (args.post.retweet_count ?? 0) * 0.2 +
    (args.post.quote_count ?? 0) * 0.3;
  const normalizedText = normalizeText(text);

  const topicalFit = clamp((args.matchedQueries?.length ?? 0) * 8, 0, 24);
  const freshness =
    ageHours <= 24 ? 20 : ageHours <= 72 ? 16 : ageHours <= 7 * 24 ? 10 : 4;
  const engagement = clamp(
    Math.round(Math.min(25, replyCount * 3 + engagementCount * 0.2)),
    0,
    25
  );
  const followers = args.post.user?.followers_count ?? 0;
  const authorQuality = clamp(
    Math.round(
      Math.min(
        10,
        (followers >= 5_000 ? 6 : followers >= 500 ? 4 : 2) +
          (args.post.user?.verified ? 2 : 0) +
          (args.post.user?.description ? 2 : 0)
      )
    ),
    0,
    10
  );
  const replyLikelihood = clamp(
    (replyCount >= 8 ? 5 : replyCount >= 3 ? 3 : 0) +
      (normalizedText.includes("?") ? 2 : 0) +
      (countMatches(normalizedText, HELP_TERMS) > 0 ? 2 : 0) +
      (countMatches(normalizedText, PAIN_TERMS) > 0 ? 1 : 0),
    0,
    10
  );
  const total = clamp(
    topicalFit + freshness + engagement + authorQuality + replyLikelihood,
    0,
    100
  );

  if (replyCount < 3 || total < 35) {
    return null;
  }

  return {
    rootTweetId: tweetId,
    conversationId: args.post.conversation_id_str || tweetId,
    rootAuthorId: getTwitterPostAuthorId(args.post),
    rootAuthorUsername: getTwitterPostAuthorUsername(args.post),
    rootTweetData: args.post,
    rootTweetSummary: summarizeTwitterPost(args.post),
    sourceSearchQuery: args.matchedQueries?.[0],
    sourceKeyword: args.sourceKeyword,
    seedScore: total,
    seedScoreBreakdown: {
      topicalFit,
      freshness,
      engagement,
      authorQuality,
      replyLikelihood,
      total,
    },
    promotionReason:
      replyCount >= 10
        ? "Strong reply volume under a relevant seed post"
        : "Relevant seed post with enough reply activity to mine",
  };
}

export function selectConversationSeeds(args: {
  posts: TwitterPost[];
  matchedQueriesByPostId?: Record<string, string[]>;
  maxSeeds?: number;
}) {
  const drafts = args.posts
    .map((post) =>
      buildConversationSeedDraft({
        post,
        matchedQueries: args.matchedQueriesByPostId?.[post.id_str] ?? [],
      })
    )
    .filter((draft): draft is ConversationSeedDraft => draft !== null)
    .sort((left, right) => right.seedScore - left.seedScore);

  const seenConversationIds = new Set<string>();
  const selected: ConversationSeedDraft[] = [];
  for (const draft of drafts) {
    if (seenConversationIds.has(draft.conversationId)) {
      continue;
    }
    seenConversationIds.add(draft.conversationId);
    selected.push(draft);
    if (selected.length >= (args.maxSeeds ?? 3)) {
      break;
    }
  }

  return selected;
}

export function buildReplyDiscoveryQueries(args: {
  rootTweetId: string;
  sourceKeyword?: string;
  matchedQueries?: string[];
}) {
  const base = `conversation_id:${args.rootTweetId}`;
  const themeTerms = buildThemeTerms(args.sourceKeyword, args.matchedQueries);
  const queries = uniqueStrings([
    base,
    `${base} ("need" OR "help" OR "advice" OR "recommend")`,
    `${base} ("struggling" OR "problem" OR "issue" OR "blocked")`,
    `${base} ("using" OR "tool" OR "platform" OR "workflow")`,
    themeTerms.length > 0 ? `${base} "${themeTerms.join(" ")}"` : undefined,
  ]);

  return queries.slice(0, 5);
}

export function scoreReplyDiscoveryCandidate(args: {
  replyTweet: TwitterPost;
  rootAuthorId?: string;
  matchedQueries?: string[];
  sourceKeyword?: string;
}): ReplyDiscoveryDecision {
  const text = getTwitterPostText(args.replyTweet);
  const discoverySnippet = text.slice(0, 240);
  const replyAuthorId = getTwitterPostAuthorId(args.replyTweet);
  if (!replyAuthorId) {
    return {
      accepted: false,
      matchedQueries: args.matchedQueries ?? [],
      score: 0,
      scoreBreakdown: {
        topicalFit: 0,
        painSignal: 0,
        intentSignal: 0,
        authorQuality: 0,
        penalties: 0,
        total: 0,
      },
      discardReason: "Reply author is missing",
      discoverySnippet,
    };
  }

  if (!text || text.length < 12) {
    return {
      accepted: false,
      matchedQueries: args.matchedQueries ?? [],
      score: 0,
      scoreBreakdown: {
        topicalFit: 0,
        painSignal: 0,
        intentSignal: 0,
        authorQuality: 0,
        penalties: 0,
        total: 0,
      },
      discardReason: "Reply is too short to qualify reliably",
      discoverySnippet,
    };
  }

  if (args.rootAuthorId && replyAuthorId === args.rootAuthorId) {
    return {
      accepted: false,
      matchedQueries: args.matchedQueries ?? [],
      score: 0,
      scoreBreakdown: {
        topicalFit: 0,
        painSignal: 0,
        intentSignal: 0,
        authorQuality: 0,
        penalties: 0,
        total: 0,
      },
      discardReason: "Seed author self-reply",
      discoverySnippet,
    };
  }

  const normalizedText = normalizeText(text);
  const themeTerms = buildThemeTerms(args.sourceKeyword, args.matchedQueries);
  const matchedQueries =
    args.matchedQueries?.filter((query) => {
      const normalizedQuery = normalizeText(stripSearchOperators(query));
      return (
        normalizedQuery.length > 0 && normalizedText.includes(normalizedQuery)
      );
    }) ?? [];

  const topicalFit = clamp(
    matchedQueries.length * 10 + countMatches(normalizedText, themeTerms) * 5,
    0,
    30
  );
  const painSignal = clamp(countMatches(normalizedText, PAIN_TERMS) * 6, 0, 24);
  const intentSignal = clamp(
    countMatches(normalizedText, HELP_TERMS) * 5 +
      countMatches(normalizedText, BUYING_INTENT_TERMS) * 4,
    0,
    24
  );
  const followers = args.replyTweet.user?.followers_count ?? 0;
  const authorQuality = clamp(
    (args.replyTweet.user?.description ? 4 : 1) +
      (followers >= 1_000 ? 4 : followers >= 100 ? 2 : 0) +
      (args.replyTweet.user?.verified ? 2 : 0),
    0,
    12
  );
  const penalties = clamp(
    (countMatches(normalizedText, LOW_SIGNAL_TERMS) >= 2 ? 8 : 0) +
      (/giveaway|airdrop|follow\s+back|dm me/i.test(text) ? 10 : 0) +
      (text.replace(/[a-z0-9\s]/gi, "").length > text.length / 3 ? 4 : 0),
    0,
    20
  );
  const total = clamp(
    topicalFit + painSignal + intentSignal + authorQuality - penalties,
    0,
    100
  );

  const accepted =
    total >= 32 && (painSignal >= 6 || intentSignal >= 6 || topicalFit >= 10);

  return {
    accepted,
    matchedQueries,
    score: total,
    scoreBreakdown: {
      topicalFit,
      painSignal,
      intentSignal,
      authorQuality,
      penalties,
      total,
    },
    acceptanceReason: accepted
      ? painSignal >= intentSignal
        ? "Reply shows a concrete pain point in a relevant conversation"
        : "Reply shows active help-seeking or evaluation intent in a relevant conversation"
      : undefined,
    discardReason: accepted
      ? undefined
      : "Reply did not show enough prospecting signal after scoring",
    discoverySnippet,
  };
}
