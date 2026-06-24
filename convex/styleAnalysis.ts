// convex/styleAnalysis.ts
// Writing style content ingestion queries/mutations (standard Convex runtime).
// Actions (backfill, distillation) live in styleAnalysisActions.ts ("use node").

import { internalMutation, internalQuery } from "./lib/functionBuilders";
import { v } from "convex/values";
import type { GenericDatabaseWriter } from "convex/server";
import type { DataModel, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { logger } from "../shared/lib/logger";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { recordMemoryWorkflowEvent } from "./lib/memoryCore";
import {
  deleteWorkspaceAgentMemoriesByCategory,
  listRecentAgentMemories,
} from "./lib/agentMemoryCore";
import {
  getStyleMemoryCategory,
  isActiveStyleSource,
} from "./lib/styleSourceCore";
import {
  BATCH_ANALYSIS_THRESHOLD,
  bootstrapWorkspaceStyleProfilesForWorkspaceOnDb,
  getWorkspaceStyleProfileRow,
  upsertWorkspaceStyleProfileOnDb,
} from "./lib/workspaceStyleProfileCore";

// ============================================================================
// Constants
// ============================================================================

/** Minimum content text length to be useful for style analysis. */
const MIN_SAMPLE_TEXT_LENGTH = 15;
const styleAnalysisLogger = logger.withScope("StyleAnalysis");

// ============================================================================
// Internal Queries
// ============================================================================

/**
 * Get unprocessed style content samples for an active source.
 */
export const getUnprocessedSamples = internalQuery({
  args: {
    userId: v.id("users"),
    platform: v.union(v.literal("twitter"), v.literal("linkedin")),
    sourceVersion: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("styleContentSamples")
      .withIndex("by_user_platform_source_processed", (q) =>
        q
          .eq("userId", args.userId)
          .eq("platform", args.platform)
          .eq("sourceVersion", args.sourceVersion)
          .eq("processedForStyle", false)
      )
      .take(args.limit ?? 100);
  },
});

/**
 * Count unprocessed samples for an active source.
 */
export const countUnprocessedSamples = internalQuery({
  args: {
    userId: v.id("users"),
    platform: v.union(v.literal("twitter"), v.literal("linkedin")),
    sourceVersion: v.number(),
  },
  handler: async (ctx, args) => {
    const samples = await ctx.db
      .query("styleContentSamples")
      .withIndex("by_user_platform_source_processed", (q) =>
        q
          .eq("userId", args.userId)
          .eq("platform", args.platform)
          .eq("sourceVersion", args.sourceVersion)
          .eq("processedForStyle", false)
      )
      .collect();
    return samples.length;
  },
});

/**
 * Get all samples for an active source (for re-analysis with full history).
 */
export const getAllSamplesForSource = internalQuery({
  args: {
    userId: v.id("users"),
    platform: v.union(v.literal("twitter"), v.literal("linkedin")),
    sourceVersion: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("styleContentSamples")
      .withIndex("by_user_platform_source_version", (q) =>
        q
          .eq("userId", args.userId)
          .eq("platform", args.platform)
          .eq("sourceVersion", args.sourceVersion)
      )
      .order("desc")
      .take(args.limit ?? 200);
  },
});

// ============================================================================
// Internal Mutations
// ============================================================================

/**
 * Ingest a single content sample (tweet, post, etc.) into the staging buffer.
 * Deduplicates by userId+platform+sourceVersion+externalContentId. Triggers
 * batch analysis when threshold met.
 */
export const ingestStyleContent = internalMutation({
  args: {
    userId: v.id("users"),
    platform: v.union(v.literal("twitter"), v.literal("linkedin")),
    sourceVersion: v.number(),
    sourceExternalUserId: v.string(),
    externalContentId: v.string(),
    fullText: v.string(),
    contentType: v.union(
      v.literal("original_post"),
      v.literal("comment"),
      v.literal("reply"),
      v.literal("repost")
    ),
    postedAt: v.number(),
    source: v.union(v.literal("backfill"), v.literal("monitor_webhook")),
  },
  handler: async (ctx, args) => {
    // Dedup check
    const existing = await ctx.db
      .query("styleContentSamples")
      .withIndex("by_user_platform_source_external_content_id", (q) =>
        q
          .eq("userId", args.userId)
          .eq("platform", args.platform)
          .eq("sourceVersion", args.sourceVersion)
          .eq("externalContentId", args.externalContentId)
      )
      .first();

    if (existing) {
      return {
        inserted: false,
        reason: "duplicate" as const,
        existingSource: existing.source,
        existingProcessedForStyle: existing.processedForStyle,
      };
    }

    // Skip very short content and reposts
    if (
      args.fullText.trim().length < MIN_SAMPLE_TEXT_LENGTH ||
      args.contentType === "repost"
    ) {
      return {
        inserted: false,
        reason:
          args.contentType === "repost"
            ? ("repost" as const)
            : ("too_short" as const),
        textLength: args.fullText.trim().length,
      };
    }

    await ctx.db.insert("styleContentSamples", {
      userId: args.userId,
      platform: args.platform,
      sourceVersion: args.sourceVersion,
      sourceExternalUserId: args.sourceExternalUserId,
      externalContentId: args.externalContentId,
      fullText: args.fullText,
      contentType: args.contentType,
      postedAt: args.postedAt,
      source: args.source,
      processedForStyle: false,
    });

    // For monitor webhooks (not backfill), check if we've hit the batch threshold
    if (args.source === "monitor_webhook") {
      const unprocessedCount = await ctx.db
        .query("styleContentSamples")
        .withIndex("by_user_platform_source_processed", (q) =>
          q
            .eq("userId", args.userId)
            .eq("platform", args.platform)
            .eq("sourceVersion", args.sourceVersion)
            .eq("processedForStyle", false)
        )
        .collect()
        .then((samples) => samples.length);

      if (unprocessedCount >= BATCH_ANALYSIS_THRESHOLD) {
        // Trigger analysis for each workspace owned by this user
        const workspaces = await ctx.db
          .query("workspaces")
          .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
          .collect();

        for (const ws of workspaces) {
          await recordMemoryWorkflowEvent(ctx, {
            workspaceId: ws._id,
            eventType: "style_content_batch_ready",
            sourceType: "style_content",
            sourceId: `batch:${args.userId}:${getCurrentUTCTimestamp()}`,
            payload: {
              platform: args.platform,
              sourceVersion: args.sourceVersion,
              sourceExternalUserId: args.sourceExternalUserId,
            },
            eventKey: `style-batch:${ws._id}:${args.userId}:${Math.floor(getCurrentUTCTimestamp() / 60000)}`,
          });
        }
      }
    }

    return {
      inserted: true,
      reason: "inserted" as const,
    };
  },
});

/**
 * Mark samples as processed after analysis for an active source.
 */
export const markSamplesProcessed = internalMutation({
  args: {
    userId: v.id("users"),
    platform: v.union(v.literal("twitter"), v.literal("linkedin")),
    sourceVersion: v.number(),
  },
  handler: async (ctx, args) => {
    const unprocessed = await ctx.db
      .query("styleContentSamples")
      .withIndex("by_user_platform_source_processed", (q) =>
        q
          .eq("userId", args.userId)
          .eq("platform", args.platform)
          .eq("sourceVersion", args.sourceVersion)
          .eq("processedForStyle", false)
      )
      .collect();

    for (const sample of unprocessed) {
      await ctx.db.patch(sample._id, { processedForStyle: true });
    }

    return { marked: unprocessed.length };
  },
});

async function finalizeStyleProfilePromotionOnDb(
  db: GenericDatabaseWriter<DataModel>,
  args: {
    workspaceId: Id<"workspaces">;
    userId: Id<"users">;
    platform: "twitter" | "linkedin";
    sourceVersion: number;
    promotedMemoryId: string;
    sampleCount: number;
    editDiffCount: number;
  }
) {
  if (args.platform === "twitter") {
    const xAccount = await db
      .query("xAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (
      !xAccount ||
      !isActiveStyleSource(xAccount, {
        platform: "twitter",
        sourceVersion: args.sourceVersion,
      })
    ) {
      return { workspaceFound: false as const };
    }
  } else {
    const linkedInAccount = await db
      .query("linkedinAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (
      !linkedInAccount ||
      !isActiveStyleSource(linkedInAccount, {
        platform: "linkedin",
        sourceVersion: args.sourceVersion,
      })
    ) {
      return { workspaceFound: false as const };
    }
  }

  const workspace = await db.get(args.workspaceId);
  const styleMemoryCategory = getStyleMemoryCategory(args.platform);
  const existingStyleProfile = await getWorkspaceStyleProfileRow(db, {
    workspaceId: args.workspaceId,
    platform: args.platform,
  });

  const allMemories = await listRecentAgentMemories(db, {
    userId: String(args.userId),
    limit: 200,
  });

  for (const memory of allMemories) {
    if (memory._id === args.promotedMemoryId) {
      continue;
    }

    const text = typeof memory.memory === "string" ? memory.memory : "";
    if (
      text.includes(`"category":"${styleMemoryCategory}"`) &&
      text.includes(`"workspaceId":"${String(args.workspaceId)}"`)
    ) {
      await (db as any).delete(memory._id);
    }
  }

  const unprocessedSamples = await db
    .query("styleContentSamples")
    .withIndex("by_user_platform_source_processed", (q) =>
      q
        .eq("userId", args.userId)
        .eq("platform", args.platform)
        .eq("sourceVersion", args.sourceVersion)
        .eq("processedForStyle", false)
    )
    .collect();

  for (const sample of unprocessedSamples) {
    await db.patch(sample._id, { processedForStyle: true });
  }

  if (!workspace) {
    return { workspaceFound: false as const };
  }

  const nextVersion = (existingStyleProfile?.version ?? 0) + 1;
  await upsertWorkspaceStyleProfileOnDb(db, {
    workspaceId: args.workspaceId,
    userId: args.userId,
    platform: args.platform,
    status: "ready",
    version: nextVersion,
    sourceKey: existingStyleProfile?.sourceKey,
    sourceVersion: args.sourceVersion,
    sourceExternalUserId: existingStyleProfile?.sourceExternalUserId,
    lastAnalyzedAt: getCurrentUTCTimestamp(),
    sampleCount: args.sampleCount,
    editDiffCount: args.editDiffCount,
    promotedMemoryId: args.promotedMemoryId,
    lastError: undefined,
  });

  return {
    workspaceFound: true as const,
    nextVersion,
  };
}

// Actions (backfillUserTimeline, buildStyleAnalysisPlan) are in
// styleAnalysisActions.ts ("use node") since they need Node.js runtime.

/**
 * Record a style_backfill_completed event (needs mutation context for
 * recordMemoryWorkflowEvent).
 */
export const recordStyleBackfillEvent = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    platform: v.union(v.literal("twitter"), v.literal("linkedin")),
    sourceVersion: v.number(),
    sourceExternalUserId: v.string(),
    sampleCount: v.number(),
  },
  handler: async (ctx, args) => {
    const occurredAt = getCurrentUTCTimestamp();
    await recordMemoryWorkflowEvent(ctx, {
      workspaceId: args.workspaceId,
      eventType: "style_content_backfill_completed",
      sourceType: "style_content",
      sourceId: `backfill:${args.userId}:${occurredAt}`,
      payload: {
        sampleCount: args.sampleCount,
        platform: args.platform,
        sourceVersion: args.sourceVersion,
        sourceExternalUserId: args.sourceExternalUserId,
      },
      eventKey: `style-backfill:${args.workspaceId}:${args.userId}:${occurredAt}`,
      occurredAt,
    });
  },
});

