import { v } from "convex/values";
import {
  updateWorkspaceArgsValidator,
  updateWorkspaceSettingsArgsValidator,
  commitWorkspaceRefineArgsValidator,
  getWorkspaceArgsValidator,
  setDefaultWorkspaceArgsValidator,
  workspaceUseCaseKeyValidator,
  workspaceOnboardingIssueSourceValidator,
  workspaceOnboardingIssueStatusCodeValidator,
  icpValidator,
} from "./validators";
import {
  getCurrentUTCTimestamp,
  normalizeTimeZoneIdentifier,
  isValidTimeZoneIdentifier,
} from "../shared/lib/utils/time/timeUtils";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./lib/functionBuilders";
import {
  getDefaultWorkspaceForUser,
  getRawDefaultWorkspaceForUser,
  getOwnedWorkspace,
  getUserByIdentity,
  requireOwnedWorkspace,
  requireUser,
} from "./lib/accessHelpers";
import { assertValidWorkspaceName } from "./lib/workspaceNameHelpers";
import { hasRequiredWorkspaceAgentData } from "./lib/workspaceSetup";
import { getActiveSetupSessionForUser } from "./lib/setupSessionCore";
import {
  DEFAULT_WORKSPACE_USE_CASE_KEY,
  resolveWorkspaceUseCaseKey,
  type WorkspaceUseCaseKey,
} from "../shared/lib/workspaceUseCases";
import { QUALIFICATION_THRESHOLD } from "../shared/lib/qualificationConstants";
import { deleteWorkspaceCascade } from "./lib/deleteWorkspaceCascade";
import { decrementWorkspaceCount, getOrCreateUserPlan } from "./lib/planCore";
import { isPaidPlanTier } from "./lib/planConstants";
import type { Id } from "./_generated/dataModel";
import {
  doesSetupSessionReserveEntitlementSlot,
  doesWorkspaceReserveEntitlementSlot,
  getFirstAccessibleWorkspaceForUser,
  isWorkspaceAccessibleForUser,
  resolveNextEntitlementSlotForUser,
} from "./lib/workspaceEntitlements";
import { recordWorkspaceActivityWithDb } from "./lib/workspaceActivity";
import {
  bootstrapWorkspaceStyleProfilesForWorkspaceOnDb,
  type WorkspaceStyleBootstrapResult,
} from "./lib/workspaceStyleProfileCore";
import { isWorkspaceInactive } from "./lib/workspaceSystem";
import { INACTIVITY_PAUSE_AFTER_MS } from "../shared/lib/workspaceSystem";
import { workflow } from "./lib/workflow";
import {
  preferredShellContextValidator,
  shouldPreferWorkspaceContext,
} from "./lib/preferredShellContext";
import { logger } from "../shared/lib/logger";
import { formatQualifiedProspectLimitReachedMessage } from "./lib/prospectingHelpers";

type WorkspaceDoc = Doc<"workspaces">;
type WorkspaceStyleProfileDoc = Doc<"workspaceStyleProfiles">;
type WorkspaceAccessCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;
type WorkspaceWithResolvedUseCase = Omit<WorkspaceDoc, "useCaseKey"> & {
  useCaseKey: WorkspaceUseCaseKey;
  styleProfileStatus: WorkspaceStyleProfileDoc["status"];
  styleProfileVersion: number;
};
const workspaceLogger = logger.withScope("Workspaces");

async function scheduleBootstrapStyleBackfillsIfNeeded(
  ctx: Pick<MutationCtx, "scheduler">,
  args: {
    userId: Id<"users">;
    results: WorkspaceStyleBootstrapResult[];
  }
) {
  for (const result of args.results) {
    if (result.reason !== "insufficient_samples") {
      continue;
    }

    if (result.platform === "twitter") {
      await ctx.scheduler.runAfter(
        0,
        internal.styleAnalysisActions.backfillUserTimeline,
        {
          userId: args.userId,
        }
      );
      continue;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.styleAnalysisActions.backfillLinkedInProfilePosts,
      {
        userId: args.userId,
      }
    );
  }
}

async function getWorkspaceTwitterStyleProfile(
  ctx: WorkspaceAccessCtx,
  workspaceId: WorkspaceDoc["_id"]
) {
  return await ctx.db
    .query("workspaceStyleProfiles")
    .withIndex("by_workspace_platform", (q) =>
      q.eq("workspaceId", workspaceId).eq("platform", "twitter")
    )
    .first();
}

async function withResolvedWorkspaceUseCase(
  ctx: WorkspaceAccessCtx,
  workspace: WorkspaceDoc
): Promise<WorkspaceWithResolvedUseCase> {
  const styleProfile = await getWorkspaceTwitterStyleProfile(
    ctx,
    workspace._id
  );
  return {
    ...workspace,
    useCaseKey: resolveWorkspaceUseCaseKey(workspace.useCaseKey),
    styleProfileStatus: styleProfile?.status ?? "none",
    styleProfileVersion: styleProfile?.version ?? 0,
  };
}

function getResolvedFitScoreRange(workspace: WorkspaceDoc) {
  return {
    fitScoreMin: workspace.fitScoreMin ?? QUALIFICATION_THRESHOLD,
    fitScoreMax: workspace.fitScoreMax ?? 100,
  };
}

// ============================================================================
// Workspace Setup Status Query (for frontend)
// ============================================================================

/**
 * Gets the workspace setup status for the agent UI.
 * Used to determine which conversation flow to show.
 */
export const getWorkspaceSetupStatus = query({
  args: {
    preferredContext: preferredShellContextValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { status: "unauthenticated" as const };
    }

    const user = await getUserByIdentity(ctx, identity);
    if (!user) {
      return { status: "no_user" as const };
    }

    const [activeSession, workspace] = await Promise.all([
      getActiveSetupSessionForUser(ctx.db, user._id, {
        includeRefine: false,
      }),
      getDefaultWorkspaceForUser(ctx, user._id),
    ]);
    const preferWorkspaceContext = shouldPreferWorkspaceContext(
      args.preferredContext,
      workspace
    );

    if (activeSession && !preferWorkspaceContext) {
      const activeWorkspace =
        (activeSession.targetWorkspaceId
          ? await ctx.db.get(activeSession.targetWorkspaceId)
          : null) ?? workspace;

      return {
        status: "setup_in_progress" as const,
        session: {
          id: activeSession._id,
          threadId: activeSession.setupThreadId,
          status: activeSession.status,
        },
        workspace: activeWorkspace
          ? {
              id: activeWorkspace._id,
              name: activeWorkspace.name,
              description: activeWorkspace.description,
              hasDescription: (activeWorkspace.description ?? "").length > 0,
              useCaseKey: resolveWorkspaceUseCaseKey(
                activeWorkspace.useCaseKey
              ),
              reportingTimeZone: activeWorkspace.reportingTimeZone ?? null,
              ...getResolvedFitScoreRange(activeWorkspace),
            }
          : null,
      };
    }

    if (!workspace) {
      return { status: "no_workspace" as const };
    }

    const hasRequiredSetupData = hasRequiredWorkspaceAgentData(workspace);

    if (!hasRequiredSetupData) {
      return {
        status: "needs_icp" as const,
        workspace: {
          id: workspace._id,
          name: workspace.name,
          description: workspace.description,
          hasDescription: (workspace.description ?? "").length > 0,
          useCaseKey: resolveWorkspaceUseCaseKey(workspace.useCaseKey),
          reportingTimeZone: workspace.reportingTimeZone ?? null,
          ...getResolvedFitScoreRange(workspace),
        },
      };
    }

    return {
      status: "complete" as const,
      workspace: {
        id: workspace._id,
        name: workspace.name,
        description: workspace.description,
        useCaseKey: resolveWorkspaceUseCaseKey(workspace.useCaseKey),
        reportingTimeZone: workspace.reportingTimeZone ?? null,
        ...getResolvedFitScoreRange(workspace),
      },
    };
  },
});

