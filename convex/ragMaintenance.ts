import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./lib/functionBuilders";
import { getProspectNamespace, prospectRag } from "./agents/outreach/rag";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";

const PROSPECT_CLAIM_BATCH_SIZE = 2;
const RAG_ENTRY_PAGE_SIZE = 100;
const CLAIM_LEASE_MS = 2 * 60 * 60 * 1000;
const NEXT_CLAIM_DELAY_MS = 60_000;

export const claimProspectsForLegacyCleanupInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = getCurrentUTCTimestamp();
    const staleBefore = now - CLAIM_LEASE_MS;
    const [unstarted, stale] = await Promise.all([
      ctx.db
        .query("prospects")
        .withIndex("by_rag_cleanup_state", (q) =>
          q
            .eq("ragCleanupCompletedAt", undefined)
            .eq("ragCleanupStartedAt", undefined)
        )
        .take(PROSPECT_CLAIM_BATCH_SIZE),
      ctx.db
        .query("prospects")
        .withIndex("by_rag_cleanup_state", (q) =>
          q
            .eq("ragCleanupCompletedAt", undefined)
            .gt("ragCleanupStartedAt", 0)
            .lt("ragCleanupStartedAt", staleBefore)
        )
        .take(PROSPECT_CLAIM_BATCH_SIZE),
    ]);
    const prospects = [...unstarted, ...stale].slice(
      0,
      PROSPECT_CLAIM_BATCH_SIZE
    );

    for (const prospect of prospects) {
      await ctx.db.patch(prospect._id, { ragCleanupStartedAt: now });
    }

    return prospects.map((prospect) => prospect._id);
  },
});

export const completeProspectLegacyCleanupInternal = internalMutation({
  args: {
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, args) => {
    const prospect = await ctx.db.get(args.prospectId);
    if (!prospect) {
      return { updated: false };
    }

    await ctx.db.patch(prospect._id, {
      ragCleanupCompletedAt: getCurrentUTCTimestamp(),
    });
    return { updated: true };
  },
});

export const releaseProspectLegacyCleanupInternal = internalMutation({
  args: {
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, args) => {
    const prospect = await ctx.db.get(args.prospectId);
    if (!prospect || prospect.ragCleanupCompletedAt) {
      return { updated: false };
    }

    await ctx.db.patch(prospect._id, { ragCleanupStartedAt: undefined });
    return { updated: true };
  },
});

/**
 * Deletes only legacy entries that have no stable key. Keyed entries are the
 * current canonical copies and are never touched.
 */
export const cleanupProspectLegacyEntriesInternal = internalAction({
  args: {
    prospectId: v.id("prospects"),
    cursor: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    deleted: number;
    completed: boolean;
    continuationScheduled: boolean;
  }> => {
    try {
      const namespace = await prospectRag.getNamespace(ctx, {
        namespace: getProspectNamespace(String(args.prospectId)),
      });
      if (!namespace) {
        await ctx.runMutation(
          internal.ragMaintenance.completeProspectLegacyCleanupInternal,
          { prospectId: args.prospectId }
        );
        return {
          deleted: 0,
          completed: true,
          continuationScheduled: false,
        };
      }

      const entries = await prospectRag.list(ctx, {
        namespaceId: namespace.namespaceId,
        paginationOpts: {
          cursor: args.cursor ?? null,
          numItems: RAG_ENTRY_PAGE_SIZE,
        },
      });
      const legacyEntries = entries.page.filter((entry) => !entry.key);
      for (const entry of legacyEntries) {
        await prospectRag.deleteAsync(ctx, { entryId: entry.entryId });
      }

      if (entries.isDone) {
        await ctx.runMutation(
          internal.ragMaintenance.completeProspectLegacyCleanupInternal,
          { prospectId: args.prospectId }
        );
        return {
          deleted: legacyEntries.length,
          completed: true,
          continuationScheduled: false,
        };
      }

      await ctx.scheduler.runAfter(
        0,
        internal.ragMaintenance.cleanupProspectLegacyEntriesInternal,
        {
          prospectId: args.prospectId,
          cursor: entries.continueCursor,
        }
      );
      return {
        deleted: legacyEntries.length,
        completed: false,
        continuationScheduled: true,
      };
    } catch (error) {
      await ctx.runMutation(
        internal.ragMaintenance.releaseProspectLegacyCleanupInternal,
        { prospectId: args.prospectId }
      );
      throw error;
    }
  },
});

/**
 * Claims a tiny batch and fans out cleanup work. It self-schedules while work
 * remains, so the first post-deploy cron run drains historical duplicates.
 */
export const cleanupLegacyProspectRagCron = internalAction({
  args: {},
  handler: async (
    ctx
  ): Promise<{ claimed: number; continuationScheduled: boolean }> => {
    const prospectIds = await ctx.runMutation(
      internal.ragMaintenance.claimProspectsForLegacyCleanupInternal,
      {}
    );

    for (const prospectId of prospectIds) {
      await ctx.scheduler.runAfter(
        0,
        internal.ragMaintenance.cleanupProspectLegacyEntriesInternal,
        { prospectId }
      );
    }

    const continuationScheduled =
      prospectIds.length === PROSPECT_CLAIM_BATCH_SIZE;
    if (continuationScheduled) {
      await ctx.scheduler.runAfter(
        NEXT_CLAIM_DELAY_MS,
        internal.ragMaintenance.cleanupLegacyProspectRagCron,
        {}
      );
    }

    return { claimed: prospectIds.length, continuationScheduled };
  },
});