// ============================================================================
// Helper Queries/Mutations for the analysis pipeline
// ============================================================================

/**
 * Get edit diffs from processed style_edit_diff_captured events for an active
 * source.
 */
export const getEditDiffsForSource = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    platform: v.union(v.literal("twitter"), v.literal("linkedin")),
    sourceVersion: v.number(),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("memoryWorkflowEvents")
      .withIndex("by_workspace_event_type_occurred_at", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("eventType", "style_edit_diff_captured")
      )
      .order("desc")
      .take(20);

    return events
      .filter(
        (e) =>
          e.payload &&
          typeof e.payload === "object" &&
          "originalDraft" in (e.payload as Record<string, unknown>) &&
          "editedContent" in (e.payload as Record<string, unknown>)
      )
      .map((e) => {
        const payload = e.payload as {
          originalDraft: string;
          editedContent: string;
          diffSource: string;
          platform?: "twitter" | "linkedin";
          sourceVersion?: number;
        };
        if (
          payload.platform !== args.platform ||
          payload.sourceVersion !== args.sourceVersion
        ) {
          return null;
        }
        return {
          originalDraft: payload.originalDraft,
          editedContent: payload.editedContent,
          diffSource: payload.diffSource ?? "unknown",
        };
      })
      .filter(
        (
          value
        ): value is {
          originalDraft: string;
          editedContent: string;
          diffSource: string;
        } => value !== null
      );
  },
});

