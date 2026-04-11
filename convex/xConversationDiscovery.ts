import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./lib/functionBuilders";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { summarizeTwitterPost } from "../shared/lib/twitter/contracts";
import type { TwitterPost } from "./integrations/twitter/searchPosts";
import {
  buildReplyDiscoveryQueries,
  getTwitterPostAuthorId,
  scoreReplyDiscoveryCandidate,
  selectConversationSeeds,
} from "./lib/xConversationDiscoveryCore";

type ConversationSeedDoc = Doc<"twitterConversationSeeds">;
const MAX_PROMOTED_SEEDS_PER_RUN = 3;
const MAX_BACKFILL_BROAD_PAGES = 5;
const MAX_BACKFILL_TARGETED_PAGES = 2;
const MAX_BACKFILL_TARGETED_QUERIES = 4;
const MAX_BACKFILL_UNIQUE_REPLIES = 150;

function mergeMatchedQueries(
  current: string[] | undefined,
  incoming: string[] | undefined
) {
  const merged = Array.from(
    new Set([...(current ?? []), ...(incoming ?? [])].filter(Boolean))
  );
  return merged.length > 0 ? merged : undefined;
}

function buildConversationMonitorQuery(seed: {
  rootTweetId: string;
  rootAuthorUsername?: string;
}) {
  const excludeAuthor = seed.rootAuthorUsername
    ? ` -from:${seed.rootAuthorUsername}`
    : "";
  return `conversation_id:${seed.rootTweetId}${excludeAuthor}`;
}

function buildSearchQueryNode(query: string) {
  return {
    kind: "search_query" as const,
    platform: "twitter" as const,
    externalId: query,
    label: query,
    summary: query,
  };
}

function buildConversationSeedNode(seed: {
  _id: Id<"twitterConversationSeeds">;
  rootTweetId: string;
  rootTweetSummary?: Doc<"twitterConversationSeeds">["rootTweetSummary"];
}) {
  return {
    kind: "conversation_seed" as const,
    platform: "twitter" as const,
    internalId: String(seed._id),
    externalId: seed.rootTweetId,
    label: seed.rootTweetSummary?.author?.handle
      ? `Seed @${seed.rootTweetSummary.author.handle}`
      : "Seed post",
    summary: seed.rootTweetSummary?.textPreview,
  };
}

function buildReplyPostNode(tweet: TwitterPost) {
  return {
    kind: "reply_post" as const,
    platform: "twitter" as const,
    externalId: tweet.id_str,
    label: tweet.user?.screen_name ? `@${tweet.user.screen_name}` : "Reply post",
    summary: summarizeTwitterPost(tweet)?.textPreview,
  };
}

function buildProspectNode(args: {
  prospectId: Id<"prospects">;
  twitterUserId: string;
  tweet: TwitterPost;
}) {
  return {
    kind: "prospect" as const,
    platform: "twitter" as const,
    internalId: String(args.prospectId),
    externalId: args.twitterUserId,
    label: args.tweet.user?.screen_name
      ? `@${args.tweet.user.screen_name}`
      : args.tweet.user?.name,
    summary: summarizeTwitterPost(args.tweet)?.textPreview,
  };
}

export const getConversationSeedByRootTweetIdInternal = internalQuery({
  args: { rootTweetId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("twitterConversationSeeds")
      .withIndex("by_root_tweet_id", (q) => q.eq("rootTweetId", args.rootTweetId))
      .first();
  },
});

