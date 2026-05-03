import { v } from "convex/values";
import { internalQuery, query } from "./lib/functionBuilders";
import { requireUser } from "./lib/accessHelpers";
import { getEffectivePostTextLimitForUser } from "./lib/xPostLimits";
import {
  getComposerLimitFromEffectiveLimit,
  type EffectivePostTextLimit,
} from "../shared/lib/twitter/xPostTextLimit";

const effectivePostTextLimitValidator = v.union(
  v.object({ mode: v.literal("short"), maxWeighted: v.number() }),
  v.object({ mode: v.literal("long"), maxChars: v.number() })
);

export const getEffectivePostLimitInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  returns: effectivePostTextLimitValidator,
  handler: async (ctx, { userId }): Promise<EffectivePostTextLimit> => {
    return await getEffectivePostTextLimitForUser(ctx, userId);
  },
});

export const getViewerPostComposerLimits = query({
  args: {},
  returns: v.object({
    maxLength: v.number(),
    characterCountMode: v.union(v.literal("raw"), v.literal("x_post")),
    effectiveLimit: effectivePostTextLimitValidator,
  }),
  handler: async (ctx) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    const effectiveLimit = await getEffectivePostTextLimitForUser(
      ctx,
      user._id
    );
    const { maxLength, characterCountMode } =
      getComposerLimitFromEffectiveLimit(effectiveLimit);
    return { maxLength, characterCountMode, effectiveLimit };
  },
});