export const getStyleSampleCountForSource = internalQuery({
  args: {
    userId: v.id("users"),
    platform: v.union(v.literal("twitter"), v.literal("linkedin")),
    sourceVersion: v.number(),
  },
  handler: async (ctx, args) => {
    return (
      await ctx.db
        .query("styleContentSamples")
        .withIndex("by_user_platform_source_version", (q) =>
          q
            .eq("userId", args.userId)
            .eq("platform", args.platform)
            .eq("sourceVersion", args.sourceVersion)
        )
        .take(BATCH_ANALYSIS_THRESHOLD)
    ).length;
  },
});

export const resetStyleSourceData = internalMutation({
  args: {
    userId: v.id("users"),
    platform: v.union(v.literal("twitter"), v.literal("linkedin")),
    sourceVersion: v.number(),
    sourceExternalUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const workspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .collect();
    const styleMemoryCategory = getStyleMemoryCategory(args.platform);

    for (const workspace of workspaces) {
      await deleteWorkspaceAgentMemoriesByCategory(ctx.db, {
        userId: String(args.userId),
        workspaceId: String(workspace._id),
        category: styleMemoryCategory,
      });

      await upsertWorkspaceStyleProfileOnDb(ctx.db, {
        workspaceId: workspace._id,
        userId: args.userId,
        platform: args.platform,
        status: "none",
        version: 0,
        sampleCount: 0,
        editDiffCount: 0,
        promotedMemoryId: undefined,
        lastAnalyzedAt: undefined,
        sourceKey: undefined,
        sourceVersion: undefined,
        sourceExternalUserId: undefined,
        lastError: undefined,
        lastErrorAt: undefined,
      });
    }

    return {
      resetWorkspaceCount: workspaces.length,
      sourceVersion: args.sourceVersion,
      sourceExternalUserId: args.sourceExternalUserId,
    };
  },
});

