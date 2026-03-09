import { action, mutation, query } from "./lib/functionBuilders";
import { api } from "./_generated/api";
import {
  linkXAccountArgsValidator,
  updateXTokensArgsValidator,
  socialConnectionStatusValidator,
} from "./validators";
import { v } from "convex/values";
import { getUserByIdentity, requireUser } from "./lib/accessHelpers";

export const getUserSocialAccounts = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await getUserByIdentity(ctx, identity);

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
    if (args.provider !== "X") throw new Error("Unsupported provider");

    const user = await requireUser(ctx);

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
        connectionStatus: "connected",
        reauthRequired: false,
        lastAuthError: undefined,
        lastAuthErrorAt: undefined,
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
        connectionStatus: "connected",
        reauthRequired: false,
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

    const user = await getUserByIdentity(ctx, identity);

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

export const getXAccountByAccountId = query({
  args: { accountId: v.id("socialAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account || account.provider !== "X") return null;
    return account;
  },
});

export const updateXTokens = mutation({
  args: updateXTokensArgsValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

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
    if (
      args.accessToken !== undefined ||
      args.refreshToken !== undefined ||
      args.expiresAt !== undefined
    ) {
      patch.connectionStatus = "connected";
      patch.reauthRequired = false;
      patch.lastAuthError = undefined;
      patch.lastAuthErrorAt = undefined;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(existing._id, patch);
    }
    return existing._id;
  },
});

// Server-side patch by account id (no identity required). Use for background refresh.
export const updateXTokensByAccountId = mutation({
  args: v.object({
    accountId: v.id("socialAccounts"),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    name: v.optional(v.string()),
    screenName: v.optional(v.string()),
    profileImageUrl: v.optional(v.string()),
    lastProfileRefreshedAt: v.optional(v.number()),
    rateLimitResetAt: v.optional(v.number()),
    scope: v.optional(v.string()),
    connectionStatus: v.optional(socialConnectionStatusValidator),
    lastAuthError: v.optional(v.string()),
    lastAuthErrorAt: v.optional(v.number()),
    reauthRequired: v.optional(v.boolean()),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.accountId);
    if (!existing) return null;

    const patch: Record<string, unknown> = {};
    if (args.accessToken !== undefined) patch.accessToken = args.accessToken;
    if (args.refreshToken !== undefined) patch.refreshToken = args.refreshToken;
    if (args.expiresAt !== undefined) patch.expiresAt = args.expiresAt;
    if (args.name !== undefined) patch.name = args.name;
    if (args.screenName !== undefined) patch.screenName = args.screenName;
    if (args.profileImageUrl !== undefined)
      patch.profileImageUrl = args.profileImageUrl;
    if (args.lastProfileRefreshedAt !== undefined)
      patch.lastProfileRefreshedAt = args.lastProfileRefreshedAt;
    if (args.rateLimitResetAt !== undefined)
      patch.rateLimitResetAt = args.rateLimitResetAt;
    if (args.scope !== undefined) patch.scope = args.scope;
    if (args.connectionStatus !== undefined)
      patch.connectionStatus = args.connectionStatus;
    if (args.lastAuthError !== undefined)
      patch.lastAuthError = args.lastAuthError;
    if (args.lastAuthErrorAt !== undefined)
      patch.lastAuthErrorAt = args.lastAuthErrorAt;
    if (args.reauthRequired !== undefined)
      patch.reauthRequired = args.reauthRequired;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(existing._id, patch);
    }
    return existing._id;
  },
});

export const unlinkXAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

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

  handler: async (ctx, args): Promise<any> => {
    return await ctx.runQuery(api.socialAccountsMutations.getXAccountByUserId, {
      userId: args.userId,
    });
  },
});

// List X accounts with tokens expiring before a timestamp
export const getExpiringXAccounts = query({
  args: { beforeTime: v.number() },

  handler: async (ctx, args): Promise<any[]> => {
    const all = await ctx.db.query("socialAccounts").collect();
    return all.filter(
      (acc: any) =>
        acc.provider === "X" &&
        !!acc.refreshToken &&
        typeof acc.expiresAt === "number" &&
        acc.expiresAt <= args.beforeTime
    );
  },
});
