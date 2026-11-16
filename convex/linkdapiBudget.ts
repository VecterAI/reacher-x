import { v } from "convex/values";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./lib/functionBuilders";
import {
  getLinkdApiBudgetConfig,
  LINKDAPI_PROVIDER,
} from "./lib/linkdapiBudget";
import {
  currentBenchmarkCycle,
  KEYWORD_POST_SEARCH_PURPOSE,
  linkdApiPurposeValidator,
  resolveKeywordPostSearchLimit,
} from "./lib/benchmarkLinkdApiCap";

const internalLinkdApiBudget = (internal as any).linkdapiBudget;

export const reserveLinkdApiBudgetSlotInternal = internalMutation({
  args: {
    consumer: v.string(),
    // Only enrichment's keyword post search sets it; see benchmarkLinkdApiCap.
    purpose: v.optional(linkdApiPurposeValidator),
  },
  handler: async (ctx, { consumer, purpose }) => {
    const config = getLinkdApiBudgetConfig();
    const now = getCurrentUTCTimestamp();
    const existing = await ctx.db
      .query("linkdapiBudgetState")
      .withIndex("by_provider", (q) => q.eq("provider", LINKDAPI_PROVIDER))
      .first();

    // Development benchmark cap on enrichment's keyword post search; unset in
    // production, and never read for any other call.
    const limit =
      purpose === KEYWORD_POST_SEARCH_PURPOSE
        ? resolveKeywordPostSearchLimit().limit
        : null;
    let benchmarkCycle: {
      benchmarkCycleKey: string;
      benchmarkCycleCalls: number;
      benchmarkCycleRefused: number;
    } | null = null;
    if (limit !== null) {
      const cycle = await currentBenchmarkCycle(ctx);
      if (cycle) {
        const same = existing?.benchmarkCycleKey === cycle.key;
        const calls = same ? (existing?.benchmarkCycleCalls ?? 0) : 0;
        const refused = same ? (existing?.benchmarkCycleRefused ?? 0) : 0;
        if (existing && calls >= limit) {
          // Refused before any wait: the call never reaches the provider.
          await ctx.db.patch(existing._id, {
            benchmarkCycleKey: cycle.key,
            benchmarkCycleCalls: calls,
            benchmarkCycleRefused: refused + 1,
          });
          return {
            waitMs: 0,
            spacingMs: config.requestSpacingMs,
            targetRequestsPerMinute: config.targetRequestsPerMinute,
            benchmarkCapRefused: limit,
          };
        }
        benchmarkCycle = {
          benchmarkCycleKey: cycle.key,
          benchmarkCycleCalls: calls + 1,
          benchmarkCycleRefused: refused,
        };
      }
    }

    const reservedAt = Math.max(now, existing?.nextAvailableAt ?? now);
    const nextAvailableAt = reservedAt + config.requestSpacingMs;

    if (existing) {
      await ctx.db.patch(existing._id, {
        nextAvailableAt,
        updatedAt: now,
        lastConsumer: consumer,
        ...benchmarkCycle,
      });
    } else {
      await ctx.db.insert("linkdapiBudgetState", {
        provider: LINKDAPI_PROVIDER,
        nextAvailableAt,
        updatedAt: now,
        lastConsumer: consumer,
        ...benchmarkCycle,
      });
    }

    return {
      waitMs: Math.max(0, reservedAt - now),
      spacingMs: config.requestSpacingMs,
      targetRequestsPerMinute: config.targetRequestsPerMinute,
      benchmarkCapRefused: null,
    };
  },
});

export const acquireLinkdApiBudgetInternal = internalAction({
  args: {
    consumer: v.string(),
    purpose: v.optional(linkdApiPurposeValidator),
  },
  handler: async (
    ctx,
    { consumer, purpose }
  ): Promise<{
    waitMs: number;
    spacingMs: number;
    targetRequestsPerMinute: number;
    // The benchmark cap that refused this call, or null when it may proceed.
    benchmarkCapRefused: number | null;
  }> => {
    const config = getLinkdApiBudgetConfig();
    for (
      let attempt = 0;
      attempt < config.reservationMaxAttempts;
      attempt += 1
    ) {
      try {
        const reservation = await ctx.runMutation(
          internalLinkdApiBudget.reserveLinkdApiBudgetSlotInternal,
          { consumer, purpose }
        );

        if (reservation.waitMs > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, reservation.waitMs)
          );
        }

        return reservation;
      } catch (error) {
        if (attempt === config.reservationMaxAttempts - 1) {
          throw error;
        }

        const jitter = Math.floor(Math.random() * config.occRetryJitterMs);
        await new Promise((resolve) =>
          setTimeout(resolve, config.occRetryBaseMs + jitter)
        );
      }
    }

    throw new Error(
      `Failed to acquire LinkdAPI budget reservation for ${consumer}`
    );
  },
});