export const upsertConversationSeedInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    rootTweetId: v.string(),
    conversationId: v.string(),
    rootAuthorId: v.optional(v.string()),
    rootAuthorUsername: v.optional(v.string()),
    rootTweetData: v.any(),
    rootTweetSummary: v.optional(v.any()),
    sourceSearchQuery: v.optional(v.string()),
    sourceKeyword: v.optional(v.string()),
    seedScore: v.number(),
    seedScoreBreakdown: v.any(),
    promotionReason: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("twitterConversationSeeds")
      .withIndex("by_root_tweet_id", (q) => q.eq("rootTweetId", args.rootTweetId))
      .first();
    const now = getCurrentUTCTimestamp();

    if (existing) {
      await ctx.db.patch(existing._id, {
        conversationId: args.conversationId,
        rootAuthorId: args.rootAuthorId ?? existing.rootAuthorId,
        rootAuthorUsername: args.rootAuthorUsername ?? existing.rootAuthorUsername,
        rootTweetData: args.rootTweetData,
        rootTweetSummary: args.rootTweetSummary ?? existing.rootTweetSummary,
        sourceSearchQuery: args.sourceSearchQuery ?? existing.sourceSearchQuery,
        sourceKeyword: args.sourceKeyword ?? existing.sourceKeyword,
        seedScore: Math.max(existing.seedScore, args.seedScore),
        seedScoreBreakdown:
          args.seedScore > existing.seedScore
            ? args.seedScoreBreakdown
            : existing.seedScoreBreakdown,
        promotionReason: args.promotionReason || existing.promotionReason,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("twitterConversationSeeds", {
      workspaceId: args.workspaceId,
      userId: args.userId,
      rootTweetId: args.rootTweetId,
      conversationId: args.conversationId,
      rootAuthorId: args.rootAuthorId,
      rootAuthorUsername: args.rootAuthorUsername,
      rootTweetData: args.rootTweetData,
      rootTweetSummary: args.rootTweetSummary,
      sourceSearchQuery: args.sourceSearchQuery,
      sourceKeyword: args.sourceKeyword,
      seedScore: args.seedScore,
      seedScoreBreakdown: args.seedScoreBreakdown,
      promotionReason: args.promotionReason,
      status: "pending_backfill",
      updatedAt: now,
    });
  },
});

export const recordConversationSeedProgressInternal = internalMutation({
  args: {
    seedId: v.id("twitterConversationSeeds"),
    status: v.optional(
      v.union(
        v.literal("pending_backfill"),
        v.literal("active"),
        v.literal("paused"),
        v.literal("archived"),
        v.literal("failed")
      )
    ),
    lastBackfillCursor: v.optional(v.string()),
    lastReplySeenAt: v.optional(v.number()),
    lastWebhookAt: v.optional(v.number()),
    repliesSeenDelta: v.optional(v.number()),
    candidatesAcceptedDelta: v.optional(v.number()),
    prospectsCreatedDelta: v.optional(v.number()),
    initialBackfillCompletedAt: v.optional(v.number()),
    monitorId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const seed = await ctx.db.get(args.seedId);
    if (!seed) {
      throw new Error("Conversation seed not found");
    }

    await ctx.db.patch(args.seedId, {
      status: args.status ?? seed.status,
      lastBackfillCursor:
        args.lastBackfillCursor !== undefined
          ? args.lastBackfillCursor
          : seed.lastBackfillCursor,
      lastReplySeenAt: args.lastReplySeenAt ?? seed.lastReplySeenAt,
      lastWebhookAt: args.lastWebhookAt ?? seed.lastWebhookAt,
      totalRepliesSeen: (seed.totalRepliesSeen ?? 0) + (args.repliesSeenDelta ?? 0),
      totalCandidatesAccepted:
        (seed.totalCandidatesAccepted ?? 0) +
        (args.candidatesAcceptedDelta ?? 0),
      totalProspectsCreated:
        (seed.totalProspectsCreated ?? 0) + (args.prospectsCreatedDelta ?? 0),
      initialBackfillCompletedAt:
        args.initialBackfillCompletedAt ?? seed.initialBackfillCompletedAt,
      monitorId: args.monitorId ?? seed.monitorId,
      updatedAt: getCurrentUTCTimestamp(),
    });
  },
});

