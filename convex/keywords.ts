// convex/keywords.ts
// Keyword management for prospect discovery (row-per-keyword design)

import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { getUserFromIdentity } from "./lib/userUtils";
import { Id } from "./_generated/dataModel";
import { prospectPlatformValidator, keywordTypeValidator } from "./validators";

// ============================================================================
// Types
// ============================================================================

/** Keyword type */
export type KeywordType = "seed" | "discovered" | "social_query";

/** Discovered keyword metadata from Bishopi */
export type DiscoveredKeywordMetadata = {
  searchVolume: number;
  competition?: number;
  competitionLevel?: string;
  cpc?: number;
  keywordDifficulty?: number;
  searchIntent?: string;
  trend?: {
    monthly?: number;
    quarterly?: number;
    yearly?: number;
  };
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Normalizes a string for uniqueness (lowercase, trimmed, collapsed whitespace)
 */
function normalizeKeyword(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

// ============================================================================
// Internal Queries
// ============================================================================

/**
 * Get all keywords for a workspace (internal, for other Convex functions)
 */
export const getWorkspaceKeywordsInternal = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    // Group by type for backwards compatibility
    const seedKeywords: string[] = [];
    const discoveredKeywords: Array<
      { keyword: string } & DiscoveredKeywordMetadata
    > = [];
    const socialQueries: string[] = [];

    for (const kw of keywords) {
      switch (kw.type) {
        case "seed":
          seedKeywords.push(kw.originalValue ?? kw.value);
          break;
        case "discovered":
          discoveredKeywords.push({
            keyword: kw.originalValue ?? kw.value,
            searchVolume: kw.searchVolume ?? 0,
            competition: kw.competition,
            competitionLevel: kw.competitionLevel,
            cpc: kw.cpc,
            keywordDifficulty: kw.keywordDifficulty,
            searchIntent: kw.searchIntent,
            trend: kw.trend,
          });
          break;
        case "social_query":
          socialQueries.push(kw.originalValue ?? kw.value);
          break;
      }
    }

    return {
      seedKeywords,
      discoveredKeywords,
      socialQueries,
      _raw: keywords, // Include raw keywords if needed
    };
  },
});

/**
 * Get social queries for a workspace (internal)
 */
export const getSocialQueriesInternal = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_workspace_type", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("type", "social_query")
      )
      .collect();

    return keywords.map((kw) => ({
      value: kw.originalValue ?? kw.value,
      monitorId: kw.monitorId,
    }));
  },
});

// ============================================================================
// Search Tracking Queries (for workflow)
// ============================================================================

/**
 * Get social queries that have never been searched on a specific platform.
 * Used by the prospecting workflow to find new queries to search.
 */
export const getUnsearchedQueries = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    platform: prospectPlatformValidator,
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<Array<{ id: Id<"keywords">; value: string }>> => {
    const batchLimit = args.limit ?? 10;

    // Get all social queries for this workspace
    const queries = await ctx.db
      .query("keywords")
      .withIndex("by_workspace_type", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("type", "social_query")
      )
      .collect();

    // Filter to queries that haven't been searched on this platform
    const unsearched = queries.filter((kw) => {
      if (args.platform === "twitter") {
        return kw.lastSearchedTwitterAt === undefined;
      } else {
        return kw.lastSearchedLinkedInAt === undefined;
      }
    });

    // Return limited batch
    return unsearched.slice(0, batchLimit).map((kw) => ({
      id: kw._id,
      value: kw.originalValue ?? kw.value,
    }));
  },
});

/**
 * Get the oldest searched LinkedIn queries for re-searching (round-robin).
 * Returns queries sorted by lastSearchedLinkedInAt (oldest first).
 */
export const getLinkedInResearchQueue = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<
    Array<{ id: Id<"keywords">; value: string; lastSearchedAt: number }>
  > => {
    const batchLimit = args.limit ?? 3;

    // Get all social queries that HAVE been searched on LinkedIn
    const queries = await ctx.db
      .query("keywords")
      .withIndex("by_workspace_type", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("type", "social_query")
      )
      .collect();

    // Filter to queries that have been searched and sort by oldest first
    const searched = queries
      .filter((kw) => kw.lastSearchedLinkedInAt !== undefined)
      .sort(
        (a, b) =>
          (a.lastSearchedLinkedInAt ?? 0) - (b.lastSearchedLinkedInAt ?? 0)
      );

    // Return oldest queries
    return searched.slice(0, batchLimit).map((kw) => ({
      id: kw._id,
      value: kw.originalValue ?? kw.value,
      lastSearchedAt: kw.lastSearchedLinkedInAt ?? 0,
    }));
  },
});

/**
 * Mark social queries as searched on a specific platform.
 * Updates the lastSearched timestamp and results count.
 */