/**
 * Gets the current user's default workspace
 */
export const getDefaultWorkspace = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await getUserByIdentity(ctx, identity);
    if (!user) {
      return null;
    }

    const workspace = await getDefaultWorkspaceForUser(ctx, user._id);
    return workspace
      ? await withResolvedWorkspaceUseCase(ctx, workspace)
      : null;
  },
});

/**
 * Gets all workspaces for the current user
 */
export const getUserWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await getUserByIdentity(ctx, identity);
    if (!user) {
      return [];
    }

    // Get all workspaces for the user
    const workspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    return await Promise.all(
      workspaces.map((workspace) =>
        withResolvedWorkspaceUseCase(ctx, workspace)
      )
    );
  },
});

export const getUserWorkspacesInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const workspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    return await Promise.all(
      workspaces.map((workspace) =>
        withResolvedWorkspaceUseCase(ctx, workspace)
      )
    );
  },
});

/**
 * Updates a workspace
 */
export const updateWorkspace = mutation({
  args: updateWorkspaceArgsValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to update this workspace",
    });

    // Update the workspace
    const updateData: {
      updatedAt: number;
      name?: string;
      description?: string;
      descriptionSource?: "manual" | "url";
      sourceUrl?: string;
      lastGeneratedAt?: number;
    } = {
      updatedAt: getCurrentUTCTimestamp(),
    };

    if (args.name !== undefined) {
      updateData.name = assertValidWorkspaceName(args.name);
    }

    if (args.description !== undefined)
      updateData.description = args.description;
    if (args.descriptionSource !== undefined)
      updateData.descriptionSource = args.descriptionSource;
    if (args.sourceUrl !== undefined) updateData.sourceUrl = args.sourceUrl;
    if (args.lastGeneratedAt !== undefined)
      updateData.lastGeneratedAt = args.lastGeneratedAt;

    await ctx.db.patch(args.workspaceId, updateData);
    return args.workspaceId;
  },
});

function buildRefineRollbackSnapshot(workspace: WorkspaceDoc) {
  return {
    description: workspace.description,
    seedDescription: workspace.seedDescription,
    improvedDescription: workspace.improvedDescription,
    icps: workspace.icps,
    useCaseKey: workspace.useCaseKey,
    sourceUrl: workspace.sourceUrl,
    descriptionSource: workspace.descriptionSource,
    capturedAt: getCurrentUTCTimestamp(),
  };
}

/**
 * Before applying setup preview updates to an existing workspace, capture rollback (Base/Pro).
 */
export const captureRefineRollbackSnapshotInternal = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) {
      return;
    }
    const plan = await getOrCreateUserPlan(ctx, workspace.userId);
    if (plan.tier !== "base" && plan.tier !== "pro") {
      return;
    }
    await ctx.db.patch(workspaceId, {
      refineRollbackSnapshot: buildRefineRollbackSnapshot(workspace),
    });
  },
});

/**
 * Combined workspace settings update (Workspace page: Details + Profiles).
 */
export const updateWorkspaceSettings = mutation({
  args: updateWorkspaceSettingsArgsValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    const workspace = await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to update this workspace",
    });

    if (args.icps !== undefined && args.icps.length < 3) {
      throw new Error("At least three ideal customer profiles are required.");
    }

    const now = getCurrentUTCTimestamp();
    const updateData: Record<string, unknown> = { updatedAt: now };

    if (args.name !== undefined) {
      updateData.name = assertValidWorkspaceName(args.name);
    }
    if (args.description !== undefined)
      updateData.description = args.description;
    if (args.seedDescription !== undefined)
      updateData.seedDescription = args.seedDescription;
    if (args.improvedDescription !== undefined)
      updateData.improvedDescription = args.improvedDescription;
    if (args.icps !== undefined) updateData.icps = args.icps;
    if (args.useCaseKey !== undefined) updateData.useCaseKey = args.useCaseKey;
    if (args.sourceUrl !== undefined) updateData.sourceUrl = args.sourceUrl;
    if (args.descriptionSource !== undefined)
      updateData.descriptionSource = args.descriptionSource;
    if (args.lastGeneratedAt !== undefined)
      updateData.lastGeneratedAt = args.lastGeneratedAt;
    if (args.reportingTimeZone !== undefined) {
      updateData.reportingTimeZone = normalizeTimeZoneIdentifier(
        args.reportingTimeZone
      );
    }

    await ctx.db.patch(workspace._id, updateData);
    return workspace._id;
  },
});

export const setWorkspaceReportingTimeZone = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    timeZone: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    const workspace = await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to update this workspace",
    });

    if (!isValidTimeZoneIdentifier(args.timeZone)) {
      throw new Error("Invalid reporting timezone");
    }

    const reportingTimeZone = normalizeTimeZoneIdentifier(args.timeZone);
    if (workspace.reportingTimeZone === reportingTimeZone) {
      return reportingTimeZone;
    }

    await ctx.db.patch(workspace._id, {
      reportingTimeZone,
      updatedAt: getCurrentUTCTimestamp(),
    });

    return reportingTimeZone;
  },
});

/**
 * Commit results from the Refine-audience panel: stores rollback snapshot (Base/Pro), then applies new ICPs and descriptions.
 */