export const bootstrapWorkspaceStyleProfilesForWorkspace = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await bootstrapWorkspaceStyleProfilesForWorkspaceOnDb(ctx, args);
  },
});

/**
 * Update workspace style profile status.
 */
export const updateWorkspaceStyleStatus = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    platform: v.union(v.literal("twitter"), v.literal("linkedin")),
    status: v.union(
      v.literal("none"),
      v.literal("collecting"),
      v.literal("analyzing"),
      v.literal("ready"),
      v.literal("failed")
    ),
    version: v.optional(v.number()),
    sampleCount: v.optional(v.number()),
    editDiffCount: v.optional(v.number()),
    sourceKey: v.optional(v.string()),
    sourceVersion: v.optional(v.number()),
    sourceExternalUserId: v.optional(v.string()),
    promotedMemoryId: v.optional(v.string()),
    lastError: v.optional(v.string()),
    lastErrorAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      return;
    }
    const existing = await getWorkspaceStyleProfileRow(ctx.db, {
      workspaceId: args.workspaceId,
      platform: args.platform,
    });
    await upsertWorkspaceStyleProfileOnDb(ctx.db, {
      workspaceId: args.workspaceId,
      userId: workspace.userId,
      platform: args.platform,
      status: args.status,
      version: args.version ?? existing?.version ?? 0,
      sourceKey: args.sourceKey ?? existing?.sourceKey,
      sourceVersion: args.sourceVersion ?? existing?.sourceVersion,
      sourceExternalUserId:
        args.sourceExternalUserId ?? existing?.sourceExternalUserId,
      lastAnalyzedAt:
        args.status === "ready"
          ? getCurrentUTCTimestamp()
          : existing?.lastAnalyzedAt,
      sampleCount: args.sampleCount ?? existing?.sampleCount ?? 0,
      editDiffCount: args.editDiffCount ?? existing?.editDiffCount ?? 0,
      promotedMemoryId: args.promotedMemoryId ?? existing?.promotedMemoryId,
      lastError: args.lastError,
      lastErrorAt:
        typeof args.lastError === "string" && args.lastError.trim().length > 0
          ? (args.lastErrorAt ?? getCurrentUTCTimestamp())
          : undefined,
    });
  },
});

