import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";
import {
  linkXAccountArgsValidator,
  updateXTokensArgsValidator,
} from "./validators";
import { v } from "convex/values";

export const getUserSocialAccounts = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const workosUserId = identity.subject;

    // Look up the user by workosUserId instead of using normalizeId
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", workosUserId))
      .first();

    if (!user) {
      return []; // Return empty array if user not found
    }

    return await ctx.db
      .query("socialAccounts")
      .withIndex("by_user_provider", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const linkXAccount = mutation({
  args: linkXAccountArgsValidator,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const workosUserId = identity.subject;

    if (args.provider !== "X") throw new Error("Unsupported provider");

    // First, ensure the user exists in the users table
    // Look up the user by workosUserId instead of using normalizeId
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", workosUserId))
      .first();

    if (!user) {
      throw new Error(
        "User not found. Please ensure you are properly authenticated and your user profile has been created."
      );
    }

    // Upsert by (userId, provider)
    const existing = await ctx.db
      .query("socialAccounts")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", user._id).eq("provider", "X")
      )
      .unique();

    // Tokens are already encrypted by the client
    const encryptedAccessToken = args.tokens.accessToken;
    const encryptedRefreshToken = args.tokens.refreshToken;

    // Start with saving tokens
    let socialId;
    if (existing) {
      await ctx.db.patch(existing._id, {
        providerAccountId: args.providerAccountId,
        screenName: args.profile.screenName,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: args.tokens.expiresAt,
        tokenType: args.tokens.tokenType,
        scope: args.tokens.scope,
      });
      socialId = existing._id;
    } else {
      socialId = await ctx.db.insert("socialAccounts", {
        userId: user._id,
        provider: "X",
        providerAccountId: args.providerAccountId,
        screenName: args.profile.screenName,
        name: undefined,
        profileImageUrl: undefined,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: args.tokens.expiresAt,
        tokenType: args.tokens.tokenType,
        scope: args.tokens.scope,
      });
    }

    // Profile will be hydrated by refreshTokenIfNeeded action post-link.

    return socialId;
  },
});

export const getXAccount = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const workosUserId = identity.subject;

    // Look up the user by workosUserId instead of using normalizeId
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", workosUserId))
      .first();

    if (!user) {
      return null; // Return null if user not found
    }

    return await ctx.db
      .query("socialAccounts")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", user._id).eq("provider", "X")
      )
      .unique();
  },
});

export const getXAccountByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("socialAccounts")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", args.userId).eq("provider", "X")
      )
      .unique();
  },
});

export const updateXTokens = mutation({
  args: updateXTokensArgsValidator,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const workosUserId = identity.subject;

    // Look up the user by workosUserId instead of using normalizeId
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", workosUserId))
      .first();

    if (!user) {
      throw new Error(
        "User not found. Please ensure you are properly authenticated and your user profile has been created."
      );
    }

    const existing = await ctx.db
      .query("socialAccounts")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", user._id).eq("provider", "X")
      )
      .unique();
    if (!existing) return null;

    const patch: Record<string, unknown> = {};
    if (args.accessToken !== undefined) patch.accessToken = args.accessToken;
    if (args.refreshToken !== undefined) patch.refreshToken = args.refreshToken;
    if (args.expiresAt !== undefined) patch.expiresAt = args.expiresAt;
    if (args.name !== undefined) patch.name = args.name;
    if (args.screenName !== undefined) patch.screenName = args.screenName;
    if (args.profileImageUrl !== undefined)
      patch.profileImageUrl = args.profileImageUrl;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(existing._id, patch);
    }
    return existing._id;
  },
});

export const unlinkXAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const workosUserId = identity.subject;

    // Look up the user by workosUserId instead of using normalizeId
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", workosUserId))
      .first();

    if (!user) {
      throw new Error(
        "User not found. Please ensure you are properly authenticated and your user profile has been created."
      );
    }

    const existing = await ctx.db
      .query("socialAccounts")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", user._id).eq("provider", "X")
      )
      .unique();
    if (!existing) return null;
    await ctx.db.delete(existing._id);
    return existing._id;
  },
});

export const getXAccountByUserIdAction = action({
  args: { userId: v.id("users") },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx, args): Promise<any> => {
    return await ctx.runQuery(api.socialAccountsMutations.getXAccountByUserId, {
      userId: args.userId,
    });
  },
});
