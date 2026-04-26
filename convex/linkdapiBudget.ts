import { v } from "convex/values";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./lib/functionBuilders";
import {
  LINKDAPI_OCC_RETRY_BASE_MS,
  LINKDAPI_OCC_RETRY_JITTER_MS,
  LINKDAPI_PROVIDER,
  LINKDAPI_REQUEST_SPACING_MS,
  LINKDAPI_TARGET_REQUESTS_PER_MINUTE,
} from "./lib/linkdapiBudget";

const internalLinkdApiBudget = (internal as any).linkdapiBudget;

export const reserveLinkdApiBudgetSlotInternal = internalMutation({
  args: {
    consumer: v.string(),
  },
  handler: async (ctx, { consumer }) => {
    const now = getCurrentUTCTimestamp();
    const existing = await ctx.db
      .query("linkdapiBudgetState")
      .withIndex("by_provider", (q) => q.eq("provider", LINKDAPI_PROVIDER))
      .first();

    const reservedAt = Math.max(now, existing?.nextAvailableAt ?? now);
    const nextAvailableAt = reservedAt + LINKDAPI_REQUEST_SPACING_MS;

    if (existing) {
      await ctx.db.patch(existing._id, {
        nextAvailableAt,
        updatedAt: now,
        lastConsumer: consumer,
      });
    } else {
      await ctx.db.insert("linkdapiBudgetState", {
        provider: LINKDAPI_PROVIDER,
        nextAvailableAt,
        updatedAt: now,
        lastConsumer: consumer,
      });
    }

    return {
      waitMs: Math.max(0, reservedAt - now),
      spacingMs: LINKDAPI_REQUEST_SPACING_MS,
      targetRequestsPerMinute: LINKDAPI_TARGET_REQUESTS_PER_MINUTE,
    };
  },
});

export const acquireLinkdApiBudgetInternal = internalAction({
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
        const reservation = await ctx.runMutation(
          internalLinkdApiBudget.reserveLinkdApiBudgetSlotInternal,
          { consumer }
        );

        if (reservation.waitMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, reservation.waitMs));
        }

        return reservation;
      } catch (error) {
        if (attempt === 11) {
          throw error;
        }

        const jitter = Math.floor(
          Math.random() * LINKDAPI_OCC_RETRY_JITTER_MS
        );
        await new Promise((resolve) =>
          setTimeout(resolve, LINKDAPI_OCC_RETRY_BASE_MS + jitter)
        );
      }
    }

    throw new Error(
      `Failed to acquire LinkdAPI budget reservation for ${consumer}`
    );
  },
});