export const commitWorkspaceRefine = mutation({
  args: commitWorkspaceRefineArgsValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    const workspace = await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to update this workspace",
    });

    if (args.icps.length < 3) {
      throw new Error("At least three ideal customer profiles are required.");
    }

    const plan = await getOrCreateUserPlan(ctx, user._id);
    const now = getCurrentUTCTimestamp();

    const patch: Record<string, unknown> = {
      description: args.description,
      improvedDescription: args.improvedDescription,
      icps: args.icps,
      lastGeneratedAt: now,
      updatedAt: now,
    };

    if (args.seedDescription !== undefined)
      patch.seedDescription = args.seedDescription;
    if (args.sourceUrl !== undefined) patch.sourceUrl = args.sourceUrl;
    if (args.descriptionSource !== undefined)
      patch.descriptionSource = args.descriptionSource;
    if (args.useCaseKey !== undefined) patch.useCaseKey = args.useCaseKey;

    if (plan.tier === "base" || plan.tier === "pro") {
      patch.refineRollbackSnapshot = buildRefineRollbackSnapshot(workspace);
    }

    await ctx.db.patch(workspace._id, patch);
    return workspace._id;
  },
});

/**
 * Restore workspace configuration from the last refine rollback snapshot (Base/Pro only).
 */
export const rollbackWorkspace = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    const workspace = await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to update this workspace",
    });

    const plan = await getOrCreateUserPlan(ctx, user._id);
    if (plan.tier !== "base" && plan.tier !== "pro") {
      throw new Error("Rollback is available on Base and Pro plans.");
    }

    const snap = workspace.refineRollbackSnapshot;
    if (!snap) {
      throw new Error("No rollback snapshot available.");
    }

    const now = getCurrentUTCTimestamp();
    await ctx.db.patch(workspace._id, {
      description: snap.description,
      seedDescription: snap.seedDescription,
      improvedDescription: snap.improvedDescription,
      icps: snap.icps,
      useCaseKey: snap.useCaseKey,
      sourceUrl: snap.sourceUrl,
      descriptionSource: snap.descriptionSource,
      lastGeneratedAt: now,
      updatedAt: now,
      refineRollbackSnapshot: undefined,
    });

    return workspace._id;
  },
});

/**
 * Permanently delete a workspace and all associated data. Switches default workspace when others exist.
 */
export const deleteWorkspace = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    const workspace = await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to update this workspace",
    });

    const all = await ctx.db
      .query("workspaces")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    const wasDefault = workspace.isDefault;
    const remaining = all.filter((w) => w._id !== workspace._id);

    if (remaining.length > 0 && wasDefault) {
      const next = remaining[0]!;
      await ctx.db.patch(next._id, {
        isDefault: true,
        updatedAt: getCurrentUTCTimestamp(),
      });
    }

    await deleteWorkspaceCascade(ctx, workspace._id);

    await decrementWorkspaceCount(ctx, user._id);

    return {
      wasLastWorkspace: remaining.length === 0,
      newDefaultWorkspaceId:
        remaining.length > 0 && wasDefault
          ? (remaining[0]!._id as Id<"workspaces">)
          : undefined,
    };
  },
});

/**
 * Sets the selected workspace as default for the current user.
 * This drives active workspace context across the web app.
 */
export const setDefaultWorkspace = mutation({
  args: setDefaultWorkspaceArgsValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    const targetWorkspace = await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to update this workspace",
    });
    if (!targetWorkspace.setupCompletedAt) {
      throw new Error("Workspace setup is not complete");
    }

    if (targetWorkspace.isDefault) {
      await recordWorkspaceActivityWithDb(ctx, targetWorkspace._id);
      return { workspaceId: targetWorkspace._id, switched: false };
    }

    const now = getCurrentUTCTimestamp();
    const currentDefaults = await ctx.db
      .query("workspaces")
      .withIndex("by_user_default", (q) =>
        q.eq("userId", user._id).eq("isDefault", true)
      )
      .collect();

    for (const workspace of currentDefaults) {
      if (workspace._id !== targetWorkspace._id) {
        await ctx.db.patch(workspace._id, {
          isDefault: false,
          updatedAt: now,
        });
      }
    }

    await ctx.db.patch(targetWorkspace._id, {
      isDefault: true,
      updatedAt: now,
    });
    await recordWorkspaceActivityWithDb(ctx, targetWorkspace._id, now);

    return { workspaceId: targetWorkspace._id, switched: true };
  },
});

export const recordWorkspaceActivity = mutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to update this workspace",
    });

    return await recordWorkspaceActivityWithDb(ctx, args.workspaceId);
  },
});

export const recordWorkspaceActivityInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    return await recordWorkspaceActivityWithDb(ctx, args.workspaceId);
  },
});

export const listInactiveRunningWorkspacesInternal = internalQuery({
  args: {
    cutoff: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspaces")
      .withIndex("by_prospecting_status_last_activity", (q) =>
        q
          .eq("prospectingWorkflowStatus", "running")
          .gt("lastMeaningfulActivityAt", undefined)
          .lt("lastMeaningfulActivityAt", args.cutoff)
      )
      .collect();
  },
});

export const pauseInactiveWorkspaces = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = getCurrentUTCTimestamp();
    const cutoff = now - INACTIVITY_PAUSE_AFTER_MS;
    const candidates = await ctx.runQuery(
      internal.workspaces.listInactiveRunningWorkspacesInternal,
      { cutoff }
    );

    let pausedCount = 0;

    for (const workspace of candidates) {
      if (workspace.prospectingWorkflowStatus !== "running") {
        continue;
      }

      if (workspace.prospectingWorkflowId) {
        try {
          await workflow.cancel(ctx, workspace.prospectingWorkflowId as any);
        } catch (error) {
          workspaceLogger.warn(
            "Failed to cancel inactive workspace workflow",
            { workspaceId: String(workspace._id) },
            error
          );
        }
      }

      await ctx.runMutation(
        internal.workflows.prospecting.updateWorkflowStatus,
        {
          workspaceId: workspace._id,
          status: "paused",
          pauseReason: "inactive",
          pausedAt: now,
        }
      );
      pausedCount += 1;
    }

    return { pausedCount };
  },
});