export const upsertReplyDiscoveryCandidateInternal = internalMutation({
  args: {
    seedId: v.id("twitterConversationSeeds"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    replyTweetId: v.string(),
    replyAuthorId: v.optional(v.string()),
    replyAuthorUsername: v.optional(v.string()),
    replyTweetData: v.any(),
    replyTweetSummary: v.optional(v.any()),
    matchedQueries: v.optional(v.array(v.string())),
    score: v.number(),
    scoreBreakdown: v.any(),
    discardReason: v.optional(v.string()),
    acceptanceReason: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("discarded")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("twitterReplyDiscoveryCandidates")
      .withIndex("by_seed_reply_tweet", (q) =>
        q.eq("seedId", args.seedId).eq("replyTweetId", args.replyTweetId)
      )
      .first();
    const now = getCurrentUTCTimestamp();

    if (existing) {
      await ctx.db.patch(existing._id, {
        replyAuthorId: args.replyAuthorId ?? existing.replyAuthorId,
        replyAuthorUsername: args.replyAuthorUsername ?? existing.replyAuthorUsername,
        replyTweetData: args.replyTweetData,
        replyTweetSummary: args.replyTweetSummary ?? existing.replyTweetSummary,
        matchedQueries: mergeMatchedQueries(existing.matchedQueries, args.matchedQueries),
        score: Math.max(existing.score, args.score),
        scoreBreakdown:
          args.score > existing.score ? args.scoreBreakdown : existing.scoreBreakdown,
        discardReason: args.discardReason ?? existing.discardReason,
        acceptanceReason: args.acceptanceReason ?? existing.acceptanceReason,
        status:
          existing.status === "prospect_created" ||
          existing.status === "merged_into_existing"
            ? existing.status
            : args.status,
        processedAt:
          existing.processedAt ??
          (args.status === "discarded" ? now : undefined),
        updatedAt: now,
      });

      return {
        candidateId: existing._id,
        alreadyProcessed:
          existing.status === "prospect_created" ||
          existing.status === "merged_into_existing" ||
          existing.status === "discarded",
        currentStatus: existing.status,
      };
    }

    const candidateId = await ctx.db.insert("twitterReplyDiscoveryCandidates", {
      seedId: args.seedId,
      workspaceId: args.workspaceId,
      userId: args.userId,
      replyTweetId: args.replyTweetId,
      replyAuthorId: args.replyAuthorId,
      replyAuthorUsername: args.replyAuthorUsername,
      replyTweetData: args.replyTweetData,
      replyTweetSummary: args.replyTweetSummary,
      matchedQueries: args.matchedQueries,
      score: args.score,
      scoreBreakdown: args.scoreBreakdown,
      discardReason: args.discardReason,
      acceptanceReason: args.acceptanceReason,
      status: args.status,
      discoveredAt: now,
      processedAt: args.status === "discarded" ? now : undefined,
      updatedAt: now,
    });

    return {
      candidateId,
      alreadyProcessed: args.status === "discarded",
      currentStatus: args.status,
    };
  },
});

export const finalizeReplyDiscoveryCandidateInternal = internalMutation({
  args: {
    candidateId: v.id("twitterReplyDiscoveryCandidates"),
    status: v.union(v.literal("prospect_created"), v.literal("merged_into_existing")),
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.candidateId, {
      status: args.status,
      prospectId: args.prospectId,
      processedAt: getCurrentUTCTimestamp(),
      updatedAt: getCurrentUTCTimestamp(),
    });
  },
});

