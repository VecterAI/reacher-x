import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
} from "./lib/functionBuilders";
import { internal } from "./_generated/api";
import {
  fetchPublicTestimonialTweetsByIds,
  normalizeOrderedConfigIds,
} from "./lib/publicSocialCore";

function asPositiveLimit(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return value > 0 ? Math.floor(value) : undefined;
}

async function getPublicTestimonialRows(
  ctx: any,
  options?: { includeInactive?: boolean }
) {
  if (options?.includeInactive) {
    return await ctx.db
      .query("publicTestimonials")
      .withIndex("by_position")
      .collect();
  }

  return await ctx.db
    .query("publicTestimonials")
    .withIndex("by_isActive_position", (q: any) => q.eq("isActive", true))
    .collect();
}

export const getPublicTestimonialsConfigInternal = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await getPublicTestimonialRows(ctx);
    return normalizeOrderedConfigIds(rows, "tweetId", {
      limit: asPositiveLimit(args.limit),
    });
  },
});

export const getPublicTestimonials = action({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const tweetIds = (await ctx.runQuery(
      internal.publicSocial.getPublicTestimonialsConfigInternal,
      {
        limit: args.limit,
      }
    )) as string[];

    const tweets = await fetchPublicTestimonialTweetsByIds(tweetIds);

    return { tweets };
  },
});

export const replacePublicSocialConfigInternal = internalMutation({
  args: {
    testimonialTweetIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedTestimonialIds = normalizeOrderedConfigIds(
      args.testimonialTweetIds.map((tweetId, position) => ({
        isActive: true,
        position,
        tweetId,
      })),
      "tweetId"
    );

    const existingTestimonialRows = await ctx.db
      .query("publicTestimonials")
      .collect();
    await Promise.all(
      existingTestimonialRows.map((row) => ctx.db.delete(row._id))
    );

    for (const [position, tweetId] of normalizedTestimonialIds.entries()) {
      await ctx.db.insert("publicTestimonials", {
        isActive: true,
        position,
        tweetId,
      });
    }

    return {
      testimonials: normalizedTestimonialIds.length,
    };
  },
});