export const reconcileWorkspaceCapacityStateInternal = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    if (!workspace) {
      return { ok: false as const, reason: "workspace_not_found" };
    }

    const limitState = await ctx.runQuery(
      internal.workflows.prospecting.checkProspectLimitInternal,
      {
        workspaceId: args.workspaceId,
      }
    );
    const capacityBlocked = limitState.limitReached;
    const paidPlanActive = isPaidPlanTier(limitState.tier);

    if (capacityBlocked) {
      if (workspace.prospectingWorkflowStatus === "running") {
        if (workspace.prospectingWorkflowId) {
          try {
            await workflow.cancel(ctx, workspace.prospectingWorkflowId as any);
          } catch (error) {
            workspaceLogger.warn(
              "Failed to cancel prospecting workflow during capacity reconcile",
              { workspaceId: String(workspace._id) },
              error
            );
          }
        }

        await ctx.runMutation(
          internal.workflows.prospecting.updateWorkflowStatus,
          {
            workspaceId: args.workspaceId,
            status: "limit_reached",
          }
        );
      } else if (workspace.prospectingWorkflowStatus !== "limit_reached") {
        await ctx.runMutation(
          internal.workflows.prospecting.updateWorkflowStatus,
          {
            workspaceId: args.workspaceId,
            status: "limit_reached",
          }
        );
      }

      await ctx.runMutation(
        internal.socialapiMonitors.pauseWorkspaceMonitorsInternal,
        {
          workspaceId: args.workspaceId,
        }
      );

      const prospects = await ctx.runQuery(
        internal.prospects.listWorkspaceCapacityCandidatesInternal,
        {
          workspaceId: args.workspaceId,
        }
      );

      for (const prospect of prospects) {
        const isPendingQualification =
          prospect.qualificationStatus !== "qualified" &&
          prospect.qualificationStatus !== "disqualified";
        const needsEnrichment =
          prospect.status !== "archived" &&
          prospect.qualificationStatus === "qualified" &&
          prospect.enrichmentStatus !== "enriched";

        if (isPendingQualification && prospect.qualificationWorkflowId) {
          try {
            await workflow.cancel(ctx, prospect.qualificationWorkflowId as any);
          } catch (error) {
            workspaceLogger.warn(
              "Failed to cancel qualification workflow during capacity reconcile",
              {
                prospectId: String(prospect._id),
                workspaceId: String(args.workspaceId),
              },
              error
            );
          }
          await ctx.runMutation(
            internal.prospects.clearQualificationWorkflowId,
            {
              prospectId: prospect._id,
            }
          );
        }

        if (
          paidPlanActive &&
          needsEnrichment &&
          !prospect.enrichmentWorkflowId
        ) {
          await ctx.runAction(internal.workflows.enrichment.startEnrichment, {
            prospectId: prospect._id,
            workspaceId: args.workspaceId,
          });
        }
      }

      await ctx.runMutation(
        internal.workspaces.clearOnboardingIssueStateForSourceInternal,
        {
          workspaceId: args.workspaceId,
          source: "workflow",
        }
      );
      await ctx.runMutation(
        internal.workspaces.clearProspectingRecoveryStateInternal,
        {
          workspaceId: args.workspaceId,
        }
      );

      return {
        ok: true as const,
        capacityBlocked: true,
        pausedWorkflowStatus: "limit_reached" as const,
      };
    }

    await ctx.runMutation(
      internal.socialapiMonitors.resumeWorkspaceMonitorsInternal,
      {
        workspaceId: args.workspaceId,
      }
    );

    if (
      workspace.prospectingWorkflowStatus === "limit_reached" &&
      hasRequiredWorkspaceAgentData(workspace)
    ) {
      await ctx.runAction(
        internal.workspaces.startProspectingWorkflowInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
    }

    const prospects = await ctx.runQuery(
      internal.prospects.listWorkspaceCapacityRestartCandidatesInternal,
      {
        workspaceId: args.workspaceId,
      }
    );

    for (const prospect of prospects) {
      if (
        prospect.qualificationStatus !== "qualified" &&
        prospect.qualificationStatus !== "disqualified"
      ) {
        await ctx.runAction(
          internal.workflows.qualification.startQualification,
          {
            prospectId: prospect._id,
            workspaceId: args.workspaceId,
          }
        );
        continue;
      }

      if (
        prospect.qualificationStatus === "qualified" &&
        prospect.enrichmentStatus !== "enriched"
      ) {
        await ctx.runAction(internal.workflows.enrichment.startEnrichment, {
          prospectId: prospect._id,
          workspaceId: args.workspaceId,
        });
      }
    }

    if (workspace.userId) {
      await ctx
        .runAction(
          internal.outreachActions.enqueueEligibleAutoPlansForWorkspace,
          {
            workspaceId: args.workspaceId,
            userId: workspace.userId,
          }
        )
        .catch((error) => {
          workspaceLogger.warn(
            "Failed to enqueue auto plans after capacity resume",
            { workspaceId: String(args.workspaceId) },
            error
          );
        });
    }

    return { ok: true as const, capacityBlocked: false };
  },
});

/**
 * Ensures a user has a default workspace assignment without creating a new one.
 * This is only for recovering users with existing workspaces but no default flag.
 */
export const ensureDefaultWorkspace = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    const existingDefault = await getDefaultWorkspaceForUser(ctx, user._id);

    if (existingDefault) {
      return existingDefault._id;
    }

    // If user has workspaces but none marked default, recover by promoting one.
    const existingWorkspace = await ctx.db
      .query("workspaces")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .first();

    if (existingWorkspace) {
      await ctx.db.patch(existingWorkspace._id, {
        isDefault: true,
        updatedAt: getCurrentUTCTimestamp(),
      });
      return existingWorkspace._id;
    }

    return null;
  },
});

/**
 * One-time, idempotent rollout backfill for legacy workspaces created before
 * `useCaseKey` was persisted. Existing rows keep their current template.
 */
export const backfillWorkspaceUseCases = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    const workspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    let updated = 0;
    let alreadyPersisted = 0;

    for (const workspace of workspaces) {
      if (workspace.useCaseKey !== undefined) {
        alreadyPersisted += 1;
        continue;
      }

      await ctx.db.patch(workspace._id, {
        useCaseKey: DEFAULT_WORKSPACE_USE_CASE_KEY,
        updatedAt: getCurrentUTCTimestamp(),
      });
      updated += 1;
    }

    return {
      scanned: workspaces.length,
      updated,
      alreadyPersisted,
      persistedUseCaseKey: DEFAULT_WORKSPACE_USE_CASE_KEY,
    };
  },
});

/**
 * Gets a specific workspace by ID
 */
export const getWorkspace = query({
  args: getWorkspaceArgsValidator,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await getUserByIdentity(ctx, identity);
    if (!user) {
      return null;
    }

    const workspace = await getOwnedWorkspace(ctx, args.workspaceId, user._id);
    return workspace
      ? await withResolvedWorkspaceUseCase(ctx, workspace)
      : null;
  },
});

// ============================================================================
// Agent-specific mutations (Internal - no auth check)
// ============================================================================

/**
 * Internal query to get workspace by ID (for agent actions).
 * No auth check - used by trusted server-side code.
 */
export const getById = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    return workspace
      ? await withResolvedWorkspaceUseCase(ctx, workspace)
      : null;
  },
});

/**
 * Internal query to get default workspace by user ID (for createWorkspace tool).
 * Used to check if we should update existing or create new.
 */
export const getDefaultWorkspaceByUserId = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_user_default", (q) =>
        q.eq("userId", args.userId).eq("isDefault", true)
      )
      .first();
    return workspace
      ? await withResolvedWorkspaceUseCase(ctx, workspace)
      : null;
  },
});

/**
 * Internal query to get workspace by ID (alias for socialapiMonitors).
 * Returns workspace with userId for creating monitors.
 */
export const getWorkspaceInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    return workspace
      ? await withResolvedWorkspaceUseCase(ctx, workspace)
      : null;
  },
});

