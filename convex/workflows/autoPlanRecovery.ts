import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../lib/functionBuilders";
import { areAutonomousJobsPaused } from "../lib/autonomousJobHelpers";

const REQUIRED_AUTO_PLAN_PROVIDERS = ["socialapi", "exa"] as const;

type RecoveryProspect = {
  sourceRunId: Id<"autoPlanRuns">;
  prospectId: Id<"prospects">;
  workspaceId: Id<"workspaces">;
  userId: Id<"users">;
};

function getUnhealthyProviders(
  circuits: Doc<"providerCircuitStates">[]
): Array<(typeof REQUIRED_AUTO_PLAN_PROVIDERS)[number]> {
  return REQUIRED_AUTO_PLAN_PROVIDERS.filter((provider) => {
    const state = circuits.find((candidate) => candidate.provider === provider);
    return (
      !state ||
      state.status !== "closed" ||
      typeof state.lastSuccessAt !== "number" ||
      (typeof state.lastFailureAt === "number" &&
        state.lastSuccessAt < state.lastFailureAt)
    );
  });
}

async function queueRecoveryProspects(
  ctx: ActionCtx,
  prospects: RecoveryProspect[]
): Promise<{ claimed: number; queued: number; failedToQueue: number }> {
  const results = await Promise.all(
    prospects.map(async (prospect) => {
      try {
        const result = await ctx.runAction(
          internal.outreachActions.startAutoPlanGeneration,
          {
            prospectId: prospect.prospectId,
            workspaceId: prospect.workspaceId,
            userId: prospect.userId,
          }
        );
        if (result.workId) {
          return true;
        }
      } catch (error) {
        console.error("[AutoPlanRecovery] Failed to queue recovery run", {
          prospectId: String(prospect.prospectId),
          error: error instanceof Error ? error.message : String(error),
        });
      }

      await ctx.runMutation(
        internal.autoPlanRuns.releaseFailedAutoPlanRecoveryClaim,
        { runId: prospect.sourceRunId }
      );
      return false;
    })
  );
  const queued = results.filter(Boolean).length;
  return {
    claimed: prospects.length,
    queued,
    failedToQueue: prospects.length - queued,
  };
}

export const retryFailedAutoPlansAfterHealthCheck = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ claimed: number; queued: number; failedToQueue: number }> => {
    const circuits = await ctx.runQuery(
      internal.providerReliability.listProviderCircuitStatesInternal,
      {}
    );
    const unhealthyProviders = getUnhealthyProviders(
      circuits as Doc<"providerCircuitStates">[]
    );
    if (unhealthyProviders.length > 0) {
      throw new Error(
        `Automatic plan recovery requires a successful provider health check: ${unhealthyProviders.join(", ")}`
      );
    }

    const prospects: RecoveryProspect[] = await ctx.runMutation(
      internal.autoPlanRuns.claimFailedAutoPlanRecoveryBatch,
      {
        workspaceId: args.workspaceId,
        limit: Math.max(1, Math.min(args.limit ?? 100, 100)),
      }
    );
    return await queueRecoveryProspects(ctx, prospects);
  },
});

export const retryFailedAutoPlansCron = internalAction({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    skipped: boolean;
    claimed: number;
    queued: number;
    failedToQueue: number;
  }> => {
    if (areAutonomousJobsPaused()) {
      console.warn(
        "[AutoPlanRecovery] Autonomous jobs paused, skipping recovery cron"
      );
      return { skipped: true, claimed: 0, queued: 0, failedToQueue: 0 };
    }

    let circuits = (await ctx.runQuery(
      internal.providerReliability.listProviderCircuitStatesInternal,
      {}
    )) as Doc<"providerCircuitStates">[];
    const unhealthyProviders = getUnhealthyProviders(circuits);
    if (unhealthyProviders.length > 0) {
      const target = await ctx.runQuery(
        internal.autoPlanRuns.getAutoPlanRecoveryProbeTarget,
        {}
      );
      if (!target) {
        return { skipped: true, claimed: 0, queued: 0, failedToQueue: 0 };
      }
      try {
        await ctx.runAction(
          internal.autoPlanActions.probeAutoPlanProviderHealth,
          { ...target, providers: unhealthyProviders }
        );
      } catch {
        return { skipped: true, claimed: 0, queued: 0, failedToQueue: 0 };
      }
      circuits = (await ctx.runQuery(
        internal.providerReliability.listProviderCircuitStatesInternal,
        {}
      )) as Doc<"providerCircuitStates">[];
      if (getUnhealthyProviders(circuits).length > 0) {
        return { skipped: true, claimed: 0, queued: 0, failedToQueue: 0 };
      }
    }

    const prospects: RecoveryProspect[] = await ctx.runMutation(
      internal.autoPlanRuns.claimFailedAutoPlanRecoveryBatchGlobal,
      { limit: 100 }
    );
    const result = await queueRecoveryProspects(ctx, prospects);
    return { skipped: false, ...result };
  },
});
