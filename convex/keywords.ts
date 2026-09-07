import { getWorkspaceIcpRefreshFingerprint } from "./lib/workspaceIcpSignalsCore";
import {
  getLearningTargetingFingerprint,
  isCurrentTargetingLearning,
} from "./lib/learningTargetingHelpers";
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
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  prospectPlatformValidator,
  keywordTypeValidator,
  linkedinSearchSurfaceValidator,
  socialQueryStyleValidator,
  twitterProspectingSearchModeValidator,
  discoveryStageValidator,
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
import {
  prioritizeQueries,
  type QueryPriority,
} from "./lib/queryPrioritizationCore";
import { getStricterDiscoveryStage } from "./lib/targetingSpecCore";
import {
  resolveTwitterProspectingSearchMode,
  type TwitterProspectingSearchMode,
} from "./lib/twitterProspectingSearchCore";

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

async function getPrioritizedSocialQueries(
  ctx: Pick<QueryCtx, "db">,
  args: {
    workspaceId: Id<"workspaces">;
    platform: "twitter" | "linkedin";
    surface?: "posts" | "people";
    allowedDiscoveryStages?: Array<"strict" | "balanced" | "broad">;
    limit: number;
  }
): Promise<
  Array<{
    id: Id<"keywords">;
    value: string;
    lastSearchedAt?: number;
    lastSeenPostId?: string;
    priority: QueryPriority;
    searchMode?: TwitterProspectingSearchMode;
    discoveryStage?: "strict" | "balanced" | "broad";
  }>
> {
  const workspace = await ctx.db.get(args.workspaceId);
  if (!workspace) return [];
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
    performanceRows
      .filter((row) => isCurrentTargetingLearning(row, workspace))
      .map((row) => [String(row.queryId), row])
  );
  const twitterSearchModeByQueryId = new Map(
    keywords.map((keyword) => [
      String(keyword._id),
      resolveTwitterProspectingSearchMode({
        query: keyword.originalValue ?? keyword.value,
        requestedMode: keyword.twitterSearchMode,
      }),
    ])
  );
  const twitterLastSeenPostIdByQueryId = new Map(
    keywords.map((keyword) => [
      String(keyword._id),
      keyword.twitterLastSeenPostId,
    ])
  );
  const candidates = keywords
    .filter((keyword) => isCurrentTargetingLearning(keyword, workspace))
    .filter((keyword) => keyword.status !== "deprecated")
    .filter(
      (keyword) =>
        !keyword.discoveryStage ||
        !args.allowedDiscoveryStages ||
        args.allowedDiscoveryStages.includes(keyword.discoveryStage)
    )
    .filter((keyword) => keywordTargetsPlatform(keyword, args.platform))
    .filter((keyword) =>
      args.platform === "linkedin" && args.surface
        ? keywordTargetsLinkedInSurface(keyword, args.surface)
        : true
    )
    .map((keyword) => {
      const performance = performanceByQueryId.get(String(keyword._id));
      return {
        id: keyword._id,
        value: keyword.originalValue ?? keyword.value,
        createdAt: keyword._creationTime,
        lastSearchedAt:
          args.platform === "twitter"
            ? keyword.lastSearchedTwitterAt
            : keyword.lastSearchedLinkedInAt,
        performance: performance
          ? {
              impressions: performance.impressions,
              prospectsFound: performance.prospectsFound,
              qualifiedCount: performance.qualifiedCount,
              convertedCount: performance.convertedCount,
              replyCount: performance.replyCount,
              replyRate: performance.replyRate,
              qualificationRate: performance.qualificationRate,
            }
          : undefined,
        discoveryStage: keyword.discoveryStage,
      };
    });

  return prioritizeQueries({
    candidates,
    limit: args.limit,
    now: getCurrentUTCTimestamp(),
    retireAfterUnqualifiedSearches: args.platform === "twitter" ? 3 : undefined,
  }).map((candidate) => ({
    id: candidate.id,
    value: candidate.value,
    lastSearchedAt: candidate.lastSearchedAt,
    lastSeenPostId:
      args.platform === "twitter"
        ? twitterLastSeenPostIdByQueryId.get(String(candidate.id))
        : undefined,
    priority: candidate.priority,
    searchMode:
      args.platform === "twitter"
        ? twitterSearchModeByQueryId.get(String(candidate.id))
        : undefined,
    discoveryStage: candidate.discoveryStage,
  }));
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
    queryStyle?: "natural_phrase" | "professional_keyword" | "role_title";
    twitterSearchMode?: TwitterProspectingSearchMode;
    discoveryStage?: "strict" | "balanced" | "broad";
    targetingCriterionIds?: string[];
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
    twitterSearchMode: args.twitterSearchMode,
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
        args.platformTargets?.length === 1
          ? args.platformTargets[0]
          : undefined,
      surface: args.platformTargets?.includes("twitter")
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
    const workspace = await ctx.db.get(args.workspaceId);
    const storedKeywords = await ctx.db
      .query("keywords")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const keywords = workspace
      ? storedKeywords.filter((row) =>
          isCurrentTargetingLearning(row, workspace)
        )
      : [];

    // Group by type for backwards compatibility
    const seedKeywords: string[] = [];
    const discoveredKeywords: Array<
      { keyword: string } & DiscoveredKeywordMetadata
    > = [];
    const socialQueries: string[] = [];
    const twitterSocialQueries: string[] = [];

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
          if (keywordTargetsPlatform(kw, "twitter")) {
            twitterSocialQueries.push(kw.originalValue ?? kw.value);
          }
          break;
      }
    }

    return {
      seedKeywords,
      discoveredKeywords,
      socialQueries,
      twitterSocialQueries,
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
    const workspace = await ctx.db.get(args.workspaceId);
    const storedKeywords = await ctx.db
      .query("keywords")
      .withIndex("by_workspace_type", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("type", "social_query")
      )
      .collect();
    const keywords = workspace
      ? storedKeywords.filter((row) =>
          isCurrentTargetingLearning(row, workspace)
        )
      : [];

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
    const workspace = await ctx.db.get(args.workspaceId);
    const keyword = await ctx.db
      .query("keywords")
      .withIndex("by_workspace_canonical_hash", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("canonicalHash", args.canonicalHash)
      )
      .first();
    return workspace &&
      keyword &&
      isCurrentTargetingLearning(keyword, workspace)
      ? keyword
      : null;
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
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) return [];
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
      .filter((keyword) => isCurrentTargetingLearning(keyword, workspace))
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