export const resolveWorkspaceStyleAnalysisFailure = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    platform: v.union(v.literal("twitter"), v.literal("linkedin")),
    sourceKey: v.optional(v.string()),
    sourceVersion: v.number(),
    sourceExternalUserId: v.string(),
    restoreReadyProfile: v.boolean(),
    lastError: v.string(),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      return;
    }

    const existing = await getWorkspaceStyleProfileRow(ctx.db, {
      workspaceId: args.workspaceId,
      platform: args.platform,
    });
    const nextStatus =
      args.restoreReadyProfile && (existing?.version ?? 0) > 0
        ? "ready"
        : "failed";

    await upsertWorkspaceStyleProfileOnDb(ctx.db, {
      workspaceId: args.workspaceId,
      userId: workspace.userId,
      platform: args.platform,
      status: nextStatus,
      version: existing?.version ?? 0,
      sourceKey: args.sourceKey ?? existing?.sourceKey,
      sourceVersion: args.sourceVersion,
      sourceExternalUserId: args.sourceExternalUserId,
      lastAnalyzedAt: existing?.lastAnalyzedAt,
      sampleCount: existing?.sampleCount ?? 0,
      editDiffCount: existing?.editDiffCount ?? 0,
      promotedMemoryId: existing?.promotedMemoryId,
      lastError: args.lastError,
      lastErrorAt: getCurrentUTCTimestamp(),
    });
  },
});

/**
 * Update style status across all of a user's workspaces.
 */
export const updateUserWorkspaceStyleStatus = internalMutation({
  args: {
    userId: v.id("users"),
    platform: v.union(v.literal("twitter"), v.literal("linkedin")),
    status: v.union(
      v.literal("none"),
      v.literal("collecting"),
      v.literal("analyzing"),
      v.literal("ready"),
      v.literal("failed")
    ),
    sourceKey: v.optional(v.string()),
    sourceVersion: v.optional(v.number()),
    sourceExternalUserId: v.optional(v.string()),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = getCurrentUTCTimestamp();
    const workspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .collect();

    for (const workspace of workspaces) {
      const existing = await getWorkspaceStyleProfileRow(ctx.db, {
        workspaceId: workspace._id,
        platform: args.platform,
      });
      const preserveReadyProfileForCurrentSource =
        existing?.status === "ready" &&
        (args.status === "collecting" || args.status === "failed") &&
        existing.sourceVersion === args.sourceVersion &&
        existing.sourceExternalUserId === args.sourceExternalUserId;

      if (preserveReadyProfileForCurrentSource) {
        const nextLastError =
          typeof args.lastError === "string" && args.lastError.trim().length > 0
            ? args.lastError
            : undefined;
        await upsertWorkspaceStyleProfileOnDb(ctx.db, {
          workspaceId: workspace._id,
          userId: args.userId,
          platform: args.platform,
          status: "ready",
          version: existing.version,
          sourceKey: existing.sourceKey,
          sourceVersion: existing.sourceVersion,
          sourceExternalUserId: existing.sourceExternalUserId,
          lastAnalyzedAt: existing.lastAnalyzedAt,
          sampleCount: existing.sampleCount,
          editDiffCount: existing.editDiffCount,
          promotedMemoryId: existing.promotedMemoryId,
          lastError: nextLastError,
          lastErrorAt: nextLastError ? now : undefined,
        });
        continue;
      }

      const nextLastError =
        typeof args.lastError === "string" && args.lastError.trim().length > 0
          ? args.lastError
          : undefined;
      await upsertWorkspaceStyleProfileOnDb(ctx.db, {
        workspaceId: workspace._id,
        userId: args.userId,
        platform: args.platform,
        status: args.status,
        version: existing?.version ?? 0,
        sourceKey: args.sourceKey ?? existing?.sourceKey,
        sourceVersion: args.sourceVersion ?? existing?.sourceVersion,
        sourceExternalUserId:
          args.sourceExternalUserId ?? existing?.sourceExternalUserId,
        lastAnalyzedAt: existing?.lastAnalyzedAt,
        sampleCount: existing?.sampleCount ?? 0,
        editDiffCount: existing?.editDiffCount ?? 0,
        promotedMemoryId: existing?.promotedMemoryId,
        lastError: nextLastError,
        lastErrorAt: nextLastError ? now : undefined,
      });
    }
  },
});

