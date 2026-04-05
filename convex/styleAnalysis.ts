// convex/styleAnalysis.ts
// Writing style content ingestion queries/mutations (standard Convex runtime).
// Actions (backfill, distillation) live in styleAnalysisActions.ts ("use node").

import { internalMutation, internalQuery } from "./lib/functionBuilders";
import { v } from "convex/values";
import type { GenericDatabaseWriter } from "convex/server";
import type { DataModel, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { recordMemoryWorkflowEvent } from "./lib/memoryCore";
import { listRecentAgentMemories } from "./lib/agentMemoryCore";

// ============================================================================
// Constants
// ============================================================================

/** Minimum content text length to be useful for style analysis. */
const MIN_SAMPLE_TEXT_LENGTH = 15;
/** Number of unprocessed samples before triggering re-analysis. */
export const BATCH_ANALYSIS_THRESHOLD = 5;

// ============================================================================
// Internal Queries
// ============================================================================

/**
 * Get unprocessed style content samples for a user.
 */
export const getUnprocessedSamples = internalQuery({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("styleContentSamples")
      .withIndex("by_user_unprocessed", (q) =>
        q.eq("userId", args.userId).eq("processedForStyle", false)
      )
      .take(args.limit ?? 100);
  },
});

/**
 * Count unprocessed samples for a user.
 */
export const countUnprocessedSamples = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const samples = await ctx.db
      .query("styleContentSamples")
      .withIndex("by_user_unprocessed", (q) =>
        q.eq("userId", args.userId).eq("processedForStyle", false)
      )
      .collect();
    return samples.length;
  },
});

/**
 * Get all processed samples for a user (for re-analysis with full history).
 */
export const getAllSamplesForUser = internalQuery({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("styleContentSamples")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit ?? 200);
  },
});

// ============================================================================
// Internal Mutations
// ============================================================================

/**
 * Ingest a single content sample (tweet, post, etc.) into the staging buffer.
 * Deduplicates by userId+platform+externalContentId. Triggers batch analysis
 * when threshold met.
 */
export const ingestStyleContent = internalMutation({
  args: {
    userId: v.id("users"),
    platform: v.union(v.literal("twitter"), v.literal("linkedin")),
    externalContentId: v.string(),
    fullText: v.string(),
    contentType: v.union(
      v.literal("original_post"),
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
      .withIndex("by_user_platform_external_content_id", (q) =>
        q
          .eq("userId", args.userId)
          .eq("platform", args.platform)
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
        .withIndex("by_user_unprocessed", (q) =>
          q.eq("userId", args.userId).eq("processedForStyle", false)
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
            eventType: "style_tweets_batch_ready",
            sourceType: "style_tweet",
            sourceId: `batch:${args.userId}:${getCurrentUTCTimestamp()}`,
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
 * Mark samples as processed after analysis.
 */
export const markSamplesProcessed = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const unprocessed = await ctx.db
      .query("styleContentSamples")
      .withIndex("by_user_unprocessed", (q) =>
        q.eq("userId", args.userId).eq("processedForStyle", false)
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
    promotedMemoryId: string;
    sampleCount: number;
    editDiffCount: number;
  }
) {
  const workspace = await db.get(args.workspaceId);

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
      text.includes('"category":"writing_style_profile"') &&
      text.includes(`"workspaceId":"${String(args.workspaceId)}"`)
    ) {
      await (db as any).delete(memory._id);
    }
  }

  const unprocessedSamples = await db
    .query("styleContentSamples")
    .withIndex("by_user_unprocessed", (q) =>
      q.eq("userId", args.userId).eq("processedForStyle", false)
    )
    .collect();

  for (const sample of unprocessedSamples) {
    await db.patch(sample._id, { processedForStyle: true });
  }

  if (!workspace) {
    return { workspaceFound: false as const };
  }

  const nextVersion = (workspace.styleProfileVersion ?? 0) + 1;
  await db.patch(args.workspaceId, {
    styleProfileStatus: "ready",
    styleProfileVersion: nextVersion,
    styleProfileLastAnalyzedAt: getCurrentUTCTimestamp(),
    styleProfileSampleCount: args.sampleCount,
    styleProfileEditDiffCount: args.editDiffCount,
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
    sampleCount: v.number(),
  },
  handler: async (ctx, args) => {
    const occurredAt = getCurrentUTCTimestamp();
    await recordMemoryWorkflowEvent(ctx, {
      workspaceId: args.workspaceId,
      eventType: "style_backfill_completed",
      sourceType: "style_tweet",
      sourceId: `backfill:${args.userId}:${occurredAt}`,
      payload: { sampleCount: args.sampleCount },
      eventKey: `style-backfill:${args.workspaceId}:${args.userId}:${occurredAt}`,
      occurredAt,
    });
  },
});

// ============================================================================
// Helper Queries/Mutations for the analysis pipeline
// ============================================================================

/**
 * Get edit diffs from processed style_edit_diff_captured events.
 */
export const getEditDiffsForUser = internalQuery({
  args: { workspaceId: v.id("workspaces") },
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
        };
        return {
          originalDraft: payload.originalDraft,
          editedContent: payload.editedContent,
          diffSource: payload.diffSource ?? "unknown",
        };
      });
  },
});

