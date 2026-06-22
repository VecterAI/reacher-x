import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type PlanUsageCtx = QueryCtx | MutationCtx;

export type QualifiedUsageWindow = {
  cycleStart: number;
  cycleEnd: number;
};

export type QualifiedUsageEligibility = Pick<
  Doc<"prospects">,
  "origin" | "qualificationStatus" | "qualifiedAt"
>;

export function isProspectEligibleForQualifiedUsage(
  prospect: Pick<Doc<"prospects">, "origin">
) {
  return prospect.origin !== "setup_preview";
}

function countsQualifiedProspectInWindow(
  window: QualifiedUsageWindow,
  args: {
    qualified: boolean;
    qualifiedAt?: number;
    usageEligible?: boolean;
  }
) {
  return (
    args.usageEligible !== false &&
    args.qualified &&
    typeof args.qualifiedAt === "number" &&
    args.qualifiedAt >= window.cycleStart &&
    args.qualifiedAt <= window.cycleEnd
  );
}

export function shouldCountQualifiedProspectUsageInWindow(
  window: QualifiedUsageWindow,
  prospect: QualifiedUsageEligibility
) {
  return countsQualifiedProspectInWindow(window, {
    qualified: prospect.qualificationStatus === "qualified",
    qualifiedAt: prospect.qualifiedAt,
    usageEligible: isProspectEligibleForQualifiedUsage(prospect),
  });
}

export async function computeQualifiedProspectUsageForWindow(
  ctx: PlanUsageCtx,
  userId: Id<"users">,
  window: QualifiedUsageWindow
) {
  const qualifiedSummaries = await ctx.db
    .query("prospectSummaries")
    .withIndex("by_user_qualification", (q) =>
      q.eq("userId", userId).eq("qualificationStatus", "qualified")
    )
    .collect();

  let used = 0;
  for (const summary of qualifiedSummaries) {
    let qualifiedAt = summary.qualifiedAt;

    // During rollout, older summaries may still be missing qualifiedAt.
    if (qualifiedAt === undefined) {
      const prospect = await ctx.db.get(summary.prospectId);
      qualifiedAt = prospect?.qualifiedAt;
    }

    if (
      shouldCountQualifiedProspectUsageInWindow(window, {
        origin: summary.origin,
        qualificationStatus: summary.qualificationStatus,
        qualifiedAt,
      } satisfies QualifiedUsageEligibility)
    ) {
      used += 1;
    }
  }

  return used;
}

export async function readQualifiedProspectUsageForWorkspaceWindow(
  ctx: PlanUsageCtx,
  workspaceId: Id<"workspaces">,
  window: QualifiedUsageWindow
) {
  const qualifiedProspects = await ctx.db
    .query("prospects")
    .withIndex("by_workspace_qualification", (q) =>
      q.eq("workspaceId", workspaceId).eq("qualificationStatus", "qualified")
    )
    .collect();

  let used = 0;
  const timestamps: number[] = [];

  for (const prospect of qualifiedProspects) {
    if (shouldCountQualifiedProspectUsageInWindow(window, prospect)) {
      used += 1;
      timestamps.push(prospect.qualifiedAt!);
    }
  }

  return {
    used,
    timestamps,
  };
}

export async function computeQualifiedProspectUsageForWorkspaceWindow(
  ctx: PlanUsageCtx,
  workspaceId: Id<"workspaces">,
  window: QualifiedUsageWindow
) {
  const usage = await readQualifiedProspectUsageForWorkspaceWindow(
    ctx,
    workspaceId,
    window
  );
  return usage.used;
}
