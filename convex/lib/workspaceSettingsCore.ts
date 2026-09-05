import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  getCurrentUTCTimestamp,
  normalizeTimeZoneIdentifier,
} from "../../shared/lib/utils/time/timeUtils";
import { assertValidWorkspaceName } from "./workspaceNameHelpers";
import {
  hasAnyWorkspaceIcpSyntheticPosts,
  invalidateWorkspaceIcpGeneratedSignals,
  reconcileWorkspaceIcpUpdate,
} from "./workspaceIcpSignalsCore";
import {
  normalizeWorkspaceProfiles,
  validateWorkspaceProfiles,
  type WorkspaceProfile,
} from "./workspaceProfileChangeCore";
import type { WorkspaceUseCaseKey } from "../../shared/lib/workspaceUseCases";

type Workspace = Doc<"workspaces">;

export type WorkspaceSettingsUpdate = {
  name?: string;
  description?: string;
  seedDescription?: string;
  improvedDescription?: string;
  icps?: WorkspaceProfile[];
  useCaseKey?: WorkspaceUseCaseKey;
  sourceUrl?: string;
  descriptionSource?: "url" | "manual" | "agent";
  lastGeneratedAt?: number;
  reportingTimeZone?: string;
};

export async function applyWorkspaceSettingsUpdateCore(
  ctx: MutationCtx,
  args: {
    workspace: Workspace;
    updates: WorkspaceSettingsUpdate;
  }
): Promise<{
  workspaceId: Workspace["_id"];
  regenerationScheduledCount: number;
  appliedIcps?: WorkspaceProfile[];
}> {
  const { workspace, updates } = args;
  const now = getCurrentUTCTimestamp();
  const updateData: Record<string, unknown> = { updatedAt: now };
  let appliedIcps: WorkspaceProfile[] | undefined;
  let regenerationIndices: number[] = [];
  let restartWorkflowAfterRefresh = false;
  let stopWorkflowForRefresh = false;
  const targetingContextChanged =
    (updates.description !== undefined &&
      updates.description !== workspace.description) ||
    (updates.improvedDescription !== undefined &&
      updates.improvedDescription !== workspace.improvedDescription) ||
    (updates.useCaseKey !== undefined &&
      updates.useCaseKey !== workspace.useCaseKey);

  if (updates.name !== undefined) {
    updateData.name = assertValidWorkspaceName(updates.name);
  }
  if (updates.description !== undefined) {
    updateData.description = updates.description;
  }
  if (updates.seedDescription !== undefined) {
    updateData.seedDescription = updates.seedDescription;
  }
  if (updates.improvedDescription !== undefined) {
    updateData.improvedDescription = updates.improvedDescription;
  }
  if (updates.icps !== undefined || targetingContextChanged) {
    const normalizedProfiles =
      updates.icps === undefined
        ? (workspace.icps ?? [])
        : normalizeWorkspaceProfiles(updates.icps);
    if (updates.icps !== undefined) {
      validateWorkspaceProfiles(normalizedProfiles);
    }

    const reconciliation =
      updates.icps === undefined
        ? {
            nextIcps: normalizedProfiles,
            regenerationIndices: [] as number[],
          }
        : reconcileWorkspaceIcpUpdate({
            existingIcps: workspace.icps ?? [],
            incomingIcps: normalizedProfiles,
            markChangedProfilesManual: true,
          });
    const nextIcps = targetingContextChanged
      ? invalidateWorkspaceIcpGeneratedSignals(reconciliation.nextIcps)
      : reconciliation.nextIcps;

    updateData.icps = nextIcps;
    appliedIcps = nextIcps;
    regenerationIndices = targetingContextChanged
      ? nextIcps.map((_profile, index) => index)
      : reconciliation.regenerationIndices;

    if (regenerationIndices.length > 0) {
      updateData.onboardingIssueStatusCode = "icp_refresh_required";
      updateData.onboardingIssueSource = "system";
      updateData.onboardingIssueUpdatedAt = now;
      stopWorkflowForRefresh =
        !hasAnyWorkspaceIcpSyntheticPosts(nextIcps) &&
        workspace.prospectingWorkflowStatus === "running";
      restartWorkflowAfterRefresh = stopWorkflowForRefresh;
    } else if (
      workspace.onboardingIssueSource === "system" &&
      workspace.onboardingIssueStatusCode === "icp_refresh_required"
    ) {
      updateData.onboardingIssueStatusCode = undefined;
      updateData.onboardingIssueSource = undefined;
      updateData.onboardingIssueUpdatedAt = undefined;
    }
  }
  if (updates.useCaseKey !== undefined) {
    updateData.useCaseKey = updates.useCaseKey;
  }
  if (updates.sourceUrl !== undefined) {
    updateData.sourceUrl = updates.sourceUrl;
  }
  if (updates.descriptionSource !== undefined) {
    updateData.descriptionSource = updates.descriptionSource;
  }
  if (updates.lastGeneratedAt !== undefined) {
    updateData.lastGeneratedAt = updates.lastGeneratedAt;
  }
  if (updates.reportingTimeZone !== undefined) {
    updateData.reportingTimeZone = normalizeTimeZoneIdentifier(
      updates.reportingTimeZone
    );
  }

  if (targetingContextChanged || regenerationIndices.length > 0) {
    updateData.targetingLearningResetAt = now;
    updateData.targetingSpec = undefined;
    updateData.prospectingBootstrapCycleCount = 0;
    updateData.prospectingBootstrapCompletedAt = undefined;
  }
  await ctx.db.patch("workspaces", workspace._id, updateData);

  if (stopWorkflowForRefresh) {
    await ctx.runMutation(internal.workflows.prospecting.updateWorkflowStatus, {
      workspaceId: workspace._id,
      status: "stopped",
    });
  }

  if (regenerationIndices.length > 0) {
    await ctx.scheduler.runAfter(
      0,
      internal.workspaceIcpSignals.refreshWorkspaceIcpSignalsInternal,
      {
        workspaceId: workspace._id,
        targetIndices: regenerationIndices,
        restartWorkflow: restartWorkflowAfterRefresh,
      }
    );
  }

  return {
    workspaceId: workspace._id,
    regenerationScheduledCount: regenerationIndices.length,
    appliedIcps,
  };
}
