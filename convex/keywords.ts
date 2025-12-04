// convex/keywords.ts
// Keyword management for prospect discovery

import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getUserFromIdentity } from "./lib/userUtils";
import {
  createWorkspaceKeywordsArgsValidator,
  updateWorkspaceKeywordsArgsValidator,
  discoveredKeywordValidator,
} from "./validators";

// ============================================================================
// Types
// ============================================================================

/** Discovered keyword with search metadata */
export type DiscoveredKeyword = {
  keyword: string;
  searchVolume: number;
  competition?: number;
  competitionLevel?: string;
  cpc?: number;
  trend?: {
    monthly?: number;
    quarterly?: number;
    yearly?: number;
  };
  keywordDifficulty?: number;
  searchIntent?: string;
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Normalizes a string for deduplication (lowercase, trimmed)
 */
function normalize(value: string): string {
  return value.toLowerCase().trim();
}

/**
 * Deduplicates string array (case-insensitive)
 */
function deduplicateStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalize(value);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(value.trim());
    }
  }

  return result;
}

/**
 * Deduplicates keywords, keeping highest search volume version
 */
function deduplicateKeywords(
  keywords: DiscoveredKeyword[]
): DiscoveredKeyword[] {
  const keywordMap = new Map<string, DiscoveredKeyword>();

  for (const keyword of keywords) {
    const normalizedKey = normalize(keyword.keyword);
    const existing = keywordMap.get(normalizedKey);

    if (!existing || keyword.searchVolume > existing.searchVolume) {
      keywordMap.set(normalizedKey, keyword);
    }
  }

  return Array.from(keywordMap.values());
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Get keywords for a workspace
 */
export const getWorkspaceKeywords = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await getUserFromIdentity(ctx, identity, false);
    if (!user) return null;

    // Verify workspace belongs to user
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.userId !== user._id) return null;

    const keywords = await ctx.db
      .query("workspaceKeywords")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    return keywords;
  },
});

/**
 * Get summary stats for workspace keywords
 */
export const getKeywordStats = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await getUserFromIdentity(ctx, identity, false);
    if (!user) return null;

    // Verify workspace belongs to user
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.userId !== user._id) return null;

    const keywords = await ctx.db
      .query("workspaceKeywords")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!keywords) {
      return {
        hasSeedKeywords: false,
        seedKeywordsCount: 0,
        discoveredKeywordsCount: 0,
        socialQueriesCount: 0,
        totalSearchVolume: 0,
        avgSearchVolume: 0,
        lastRefreshedAt: null,
      };
    }

    const totalSearchVolume = keywords.discoveredKeywords.reduce(
      (sum, kw) => sum + kw.searchVolume,
      0
    );

    return {
      hasSeedKeywords: keywords.seedKeywords.length > 0,
      seedKeywordsCount: keywords.seedKeywords.length,
      discoveredKeywordsCount: keywords.discoveredKeywords.length,
      socialQueriesCount: keywords.socialQueries.length,
      totalSearchVolume,
      avgSearchVolume:
        keywords.discoveredKeywords.length > 0
          ? Math.round(totalSearchVolume / keywords.discoveredKeywords.length)
          : 0,
      lastRefreshedAt: keywords.lastRefreshedAt,
    };
  },
});

/**
 * Get top keywords by search volume
 */
export const getTopKeywords = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await getUserFromIdentity(ctx, identity, false);
    if (!user) return [];

    // Verify workspace belongs to user
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.userId !== user._id) return [];

    const keywords = await ctx.db
      .query("workspaceKeywords")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!keywords) return [];

    const limit = args.limit ?? 20;

    // Already sorted by search volume in the mutation, but ensure order
    return [...keywords.discoveredKeywords]
      .sort((a, b) => b.searchVolume - a.searchVolume)
      .slice(0, limit);
  },
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Create or replace keywords for a workspace
 */