export const getPrioritizedTwitterQueries = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    allowedDiscoveryStages: v.optional(v.array(discoveryStageValidator)),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) =>
    await getPrioritizedSocialQueries(ctx, {
      workspaceId: args.workspaceId,
      platform: "twitter",
      allowedDiscoveryStages: args.allowedDiscoveryStages,
      limit: args.limit ?? 5,
    }),
});

/**
 * Get the best next LinkedIn queries for a surface.
 * Uses the same bounded performance/exploration policy as Twitter.
 */
export const getPrioritizedLinkedInQueries = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    surface: linkedinSearchSurfaceValidator,
    allowedDiscoveryStages: v.optional(v.array(discoveryStageValidator)),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) =>
    await getPrioritizedSocialQueries(ctx, {
      workspaceId: args.workspaceId,
      platform: "linkedin",
      surface: args.surface,
      allowedDiscoveryStages: args.allowedDiscoveryStages,
      limit: args.limit ?? 8,
    }),
});

/**
 * Mark social queries as searched on a specific platform.
 * Updates the lastSearched timestamp and results count.
 */
export const markQueriesAsSearched = internalMutation({
  args: {
    expectedTargetingFingerprint: v.optional(v.string()),
    queryIds: v.array(v.id("keywords")),
    platform: prospectPlatformValidator,
    surface: v.optional(linkedinSearchSurfaceValidator),
    resultsCount: v.optional(v.number()),
    queryStats: v.optional(
      v.array(
        v.object({
          query: v.string(),
          postsFound: v.number(),
          newProspectsFound: v.optional(v.number()),
          pagesFetched: v.optional(v.number()),
          newestPostId: v.optional(v.string()),
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
        const workspace = await ctx.db.get(keyword.workspaceId);
        if (
          !workspace ||
          !isCurrentTargetingLearning(keyword, workspace) ||
          (args.expectedTargetingFingerprint !== undefined &&
            args.expectedTargetingFingerprint !==
              getLearningTargetingFingerprint(workspace))
        )
          continue;
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
            twitterLastSeenPostId:
              perQueryStats?.newestPostId ?? keyword.twitterLastSeenPostId,
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
              : (args.surface ?? resolveKeywordLinkedInSurface(keyword)),
          activatedQueryCandidateId: keyword.activatedQueryCandidateId,
          impressionsDelta: 1,
          prospectsFoundDelta:
            perQueryStats?.newProspectsFound ??
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
            rawPostsFound: perQueryStats?.postsFound,
            newProspectsFound: perQueryStats?.newProspectsFound,
            pagesFetched: perQueryStats?.pagesFetched,
            newestPostId: perQueryStats?.newestPostId,
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
    twitterSearchMode: v.optional(twitterProspectingSearchModeValidator),
    discoveryStage: v.optional(discoveryStageValidator),
    targetingCriterionIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("Workspace not found");
    const targetingFingerprint = getLearningTargetingFingerprint(workspace);
    const normalized = normalizeKeyword(args.value);
    const canonical = buildKeywordCanonicalRecord({
      type: args.type,
      value: args.value,
    });

    // Keyword types have different behavior: seed/discovered terms inform query
    // generation, while social_query rows are executable. Preserve both when
    // their normalized text is identical.
    const existing = await ctx.db
      .query("keywords")
      .withIndex("by_workspace_type_and_value", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("type", args.type)
          .eq("value", normalized)
      )
      .first();

    if (existing) {
      const previous = isCurrentTargetingLearning(existing, workspace)
        ? existing
        : undefined;
      // The compound index guarantees this, but keep the guard defensive.
      if (existing.type === args.type) {
        await ctx.db.patch(existing._id, {
          targetingFingerprint,
          ...(!previous
            ? {
                status: "active" as const,
                lastSearchedTwitterAt: undefined,
                lastSearchedLinkedInAt: undefined,
                twitterLastSeenPostId: undefined,
                twitterResultsCount: undefined,
                linkedinResultsCount: undefined,
                resultsCount: undefined,
                lastUsedAt: undefined,
              }
            : {}),
          canonicalValue: canonical.canonicalValue,
          canonicalHash: canonical.canonicalHash,
          canonicalKey: canonical.canonicalKey,
          source: args.source ?? previous?.source,
          searchVolume: args.searchVolume ?? previous?.searchVolume,
          competition: args.competition ?? previous?.competition,
          competitionLevel: args.competitionLevel ?? previous?.competitionLevel,
          cpc: args.cpc ?? previous?.cpc,
          keywordDifficulty:
            args.keywordDifficulty ?? previous?.keywordDifficulty,
          searchIntent: args.searchIntent ?? previous?.searchIntent,
          trend: args.trend ?? previous?.trend,
          monitorId: args.monitorId ?? previous?.monitorId,
          platformTargets:
            mergeUniqueValues(
              previous?.platformTargets,
              args.platformTargets
            ) ?? previous?.platformTargets,
          linkedinSurface: previous?.linkedinSurface ?? args.linkedinSurface,
          linkedinSurfaceTargets:
            mergeUniqueValues(
              previous?.linkedinSurfaceTargets,
              args.linkedinSurfaceTargets,
              args.linkedinSurface ? [args.linkedinSurface] : undefined
            ) ?? previous?.linkedinSurfaceTargets,
          queryStyle: args.queryStyle ?? previous?.queryStyle,
          twitterSearchMode:
            args.twitterSearchMode ?? previous?.twitterSearchMode,
          discoveryStage:
            args.discoveryStage && previous?.discoveryStage
              ? getStricterDiscoveryStage(
                  previous?.discoveryStage,
                  args.discoveryStage
                )
              : (args.discoveryStage ?? previous?.discoveryStage),
          targetingCriterionIds:
            mergeUniqueValues(
              previous?.targetingCriterionIds,
              args.targetingCriterionIds
            ) ?? previous?.targetingCriterionIds,
        });

        await syncKeywordMemoryState(ctx, {
          workspaceId: args.workspaceId,
          keywordId: existing._id,
          type: args.type,
          rawValue: args.value.trim(),
          lastUsedAt: previous?.lastUsedAt,
          platformTargets:
            mergeUniqueValues(
              previous?.platformTargets,
              args.platformTargets
            ) ?? previous?.platformTargets,
          linkedinSurface: previous?.linkedinSurface ?? args.linkedinSurface,
          linkedinSurfaceTargets:
            mergeUniqueValues(
              previous?.linkedinSurfaceTargets,
              args.linkedinSurfaceTargets,
              args.linkedinSurface ? [args.linkedinSurface] : undefined
            ) ?? previous?.linkedinSurfaceTargets,
          queryStyle: args.queryStyle ?? previous?.queryStyle,
          twitterSearchMode:
            args.twitterSearchMode ?? previous?.twitterSearchMode,
        });
      }
      return existing._id;
    }

    // Insert new keyword
    const keywordId = await ctx.db.insert("keywords", {
      workspaceId: args.workspaceId,
      targetingFingerprint,
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
      twitterSearchMode: args.twitterSearchMode,
      discoveryStage: args.discoveryStage,
      targetingCriterionIds: args.targetingCriterionIds,
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
      twitterSearchMode: args.twitterSearchMode,
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
        linkedinSurfaceTargets: v.optional(
          v.array(linkedinSearchSurfaceValidator)
        ),
        queryStyle: v.optional(socialQueryStyleValidator),
        twitterSearchMode: v.optional(twitterProspectingSearchModeValidator),
        discoveryStage: v.optional(discoveryStageValidator),
        targetingCriterionIds: v.optional(v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("Workspace not found");
    const targetingFingerprint = getLearningTargetingFingerprint(workspace);
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
      const canonical = buildKeywordCanonicalRecord({
        type: kw.type,
        value: kw.value,
      });
      existingMap.set(canonical.canonicalKey, kw);
    }

    for (const keyword of args.keywords) {
      const normalized = normalizeKeyword(keyword.value);
      const canonical = buildKeywordCanonicalRecord({
        type: keyword.type,
        value: keyword.value,
      });
      const existing = existingMap.get(canonical.canonicalKey);

      if (existing) {
        const previous = isCurrentTargetingLearning(existing, workspace)
          ? existing
          : undefined;
        if (existing.type === keyword.type) {
          await ctx.db.patch(existing._id, {
            targetingFingerprint,
            ...(!previous
              ? {
                  status: "active" as const,
                  lastSearchedTwitterAt: undefined,
                  lastSearchedLinkedInAt: undefined,
                  twitterLastSeenPostId: undefined,
                  twitterResultsCount: undefined,
                  linkedinResultsCount: undefined,
                  resultsCount: undefined,
                  lastUsedAt: undefined,
                }
              : {}),
            canonicalValue: canonical.canonicalValue,
            canonicalHash: canonical.canonicalHash,
            canonicalKey: canonical.canonicalKey,
            source: keyword.source ?? previous?.source,
            searchVolume: keyword.searchVolume ?? previous?.searchVolume,
            competition: keyword.competition ?? previous?.competition,
            competitionLevel:
              keyword.competitionLevel ?? previous?.competitionLevel,
            cpc: keyword.cpc ?? previous?.cpc,
            keywordDifficulty:
              keyword.keywordDifficulty ?? previous?.keywordDifficulty,
            searchIntent: keyword.searchIntent ?? previous?.searchIntent,
            trend: keyword.trend ?? previous?.trend,
            monitorId: keyword.monitorId ?? previous?.monitorId,
            platformTargets:
              mergeUniqueValues(
                previous?.platformTargets,
                keyword.platformTargets
              ) ?? previous?.platformTargets,
            linkedinSurface:
              previous?.linkedinSurface ?? keyword.linkedinSurface,
            linkedinSurfaceTargets:
              mergeUniqueValues(
                previous?.linkedinSurfaceTargets,
                keyword.linkedinSurfaceTargets,
                keyword.linkedinSurface ? [keyword.linkedinSurface] : undefined
              ) ?? previous?.linkedinSurfaceTargets,
            queryStyle: keyword.queryStyle ?? previous?.queryStyle,
            twitterSearchMode:
              keyword.twitterSearchMode ?? previous?.twitterSearchMode,
            discoveryStage:
              keyword.discoveryStage && previous?.discoveryStage
                ? getStricterDiscoveryStage(
                    previous?.discoveryStage,
                    keyword.discoveryStage
                  )
                : (keyword.discoveryStage ?? previous?.discoveryStage),
            targetingCriterionIds:
              mergeUniqueValues(
                previous?.targetingCriterionIds,
                keyword.targetingCriterionIds
              ) ?? previous?.targetingCriterionIds,
          });
          await syncKeywordMemoryState(ctx, {
            workspaceId: args.workspaceId,
            keywordId: existing._id,
            type: keyword.type,
            rawValue: keyword.value.trim(),
            lastUsedAt: previous?.lastUsedAt,
            platformTargets:
              mergeUniqueValues(
                previous?.platformTargets,
                keyword.platformTargets
              ) ?? previous?.platformTargets,
            linkedinSurface:
              previous?.linkedinSurface ?? keyword.linkedinSurface,
            linkedinSurfaceTargets:
              mergeUniqueValues(
                previous?.linkedinSurfaceTargets,
                keyword.linkedinSurfaceTargets,
                keyword.linkedinSurface ? [keyword.linkedinSurface] : undefined
              ) ?? previous?.linkedinSurfaceTargets,
            queryStyle: keyword.queryStyle ?? previous?.queryStyle,
            twitterSearchMode:
              keyword.twitterSearchMode ?? previous?.twitterSearchMode,
          });
          const refreshedKeyword = await ctx.db.get(existing._id);
          if (refreshedKeyword) {
            existingMap.set(canonical.canonicalKey, refreshedKeyword);
          }
          updated++;
        } else {
          skipped++;
        }
      } else {
        // Insert new
        const newId = await ctx.db.insert("keywords", {
          workspaceId: args.workspaceId,
          targetingFingerprint,
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
          twitterSearchMode: keyword.twitterSearchMode,
          discoveryStage: keyword.discoveryStage,
          targetingCriterionIds: keyword.targetingCriterionIds,
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
          twitterSearchMode: keyword.twitterSearchMode,
          discoveryStage: keyword.discoveryStage,
          targetingCriterionIds: keyword.targetingCriterionIds,
        });
        // Add to map to prevent duplicates within batch
        existingMap.set(canonical.canonicalKey, {
          targetingFingerprint,
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
          twitterSearchMode: keyword.twitterSearchMode,
          discoveryStage: keyword.discoveryStage,
          targetingCriterionIds: keyword.targetingCriterionIds,
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
      .withIndex("by_workspace_type_and_value", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("type", "social_query")
          .eq("value", normalized)
      )
      .first();

    if (keyword) {
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

export const deleteWorkspaceKeywordsBatchInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.number(),
    expectedTargetingFingerprint: v.optional(v.string()),
  },
  returns: v.object({
    deleted: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    if (args.expectedTargetingFingerprint !== undefined) {
      const workspace = await ctx.db.get(args.workspaceId);
      if (
        !workspace ||
        getWorkspaceIcpRefreshFingerprint(workspace) !==
          args.expectedTargetingFingerprint
      ) {
        return { deleted: 0, hasMore: false };
      }
    }
    const limit = Math.max(1, Math.min(Math.floor(args.limit), 500));
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(limit + 1);
    const batch = keywords.slice(0, limit);

    await Promise.all(batch.map((keyword) => ctx.db.delete(keyword._id)));

    return {
      deleted: batch.length,
      hasMore: keywords.length > limit,
    };
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