/**
 * Internal query to get default workspace for a user.
 * Used by getUserStatus tool.
 */
export const getDefaultWorkspaceInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_user_default", (q) =>
        q.eq("userId", args.userId).eq("isDefault", true)
      )
      .first();
    return workspace
      ? await withResolvedWorkspaceUseCase(ctx, workspace)
      : null;
  },
});

/**
 * Internal query to get the user's accessible default workspace.
 * Safe for actions, which must cross into a query instead of reading `ctx.db`
 * directly.
 */
export const getAccessibleDefaultWorkspaceInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const workspace = await getDefaultWorkspaceForUser(ctx, args.userId);
    return workspace
      ? await withResolvedWorkspaceUseCase(ctx, workspace)
      : null;
  },
});

async function reconcileWorkspaceEntitlementsForUser(
  ctx: MutationCtx,
  userId: Id<"users">
) {
  const workspaces = await ctx.db
    .query("workspaces")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .collect();
  const sessions = await ctx.db
    .query("workspaceSetupSessions")
    .withIndex("by_user_last_active", (q) => q.eq("userId", userId))
    .collect();
  const now = getCurrentUTCTimestamp();

  const reservingWorkspaces = workspaces
    .filter(doesWorkspaceReserveEntitlementSlot)
    .sort((a, b) => a._creationTime - b._creationTime);
  let nextEntitlementSlot = 1;

  for (const workspace of reservingWorkspaces) {
    const entitlementSlot = nextEntitlementSlot;
    nextEntitlementSlot += 1;
    if (workspace.entitlementSlot === entitlementSlot) {
      continue;
    }
    await ctx.db.patch(workspace._id, {
      entitlementSlot,
      updatedAt: now,
    });
  }

  const reservingSetupSessions = sessions
    .filter(doesSetupSessionReserveEntitlementSlot)
    .sort((a, b) => a._creationTime - b._creationTime);

  for (const session of reservingSetupSessions) {
    const entitlementSlot = nextEntitlementSlot;
    nextEntitlementSlot += 1;
    if (session.entitlementSlot !== entitlementSlot) {
      await ctx.db.patch(session._id, {
        entitlementSlot,
        lastActiveAt: session.lastActiveAt ?? now,
      });
    }
    if (session.targetWorkspaceId && !session.existingWorkspaceId) {
      const provisionedWorkspace = await ctx.db.get(session.targetWorkspaceId);
      if (
        provisionedWorkspace &&
        provisionedWorkspace.userId === userId &&
        !provisionedWorkspace.setupCompletedAt &&
        provisionedWorkspace.entitlementSlot !== entitlementSlot
      ) {
        await ctx.db.patch(provisionedWorkspace._id, {
          entitlementSlot,
          updatedAt: now,
        });
      }
    }
  }

  const rawDefaultWorkspace = await getRawDefaultWorkspaceForUser(ctx, userId);
  const accessibleDefaultWorkspace = await getDefaultWorkspaceForUser(
    ctx,
    userId
  );

  if (
    rawDefaultWorkspace &&
    !(await isWorkspaceAccessibleForUser(ctx, rawDefaultWorkspace))
  ) {
    await ctx.db.patch(rawDefaultWorkspace._id, {
      isDefault: false,
      updatedAt: now,
    });
    if (
      accessibleDefaultWorkspace &&
      accessibleDefaultWorkspace._id !== rawDefaultWorkspace._id
    ) {
      await ctx.db.patch(accessibleDefaultWorkspace._id, {
        isDefault: true,
        updatedAt: now,
      });
    }
  } else if (!rawDefaultWorkspace) {
    const fallbackWorkspace = await getFirstAccessibleWorkspaceForUser(
      ctx,
      userId
    );
    if (fallbackWorkspace) {
      await ctx.db.patch(fallbackWorkspace._id, {
        isDefault: true,
        updatedAt: now,
      });
    }
  }
}

export const reconcileWorkspaceEntitlementsForUserInternal = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await reconcileWorkspaceEntitlementsForUser(ctx, args.userId);
  },
});

export const cleanupDiscardedSetupProvisionalWorkspacesForUserInternal =
  internalMutation({
    args: {
      userId: v.id("users"),
      cursor: v.optional(v.string()),
      batchSize: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
      const batchSize = Math.max(1, Math.min(25, args.batchSize ?? 10));
      const page = await ctx.db
        .query("workspaceSetupSessions")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", args.userId).eq("status", "discarded")
        )
        .paginate({
          cursor: args.cursor ?? null,
          numItems: batchSize,
        });

      for (const session of page.page) {
        if (session.mode !== "new_workspace" || !session.targetWorkspaceId) {
          continue;
        }
        if (session.existingWorkspaceId) {
          continue;
        }

        const workspace = await ctx.db.get(session.targetWorkspaceId);
        if (
          !workspace ||
          workspace.userId !== args.userId ||
          workspace.setupCompletedAt
        ) {
          continue;
        }

        await deleteWorkspaceCascade(ctx, workspace._id);
        await reconcileWorkspaceEntitlementsForUser(ctx, args.userId);

        if (!page.isDone) {
          await ctx.scheduler.runAfter(
            0,
            internal.workspaces
              .cleanupDiscardedSetupProvisionalWorkspacesForUserInternal,
            {
              userId: args.userId,
              cursor: page.continueCursor,
              batchSize,
            }
          );
        }

        return {
          deletedCount: 1,
          scheduled: !page.isDone,
        };
      }

      await reconcileWorkspaceEntitlementsForUser(ctx, args.userId);

      if (!page.isDone) {
        await ctx.scheduler.runAfter(
          0,
          internal.workspaces
            .cleanupDiscardedSetupProvisionalWorkspacesForUserInternal,
          {
            userId: args.userId,
            cursor: page.continueCursor,
            batchSize,
          }
        );
      }

      return {
        deletedCount: 0,
        scheduled: !page.isDone,
      };
    },
  });

/**
 * Persist an internal onboarding issue state on a workspace.
 * This is used for reliable, user-safe issue messaging.
 */
export const setOnboardingIssueStateInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    statusCode: workspaceOnboardingIssueStatusCodeValidator,
    source: workspaceOnboardingIssueSourceValidator,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workspaceId, {
      onboardingIssueStatusCode: args.statusCode,
      onboardingIssueSource: args.source,
      onboardingIssueUpdatedAt: getCurrentUTCTimestamp(),
    });
  },
});

/**
 * Clear internal onboarding issue state once setup recovers.
 */
export const clearOnboardingIssueStateInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workspaceId, {
      onboardingIssueStatusCode: undefined,
      onboardingIssueSource: undefined,
      onboardingIssueUpdatedAt: undefined,
    });
  },
});

export const clearOnboardingIssueStateForSourceInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    source: workspaceOnboardingIssueSourceValidator,
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.onboardingIssueSource !== args.source) {
      return { cleared: false as const };
    }

    await ctx.db.patch(args.workspaceId, {
      onboardingIssueStatusCode: undefined,
      onboardingIssueSource: undefined,
      onboardingIssueUpdatedAt: undefined,
    });

    return { cleared: true as const };
  },
});

export const clearProspectingRecoveryStateInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workspaceId, {
      prospectingFailureStreak: undefined,
      prospectingNextRecoveryAt: undefined,
    });
  },
});

/**
 * Persist setup thread linkage for a workspace so onboarding can restore context.
 */
export const setOnboardingThreadInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workspaceId, {
      onboardingThreadId: args.threadId,
      updatedAt: getCurrentUTCTimestamp(),
    });
  },
});

/**
 * Internal mutation to create a workspace with v4 fields.
 * Used by createWorkspace tool.
 */
export const createWorkspaceInternal = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    description: v.string(),
    seedDescription: v.string(),
    improvedDescription: v.string(),
    icps: v.array(icpValidator),
    sourceUrl: v.optional(v.string()),
    descriptionSource: v.union(v.literal("url"), v.literal("manual")),
    useCaseKey: v.optional(workspaceUseCaseKeyValidator),
    isDefault: v.boolean(),
    entitlementSlot: v.optional(v.number()),
    consumeReservedEntitlementSlot: v.optional(v.number()),
    consumingSetupSessionId: v.optional(v.id("workspaceSetupSessions")),
    fitScoreMin: v.optional(v.number()),
    fitScoreMax: v.optional(v.number()),
    setupCompletedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const normalizedName = assertValidWorkspaceName(args.name);

    const eligibility = await ctx.runQuery(
      internal.plans.getWorkspaceCreationEligibilityByUserId,
      {
        userId: args.userId,
        consumeEntitlementSlot: args.consumeReservedEntitlementSlot,
        excludeSetupSessionId: args.consumingSetupSessionId,
      }
    );
    if (!eligibility.allowed) {
      throw new Error(eligibility.reason ?? "Workspace limit reached");
    }

    const now = getCurrentUTCTimestamp();
    const entitlementSlot =
      args.entitlementSlot ??
      (await resolveNextEntitlementSlotForUser(ctx, args.userId));

    // If setting as default, unset any existing default
    if (args.isDefault) {
      const existingDefault = await ctx.db
        .query("workspaces")
        .withIndex("by_user_default", (q) =>
          q.eq("userId", args.userId).eq("isDefault", true)
        )
        .first();

      if (existingDefault) {
        await ctx.db.patch(existingDefault._id, { isDefault: false });
      }
    }

    // Create new workspace with v4 fields
    const workspaceId = await ctx.db.insert("workspaces", {
      userId: args.userId,
      name: normalizedName,
      description: args.description,
      seedDescription: args.seedDescription,
      improvedDescription: args.improvedDescription,
      icps: args.icps,
      descriptionSource: args.descriptionSource,
      sourceUrl: args.sourceUrl,
      useCaseKey: args.useCaseKey,
      lastGeneratedAt: now,
      setupCompletedAt: args.setupCompletedAt,
      fitScoreMin: args.fitScoreMin ?? QUALIFICATION_THRESHOLD,
      fitScoreMax: args.fitScoreMax ?? 100,
      isDefault: args.isDefault,
      entitlementSlot,
      updatedAt: now,
    });

    try {
      const bootstrapResults =
        await bootstrapWorkspaceStyleProfilesForWorkspaceOnDb(ctx, {
          workspaceId,
          userId: args.userId,
        });
      await scheduleBootstrapStyleBackfillsIfNeeded(ctx, {
        userId: args.userId,
        results: bootstrapResults,
      });
    } catch (error) {
      workspaceLogger.warn(
        "Failed to bootstrap style profiles for new workspace",
        { workspaceId: String(workspaceId), userId: String(args.userId) },
        error
      );
    }

    return workspaceId;
  },
});

/**
 * Internal mutation to update a workspace with v4 fields.
 * Used by updateWorkspace tool.
 */
export const updateWorkspaceInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    seedDescription: v.optional(v.string()),
    improvedDescription: v.string(),
    description: v.string(),
    icps: v.array(icpValidator),
    sourceUrl: v.optional(v.string()),
    descriptionSource: v.optional(
      v.union(v.literal("url"), v.literal("manual"), v.literal("agent"))
    ),
    useCaseKey: v.optional(workspaceUseCaseKeyValidator),
    setupCompletedAt: v.optional(v.number()),
    isDefault: v.optional(v.boolean()),
    fitScoreMin: v.optional(v.number()),
    fitScoreMax: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = getCurrentUTCTimestamp();

    const updateData: Record<string, unknown> = {
      description: args.description,
      improvedDescription: args.improvedDescription,
      icps: args.icps,
      lastGeneratedAt: now,
      updatedAt: now,
    };

    if (args.seedDescription !== undefined) {
      updateData.seedDescription = args.seedDescription;
    }
    if (args.sourceUrl !== undefined) {
      updateData.sourceUrl = args.sourceUrl;
    }
    if (args.descriptionSource !== undefined) {
      updateData.descriptionSource = args.descriptionSource;
    }
    if (args.useCaseKey !== undefined) {
      updateData.useCaseKey = args.useCaseKey;
    }
    if (args.setupCompletedAt !== undefined) {
      updateData.setupCompletedAt = args.setupCompletedAt;
    }
    if (args.isDefault === true) {
      const workspace = await ctx.db.get(args.workspaceId);
      if (!workspace) {
        throw new Error("Workspace not found");
      }
      const currentDefaults = await ctx.db
        .query("workspaces")
        .withIndex("by_user_default", (q) =>
          q.eq("userId", workspace.userId).eq("isDefault", true)
        )
        .collect();

      for (const currentDefault of currentDefaults) {
        if (currentDefault._id !== args.workspaceId) {
          await ctx.db.patch(currentDefault._id, {
            isDefault: false,
            updatedAt: now,
          });
        }
      }

      updateData.isDefault = true;
    }
    if (args.fitScoreMin !== undefined) {
      updateData.fitScoreMin = args.fitScoreMin;
    }
    if (args.fitScoreMax !== undefined) {
      updateData.fitScoreMax = args.fitScoreMax;
    }

    await ctx.db.patch(args.workspaceId, updateData);
  },
});

// ============================================================================
// Prospecting Workflow Management
// ============================================================================

type StartProspectingWorkflowOutcome =
  | "started"
  | "rearmed_running_workflow"
  | "limit_reached";

type RecoverProspectingWorkflowOutcome =
  | "restarted"
  | "rearmed_running_workflow"
  | "workspace_not_found"
  | "stale_recovery"
  | "status_changed"
  | "issue_cleared"
  | "inactive_paused"
  | "setup_incomplete"
  | "limit_reached";