async function processReplyTweet(args: {
  ctx: ActionCtx;
  seed: ConversationSeedDoc;
  tweet: TwitterPost;
  matchedQueries?: string[];
}) {
  const replyTweetId = args.tweet.id_str;
  if (!replyTweetId || replyTweetId === args.seed.rootTweetId) {
    return { repliesSeenDelta: 0, acceptedDelta: 0, prospectsCreatedDelta: 0 };
  }

  const decision = scoreReplyDiscoveryCandidate({
    replyTweet: args.tweet,
    rootAuthorId: args.seed.rootAuthorId,
    matchedQueries: args.matchedQueries,
    sourceKeyword: args.seed.sourceKeyword,
  });

  const candidate = await args.ctx.runMutation(
    internal.xConversationDiscovery.upsertReplyDiscoveryCandidateInternal,
    {
      seedId: args.seed._id,
      workspaceId: args.seed.workspaceId,
      userId: args.seed.userId,
      replyTweetId,
      replyAuthorId: getTwitterPostAuthorId(args.tweet),
      replyAuthorUsername: args.tweet.user?.screen_name,
      replyTweetData: args.tweet,
      replyTweetSummary: summarizeTwitterPost(args.tweet),
      matchedQueries: decision.matchedQueries,
      score: decision.score,
      scoreBreakdown: decision.scoreBreakdown,
      discardReason: decision.discardReason,
      acceptanceReason: decision.acceptanceReason,
      status: decision.accepted ? "pending" : "discarded",
    }
  );

  if (!decision.accepted || candidate.alreadyProcessed) {
    return {
      repliesSeenDelta: 1,
      acceptedDelta:
        candidate.currentStatus === "prospect_created" ||
        candidate.currentStatus === "merged_into_existing"
          ? 1
          : 0,
      prospectsCreatedDelta: candidate.currentStatus === "prospect_created" ? 1 : 0,
    };
  }

  const twitterUserId = getTwitterPostAuthorId(args.tweet);
  if (!twitterUserId) {
    return { repliesSeenDelta: 1, acceptedDelta: 0, prospectsCreatedDelta: 0 };
  }

  const prospectResult = await args.ctx.runAction(
    internal.prospects.saveReplyDerivedProspectWithRetry,
    {
      workspaceId: args.seed.workspaceId,
      userId: args.seed.userId,
      replyTweetId,
      twitterUserId,
      data: args.tweet,
      matchReason:
        decision.acceptanceReason ?? "Matched as a strong X reply prospect",
      matchedKeywords: decision.matchedQueries,
      discoveryContext: {
        conversationSeedId: args.seed._id,
        replyCandidateId: candidate.candidateId,
        monitorId: args.seed.monitorId,
        seedPostSummary: args.seed.rootTweetSummary,
        seedPostRef:
          args.seed.rootTweetSummary &&
          typeof args.seed.rootTweetSummary === "object" &&
          "ref" in (args.seed.rootTweetSummary as Record<string, unknown>)
            ? ((args.seed.rootTweetSummary as Record<string, unknown>).ref as any)
            : undefined,
        replyPostSummary: summarizeTwitterPost(args.tweet),
        replyPostRef: summarizeTwitterPost(args.tweet)?.ref,
        matchedQueries: decision.matchedQueries,
        matchedReason: decision.acceptanceReason,
        discoverySnippet: decision.discoverySnippet,
      },
    }
  );

  await args.ctx.runMutation(
    internal.xConversationDiscovery.finalizeReplyDiscoveryCandidateInternal,
    {
      candidateId: candidate.candidateId,
      prospectId: prospectResult.prospectId,
      status: prospectResult.created ? "prospect_created" : "merged_into_existing",
    }
  );

  await args.ctx.runMutation(internal.discoveryEdges.upsertDiscoveryEdgeInternal, {
    workspaceId: args.seed.workspaceId,
    userId: args.seed.userId,
    edgeType: "seed_to_reply",
    discoverySource: "conversation_reply",
    sourceNode: buildConversationSeedNode(args.seed),
    targetNode: buildReplyPostNode(args.tweet),
    context: {
      matchedQueries: decision.matchedQueries,
      matchedReason: decision.acceptanceReason,
      score: decision.score,
      rootTweetId: args.seed.rootTweetId,
      replyTweetId,
      twitterUserId,
      acceptanceReason: decision.acceptanceReason,
      discardReason: decision.discardReason,
    },
  });

  await args.ctx.runMutation(internal.discoveryEdges.upsertDiscoveryEdgeInternal, {
    workspaceId: args.seed.workspaceId,
    userId: args.seed.userId,
    edgeType: "reply_to_prospect",
    discoverySource: "conversation_reply",
    sourceNode: buildReplyPostNode(args.tweet),
    targetNode: buildProspectNode({
      prospectId: prospectResult.prospectId,
      twitterUserId,
      tweet: args.tweet,
    }),
    context: {
      matchedQueries: decision.matchedQueries,
      matchedReason: decision.acceptanceReason,
      score: decision.score,
      rootTweetId: args.seed.rootTweetId,
      replyTweetId,
      twitterUserId,
      acceptanceReason: decision.acceptanceReason,
      discardReason: decision.discardReason,
    },
  });

  return {
    repliesSeenDelta: 1,
    acceptedDelta: 1,
    prospectsCreatedDelta: prospectResult.created ? 1 : 0,
  };
}