export const markQueriesAsSearched = internalMutation({
  args: {
    queryIds: v.array(v.id("keywords")),
    platform: prospectPlatformValidator,
    resultsCount: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ updated: number }> => {
    const now = Date.now();
    let updated = 0;

    for (const queryId of args.queryIds) {
      const keyword = await ctx.db.get(queryId);
      if (keyword && keyword.type === "social_query") {
        if (args.platform === "twitter") {
          await ctx.db.patch(queryId, {
            lastSearchedTwitterAt: now,
            twitterResultsCount:
              args.resultsCount ?? keyword.twitterResultsCount,
            lastUsedAt: now,
          });
        } else {
          await ctx.db.patch(queryId, {
            lastSearchedLinkedInAt: now,
            linkedinResultsCount:
              args.resultsCount ?? keyword.linkedinResultsCount,
            lastUsedAt: now,
          });
        }
        updated++;
      }
    }

    return { updated };
  },
});

// ============================================================================
// Internal Mutations
// ============================================================================

/**
 * Save a single keyword with uniqueness check (internal)
 */
export const saveKeywordInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    type: keywordTypeValidator,
    value: v.string(),
    source: v.optional(v.string()),
    // Discovered keyword metadata
    searchVolume: v.optional(v.number()),
    competition: v.optional(v.number()),
    competitionLevel: v.optional(v.string()),
    cpc: v.optional(v.number()),
    keywordDifficulty: v.optional(v.number()),
    searchIntent: v.optional(v.string()),
    trend: v.optional(
      v.object({
        monthly: v.optional(v.number()),
        quarterly: v.optional(v.number()),
        yearly: v.optional(v.number()),
      })
    ),
    // Social query specific
    monitorId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalized = normalizeKeyword(args.value);

    // Check for existing keyword with same value in workspace
    const existing = await ctx.db
      .query("keywords")
      .withIndex("by_workspace_value", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("value", normalized)
      )
      .first();

    if (existing) {
      // Update existing keyword if it's the same type, otherwise skip
      if (existing.type === args.type) {
        await ctx.db.patch(existing._id, {
          source: args.source ?? existing.source,
          searchVolume: args.searchVolume ?? existing.searchVolume,
          competition: args.competition ?? existing.competition,
          competitionLevel: args.competitionLevel ?? existing.competitionLevel,
          cpc: args.cpc ?? existing.cpc,
          keywordDifficulty:
            args.keywordDifficulty ?? existing.keywordDifficulty,
          searchIntent: args.searchIntent ?? existing.searchIntent,
          trend: args.trend ?? existing.trend,
          monitorId: args.monitorId ?? existing.monitorId,
        });
      }
      return existing._id;
    }

    // Insert new keyword
    return await ctx.db.insert("keywords", {
      workspaceId: args.workspaceId,
      type: args.type,
      value: normalized,
      originalValue:
        args.value.trim() !== normalized ? args.value.trim() : undefined,
      source: args.source,
      status: "active",
      searchVolume: args.searchVolume,
      competition: args.competition,
      competitionLevel: args.competitionLevel,
      cpc: args.cpc,
      keywordDifficulty: args.keywordDifficulty,
      searchIntent: args.searchIntent,
      trend: args.trend,
      monitorId: args.monitorId,
    });
  },
});

/**
 * Save multiple keywords in batch with uniqueness check (internal)
 * Used by searchProspects tool
 */
export const saveKeywordsBatch = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    keywords: v.array(
      v.object({
        type: keywordTypeValidator,
        value: v.string(),
        source: v.optional(v.string()),
        searchVolume: v.optional(v.number()),
        competition: v.optional(v.number()),
        competitionLevel: v.optional(v.string()),
        cpc: v.optional(v.number()),
        keywordDifficulty: v.optional(v.number()),
        searchIntent: v.optional(v.string()),
        trend: v.optional(
          v.object({
            monthly: v.optional(v.number()),
            quarterly: v.optional(v.number()),
            yearly: v.optional(v.number()),
          })
        ),
        monitorId: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    // Get existing keywords for this workspace to check uniqueness
    const existingKeywords = await ctx.db
      .query("keywords")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const existingMap = new Map<string, (typeof existingKeywords)[0]>();
    for (const kw of existingKeywords) {
      existingMap.set(kw.value, kw);
    }

    for (const keyword of args.keywords) {
      const normalized = normalizeKeyword(keyword.value);
      const existing = existingMap.get(normalized);

      if (existing) {
        // Update if same type, otherwise skip
        if (existing.type === keyword.type) {
          await ctx.db.patch(existing._id, {
            source: keyword.source ?? existing.source,
            searchVolume: keyword.searchVolume ?? existing.searchVolume,
            competition: keyword.competition ?? existing.competition,
            competitionLevel:
              keyword.competitionLevel ?? existing.competitionLevel,
            cpc: keyword.cpc ?? existing.cpc,
            keywordDifficulty:
              keyword.keywordDifficulty ?? existing.keywordDifficulty,
            searchIntent: keyword.searchIntent ?? existing.searchIntent,
            trend: keyword.trend ?? existing.trend,
            monitorId: keyword.monitorId ?? existing.monitorId,
          });
          updated++;
        } else {
          skipped++;
        }
      } else {
        // Insert new
        const newId = await ctx.db.insert("keywords", {
          workspaceId: args.workspaceId,
          type: keyword.type,
          value: normalized,
          originalValue:
            keyword.value.trim() !== normalized
              ? keyword.value.trim()
              : undefined,
          source: keyword.source,
          status: "active",
          searchVolume: keyword.searchVolume,
          competition: keyword.competition,
          competitionLevel: keyword.competitionLevel,
          cpc: keyword.cpc,
          keywordDifficulty: keyword.keywordDifficulty,
          searchIntent: keyword.searchIntent,
          trend: keyword.trend,
          monitorId: keyword.monitorId,
        });
        // Add to map to prevent duplicates within batch
        existingMap.set(normalized, {
          _id: newId,
          _creationTime: now,
          workspaceId: args.workspaceId,
          type: keyword.type,
          value: normalized,
        });
        inserted++;
      }
    }

    return { inserted, updated, skipped };
  },
});

