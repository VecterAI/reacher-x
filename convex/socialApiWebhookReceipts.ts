import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./lib/functionBuilders";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";

const WEBHOOK_RECEIPT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const WEBHOOK_RECEIPT_CLEANUP_BATCH_SIZE = 200;

function buildReceiptKey(monitorId: string, eventId: string): string {
  return `${monitorId}:${eventId}`;
}

/**
 * Claims a SocialAPI event before expensive processing. The indexed read makes
 * concurrent claims conflict, so Convex retries one and only one claim wins.
 */
export const claimInternal = internalMutation({
  args: {
    monitorId: v.string(),
    eventId: v.string(),
  },
  handler: async (ctx, args) => {
    const receiptKey = buildReceiptKey(args.monitorId, args.eventId);
    const existing = await ctx.db
      .query("socialApiWebhookReceipts")
      .withIndex("by_receipt_key", (q) => q.eq("receiptKey", receiptKey))
      .first();
    const now = getCurrentUTCTimestamp();

    if (existing && existing.expiresAt > now) {
      return { claimed: false as const };
    }
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    const receiptId = await ctx.db.insert("socialApiWebhookReceipts", {
      receiptKey,
      monitorId: args.monitorId,
      eventId: args.eventId,
      receivedAt: now,
      expiresAt: now + WEBHOOK_RECEIPT_TTL_MS,
    });
    return { claimed: true as const, receiptId };
  },
});

/**
 * Releases a claim when processing fails so a provider retry is not lost.
 */
export const releaseInternal = internalMutation({
  args: {
    receiptId: v.id("socialApiWebhookReceipts"),
  },
  handler: async (ctx, args) => {
    const receipt = await ctx.db.get(args.receiptId);
    if (receipt) {
      await ctx.db.delete(receipt._id);
    }
    return { released: Boolean(receipt) };
  },
});

export const cleanupExpiredCron = internalMutation({
  args: {},
  handler: async (
    ctx
  ): Promise<{ deleted: number; continuationScheduled: boolean }> => {
    const now = getCurrentUTCTimestamp();
    const expired = await ctx.db
      .query("socialApiWebhookReceipts")
      .withIndex("by_expires_at", (q) => q.lte("expiresAt", now))
      .take(WEBHOOK_RECEIPT_CLEANUP_BATCH_SIZE);

    for (const receipt of expired) {
      await ctx.db.delete(receipt._id);
    }

    const continuationScheduled =
      expired.length === WEBHOOK_RECEIPT_CLEANUP_BATCH_SIZE;
    if (continuationScheduled) {
      await ctx.scheduler.runAfter(
        0,
        internal.socialApiWebhookReceipts.cleanupExpiredCron,
        {}
      );
    }

    return { deleted: expired.length, continuationScheduled };
  },
});