export const promoteConversationSeedsInternal = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    posts: v.array(v.any()),
    matchedQueriesByPostId: v.optional(v.any()),
    maxSeeds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const seeds = selectConversationSeeds({
      posts: args.posts as TwitterPost[],
      matchedQueriesByPostId: args.matchedQueriesByPostId as
        | Record<string, string[]>
        | undefined,
      maxSeeds: args.maxSeeds ?? MAX_PROMOTED_SEEDS_PER_RUN,
    });

    const seedIds: Id<"twitterConversationSeeds">[] = [];
    for (const seed of seeds) {
      const seedId = await ctx.runMutation(
        internal.xConversationDiscovery.upsertConversationSeedInternal,
        {
          workspaceId: args.workspaceId,
          userId: workspace.userId,
          rootTweetId: seed.rootTweetId,
          conversationId: seed.conversationId,
          rootAuthorId: seed.rootAuthorId,
          rootAuthorUsername: seed.rootAuthorUsername,
          rootTweetData: seed.rootTweetData,
          rootTweetSummary: seed.rootTweetSummary,
          sourceSearchQuery: seed.sourceSearchQuery,
          sourceKeyword: seed.sourceKeyword,
          seedScore: seed.seedScore,
          seedScoreBreakdown: seed.seedScoreBreakdown,
          promotionReason: seed.promotionReason,
        }
      );

      const matchedQueries =
        ((args.matchedQueriesByPostId as Record<string, string[]> | undefined)?.[
          seed.rootTweetId
        ] ?? (seed.sourceSearchQuery ? [seed.sourceSearchQuery] : [])).slice(
          0,
          MAX_BACKFILL_TARGETED_QUERIES + 1
        );
      for (const matchedQuery of matchedQueries) {
        await ctx.runMutation(internal.discoveryEdges.upsertDiscoveryEdgeInternal, {
          workspaceId: args.workspaceId,
          userId: workspace.userId,
          edgeType: "matched_query_to_seed",
          discoverySource: "conversation_reply",
          sourceNode: buildSearchQueryNode(matchedQuery),
          targetNode: buildConversationSeedNode({
            _id: seedId,
            rootTweetId: seed.rootTweetId,
            rootTweetSummary: seed.rootTweetSummary,
          }),
          context: {
            matchedQueries: [matchedQuery],
            searchQuery: matchedQuery,
            rootTweetId: seed.rootTweetId,
          },
        });
      }
      seedIds.push(seedId);
    }

    return { createdOrUpdated: seedIds.length, seedIds };
  },
});

export const processConversationSeedRepliesInternal = internalAction({
  args: {
    seedId: v.id("twitterConversationSeeds"),
    tweets: v.array(v.any()),
    matchedQueriesByPostId: v.optional(v.any()),
    lastBackfillCursor: v.optional(v.string()),
    markInitialBackfillComplete: v.optional(v.boolean()),
    fromWebhook: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    repliesSeenDelta: number;
    acceptedDelta: number;
    prospectsCreatedDelta: number;
    lastReplySeenAt?: number;
  }> => {
    const seed: ConversationSeedDoc | null = await ctx.runQuery(
      internal.xConversationDiscovery.getConversationSeedByIdInternal,
      {
        seedId: args.seedId,
      }
    );
    if (!seed) {
      throw new Error("Conversation seed not found");
    }

    const matchedQueriesByPostId = (args.matchedQueriesByPostId ?? {}) as Record<
      string,
      string[]
    >;
    const aggregate: {
      repliesSeenDelta: number;
      acceptedDelta: number;
      prospectsCreatedDelta: number;
      lastReplySeenAt?: number;
    } = {
      repliesSeenDelta: 0,
      acceptedDelta: 0,
      prospectsCreatedDelta: 0,
      lastReplySeenAt: seed.lastReplySeenAt,
    };

    for (const tweet of args.tweets as TwitterPost[]) {
      const result = await processReplyTweet({
        ctx,
        seed,
        tweet,
        matchedQueries:
          matchedQueriesByPostId[tweet.id_str] ??
          (seed.sourceSearchQuery ? [seed.sourceSearchQuery] : undefined),
      });

      aggregate.repliesSeenDelta += result.repliesSeenDelta;
      aggregate.acceptedDelta += result.acceptedDelta;
      aggregate.prospectsCreatedDelta += result.prospectsCreatedDelta;

      const createdAt = Date.parse(tweet.tweet_created_at || "");
      if (
        Number.isFinite(createdAt) &&
        (aggregate.lastReplySeenAt ?? 0) < createdAt
      ) {
        aggregate.lastReplySeenAt = createdAt;
      }
    }

    await ctx.runMutation(
      internal.xConversationDiscovery.recordConversationSeedProgressInternal,
      {
        seedId: args.seedId,
        status: seed.status === "failed" ? "failed" : "active",
        lastBackfillCursor: args.lastBackfillCursor,
        lastReplySeenAt: aggregate.lastReplySeenAt,
        lastWebhookAt: args.fromWebhook ? getCurrentUTCTimestamp() : undefined,
        repliesSeenDelta: aggregate.repliesSeenDelta,
        candidatesAcceptedDelta: aggregate.acceptedDelta,
        prospectsCreatedDelta: aggregate.prospectsCreatedDelta,
        initialBackfillCompletedAt: args.markInitialBackfillComplete
          ? getCurrentUTCTimestamp()
          : undefined,
      }
    );

    return aggregate;
  },
});

