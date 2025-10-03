import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getActiveByKeyword = query({
  args: { keywordKey: v.string() },
  handler: async (ctx, { keywordKey }) => {
    // Return the latest progress row (may be complete). The client decides visibility
    return await ctx.db
      .query("search_progress")
      .withIndex("by_keyword", (q) => q.eq("keywordKey", keywordKey))
      .order("desc")
      .first();
  },
});

export const upsertProgress = mutation({
  args: {
    keywordKey: v.string(),
    operation: v.union(v.literal("initial"), v.literal("loadMore")),
    phase: v.union(
      v.literal("queued"),
      v.literal("searching"),
      v.literal("chunking"),
      v.literal("filtering"),
      v.literal("finalizing"),
      v.literal("complete")
    ),
    value: v.number(),
  },
  handler: async (ctx, args) => {
    const { keywordKey, operation, phase, value } = args;
    const now = Date.now();
    // Find the latest by keyword+operation
    const latest = await ctx.db
      .query("search_progress")
      .withIndex("by_keyword_operation", (q) =>
        q.eq("keywordKey", keywordKey).eq("operation", operation)
      )
      .order("desc")
      .first();

    // Insert a new row ONLY when starting a new run (phase=queued)
    if (phase === "queued" || !latest) {
      return await ctx.db.insert("search_progress", {
        keywordKey,
        operation,
        phase,
        value,
        isComplete: phase === "complete",
        updatedAt: now,
      });
    }

    // If the latest run is already complete, ignore non-queued updates
    if (latest.isComplete) {
      return latest._id;
    }

    // Otherwise patch the latest ongoing row
    await ctx.db.patch(latest._id, {
      phase,
      value,
      isComplete: phase === "complete",
      updatedAt: now,
    });
    return latest._id;
  },
});

export const completeProgress = mutation({
  args: {
    keywordKey: v.string(),
    operation: v.union(v.literal("initial"), v.literal("loadMore")),
  },
  handler: async (ctx, { keywordKey, operation }) => {
    const latest = await ctx.db
      .query("search_progress")
      .withIndex("by_keyword_operation", (q) =>
        q.eq("keywordKey", keywordKey).eq("operation", operation)
      )
      .order("desc")
      .first();
    if (!latest) return;
    await ctx.db.patch(latest._id, {
      phase: "complete",
      value: 100,
      isComplete: true,
      updatedAt: Date.now(),
    });
  },
});
