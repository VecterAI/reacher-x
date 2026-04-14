import { v } from "convex/values";
import { internalMutation, internalQuery } from "./lib/functionBuilders";
import {
  prospectPlatformValidator,
  styleProfileStatusValidator,
} from "./validators";

export const getWorkspaceStyleProfile = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    platform: prospectPlatformValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspaceStyleProfiles")
      .withIndex("by_workspace_platform", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("platform", args.platform)
      )
      .first();
  },
});

export const listWorkspaceStyleProfiles = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspaceStyleProfiles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const upsertWorkspaceStyleProfile = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    platform: prospectPlatformValidator,
    status: styleProfileStatusValidator,
    version: v.number(),
    sourceKey: v.optional(v.string()),
    sourceVersion: v.optional(v.number()),
    sourceExternalUserId: v.optional(v.string()),
    lastAnalyzedAt: v.optional(v.number()),
    sampleCount: v.number(),
    editDiffCount: v.number(),
    promotedMemoryId: v.optional(v.string()),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("workspaceStyleProfiles")
      .withIndex("by_workspace_platform", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("platform", args.platform)
      )
      .first();

    const payload = {
      workspaceId: args.workspaceId,
      userId: args.userId,
      platform: args.platform,
      status: args.status,
      version: args.version,
      sourceKey: args.sourceKey,
      sourceVersion: args.sourceVersion,
      sourceExternalUserId: args.sourceExternalUserId,
      lastAnalyzedAt: args.lastAnalyzedAt,
      sampleCount: args.sampleCount,
      editDiffCount: args.editDiffCount,
      promotedMemoryId: args.promotedMemoryId,
      lastError: args.lastError,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("workspaceStyleProfiles", payload);
  },
});

export const patchWorkspaceStyleProfile = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    platform: prospectPlatformValidator,
    patch: v.object({
      status: v.optional(styleProfileStatusValidator),
      version: v.optional(v.number()),
      sourceKey: v.optional(v.string()),
      sourceVersion: v.optional(v.number()),
      sourceExternalUserId: v.optional(v.string()),
      lastAnalyzedAt: v.optional(v.number()),
      sampleCount: v.optional(v.number()),
      editDiffCount: v.optional(v.number()),
      promotedMemoryId: v.optional(v.string()),
      lastError: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("workspaceStyleProfiles")
      .withIndex("by_workspace_platform", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("platform", args.platform)
      )
      .first();

    if (!existing) {
      return null;
    }

    await ctx.db.patch(existing._id, args.patch);
    return existing._id;
  },
});