/**
 * Update workspace style profile status.
 */
export const updateWorkspaceStyleStatus = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.union(
      v.literal("none"),
      v.literal("collecting"),
      v.literal("analyzing"),
      v.literal("ready")
    ),
    version: v.optional(v.number()),
    sampleCount: v.optional(v.number()),
    editDiffCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {
      styleProfileStatus: args.status,
    };
    if (args.status === "ready") {
      patch.styleProfileLastAnalyzedAt = getCurrentUTCTimestamp();
    }
    if (args.version !== undefined) {
      patch.styleProfileVersion = args.version;
    }
    if (args.sampleCount !== undefined) {
      patch.styleProfileSampleCount = args.sampleCount;
    }
    if (args.editDiffCount !== undefined) {
      patch.styleProfileEditDiffCount = args.editDiffCount;
    }
    await ctx.db.patch(args.workspaceId, patch);
  },
});

/**
 * Update style status across all of a user's workspaces.
 */
export const updateUserWorkspaceStyleStatus = internalMutation({
  args: {
    userId: v.id("users"),
    status: v.union(
      v.literal("none"),
      v.literal("collecting"),
      v.literal("analyzing"),
      v.literal("ready")
    ),
  },
  handler: async (ctx, args) => {
    const workspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .collect();

    for (const workspace of workspaces) {
      if (
        args.status === "collecting" &&
        workspace.styleProfileStatus === "ready"
      ) {
        continue;
      }

      await ctx.db.patch(workspace._id, {
        styleProfileStatus: args.status,
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
    },
    handler: async (ctx, args) => {
      const workspaces = await ctx.db
        .query("workspaces")
        .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
        .collect();

      for (const workspace of workspaces) {
        const hasReadyProfile =
          typeof workspace.styleProfileVersion === "number" &&
          workspace.styleProfileVersion > 0;
        const nextStatus = hasReadyProfile ? "ready" : "none";

        if (workspace.styleProfileStatus === nextStatus) {
          continue;
        }

        await ctx.db.patch(workspace._id, {
          styleProfileStatus: nextStatus,
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
    promotedMemoryId: v.string(),
    sampleCount: v.number(),
    editDiffCount: v.number(),
  },
  handler: async (ctx, args) => {
    const result = await finalizeStyleProfilePromotionOnDb(ctx.db, args);
    if (result.workspaceFound) {
      console.info(
        `[StyleAnalysis] Style profile ready for workspace ${args.workspaceId}: version=${result.nextVersion}, samples=${args.sampleCount}, editDiffs=${args.editDiffCount}, memoryId=${args.promotedMemoryId}`
      );
    } else {
      console.warn(
        `[StyleAnalysis] finalizeStyleProfilePromotion skipped because workspace ${args.workspaceId} was missing`
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
