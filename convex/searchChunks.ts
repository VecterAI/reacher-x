import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Minimal tweet shape used for deduplication keys
type TweetLike = {
  id?: string | number;
  id_str?: string;
  user?: { screen_name?: string };
  tweet_created_at?: string | number;
  [key: string]: unknown;
};

export const upsertChunkSet = mutation({
  args: {
    keywordKey: v.string(),
    operation: v.union(v.literal("initial"), v.literal("loadMore")),
    chunkSetId: v.string(),
    total: v.number(),
  },
  handler: async (ctx, { keywordKey, operation, chunkSetId, total }) => {
    const existing = await ctx.db
      .query("searchChunkSets")
      .withIndex("by_set", (q) => q.eq("chunkSetId", chunkSetId))
      .first();
    if (!existing) {
      await ctx.db.insert("searchChunkSets", {
        keywordKey,
        operation,
        chunkSetId,
        total,
        resolved: 0,
        withResults: 0,
        isComplete: false,
      });
    }
  },
});

export const recordChunkResult = mutation({
  args: {
    keywordKey: v.string(),
    operation: v.union(v.literal("initial"), v.literal("loadMore")),
    chunkSetId: v.string(),
    chunkIndex: v.number(),
    tweets: v.array(v.any()),
    originalCount: v.number(),
    filteredCount: v.number(),
  },
  handler: async (
    ctx,
    {
      keywordKey,
      operation,
      chunkSetId,
      chunkIndex,
      tweets,
      originalCount,
      filteredCount,
    }
  ) => {
    await ctx.db.insert("searchChunkResults", {
      chunkSetId,
      keywordKey,
      operation,
      chunkIndex,
      tweets,
      originalCount,
      filteredCount,
    });

    const setDoc = await ctx.db
      .query("searchChunkSets")
      .withIndex("by_set", (q) => q.eq("chunkSetId", chunkSetId))
      .first();
    if (!setDoc) return;

    await ctx.db.patch(setDoc._id, {
      resolved: setDoc.resolved + 1,
      withResults: setDoc.withResults + (filteredCount > 0 ? 1 : 0),
      isComplete: setDoc.resolved + 1 >= setDoc.total,
    });
  },
});

export const getChunkSetStatus = query({
  args: { chunkSetId: v.string() },
  handler: async (ctx, { chunkSetId }) => {
    const setDoc = await ctx.db
      .query("searchChunkSets")
      .withIndex("by_set", (q) => q.eq("chunkSetId", chunkSetId))
      .first();
    if (!setDoc) return null;
    const unresolvedRows = await ctx.db
      .query("searchChunkResults")
      .withIndex("by_set", (q) => q.eq("chunkSetId", chunkSetId))
      .collect();
    const unresolvedTweetCount = unresolvedRows
      .filter((r) => r.mergedAt === undefined)
      .reduce((acc, r) => acc + (r.filteredCount || 0), 0);
    return {
      total: setDoc.total,
      resolved: setDoc.resolved,
      withResults: setDoc.withResults,
      isComplete: setDoc.isComplete,
      unresolvedTweetCount,
    };
  },
});

export const getResolvedTweetsForSet = query({
  args: { chunkSetId: v.string() },
  handler: async (ctx, { chunkSetId }) => {
    const rows = await ctx.db
      .query("searchChunkResults")
      .withIndex("by_set", (q) => q.eq("chunkSetId", chunkSetId))
      .order("asc")
      .collect();
    const unmerged = rows.filter((r) => r.mergedAt === undefined);
    const tweets = unmerged.flatMap((r) => r.tweets || []);
    return { tweets, count: tweets.length };
  },
});

export const markMergedForSet = mutation({
  args: { chunkSetId: v.string() },
  handler: async (ctx, { chunkSetId }) => {
    const rows = await ctx.db
      .query("searchChunkResults")
      .withIndex("by_set", (q) => q.eq("chunkSetId", chunkSetId))
      .collect();
    const now = Date.now();
    await Promise.all(
      rows
        .filter((row) => row.mergedAt === undefined)
        .map((row) => ctx.db.patch(row._id, { mergedAt: now }))
    );
  },
});

// NEW: Atomically consume and mark merged for a chunk set.
export const consumeResolvedTweetsForSet = mutation({
  args: { chunkSetId: v.string() },
  handler: async (ctx, { chunkSetId }) => {
    const rows = await ctx.db
      .query("searchChunkResults")
      .withIndex("by_set", (q) => q.eq("chunkSetId", chunkSetId))
      .order("asc")
      .collect();

    const unmerged = rows.filter((r) => r.mergedAt === undefined);
    const allTweets: TweetLike[] = unmerged.flatMap(
      (r) => (r.tweets as TweetLike[]) || []
    );

    // Deduplicate by id_str, id, or composite fallback
    const makeKey = (t: TweetLike) =>
      String(
        (t && (t.id_str || t.id)) ||
          `${t?.user?.screen_name ?? "u"}-${t?.tweet_created_at ?? "t"}`
      );
    const seen = new Set<string>();
    const deduped: TweetLike[] = [];
    for (const t of allTweets) {
      const k = makeKey(t);
      if (!seen.has(k)) {
        seen.add(k);
        deduped.push(t);
      }
    }

    // Mark all unmerged rows as merged
    const now = Date.now();
    await Promise.all(
      unmerged.map((row) => ctx.db.patch(row._id, { mergedAt: now }))
    );

    return { tweets: deduped, count: deduped.length };
  },
});
