import { v } from "convex/values";
import { internalMutation, query } from "./lib/functionBuilders";
import { requireUser } from "./lib/accessHelpers";
import { buildChangedPatchWithUpdatedAt } from "./lib/patchHelpers";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";

function normalizePostKeys(postKeys: string[]) {
  return Array.from(
    new Set(
      postKeys
        .map((key) => key.trim())
        .filter((key): key is string => key.length > 0)
    )
  );
}

function normalizeViewerReaction(value?: string | null) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().toLowerCase()
    : null;
}

function normalizeCount(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : undefined;
}

export const upsertPostEngagementInternal = internalMutation({
  args: {
    userId: v.id("users"),
    postKeys: v.array(v.string()),
    prospectId: v.optional(v.id("prospects")),
    viewerReaction: v.optional(v.union(v.string(), v.null())),
    reactionCount: v.optional(v.number()),
    commented: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const postKeys = normalizePostKeys(args.postKeys);
    if (postKeys.length === 0) {
      return [];
    }

    const now = getCurrentUTCTimestamp();
    const ids = [];
    const reactionCount = normalizeCount(args.reactionCount);
    const hasViewerReactionPatch = args.viewerReaction !== undefined;

    for (const postKey of postKeys) {
      const existing = await ctx.db
        .query("linkedinUserPostEngagements")
        .withIndex("by_user_post", (q) =>
          q.eq("userId", args.userId).eq("postKey", postKey)
        )
        .first();

      const prospectId = args.prospectId ?? existing?.prospectId;
      const next = {
        userId: args.userId,
        postKey,
        ...(prospectId ? { prospectId } : {}),
        viewerReaction: hasViewerReactionPatch
          ? normalizeViewerReaction(args.viewerReaction)
          : (existing?.viewerReaction ?? null),
        ...(reactionCount !== undefined || existing?.reactionCount !== undefined
          ? { reactionCount: reactionCount ?? existing?.reactionCount }
          : {}),
        commented: args.commented ?? existing?.commented ?? false,
        updatedAt: now,
      };

      if (existing) {
        const patch = buildChangedPatchWithUpdatedAt(
          existing as unknown as Record<string, unknown>,
          next,
          now
        );
        if (patch) {
          await ctx.db.patch(existing._id, patch);
        }
        ids.push(existing._id);
        continue;
      }

      ids.push(await ctx.db.insert("linkedinUserPostEngagements", next));
    }

    return ids;
  },
});

export const getEngagementsForPostKeys = query({
  args: {
    postKeys: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const postKeys = normalizePostKeys(args.postKeys);
    if (postKeys.length === 0) {
      return {};
    }

    const out: Record<
      string,
      {
        viewerReaction: string | null;
        reactionCount?: number;
        commented: boolean;
        updatedAt: number;
      }
    > = {};

    for (const postKey of postKeys) {
      const row = await ctx.db
        .query("linkedinUserPostEngagements")
        .withIndex("by_user_post", (q) =>
          q.eq("userId", user._id).eq("postKey", postKey)
        )
        .first();
      if (row) {
        out[postKey] = {
          viewerReaction: row.viewerReaction,
          reactionCount: row.reactionCount,
          commented: row.commented,
          updatedAt: row.updatedAt,
        };
      }
    }

    return out;
  },
});
