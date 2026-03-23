import { v } from "convex/values";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./lib/functionBuilders";
import {
  SOCIAL_API_OCC_RETRY_BASE_MS,
  SOCIAL_API_OCC_RETRY_JITTER_MS,
  SOCIAL_API_PROVIDER,
  SOCIAL_API_REQUEST_SPACING_MS,
  SOCIAL_API_TARGET_REQUESTS_PER_MINUTE,
} from "./lib/socialApiBudget";

export const reserveSocialApiBudgetSlotInternal = internalMutation({
  args: {
    consumer: v.string(),
  },
  handler: async (ctx, { consumer }) => {
    const now = getCurrentUTCTimestamp();
    const existing = await ctx.db
      .query("socialApiBudgetState")
      .withIndex("by_provider", (q) => q.eq("provider", SOCIAL_API_PROVIDER))
      .first();

    const reservedAt = Math.max(now, existing?.nextAvailableAt ?? now);
    const nextAvailableAt = reservedAt + SOCIAL_API_REQUEST_SPACING_MS;

    if (existing) {
      await ctx.db.patch(existing._id, {
        nextAvailableAt,
        updatedAt: now,
        lastConsumer: consumer,
      });
    } else {
      await ctx.db.insert("socialApiBudgetState", {
        provider: SOCIAL_API_PROVIDER,
        nextAvailableAt,
        updatedAt: now,
        lastConsumer: consumer,
      });
    }

    return {
      waitMs: Math.max(0, reservedAt - now),
      spacingMs: SOCIAL_API_REQUEST_SPACING_MS,
      targetRequestsPerMinute: SOCIAL_API_TARGET_REQUESTS_PER_MINUTE,
    };
  },
});

export const acquireSocialApiBudgetInternal = internalAction({
  args: {
    consumer: v.string(),
  },
  handler: async (
    ctx,
    { consumer }
  ): Promise<{
    waitMs: number;
    spacingMs: number;
    targetRequestsPerMinute: number;
  }> => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      try {
        const reservation: {
          waitMs: number;
          spacingMs: number;
          targetRequestsPerMinute: number;
        } = await ctx.runMutation(
          internal.socialApiBudget.reserveSocialApiBudgetSlotInternal,
          {
            consumer,
          }
        );

        if (reservation.waitMs > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, reservation.waitMs)
          );
        }

        return reservation;
      } catch (error) {
        const isLastAttempt = attempt === 11;
        if (isLastAttempt) {
          throw error;
        }

        const jitter = Math.floor(
          Math.random() * SOCIAL_API_OCC_RETRY_JITTER_MS
        );
        await new Promise((resolve) =>
          setTimeout(resolve, SOCIAL_API_OCC_RETRY_BASE_MS + jitter)
        );
      }
    }

    throw new Error(
      `Failed to acquire SocialAPI budget reservation for ${consumer}`
    );
  },
});