/**
 * Recompute style status when monitoring is disabled, so active UI states do not
 * linger after disconnect. Ready profiles stay ready; in-progress states clear.
 */
export const recomputeUserWorkspaceStyleStatusAfterDisconnect =
  internalMutation({
    args: {
      userId: v.id("users"),
      platform: v.union(v.literal("twitter"), v.literal("linkedin")),
    },
    handler: async (ctx, args) => {
      const workspaces = await ctx.db
        .query("workspaces")
        .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
        .collect();

      for (const workspace of workspaces) {
        const existing = await getWorkspaceStyleProfileRow(ctx.db, {
          workspaceId: workspace._id,
          platform: args.platform,
        });
        const hasReadyProfile =
          typeof existing?.version === "number" && existing.version > 0;
        const nextStatus = hasReadyProfile ? "ready" : "none";

        if (existing?.status === nextStatus) {
          continue;
        }

        await upsertWorkspaceStyleProfileOnDb(ctx.db, {
          workspaceId: workspace._id,
          userId: args.userId,
          platform: args.platform,
          status: nextStatus,
          version: existing?.version ?? 0,
          sourceKey: existing?.sourceKey,
          sourceVersion: existing?.sourceVersion,
          sourceExternalUserId: existing?.sourceExternalUserId,
          lastAnalyzedAt: existing?.lastAnalyzedAt,
          sampleCount: existing?.sampleCount ?? 0,
          editDiffCount: existing?.editDiffCount ?? 0,
          promotedMemoryId: existing?.promotedMemoryId,
          lastError: undefined,
          lastErrorAt: undefined,
        });
      }
    },
  });

/**
 * Finalize a promoted style profile only after the new memory exists.
 */
export const finalizeStyleProfilePromotion = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    platform: v.union(v.literal("twitter"), v.literal("linkedin")),
    sourceVersion: v.number(),
    promotedMemoryId: v.string(),
    sampleCount: v.number(),
    editDiffCount: v.number(),
  },
  handler: async (ctx, args) => {
    const result = await finalizeStyleProfilePromotionOnDb(ctx.db, args);
    if (result.workspaceFound) {
      styleAnalysisLogger.info("Style profile ready", {
        workspaceId: String(args.workspaceId),
        version: result.nextVersion,
        sampleCount: args.sampleCount,
        editDiffCount: args.editDiffCount,
        promotedMemoryId: args.promotedMemoryId,
      });
    } else {
      styleAnalysisLogger.warn(
        "finalizeStyleProfilePromotion skipped because workspace was missing",
        { workspaceId: String(args.workspaceId) }
      );
    }
    await ctx.scheduler.runAfter(
      0,
      internal.outreachActions.enqueueEligibleAutoPlansForWorkspace,
      {
        workspaceId: args.workspaceId,
        userId: args.userId,
      }
    );
  },
});

export { finalizeStyleProfilePromotionOnDb };