/**
 * Update monitor ID for a social query
 */
export const updateKeywordMonitorId = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
    monitorId: v.string(),
  },
  handler: async (ctx, args) => {
    const normalized = normalizeKeyword(args.query);

    const keyword = await ctx.db
      .query("keywords")
      .withIndex("by_workspace_value", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("value", normalized)
      )
      .first();

    if (keyword && keyword.type === "social_query") {
      await ctx.db.patch(keyword._id, { monitorId: args.monitorId });
      return { success: true };
    }

    return { success: false, error: "Keyword not found" };
  },
});

/**
 * Delete all keywords for a workspace (internal)
 */
export const deleteWorkspaceKeywordsInternal = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    for (const kw of keywords) {
      await ctx.db.delete(kw._id);
    }

    return { deleted: keywords.length };
  },
});

// ============================================================================
// Queries (public, with auth)
// ============================================================================

/**
 * Get all keywords for a workspace
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
      .query("keywords")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    // Group by type
    const seedKeywords: string[] = [];
    const discoveredKeywords: Array<
      { keyword: string } & DiscoveredKeywordMetadata
    > = [];
    const socialQueries: string[] = [];

    for (const kw of keywords) {
      switch (kw.type) {
        case "seed":
          seedKeywords.push(kw.originalValue ?? kw.value);
          break;
        case "discovered":
          discoveredKeywords.push({
            keyword: kw.originalValue ?? kw.value,
            searchVolume: kw.searchVolume ?? 0,
            competition: kw.competition,
            competitionLevel: kw.competitionLevel,
            cpc: kw.cpc,
            keywordDifficulty: kw.keywordDifficulty,
            searchIntent: kw.searchIntent,
            trend: kw.trend,
          });
          break;
        case "social_query":
          socialQueries.push(kw.originalValue ?? kw.value);
          break;
      }
    }

    // Sort discovered by search volume
    discoveredKeywords.sort((a, b) => b.searchVolume - a.searchVolume);

    return {
      seedKeywords,
      discoveredKeywords,
      socialQueries,
    };
  },
});

/**
 * Get keyword stats for a workspace
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
      .query("keywords")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    let seedCount = 0;
    let discoveredCount = 0;
    let socialQueryCount = 0;
    let totalSearchVolume = 0;

    for (const kw of keywords) {
      switch (kw.type) {
        case "seed":
          seedCount++;
          break;
        case "discovered":
          discoveredCount++;
          totalSearchVolume += kw.searchVolume ?? 0;
          break;
        case "social_query":
          socialQueryCount++;
          break;
      }
    }

    return {
      hasSeedKeywords: seedCount > 0,
      seedKeywordsCount: seedCount,
      discoveredKeywordsCount: discoveredCount,
      socialQueriesCount: socialQueryCount,
      totalSearchVolume,
      avgSearchVolume:
        discoveredCount > 0
          ? Math.round(totalSearchVolume / discoveredCount)
          : 0,
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
      .query("keywords")
      .withIndex("by_workspace_type", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("type", "discovered")
      )
      .collect();

    const limit = args.limit ?? 20;

    return keywords
      .map((kw) => ({
        keyword: kw.originalValue ?? kw.value,
        searchVolume: kw.searchVolume ?? 0,
        competition: kw.competition,
        competitionLevel: kw.competitionLevel,
        cpc: kw.cpc,
        keywordDifficulty: kw.keywordDifficulty,
        searchIntent: kw.searchIntent,
        trend: kw.trend,
      }))
      .sort((a, b) => b.searchVolume - a.searchVolume)
      .slice(0, limit);
  },
});

// ============================================================================
// Mutations (public, with auth)
// ============================================================================

/**
 * Delete all keywords for a workspace
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

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    for (const kw of keywords) {
      await ctx.db.delete(kw._id);
    }

    return { success: true, deleted: keywords.length };
  },
});