export const getConversationSeedByIdInternal = internalQuery({
  args: { seedId: v.id("twitterConversationSeeds") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.seedId);
  },
});

export const getConversationSeedsByWorkspaceStatusInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.union(
      v.literal("pending_backfill"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("twitterConversationSeeds")
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", args.status)
      )
      .collect();
  },
});

export const initialBackfillConversationSeedsInternal = internalAction({
  args: {
    seedIds: v.array(v.id("twitterConversationSeeds")),
  },
  handler: async (
    ctx,
    args
  ): Promise<
    Array<{
      seedId: Id<"twitterConversationSeeds">;
      repliesSeen: number;
      accepted: number;
      prospectsCreated: number;
    }>
  > => {
    const results: Array<{
      seedId: Id<"twitterConversationSeeds">;
      repliesSeen: number;
      accepted: number;
      prospectsCreated: number;
    }> = [];

    for (const seedId of args.seedIds) {
      const seed = await ctx.runQuery(
        internal.xConversationDiscovery.getConversationSeedByIdInternal,
        { seedId }
      );
      if (!seed) {
        continue;
      }

      const queries = buildReplyDiscoveryQueries({
        rootTweetId: seed.rootTweetId,
        sourceKeyword: seed.sourceKeyword,
        matchedQueries: seed.sourceSearchQuery ? [seed.sourceSearchQuery] : undefined,
      });
      const broadQuery = queries[0];
      const targetedQueries = queries.slice(1, 1 + MAX_BACKFILL_TARGETED_QUERIES);

      const combinedTweets = new Map<string, TwitterPost>();
      const matchedQueriesByPostId = new Map<string, Set<string>>();
      let nextCursor: string | undefined;
      let broadCursor: string | undefined;

      for (
        let pageIndex = 0;
        pageIndex < MAX_BACKFILL_BROAD_PAGES &&
        combinedTweets.size < MAX_BACKFILL_UNIQUE_REPLIES;
        pageIndex += 1
      ) {
        const broadResult = await ctx.runAction(
          api.integrations.twitter.searchPosts.searchRaw,
          {
            query: broadQuery,
            type: "Latest",
            cursor: broadCursor,
          }
        );
        if (!broadResult.success) {
          break;
        }

        for (const tweet of broadResult.posts as TwitterPost[]) {
          combinedTweets.set(tweet.id_str, tweet);
          const queriesForPost = matchedQueriesByPostId.get(tweet.id_str) ?? new Set();
          queriesForPost.add(broadQuery);
          matchedQueriesByPostId.set(tweet.id_str, queriesForPost);
          if (combinedTweets.size >= MAX_BACKFILL_UNIQUE_REPLIES) {
            break;
          }
        }

        nextCursor = broadResult.nextCursor;
        broadCursor = broadResult.nextCursor;
        if (
          combinedTweets.size >= MAX_BACKFILL_UNIQUE_REPLIES ||
          !broadResult.hasMore ||
          !broadResult.nextCursor
        ) {
          break;
        }
      }

      if (targetedQueries.length > 0) {
        let cursorsByQuery: Record<string, string | undefined> = {};

        for (
          let pageIndex = 0;
          pageIndex < MAX_BACKFILL_TARGETED_PAGES &&
          combinedTweets.size < MAX_BACKFILL_UNIQUE_REPLIES;
          pageIndex += 1
        ) {
          const targetedResult = await ctx.runAction(
            api.integrations.twitter.searchPosts.searchRawBatch,
            {
              queries: targetedQueries,
              type: "Latest",
              maxQueriesPerBatch: MAX_BACKFILL_TARGETED_QUERIES,
              cursorsByQuery,
            }
          );

          for (const tweet of targetedResult.posts as TwitterPost[]) {
            combinedTweets.set(tweet.id_str, tweet);
            if (combinedTweets.size >= MAX_BACKFILL_UNIQUE_REPLIES) {
              break;
            }
          }
          for (const [postId, queriesForPost] of Object.entries(
            targetedResult.matchedQueriesByPostId
          ) as Array<[string, string[]]>) {
            const querySet = matchedQueriesByPostId.get(postId) ?? new Set<string>();
            for (const query of queriesForPost) {
              querySet.add(query);
            }
            matchedQueriesByPostId.set(postId, querySet);
          }

          const nextCursors: Record<string, string | undefined> = {};
          for (const queryResult of targetedResult.queryResults ?? []) {
            if (queryResult.hasMore && queryResult.nextCursor) {
              nextCursors[queryResult.query] = queryResult.nextCursor;
            }
          }

          if (
            combinedTweets.size >= MAX_BACKFILL_UNIQUE_REPLIES ||
            Object.keys(nextCursors).length === 0
          ) {
            break;
          }

          cursorsByQuery = nextCursors;
        }
      }

      const processResult: {
        repliesSeenDelta: number;
        acceptedDelta: number;
        prospectsCreatedDelta: number;
        lastReplySeenAt?: number;
      } = await ctx.runAction(
        internal.xConversationDiscovery.processConversationSeedRepliesInternal,
        {
          seedId,
          tweets: Array.from(combinedTweets.values()),
          matchedQueriesByPostId: Object.fromEntries(
            Array.from(matchedQueriesByPostId.entries()).map(([postId, querySet]) => [
              postId,
              Array.from(querySet),
            ])
          ),
          lastBackfillCursor: nextCursor,
          markInitialBackfillComplete: true,
        }
      );

      results.push({
        seedId,
        repliesSeen: processResult.repliesSeenDelta,
        accepted: processResult.acceptedDelta,
        prospectsCreated: processResult.prospectsCreatedDelta,
      });
    }

    return results;
  },
});

