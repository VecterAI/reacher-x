import { v } from "convex/values";
import { internalMutation, internalQuery } from "./lib/functionBuilders";
import {
  xAccountStatusValidator,
  xSubscriptionTypeValidator,
} from "./validators";

export const getXAccountForUserInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("xAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

export const upsertXAccountInternal = internalMutation({
  args: {
    userId: v.id("users"),
    xUserId: v.string(),
    username: v.string(),
    displayName: v.optional(v.string()),
    profileImageUrl: v.optional(v.string()),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.number(),
    grantedScopes: v.array(v.string()),
    tokenType: v.string(),
    status: xAccountStatusValidator,
    lastVerifiedAt: v.optional(v.number()),
    lastRefreshAttemptAt: v.optional(v.number()),
    lastRefreshError: v.optional(v.string()),
    xSubscriptionType: v.optional(xSubscriptionTypeValidator),
    xSubscriptionUpdatedAt: v.optional(v.number()),
    xVerified: v.optional(v.boolean()),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("xAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    const payload = {
      userId: args.userId,
      xUserId: args.xUserId,
      username: args.username,
      displayName: args.displayName,
      profileImageUrl: args.profileImageUrl,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
      grantedScopes: args.grantedScopes,
      tokenType: args.tokenType,
      status: args.status,
      lastVerifiedAt: args.lastVerifiedAt,
      lastRefreshAttemptAt: args.lastRefreshAttemptAt,
      lastRefreshError: args.lastRefreshError,
      xSubscriptionType: args.xSubscriptionType,
      xSubscriptionUpdatedAt: args.xSubscriptionUpdatedAt,
      xVerified: args.xVerified,
      updatedAt: args.now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("xAccounts", payload);
  },
});

export const patchXAccountInternal = internalMutation({
  args: {
    userId: v.id("users"),
    patch: v.any(),
  },
  handler: async (ctx, { userId, patch }) => {
    const existing = await ctx.db
      .query("xAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!existing) {
      return null;
    }

    await ctx.db.patch(existing._id, patch);
    return existing._id;
  },
});

export const deleteXAccountInternal = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const existing = await ctx.db
      .query("xAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!existing) {
      return { deleted: false as const };
    }

    await ctx.db.delete(existing._id);
    return { deleted: true as const };
  },
});

export const createXAuthSessionInternal = internalMutation({
  args: {
    userId: v.id("users"),
    state: v.string(),
    redirectUri: v.string(),
    codeVerifier: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("xAuthSessions", args);
  },
});

export const getXAuthSessionByStateInternal = internalQuery({
  args: {
    state: v.string(),
  },
  handler: async (ctx, { state }) => {
    return await ctx.db
      .query("xAuthSessions")
      .withIndex("by_state", (q) => q.eq("state", state))
      .first();
  },
});

export const completeXAuthSessionInternal = internalMutation({
  args: {
    sessionId: v.id("xAuthSessions"),
    completedAt: v.number(),
  },
  handler: async (ctx, { sessionId, completedAt }) => {
    await ctx.db.patch(sessionId, {
      completedAt,
    });
  },
});
