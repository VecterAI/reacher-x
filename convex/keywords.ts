// convex/keywords.ts
// Keyword management for prospect discovery (row-per-keyword design)

import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./lib/functionBuilders";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  prospectPlatformValidator,
  keywordTypeValidator,
  linkedinSearchSurfaceValidator,
  socialQueryStyleValidator,
} from "./validators";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import {
  getOwnedWorkspace,
  getUserByIdentity,
  requireOwnedWorkspace,
  requireUser,
} from "./lib/accessHelpers";
import {
  recordMemoryWorkflowEvent,
  upsertQueryCandidateRecord,
  upsertQueryPerformanceRecord,
} from "./lib/memoryCore";
import {
  buildKeywordCanonicalRecord,
  mapKeywordTypeToQueryCandidateType,
  normalizeMemoryText,
} from "./lib/memoryHelpers";

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
  return normalizeMemoryText(value);
}

function mergeUniqueValues<T extends string>(
  ...values: Array<Array<T | undefined> | undefined>
): T[] | undefined {
  const merged = Array.from(
    new Set(
      values
        .flatMap((value) => value ?? [])
        .filter((value): value is T => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  ) as T[];

  return merged.length > 0 ? merged : undefined;
}

function keywordTargetsPlatform(
  keyword: {
    platformTargets?: Array<"twitter" | "linkedin">;
  },
  platform: "twitter" | "linkedin"
) {
  if (!keyword.platformTargets || keyword.platformTargets.length === 0) {
    // LEGACY COMPAT: historical social_query rows predate per-platform metadata.
    // Remove this fallback after all readers rely on queriesByPlatform/queryMetadata
    // and legacy rows have been backfilled or naturally aged out.
    return true;
  }

  return keyword.platformTargets.includes(platform);
}

function resolveKeywordLinkedInSurface(keyword: {
  linkedinSurface?: "posts" | "people";
  linkedinSurfaceTargets?: Array<"posts" | "people">;
}): "posts" | "people" {
  if (keyword.linkedinSurface) {
    return keyword.linkedinSurface;
  }

  if (keyword.linkedinSurfaceTargets?.includes("people")) {
    return "people";
  }

  // LEGACY COMPAT: LinkedIn discovery used posts only before per-surface metadata.
  // Remove this fallback after all active social_query rows carry linkedinSurface.
  return "posts";
}

function keywordTargetsLinkedInSurface(
  keyword: {
    linkedinSurface?: "posts" | "people";
    linkedinSurfaceTargets?: Array<"posts" | "people">;
  },
  surface: "posts" | "people"
) {
  if (keyword.linkedinSurfaceTargets?.length) {
    return keyword.linkedinSurfaceTargets.includes(surface);
  }

  return resolveKeywordLinkedInSurface(keyword) === surface;
}

async function syncKeywordMemoryState(
  ctx: Pick<MutationCtx, "db" | "scheduler">,
  args: {
    workspaceId: Id<"workspaces">;
    keywordId: Id<"keywords">;
    type: "seed" | "discovered" | "social_query";
    rawValue: string;
    lastUsedAt?: number;
    platformTargets?: Array<"twitter" | "linkedin">;
    linkedinSurface?: "posts" | "people";
    linkedinSurfaceTargets?: Array<"posts" | "people">;
    queryStyle?:
      | "natural_phrase"
      | "professional_keyword"
      | "role_title";
  }
) {
  const queryCandidate = await upsertQueryCandidateRecord(ctx.db, {
    workspaceId: args.workspaceId,
    type: mapKeywordTypeToQueryCandidateType(args.type),
    rawValue: args.rawValue,
    platformTargets: args.platformTargets,
    linkedinSurface: args.linkedinSurface,
    linkedinSurfaceTargets: args.linkedinSurfaceTargets,
    queryStyle: args.queryStyle,
    status: "activated",
    activatedKeywordId: args.keywordId,
  });

  await ctx.db.patch(args.keywordId, {
    activatedQueryCandidateId: queryCandidate.queryCandidateId,
  });

  await recordMemoryWorkflowEvent(ctx, {
    workspaceId: args.workspaceId,
    eventType: "query_candidate_activated",
    sourceType: "query_candidate",
    sourceId: String(queryCandidate.queryCandidateId),
    queryCandidateId: queryCandidate.queryCandidateId,
    queryId: args.keywordId,
    payload: {
      keywordType: args.type,
      rawValue: args.rawValue,
    },
  });

  if (args.type === "social_query") {
    const canonical = buildKeywordCanonicalRecord({
      type: args.type,
      value: args.rawValue,
    });
    await upsertQueryPerformanceRecord(ctx.db, {
      workspaceId: args.workspaceId,
      queryId: args.keywordId,
      canonicalValue: canonical.canonicalValue,
      canonicalHash: canonical.canonicalHash,
      platform:
        args.platformTargets?.length === 1 ? args.platformTargets[0] : undefined,
      surface:
        args.platformTargets?.includes("twitter")
          ? "posts"
          : args.linkedinSurface,
      activatedQueryCandidateId: queryCandidate.queryCandidateId,
      lastUsedAt: args.lastUsedAt,
    });
  }
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

/**
 * Resolve a keyword by its canonical hash within a workspace.
 * Used by discovery novelty gates and monitor lineage linking.
 */
export const getKeywordByCanonicalHashInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    canonicalHash: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("keywords")
      .withIndex("by_workspace_canonical_hash", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("canonicalHash", args.canonicalHash)
      )
      .first();
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
    surface: v.optional(linkedinSearchSurfaceValidator),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<Array<{ id: Id<"keywords">; value: string }>> => {
    const batchLimit = args.limit ?? 10;

    const rawQueries =
      args.platform === "twitter"
        ? await ctx.db
            .query("keywords")
            .withIndex("by_workspace_type_twitter", (q) =>
              q
                .eq("workspaceId", args.workspaceId)
                .eq("type", "social_query")
                .eq("lastSearchedTwitterAt", undefined)
            )
            .collect()
        : await ctx.db
            .query("keywords")
            .withIndex("by_workspace_type_linkedin", (q) =>
              q
                .eq("workspaceId", args.workspaceId)
                .eq("type", "social_query")
                .eq("lastSearchedLinkedInAt", undefined)
            )
            .collect();

    const queries = rawQueries
      .filter((keyword) => keywordTargetsPlatform(keyword, args.platform))
      .filter((keyword) =>
        args.platform === "linkedin" && args.surface
          ? keywordTargetsLinkedInSurface(keyword, args.surface)
          : true
      )
      .slice(0, batchLimit);

    return queries.map((kw) => ({
      id: kw._id,
      value: kw.originalValue ?? kw.value,
    }));
  },
});

/**
 * Get the best next LinkedIn queries for a surface.
 * Prioritizes new queries, proven winners, then learning queries, and only
 * revisits cold queries after a cooldown.
 */
export const getPrioritizedLinkedInQueries = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    surface: linkedinSearchSurfaceValidator,
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<
    Array<{
      id: Id<"keywords">;
      value: string;
      lastSearchedAt?: number;
      priority: "new" | "proven" | "learning" | "cold";
    }>
  > => {
    const batchLimit = args.limit ?? 8;
    const now = getCurrentUTCTimestamp();
    const coldCooldownMs = 7 * 24 * 60 * 60 * 1000;
    const [keywords, performanceRows] = await Promise.all([
      ctx.db
        .query("keywords")
        .withIndex("by_workspace_type", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("type", "social_query")
        )
        .collect(),
      ctx.db
        .query("queryPerformance")
        .withIndex("by_workspace_updated_at", (q) =>
          q.eq("workspaceId", args.workspaceId)
        )
        .collect(),
    ]);

    const performanceByQueryId = new Map(
      performanceRows.map((row) => [String(row.queryId), row])
    );

    const candidates = keywords
      .filter((keyword) => keywordTargetsPlatform(keyword, "linkedin"))
      .filter((keyword) => keywordTargetsLinkedInSurface(keyword, args.surface))
      .map((keyword) => {
        const performance = performanceByQueryId.get(String(keyword._id));
        const impressions = performance?.impressions ?? 0;
        const prospectsFound = performance?.prospectsFound ?? 0;
        const lastSearchedAt = keyword.lastSearchedLinkedInAt;

        let priority: "new" | "proven" | "learning" | "cold";
        if (typeof lastSearchedAt !== "number") {
          priority = "new";
        } else if (prospectsFound > 0) {
          priority = "proven";
        } else if (impressions < 3) {
          priority = "learning";
        } else {
          priority = "cold";
        }

        return {
          id: keyword._id,
          value: keyword.originalValue ?? keyword.value,
          lastSearchedAt,
          impressions,
          prospectsFound,
          priority,
        };
      });

    const newQueries = candidates
      .filter((candidate) => candidate.priority === "new")
      .sort((left, right) => String(left.id).localeCompare(String(right.id)));
    const provenQueries = candidates
      .filter((candidate) => candidate.priority === "proven")
      .sort((left, right) => right.prospectsFound - left.prospectsFound);
    const learningQueries = candidates
      .filter((candidate) => candidate.priority === "learning")
      .sort(
        (left, right) =>
          (left.lastSearchedAt ?? 0) - (right.lastSearchedAt ?? 0)
      );
    const coldQueries = candidates
      .filter(
        (candidate) =>
          candidate.priority === "cold" &&
          typeof candidate.lastSearchedAt === "number" &&
          now - candidate.lastSearchedAt >= coldCooldownMs
      )
      .sort(
        (left, right) =>
          (left.lastSearchedAt ?? 0) - (right.lastSearchedAt ?? 0)
      )
      .slice(0, 1);

    return [...newQueries, ...provenQueries, ...learningQueries, ...coldQueries]
      .slice(0, batchLimit)
      .map((candidate) => ({
        id: candidate.id,
        value: candidate.value,
        lastSearchedAt: candidate.lastSearchedAt,
        priority: candidate.priority,
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
    surface: v.optional(linkedinSearchSurfaceValidator),
    resultsCount: v.optional(v.number()),
    queryStats: v.optional(
      v.array(
        v.object({
          query: v.string(),
          postsFound: v.number(),
          success: v.boolean(),
          error: v.optional(v.string()),
        })
      )
    ),
  },
  handler: async (ctx, args): Promise<{ updated: number }> => {
    const now = getCurrentUTCTimestamp();
    let updated = 0;
    const queryStatsMap = new Map(
      (args.queryStats ?? []).map((item) => [
        normalizeKeyword(item.query),
        item,
      ])
    );

    for (const queryId of args.queryIds) {
      const keyword = await ctx.db.get(queryId);
      if (keyword && keyword.type === "social_query") {
        const canonical =
          keyword.canonicalValue && keyword.canonicalHash
            ? {
                canonicalValue: keyword.canonicalValue,
                canonicalHash: keyword.canonicalHash,
              }
            : buildKeywordCanonicalRecord({
                type: keyword.type,
                value: keyword.originalValue ?? keyword.value,
              });
        const perQueryStats = queryStatsMap.get(keyword.value);
        if (args.platform === "twitter") {
          await ctx.db.patch(queryId, {
            lastSearchedTwitterAt: now,
            twitterResultsCount:
              perQueryStats?.postsFound ??
              args.resultsCount ??
              keyword.twitterResultsCount,
            lastUsedAt: now,
          });
        } else {
          await ctx.db.patch(queryId, {
            lastSearchedLinkedInAt: now,
            linkedinResultsCount:
              perQueryStats?.postsFound ??
              args.resultsCount ??
              keyword.linkedinResultsCount,
            lastUsedAt: now,
          });
        }

        await upsertQueryPerformanceRecord(ctx.db, {
          workspaceId: keyword.workspaceId,
          queryId,
          canonicalValue: canonical.canonicalValue,
          canonicalHash: canonical.canonicalHash,
          platform: args.platform,
          surface:
            args.platform === "twitter"
              ? "posts"
              : args.surface ?? resolveKeywordLinkedInSurface(keyword),
          activatedQueryCandidateId: keyword.activatedQueryCandidateId,
          impressionsDelta: 1,
          prospectsFoundDelta:
            perQueryStats?.postsFound ??
            (args.queryIds.length === 1 ? (args.resultsCount ?? 0) : 0),
          lastUsedAt: now,
        });
        await recordMemoryWorkflowEvent(ctx, {
          workspaceId: keyword.workspaceId,
          eventType: "query_search_executed",
          sourceType: "keyword",
          sourceId: String(queryId),
          queryId,
          payload: {
            platform: args.platform,
            resultsCount:
              perQueryStats?.postsFound ??
              (args.queryIds.length === 1
                ? (args.resultsCount ?? 0)
                : undefined),
            searchSuccess: perQueryStats?.success,
            searchError: perQueryStats?.error,
          },
          occurredAt: now,
        });
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
    platformTargets: v.optional(v.array(prospectPlatformValidator)),
    linkedinSurface: v.optional(linkedinSearchSurfaceValidator),
    linkedinSurfaceTargets: v.optional(v.array(linkedinSearchSurfaceValidator)),
    queryStyle: v.optional(socialQueryStyleValidator),
  },
  handler: async (ctx, args) => {
    const normalized = normalizeKeyword(args.value);
    const canonical = buildKeywordCanonicalRecord({
      type: args.type,
      value: args.value,
    });

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
          canonicalValue: canonical.canonicalValue,
          canonicalHash: canonical.canonicalHash,
          canonicalKey: canonical.canonicalKey,
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
          platformTargets:
            mergeUniqueValues(
              existing.platformTargets,
              args.platformTargets
            ) ?? existing.platformTargets,
          linkedinSurface: existing.linkedinSurface ?? args.linkedinSurface,
          linkedinSurfaceTargets:
            mergeUniqueValues(
              existing.linkedinSurfaceTargets,
              args.linkedinSurfaceTargets,
              args.linkedinSurface ? [args.linkedinSurface] : undefined
            ) ?? existing.linkedinSurfaceTargets,
          queryStyle: args.queryStyle ?? existing.queryStyle,
        });

        await syncKeywordMemoryState(ctx, {
          workspaceId: args.workspaceId,
          keywordId: existing._id,
          type: args.type,
          rawValue: args.value.trim(),
          lastUsedAt: existing.lastUsedAt,
          platformTargets:
            mergeUniqueValues(
              existing.platformTargets,
              args.platformTargets
            ) ?? existing.platformTargets,
          linkedinSurface: existing.linkedinSurface ?? args.linkedinSurface,
          linkedinSurfaceTargets:
            mergeUniqueValues(
              existing.linkedinSurfaceTargets,
              args.linkedinSurfaceTargets,
              args.linkedinSurface ? [args.linkedinSurface] : undefined
            ) ?? existing.linkedinSurfaceTargets,
          queryStyle: args.queryStyle ?? existing.queryStyle,
        });
      }
      return existing._id;
    }

    // Insert new keyword
    const keywordId = await ctx.db.insert("keywords", {
      workspaceId: args.workspaceId,
      type: args.type,
      value: normalized,
      canonicalValue: canonical.canonicalValue,
      canonicalHash: canonical.canonicalHash,
      canonicalKey: canonical.canonicalKey,
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
      platformTargets: args.platformTargets,
      linkedinSurface: args.linkedinSurface,
      linkedinSurfaceTargets:
        mergeUniqueValues(
          args.linkedinSurfaceTargets,
          args.linkedinSurface ? [args.linkedinSurface] : undefined
        ) ?? undefined,
      queryStyle: args.queryStyle,
    });

    await syncKeywordMemoryState(ctx, {
      workspaceId: args.workspaceId,
      keywordId,
      type: args.type,
      rawValue: args.value.trim(),
      platformTargets: args.platformTargets,
      linkedinSurface: args.linkedinSurface,
      linkedinSurfaceTargets:
        mergeUniqueValues(
          args.linkedinSurfaceTargets,
          args.linkedinSurface ? [args.linkedinSurface] : undefined
        ) ?? undefined,
      queryStyle: args.queryStyle,
    });

    return keywordId;
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
        platformTargets: v.optional(v.array(prospectPlatformValidator)),
        linkedinSurface: v.optional(linkedinSearchSurfaceValidator),
        linkedinSurfaceTargets: v.optional(v.array(linkedinSearchSurfaceValidator)),
        queryStyle: v.optional(socialQueryStyleValidator),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = getCurrentUTCTimestamp();
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
      const canonical = buildKeywordCanonicalRecord({
        type: keyword.type,
        value: keyword.value,
      });
      const existing = existingMap.get(normalized);

      if (existing) {
        // Update if same type, otherwise skip
        if (existing.type === keyword.type) {
          await ctx.db.patch(existing._id, {
            canonicalValue: canonical.canonicalValue,
            canonicalHash: canonical.canonicalHash,
            canonicalKey: canonical.canonicalKey,
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
            platformTargets:
              mergeUniqueValues(
                existing.platformTargets,
                keyword.platformTargets
              ) ?? existing.platformTargets,
            linkedinSurface:
              existing.linkedinSurface ?? keyword.linkedinSurface,
            linkedinSurfaceTargets:
              mergeUniqueValues(
                existing.linkedinSurfaceTargets,
                keyword.linkedinSurfaceTargets,
                keyword.linkedinSurface ? [keyword.linkedinSurface] : undefined
              ) ?? existing.linkedinSurfaceTargets,
            queryStyle: keyword.queryStyle ?? existing.queryStyle,
          });
          await syncKeywordMemoryState(ctx, {
            workspaceId: args.workspaceId,
            keywordId: existing._id,
            type: keyword.type,
            rawValue: keyword.value.trim(),
            lastUsedAt: existing.lastUsedAt,
            platformTargets:
              mergeUniqueValues(
                existing.platformTargets,
                keyword.platformTargets
              ) ?? existing.platformTargets,
            linkedinSurface:
              existing.linkedinSurface ?? keyword.linkedinSurface,
            linkedinSurfaceTargets:
              mergeUniqueValues(
                existing.linkedinSurfaceTargets,
                keyword.linkedinSurfaceTargets,
                keyword.linkedinSurface ? [keyword.linkedinSurface] : undefined
              ) ?? existing.linkedinSurfaceTargets,
            queryStyle: keyword.queryStyle ?? existing.queryStyle,
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
          canonicalValue: canonical.canonicalValue,
          canonicalHash: canonical.canonicalHash,
          canonicalKey: canonical.canonicalKey,
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
          platformTargets: keyword.platformTargets,
          linkedinSurface: keyword.linkedinSurface,
          linkedinSurfaceTargets:
            mergeUniqueValues(
              keyword.linkedinSurfaceTargets,
              keyword.linkedinSurface ? [keyword.linkedinSurface] : undefined
            ) ?? undefined,
          queryStyle: keyword.queryStyle,
        });
        await syncKeywordMemoryState(ctx, {
          workspaceId: args.workspaceId,
          keywordId: newId,
          type: keyword.type,
          rawValue: keyword.value.trim(),
          platformTargets: keyword.platformTargets,
          linkedinSurface: keyword.linkedinSurface,
          linkedinSurfaceTargets:
            mergeUniqueValues(
              keyword.linkedinSurfaceTargets,
              keyword.linkedinSurface ? [keyword.linkedinSurface] : undefined
            ) ?? undefined,
          queryStyle: keyword.queryStyle,
        });
        // Add to map to prevent duplicates within batch
        existingMap.set(normalized, {
          _id: newId,
          _creationTime: now,
          workspaceId: args.workspaceId,
          type: keyword.type,
          value: normalized,
          status: "active",
          canonicalValue: canonical.canonicalValue,
          canonicalHash: canonical.canonicalHash,
          canonicalKey: canonical.canonicalKey,
          activatedQueryCandidateId: undefined,
          platformTargets: keyword.platformTargets,
          linkedinSurface: keyword.linkedinSurface,
          linkedinSurfaceTargets:
            mergeUniqueValues(
              keyword.linkedinSurfaceTargets,
              keyword.linkedinSurface ? [keyword.linkedinSurface] : undefined
            ) ?? undefined,
          queryStyle: keyword.queryStyle,
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

    const user = await getUserByIdentity(ctx, identity);
    if (!user) return null;

    const workspace = await getOwnedWorkspace(ctx, args.workspaceId, user._id);
    if (!workspace) return null;

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

    const user = await getUserByIdentity(ctx, identity);
    if (!user) return null;

    const workspace = await getOwnedWorkspace(ctx, args.workspaceId, user._id);
    if (!workspace) return null;

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

    const user = await getUserByIdentity(ctx, identity);
    if (!user) return [];

    const workspace = await getOwnedWorkspace(ctx, args.workspaceId, user._id);
    if (!workspace) return [];

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
    const user = await requireUser(ctx);
    await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Workspace not found",
    });

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
