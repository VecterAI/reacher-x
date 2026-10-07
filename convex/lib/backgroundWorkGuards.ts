// convex/lib/backgroundWorkGuards.ts
// Execution-time gate for autonomous background work (qualification,
// enrichment evidence gathering, recovery re-claims).
//
// Dispatch-time checks alone are not enough: tenant-scheduler dispatch and
// recovery crons reach the worker actions directly, and a workspace that
// pauses, hits its plan limit, or loses its provider mid-queue must not keep
// spending AI and provider compute on work it cannot use. Every claim/dispatch
// path checks this gate at execution time and parks the work instead —
// recovery re-arms it when the block clears.
//
// This consolidates the checks that previously lived separately in
// workflows/qualification.ts and workflows/enrichment.ts:
//   - workspace automation state (paused/stopped/deleting)
//   - plan match limit for the current usage cycle
//   - provider circuit health for the prospect's platform

import { v } from "convex/values";
import { internalQuery } from "./functionBuilders";
import type { QueryCtx } from "../_generated/server";
import { isWorkspaceAutomationActive } from "./workspaceSystem";
import { checkProspectLimit } from "./prospectingHelpers";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";

export const backgroundWorkBlockReasonValidator = v.union(
  v.literal("workspace_inactive"),
  v.literal("prospect_limit_reached"),
  v.literal("provider_circuit_open")
);

function getProviderForPlatform(
  platform: "twitter" | "linkedin"
): "socialapi" | "linkdapi" {
  return platform === "twitter" ? "socialapi" : "linkdapi";
}

/**
 * Mirror of the circuit state check in
 * `providerReliability.acquireProviderCircuitPermission`: a closed circuit —
 * or an open/half-open one whose probe window has arrived — counts as
 * usable, so gating here never starves the circuit breaker's own probes.
 */
async function isProviderCircuitUsable(
  ctx: QueryCtx,
  platform: "twitter" | "linkedin"
): Promise<boolean> {
  const provider = getProviderForPlatform(platform);
  const state = await ctx.db
    .query("providerCircuitStates")
    .withIndex("by_provider", (q) => q.eq("provider", provider))
    .first();
  if (!state || state.status === "closed") {
    return true;
  }
  const now = getCurrentUTCTimestamp();
  const probeAvailable =
    state.status === "open" &&
    typeof state.retryAfterAt === "number" &&
    state.retryAfterAt <= now;
  const probeLeaseExpired =
    state.status === "half_open" &&
    typeof state.probeLeaseUntil === "number" &&
    state.probeLeaseUntil <= now;
  return probeAvailable || probeLeaseExpired;
}

/**
 * Single execution-time gate for autonomous background work. Returns every
 * reason the work is currently blocked; an empty list means go.
 */
export const checkBackgroundWorkAllowedInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    prospectId: v.optional(v.id("prospects")),
  },
  returns: v.object({
    allowed: v.boolean(),
    reasons: v.array(backgroundWorkBlockReasonValidator),
  }),
  handler: async (ctx, args) => {
    const reasons: Array<
      "workspace_inactive" | "prospect_limit_reached" | "provider_circuit_open"
    > = [];

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || !isWorkspaceAutomationActive(workspace)) {
      reasons.push("workspace_inactive");
    }

    if (workspace && reasons.length === 0) {
      const limitState = await checkProspectLimit(
        ctx,
        workspace._id,
        workspace.userId
      );
      if (limitState.limitReached) {
        reasons.push("prospect_limit_reached");
      }
    }

    if (args.prospectId) {
      const prospect = await ctx.db.get(args.prospectId);
      if (prospect && reasons.length === 0) {
        const usable = await isProviderCircuitUsable(ctx, prospect.platform);
        if (!usable) {
          reasons.push("provider_circuit_open");
        }
      }
    }

    return { allowed: reasons.length === 0, reasons };
  },
});