/**
 * Start the continuous prospecting workflow for a workspace.
 * Called automatically after workspace setup or manually by user.
 */
export const startProspectingWorkflow = action({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    outcome: StartProspectingWorkflowOutcome;
    error?: string;
    workflowId?: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.runQuery(internal.users.getUserByWorkosIdInternal, {
      workosUserId: identity.subject,
    });
    if (!user) {
      throw new Error("User not found");
    }

    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    if (!workspace || workspace.userId !== user._id) {
      throw new Error("Workspace not found");
    }

    const hasRequiredSetupData = hasRequiredWorkspaceAgentData(workspace);
    if (!hasRequiredSetupData) {
      throw new Error("Workspace setup is incomplete");
    }
    const limitState = await ctx.runQuery(
      internal.workflows.prospecting.checkProspectLimitInternal,
      {
        workspaceId: args.workspaceId,
      }
    );
    if (limitState.limitReached) {
      await ctx.runAction(
        internal.workspaces.reconcileWorkspaceCapacityStateInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
      return {
        success: false,
        outcome: "limit_reached",
        error: formatQualifiedProspectLimitReachedMessage({
          currentCount: limitState.currentCount,
          limit: limitState.limit,
        }),
      };
    }
    const now = getCurrentUTCTimestamp();

    // Check if workflow is already running
    if (workspace.prospectingWorkflowStatus === "running") {
      await ctx.runMutation(
        internal.socialapiMonitors.resumeWorkspaceMonitorsInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
      await ctx.runMutation(
        internal.workspaces.clearOnboardingIssueStateInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
      await ctx.runMutation(
        internal.workspaces.clearProspectingRecoveryStateInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
      return {
        success: true,
        outcome: "rearmed_running_workflow",
        workflowId: workspace.prospectingWorkflowId ?? undefined,
      };
    }

    // Start the workflow with onComplete handler for continuous operation
    const workflowId = await workflow.start(
      ctx,
      internal.workflows.prospecting.prospectingWorkflow,
      { workspaceId: args.workspaceId },
      {
        onComplete: internal.workflows.prospecting.handleWorkflowComplete,
        context: { workspaceId: args.workspaceId },
      }
    );

    // Update workspace with workflow ID and status
    await ctx.runMutation(internal.workflows.prospecting.updateWorkflowStatus, {
      workspaceId: args.workspaceId,
      status: "running",
      workflowId: workflowId.toString(),
      lastMeaningfulActivityAt: now,
    });
    await ctx.runMutation(
      internal.workspaces.clearOnboardingIssueStateInternal,
      {
        workspaceId: args.workspaceId,
      }
    );
    await ctx.runMutation(
      internal.socialapiMonitors.resumeWorkspaceMonitorsInternal,
      {
        workspaceId: args.workspaceId,
      }
    );
    await ctx.runMutation(
      internal.workspaces.clearProspectingRecoveryStateInternal,
      {
        workspaceId: args.workspaceId,
      }
    );

    return {
      success: true,
      outcome: "started",
      workflowId: workflowId.toString(),
    };
  },
});

/**
 * Internal action to start workflow (for use by agent tools).
 */
export const startProspectingWorkflowInternal = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    outcome: StartProspectingWorkflowOutcome;
    error?: string;
    workflowId?: string;
  }> => {
    // Get workspace to verify it exists and is ready
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const hasRequiredSetupData = hasRequiredWorkspaceAgentData(workspace);
    if (!hasRequiredSetupData) {
      throw new Error("Workspace setup is incomplete");
    }
    const limitState = await ctx.runQuery(
      internal.workflows.prospecting.checkProspectLimitInternal,
      {
        workspaceId: args.workspaceId,
      }
    );
    if (limitState.limitReached) {
      await ctx.runAction(
        internal.workspaces.reconcileWorkspaceCapacityStateInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
      return {
        success: false,
        outcome: "limit_reached",
        error: formatQualifiedProspectLimitReachedMessage({
          currentCount: limitState.currentCount,
          limit: limitState.limit,
        }),
      };
    }
    const now = getCurrentUTCTimestamp();

    // Check if workflow is already running
    if (workspace.prospectingWorkflowStatus === "running") {
      await ctx.runMutation(
        internal.socialapiMonitors.resumeWorkspaceMonitorsInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
      await ctx.runMutation(
        internal.workspaces.clearOnboardingIssueStateInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
      await ctx.runMutation(
        internal.workspaces.clearProspectingRecoveryStateInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
      return {
        success: true,
        outcome: "rearmed_running_workflow",
        workflowId: workspace.prospectingWorkflowId ?? undefined,
      };
    }

    // Start the workflow with onComplete handler for continuous operation
    const workflowId = await workflow.start(
      ctx,
      internal.workflows.prospecting.prospectingWorkflow,
      { workspaceId: args.workspaceId },
      {
        onComplete: internal.workflows.prospecting.handleWorkflowComplete,
        context: { workspaceId: args.workspaceId },
      }
    );

    // Update workspace with workflow ID and status
    await ctx.runMutation(internal.workflows.prospecting.updateWorkflowStatus, {
      workspaceId: args.workspaceId,
      status: "running",
      workflowId: workflowId.toString(),
      lastMeaningfulActivityAt: now,
    });
    await ctx.runMutation(
      internal.workspaces.clearOnboardingIssueStateInternal,
      {
        workspaceId: args.workspaceId,
      }
    );
    await ctx.runMutation(
      internal.socialapiMonitors.resumeWorkspaceMonitorsInternal,
      {
        workspaceId: args.workspaceId,
      }
    );
    await ctx.runMutation(
      internal.workspaces.clearProspectingRecoveryStateInternal,
      {
        workspaceId: args.workspaceId,
      }
    );

    return {
      success: true,
      outcome: "started",
      workflowId: workflowId.toString(),
    };
  },
});

export const restartProspectingWorkflowForSetupInternal = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; workflowId?: string; error?: string }> => {
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    if (!workspace) {
      throw new Error("Workspace not found");
    }
    const now = getCurrentUTCTimestamp();

    const hasRequiredSetupData = hasRequiredWorkspaceAgentData(workspace);
    if (!hasRequiredSetupData) {
      throw new Error("Workspace setup is incomplete");
    }
    const limitState = await ctx.runQuery(
      internal.workflows.prospecting.checkProspectLimitInternal,
      {
        workspaceId: args.workspaceId,
      }
    );
    if (limitState.limitReached) {
      await ctx.runAction(
        internal.workspaces.reconcileWorkspaceCapacityStateInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
      return {
        success: false,
        error: formatQualifiedProspectLimitReachedMessage({
          currentCount: limitState.currentCount,
          limit: limitState.limit,
        }),
      };
    }

    if (workspace.prospectingWorkflowId) {
      try {
        await workflow.cancel(ctx, workspace.prospectingWorkflowId as any);
      } catch (error) {
        workspaceLogger.warn(
          "Failed to cancel prior prospecting workflow during restart",
          { workspaceId: String(args.workspaceId) },
          error
        );
      }
    }

    await ctx.runMutation(internal.workflows.prospecting.updateWorkflowStatus, {
      workspaceId: args.workspaceId,
      status: "stopped",
    });

    const workflowId = await workflow.start(
      ctx,
      internal.workflows.prospecting.prospectingWorkflow,
      { workspaceId: args.workspaceId },
      {
        onComplete: internal.workflows.prospecting.handleWorkflowComplete,
        context: { workspaceId: args.workspaceId },
      }
    );

    await ctx.runMutation(internal.workflows.prospecting.updateWorkflowStatus, {
      workspaceId: args.workspaceId,
      status: "running",
      workflowId: workflowId.toString(),
      lastMeaningfulActivityAt: now,
    });
    await ctx.runMutation(
      internal.workspaces.clearOnboardingIssueStateInternal,
      {
        workspaceId: args.workspaceId,
      }
    );
    await ctx.runMutation(
      internal.socialapiMonitors.resumeWorkspaceMonitorsInternal,
      {
        workspaceId: args.workspaceId,
      }
    );
    await ctx.runMutation(
      internal.workspaces.clearProspectingRecoveryStateInternal,
      {
        workspaceId: args.workspaceId,
      }
    );

    return {
      success: true,
      workflowId: workflowId.toString(),
    };
  },
});

/**
 * Retry a failed prospecting workflow after cooldown.
 * Only restarts true workflow failures, never manual pauses/stops.
 */
export const attemptProspectingWorkflowRecoveryInternal = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    recoveryAttemptId: v.number(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    outcome: RecoverProspectingWorkflowOutcome;
    error?: string;
    workflowId?: string;
  }> => {
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    if (!workspace) {
      return {
        success: false,
        outcome: "workspace_not_found",
      };
    }

    if (workspace.prospectingRecoveryAttemptId !== args.recoveryAttemptId) {
      return {
        success: false,
        outcome: "stale_recovery",
      };
    }

    if (
      workspace.onboardingIssueSource !== "workflow" ||
      workspace.onboardingIssueStatusCode !== "workflow_failed"
    ) {
      return {
        success: false,
        outcome: "issue_cleared",
      };
    }

    if (workspace.prospectingWorkflowStatus !== "stopped") {
      return {
        success: false,
        outcome: "status_changed",
      };
    }

    if (isWorkspaceInactive(workspace)) {
      await ctx.runMutation(
        internal.workflows.prospecting.updateWorkflowStatus,
        {
          workspaceId: args.workspaceId,
          status: "paused",
          pauseReason: "inactive",
        }
      );
      await ctx.runMutation(
        internal.workspaces.clearOnboardingIssueStateForSourceInternal,
        {
          workspaceId: args.workspaceId,
          source: "workflow",
        }
      );
      await ctx.runMutation(
        internal.workspaces.clearProspectingRecoveryStateInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
      return {
        success: false,
        outcome: "inactive_paused",
      };
    }

    if (!hasRequiredWorkspaceAgentData(workspace)) {
      await ctx.runMutation(
        internal.workspaces.setOnboardingIssueStateInternal,
        {
          workspaceId: args.workspaceId,
          statusCode: "setup_incomplete",
          source: "setup",
        }
      );
      await ctx.runMutation(
        internal.workspaces.clearProspectingRecoveryStateInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
      return {
        success: false,
        outcome: "setup_incomplete",
      };
    }

    const result = await ctx.runAction(
      internal.workspaces.startProspectingWorkflowInternal,
      {
        workspaceId: args.workspaceId,
      }
    );

    if (result.success) {
      return {
        success: true,
        outcome:
          result.outcome === "started"
            ? "restarted"
            : "rearmed_running_workflow",
        workflowId: result.workflowId,
      };
    }

    if (result.outcome === "limit_reached") {
      await ctx.runMutation(
        internal.workspaces.clearOnboardingIssueStateForSourceInternal,
        {
          workspaceId: args.workspaceId,
          source: "workflow",
        }
      );
      await ctx.runMutation(
        internal.workspaces.clearProspectingRecoveryStateInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
      return {
        success: false,
        outcome: "limit_reached",
        error: result.error,
      };
    }

    return {
      success: false,
      outcome: "status_changed",
      error: result.error,
    };
  },
});

/**
 * Stop the continuous prospecting workflow for a workspace.
 */
export const stopProspectingWorkflow = action({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.runQuery(internal.users.getUserByWorkosIdInternal, {
      workosUserId: identity.subject,
    });
    if (!user) {
      throw new Error("User not found");
    }

    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    if (!workspace || workspace.userId !== user._id) {
      throw new Error("Workspace not found");
    }

    const pausedMonitors = await ctx.runMutation(
      internal.socialapiMonitors.pauseWorkspaceMonitorsInternal,
      {
        workspaceId: args.workspaceId,
      }
    );

    if (
      !workspace.prospectingWorkflowId &&
      pausedMonitors.pausedCount === 0 &&
      workspace.prospectingWorkflowStatus !== "running"
    ) {
      return {
        success: false,
        error: "No active △ Agent activity found",
      };
    }

    // Cancel the workflow
    if (workspace.prospectingWorkflowId) {
      try {
        await workflow.cancel(ctx, workspace.prospectingWorkflowId as any);
      } catch (err) {
        workspaceLogger.error(
          "Failed to cancel workflow",
          { workspaceId: String(args.workspaceId) },
          err
        );
        // Continue to update status even if cancel fails
      }
    }

    // Update workspace status
    await ctx.runMutation(internal.workflows.prospecting.updateWorkflowStatus, {
      workspaceId: args.workspaceId,
      status: "paused",
      pauseReason: "manual",
    });
    await ctx.runMutation(
      internal.workspaces.clearOnboardingIssueStateForSourceInternal,
      {
        workspaceId: args.workspaceId,
        source: "workflow",
      }
    );
    await ctx.runMutation(
      internal.workspaces.clearProspectingRecoveryStateInternal,
      {
        workspaceId: args.workspaceId,
      }
    );

    return {
      success: true,
    };
  },
});

/**
 * Get the prospecting workflow status for a workspace.
 */
export const getProspectingWorkflowStatus = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await getUserByIdentity(ctx, identity);
    if (!user) {
      return null;
    }

    const workspace = await getOwnedWorkspace(ctx, args.workspaceId, user._id);
    if (!workspace) {
      return null;
    }

    return {
      workflowId: workspace.prospectingWorkflowId,
      status: workspace.prospectingWorkflowStatus || "stopped",
      startedAt: workspace.prospectingWorkflowStartedAt,
    };
  },
});