export const createConversationSeedMonitorsInternal = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    seedIds: v.optional(v.array(v.id("twitterConversationSeeds"))),
  },
  handler: async (ctx, args) => {
    const pending = await ctx.runQuery(
      internal.xConversationDiscovery.getConversationSeedsByWorkspaceStatusInternal,
      {
        workspaceId: args.workspaceId,
        status: "active",
      }
    );
    const backfilled = await ctx.runQuery(
      internal.xConversationDiscovery.getConversationSeedsByWorkspaceStatusInternal,
      {
        workspaceId: args.workspaceId,
        status: "pending_backfill",
      }
    );
    const targetSeedIds = new Set((args.seedIds ?? []).map(String));
    const seeds = [...pending, ...backfilled].filter((seed) => {
      if (seed.monitorId) {
        return false;
      }
      if (targetSeedIds.size === 0) {
        return true;
      }
      return targetSeedIds.has(String(seed._id));
    });

    let created = 0;
    const errors: string[] = [];
    for (const seed of seeds) {
      const result = await ctx.runAction(
        internal.socialapiMonitors.createMonitorInternal,
        {
          workspaceId: args.workspaceId,
          query: buildConversationMonitorQuery(seed),
          purpose: "conversation_seed",
          conversationSeedId: seed._id,
        }
      );

      if (!result.success || !result.monitorId) {
        errors.push(result.error ?? `Failed to create monitor for ${seed.rootTweetId}`);
        await ctx.runMutation(
          internal.xConversationDiscovery.recordConversationSeedProgressInternal,
          {
            seedId: seed._id,
            status: "failed",
          }
        );
        continue;
      }

      await ctx.runMutation(
        internal.xConversationDiscovery.recordConversationSeedProgressInternal,
        {
          seedId: seed._id,
          status: "active",
          monitorId: result.monitorId,
        }
      );
      created += 1;
    }

    return { created, errors };
  },
});

export const processConversationSeedWebhookInternal = internalAction({
  args: {
    seedId: v.id("twitterConversationSeeds"),
    tweet: v.any(),
    matchedQuery: v.optional(v.string()),
    monitorId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    repliesSeenDelta: number;
    acceptedDelta: number;
    prospectsCreatedDelta: number;
    lastReplySeenAt?: number;
  }> => {
    const result: {
      repliesSeenDelta: number;
      acceptedDelta: number;
      prospectsCreatedDelta: number;
      lastReplySeenAt?: number;
    } = await ctx.runAction(
      internal.xConversationDiscovery.processConversationSeedRepliesInternal,
      {
        seedId: args.seedId,
        tweets: [args.tweet],
        matchedQueriesByPostId: {
          [args.tweet.id_str ?? ""]: args.matchedQuery ? [args.matchedQuery] : [],
        },
        fromWebhook: true,
      }
    );

    if (args.monitorId) {
      await ctx.runMutation(
        internal.xConversationDiscovery.recordConversationSeedProgressInternal,
        {
          seedId: args.seedId,
          lastWebhookAt: getCurrentUTCTimestamp(),
        }
      );
    }

    return result;
  },
});
