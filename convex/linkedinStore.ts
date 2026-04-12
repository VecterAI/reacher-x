import { v } from "convex/values";
import { internalMutation, internalQuery } from "./lib/functionBuilders";
import {
  linkedinAccountStatusValidator,
  unipileAccountSourceStatusValidator,
  unipileWebhookEventValidator,
  unipileWebhookSourceValidator,
} from "./validators";

export const getLinkedInAccountForUserInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("linkedinAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

export const getLinkedInAccountByAccountIdInternal = internalQuery({
  args: {
    accountId: v.string(),
  },
  handler: async (ctx, { accountId }) => {
    return await ctx.db
      .query("linkedinAccounts")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .first();
  },
});

export const upsertLinkedInAccountInternal = internalMutation({
  args: {
    userId: v.id("users"),
    accountId: v.string(),
    status: linkedinAccountStatusValidator,
    publicIdentifier: v.optional(v.string()),
    username: v.optional(v.string()),
    providerId: v.optional(v.string()),
    entityUrn: v.optional(v.string()),
    objectUrn: v.optional(v.string()),
    displayName: v.optional(v.string()),
    headline: v.optional(v.string()),
    location: v.optional(v.string()),
    email: v.optional(v.string()),
    profileImageUrl: v.optional(v.string()),
    publicProfileUrl: v.optional(v.string()),
    premium: v.optional(v.boolean()),
    openProfile: v.optional(v.boolean()),
    sourceStatuses: v.optional(
      v.array(
        v.object({
          id: v.string(),
          status: unipileAccountSourceStatusValidator,
        })
      )
    ),
    organizationMailboxes: v.optional(
      v.array(
        v.object({
          id: v.optional(v.string()),
          name: v.string(),
          organizationId: v.optional(v.string()),
          mailboxId: v.optional(v.string()),
          messagingEnabled: v.optional(v.boolean()),
        })
      )
    ),
    premiumFeatures: v.optional(v.array(v.string())),
    recruiterState: v.optional(v.any()),
    salesNavigatorState: v.optional(v.any()),
    lastSyncedAt: v.optional(v.number()),
    lastSyncAttemptAt: v.optional(v.number()),
    lastSyncError: v.optional(v.string()),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("linkedinAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    const payload = {
      userId: args.userId,
      accountId: args.accountId,
      status: args.status,
      publicIdentifier: args.publicIdentifier,
      username: args.username,
      providerId: args.providerId,
      entityUrn: args.entityUrn,
      objectUrn: args.objectUrn,
      displayName: args.displayName,
      headline: args.headline,
      location: args.location,
      email: args.email,
      profileImageUrl: args.profileImageUrl,
      publicProfileUrl: args.publicProfileUrl,
      premium: args.premium,
      openProfile: args.openProfile,
      sourceStatuses: args.sourceStatuses,
      organizationMailboxes: args.organizationMailboxes,
      premiumFeatures: args.premiumFeatures,
      recruiterState: args.recruiterState,
      salesNavigatorState: args.salesNavigatorState,
      lastSyncedAt: args.lastSyncedAt,
      lastSyncAttemptAt: args.lastSyncAttemptAt,
      lastSyncError: args.lastSyncError,
      updatedAt: args.now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("linkedinAccounts", payload);
  },
});

export const patchLinkedInAccountInternal = internalMutation({
  args: {
    userId: v.id("users"),
    patch: v.any(),
  },
  handler: async (ctx, { userId, patch }) => {
    const existing = await ctx.db
      .query("linkedinAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!existing) {
      return null;
    }

    await ctx.db.patch(existing._id, patch);
    return existing._id;
  },
});

export const deleteLinkedInAccountInternal = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const existing = await ctx.db
      .query("linkedinAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!existing) {
      return { deleted: false as const };
    }

    await ctx.db.delete(existing._id);
    return { deleted: true as const };
  },
});

export const getUnipileWebhookBySourceInternal = internalQuery({
  args: {
    source: unipileWebhookSourceValidator,
  },
  handler: async (ctx, { source }) => {
    return await ctx.db
      .query("unipileWebhooks")
      .withIndex("by_source", (q) => q.eq("source", source))
      .first();
  },
});

export const upsertUnipileWebhookInternal = internalMutation({
  args: {
    source: unipileWebhookSourceValidator,
    webhookId: v.string(),
    requestUrl: v.string(),
    enabled: v.boolean(),
    events: v.array(unipileWebhookEventValidator),
    updatedAt: v.number(),
    lastValidatedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("unipileWebhooks")
      .withIndex("by_source", (q) => q.eq("source", args.source))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }

    return await ctx.db.insert("unipileWebhooks", args);
  },
});
