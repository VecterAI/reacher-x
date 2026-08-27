import { v } from "convex/values";
import { internalMutation, internalQuery } from "./lib/functionBuilders";
import {
  providerCircuitReasonValidator,
  providerNameValidator,
  providerRequestOutcomeValidator,
} from "./validators";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { hasProviderHealthEvidence } from "./lib/providerReliability";
import { getSystemRuntimeConfig } from "./lib/runtimeConfigHelpers";

export const acquireProviderCircuitPermission = internalMutation({
  args: {
    provider: providerNameValidator,
    consumer: v.string(),
    endpoint: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
    prospectId: v.optional(v.id("prospects")),
    autoPlanRunId: v.optional(v.id("autoPlanRuns")),
  },
  handler: async (ctx, args) => {
    const circuitConfig = getSystemRuntimeConfig().providers.circuit;
    const now = getCurrentUTCTimestamp();
    const state = await ctx.db
      .query("providerCircuitStates")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
      .first();

    if (!state || state.status === "closed") {
      return {
        allowed: true,
        reason: undefined,
        retryAfterAt: undefined,
      };
    }

    const probeAvailable =
      state.status === "open" &&
      typeof state.retryAfterAt === "number" &&
      state.retryAfterAt <= now;
    const probeLeaseExpired =
      state.status === "half_open" &&
      typeof state.probeLeaseUntil === "number" &&
      state.probeLeaseUntil <= now;

    if (probeAvailable || probeLeaseExpired) {
      await ctx.db.patch(state._id, {
        status: "half_open",
        probeLeaseUntil: now + circuitConfig.probeLeaseMs,
        updatedAt: now,
      });
      return {
        allowed: true,
        reason: state.reason,
        retryAfterAt: state.retryAfterAt,
      };
    }

    await ctx.db.insert("providerRequestEvents", {
      provider: args.provider,
      outcome: "blocked",
      consumer: args.consumer,
      endpoint: args.endpoint,
      workspaceId: args.workspaceId,
      prospectId: args.prospectId,
      autoPlanRunId: args.autoPlanRunId,
      requestCount: 0,
      billableUnits: 0,
      estimatedCostUsd: 0,
      errorCode: state.reason ?? "unknown",
      errorMessage: state.errorMessage,
      durationMs: 0,
      recordedAt: now,
    });

    return {
      allowed: false,
      reason: state.reason,
      retryAfterAt: state.retryAfterAt,
    };
  },
});

export const recordProviderRequestResult = internalMutation({
  args: {
    provider: providerNameValidator,
    outcome: providerRequestOutcomeValidator,
    consumer: v.string(),
    endpoint: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
    prospectId: v.optional(v.id("prospects")),
    autoPlanRunId: v.optional(v.id("autoPlanRuns")),
    requestCount: v.number(),
    billableUnits: v.number(),
    estimatedCostUsd: v.number(),
    httpStatus: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    durationMs: v.number(),
    circuitReason: v.optional(providerCircuitReasonValidator),
    circuitRetryAfterMs: v.optional(v.number()),
    healthEvidence: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const circuitConfig = getSystemRuntimeConfig().providers.circuit;
    const now = getCurrentUTCTimestamp();
    await ctx.db.insert("providerRequestEvents", {
      provider: args.provider,
      outcome: args.outcome,
      consumer: args.consumer,
      endpoint: args.endpoint,
      workspaceId: args.workspaceId,
      prospectId: args.prospectId,
      autoPlanRunId: args.autoPlanRunId,
      requestCount: args.requestCount,
      billableUnits: args.billableUnits,
      estimatedCostUsd: args.estimatedCostUsd,
      httpStatus: args.httpStatus,
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      durationMs: args.durationMs,
      recordedAt: now,
    });

    const state = await ctx.db
      .query("providerCircuitStates")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
      .first();

    if (hasProviderHealthEvidence(args.outcome, args.healthEvidence)) {
      const alreadyHealthy =
        !state ||
        (state.status === "closed" &&
          state.consecutiveFailures === 0 &&
          state.reason === undefined &&
          state.errorMessage === undefined &&
          state.openedAt === undefined &&
          state.retryAfterAt === undefined &&
          state.probeLeaseUntil === undefined);
      if (alreadyHealthy) {
        // The append-only providerRequestEvents row above is the success audit
        // trail. Avoid rewriting one provider-wide circuit row on every healthy
        // request; only recovery transitions need to mutate shared state.
        return null;
      }
      const patch = {
        status: "closed" as const,
        reason: undefined,
        errorMessage: undefined,
        consecutiveFailures: 0,
        openedAt: undefined,
        retryAfterAt: undefined,
        probeLeaseUntil: undefined,
        lastSuccessAt: now,
        updatedAt: now,
      };
      await ctx.db.patch(state._id, patch);
      return null;
    }

    if (args.outcome === "success") {
      return null;
    }

    if (args.outcome !== "error") {
      return null;
    }

    const consecutiveFailures = (state?.consecutiveFailures ?? 0) + 1;
    const reason = args.circuitReason ?? "unknown";
    const opensImmediately =
      reason === "credits" ||
      reason === "authentication" ||
      reason === "rate_limit" ||
      state?.status === "half_open";
    const shouldOpen =
      opensImmediately ||
      consecutiveFailures >= circuitConfig.transientFailuresBeforeOpen;
    const retryAfterAt = shouldOpen
      ? now + (args.circuitRetryAfterMs ?? 60 * 1_000)
      : undefined;
    const patch = {
      status: shouldOpen ? ("open" as const) : ("closed" as const),
      reason,
      errorMessage: args.errorMessage,
      consecutiveFailures,
      openedAt: shouldOpen ? (state?.openedAt ?? now) : state?.openedAt,
      retryAfterAt,
      probeLeaseUntil: undefined,
      lastFailureAt: now,
      updatedAt: now,
    };
    if (state) {
      await ctx.db.patch(state._id, patch);
    } else {
      await ctx.db.insert("providerCircuitStates", {
        provider: args.provider,
        ...patch,
      });
    }
    return null;
  },
});

export const listProviderCircuitStatesInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("providerCircuitStates").collect();
  },
});