export const saveWorkspaceKeywords = mutation({
  args: createWorkspaceKeywordsArgsValidator,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await getUserFromIdentity(ctx, identity);

    // Verify workspace belongs to user
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.userId !== user._id) {
      throw new Error("Workspace not found");
    }

    const now = Date.now();

    // Deduplicate all arrays
    const seedKeywords = deduplicateStrings(args.seedKeywords);
    const discoveredKeywords = deduplicateKeywords(args.discoveredKeywords);
    const socialQueries = deduplicateStrings(args.socialQueries);

    // Sort discovered keywords by search volume (descending)
    discoveredKeywords.sort((a, b) => b.searchVolume - a.searchVolume);

    // Check if keywords already exist for this workspace
    const existing = await ctx.db
      .query("workspaceKeywords")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        seedKeywords,
        discoveredKeywords,
        socialQueries,
        lastRefreshedAt: now,
      });
      return existing._id;
    }

    // Create new
    return await ctx.db.insert("workspaceKeywords", {
      workspaceId: args.workspaceId,
      seedKeywords,
      discoveredKeywords,
      socialQueries,
      lastRefreshedAt: now,
    });
  },
});

/**
 * Update specific fields of workspace keywords
 */
export const updateWorkspaceKeywords = mutation({
  args: updateWorkspaceKeywordsArgsValidator,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await getUserFromIdentity(ctx, identity);

    // Verify workspace belongs to user
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.userId !== user._id) {
      throw new Error("Workspace not found");
    }

    const existing = await ctx.db
      .query("workspaceKeywords")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!existing) {
      throw new Error("Keywords not found for this workspace");
    }

    const updateData: {
      seedKeywords?: string[];
      discoveredKeywords?: DiscoveredKeyword[];
      socialQueries?: string[];
      lastRefreshedAt: number;
    } = {
      lastRefreshedAt: Date.now(),
    };

    if (args.seedKeywords) {
      updateData.seedKeywords = deduplicateStrings(args.seedKeywords);
    }

    if (args.discoveredKeywords) {
      const dedupedKeywords = deduplicateKeywords(args.discoveredKeywords);
      dedupedKeywords.sort((a, b) => b.searchVolume - a.searchVolume);
      updateData.discoveredKeywords = dedupedKeywords;
    }

    if (args.socialQueries) {
      updateData.socialQueries = deduplicateStrings(args.socialQueries);
    }

    await ctx.db.patch(existing._id, updateData);

    return { success: true };
  },
});

/**
 * Internal mutation for agent to save keywords
 */
export const saveKeywordsInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    seedKeywords: v.array(v.string()),
    discoveredKeywords: v.array(discoveredKeywordValidator),
    socialQueries: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Deduplicate all arrays
    const seedKeywords = deduplicateStrings(args.seedKeywords);
    const discoveredKeywords = deduplicateKeywords(args.discoveredKeywords);
    const socialQueries = deduplicateStrings(args.socialQueries);

    // Sort discovered keywords by search volume (descending)
    discoveredKeywords.sort((a, b) => b.searchVolume - a.searchVolume);

    // Check if keywords already exist
    const existing = await ctx.db
      .query("workspaceKeywords")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        seedKeywords,
        discoveredKeywords,
        socialQueries,
        lastRefreshedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("workspaceKeywords", {
      workspaceId: args.workspaceId,
      seedKeywords,
      discoveredKeywords,
      socialQueries,
      lastRefreshedAt: now,
    });
  },
});

/**
 * Add social queries to existing keywords
 */
export const addSocialQueries = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    queries: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await getUserFromIdentity(ctx, identity);

    // Verify workspace belongs to user
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.userId !== user._id) {
      throw new Error("Workspace not found");
    }

    const existing = await ctx.db
      .query("workspaceKeywords")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!existing) {
      throw new Error("Keywords not found for this workspace");
    }

    // Merge and deduplicate
    const allQueries = [...existing.socialQueries, ...args.queries];
    const uniqueQueries = deduplicateStrings(allQueries);

    await ctx.db.patch(existing._id, {
      socialQueries: uniqueQueries,
      lastRefreshedAt: Date.now(),
    });

    return {
      success: true,
      totalQueries: uniqueQueries.length,
      addedQueries: uniqueQueries.length - existing.socialQueries.length,
    };
  },
});

/**
 * Delete keywords for a workspace
 */
export const deleteWorkspaceKeywords = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await getUserFromIdentity(ctx, identity);

    // Verify workspace belongs to user
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.userId !== user._id) {
      throw new Error("Workspace not found");
    }

    const existing = await ctx.db
      .query("workspaceKeywords")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return { success: true };
  },
});

