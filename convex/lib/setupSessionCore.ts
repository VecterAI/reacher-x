import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { formatWorkspaceDraftName } from "../../shared/lib/workspaceDisplayNames";
import { getSetupStatusStepId, type SetupVisibleStepId } from "./setupFlowCore";

type SetupSessionDoc = Doc<"workspaceSetupSessions">;
type SetupSessionDb = QueryCtx["db"] | MutationCtx["db"];
type SetupPreviewProspectWriteSession = Pick<
  SetupSessionDoc,
  "_id" | "userId" | "targetWorkspaceId" | "previewRevision" | "status"
>;
type SetupPreviewProspectIdentity = {
  origin?: "setup_preview" | "workspace_discovery" | "manual";
  setupSessionId?: Id<"workspaceSetupSessions">;
  setupRevision?: number;
  userId: Id<"users">;
  workspaceId: Id<"workspaces">;
};

const SETUP_PREVIEW_PROSPECT_WRITE_STATUSES = new Set<
  SetupSessionDoc["status"]
>([
  "discovering_preview_prospects",
  "preview_search_in_progress",
  "awaiting_preview_confirmation",
]);

export function isSetupPreviewProspectWriteStatus(
  status: SetupSessionDoc["status"]
): boolean {
  return SETUP_PREVIEW_PROSPECT_WRITE_STATUSES.has(status);
}

export const TERMINAL_SETUP_SESSION_STATUSES = new Set<
  SetupSessionDoc["status"]
>(["ready", "failed", "discarded"]);

export function isTerminalSetupSessionStatus(
  status: SetupSessionDoc["status"]
): boolean {
  return TERMINAL_SETUP_SESSION_STATUSES.has(status);
}

export function isActiveSetupSession(
  session: SetupSessionDoc | null | undefined
): session is SetupSessionDoc {
  return Boolean(session && !isTerminalSetupSessionStatus(session.status));
}

function matchesActiveSetupSessionFilter(session: SetupSessionDoc): boolean {
  if (
    isTerminalSetupSessionStatus(session.status) ||
    session.refineFromWorkspace
  ) {
    return false;
  }
  return true;
}

function compareSessionsByRecency(
  a: SetupSessionDoc,
  b: SetupSessionDoc
): number {
  return (
    (b.lastActiveAt ?? b.statusUpdatedAt) -
    (a.lastActiveAt ?? a.statusUpdatedAt)
  );
}

export function hasSetupGenerationData(
  session: Pick<SetupSessionDoc, "improvedDescription" | "generatedProfiles">
): boolean {
  return (
    typeof session.improvedDescription === "string" &&
    session.improvedDescription.trim().length > 0 &&
    Array.isArray(session.generatedProfiles) &&
    session.generatedProfiles.length > 0
  );
}

/**
 * Each profile-generation request gets a stable, monotonically increasing
 * identity so UI artifacts can remain attached to the user turn that created
 * them instead of being reused as mutable session state.
 */
export function getNextSetupGenerationRevision(
  session: Pick<SetupSessionDoc, "generationRevision">
): number {
  return (session.generationRevision ?? 0) + 1;
}

export function buildPreviewProvisioningFailurePatch(args: {
  now: number;
  errorMessage: string;
  errorCode?: string;
}) {
  return {
    status: "awaiting_icp_confirmation" as const,
    previewWorkflowId: undefined,
    previewDiscoveryStartedAt: undefined,
    previewProspectIds: undefined,
    previewReviewMode: undefined,
    previewReadyAt: undefined,
    previewApprovedAt: undefined,
    lastAgentActionAt: args.now,
    lastActiveAt: args.now,
    statusUpdatedAt: args.now,
    errorCode: args.errorCode ?? "preview_provisioning_failed",
    errorMessage: args.errorMessage,
  };
}

export function canWriteSetupPreviewProspectBatch(args: {
  session: SetupPreviewProspectWriteSession | null | undefined;
  sessionId: Id<"workspaceSetupSessions">;
  userId: Id<"users">;
  workspaceId: Id<"workspaces">;
  workspaceUserId: Id<"users">;
  previewRevision: number;
  batchSize: number;
  maxBatchSize: number;
}): boolean {
  const { session } = args;

  return Boolean(
    session &&
    session._id === args.sessionId &&
    session.userId === args.userId &&
    args.workspaceUserId === args.userId &&
    session.targetWorkspaceId === args.workspaceId &&
    session.previewRevision === args.previewRevision &&
    isSetupPreviewProspectWriteStatus(session.status) &&
    args.batchSize > 0 &&
    args.batchSize <= args.maxBatchSize
  );
}

export function isValidatedSetupPreviewProspect(args: {
  prospect: SetupPreviewProspectIdentity;
  session: SetupPreviewProspectWriteSession | null | undefined;
  workspaceUserId: Id<"users">;
  workspaceId: Id<"workspaces">;
}): boolean {
  const { prospect } = args;
  if (
    prospect.origin !== "setup_preview" ||
    !prospect.setupSessionId ||
    prospect.setupRevision === undefined ||
    prospect.workspaceId !== args.workspaceId
  ) {
    return false;
  }

  return canWriteSetupPreviewProspectBatch({
    session: args.session,
    sessionId: prospect.setupSessionId,
    userId: prospect.userId,
    workspaceId: args.workspaceId,
    workspaceUserId: args.workspaceUserId,
    previewRevision: prospect.setupRevision,
    batchSize: 1,
    maxBatchSize: 1,
  });
}

export function buildSetupPreviewCapacityResetPatch() {
  return {
    prospectingWorkflowId: undefined,
    prospectingWorkflowStatus: undefined,
    prospectingWorkflowStartedAt: undefined,
    prospectingWorkflowPauseReason: undefined,
    prospectingWorkflowPausedAt: undefined,
    prospectingFailureStreak: undefined,
    prospectingRecoveryAttemptId: undefined,
    prospectingLastFailureAt: undefined,
    prospectingNextRunAt: undefined,
    prospectingNextRecoveryAt: undefined,
    onboardingIssueStatusCode: undefined,
    onboardingIssueSource: undefined,
    onboardingIssueUpdatedAt: undefined,
  };
}

export function getSetupSessionDisplayName(session: SetupSessionDoc): string {
  return formatWorkspaceDraftName(session);
}

export function getSetupSessionPanelStep(
  status: SetupSessionDoc["status"]
): SetupVisibleStepId {
  return getSetupStatusStepId(status);
}

export async function getActiveSetupSessionForUser(
  db: SetupSessionDb,
  userId: Id<"users">
): Promise<SetupSessionDoc | null> {
  const sessions = await db
    .query("workspaceSetupSessions")
    .withIndex("by_user_last_active", (q) => q.eq("userId", userId))
    .order("desc")
    .collect();

  return (
    sessions.find((session) => matchesActiveSetupSessionFilter(session)) ?? null
  );
}

export async function getSetupSessionByThreadId(
  db: SetupSessionDb,
  setupThreadId: string
): Promise<SetupSessionDoc | null> {
  return await db
    .query("workspaceSetupSessions")
    .withIndex("by_setup_thread", (q) => q.eq("setupThreadId", setupThreadId))
    .first();
}

export async function getSetupSessionByTargetWorkspaceId(
  db: SetupSessionDb,
  targetWorkspaceId: Id<"workspaces">
): Promise<SetupSessionDoc | null> {
  const sessions = await db
    .query("workspaceSetupSessions")
    .withIndex("by_target_workspace", (q) =>
      q.eq("targetWorkspaceId", targetWorkspaceId)
    )
    .collect();

  return sessions.sort(compareSessionsByRecency)[0] ?? null;
}

export async function resolveNextSetupDraftOrdinal(
  db: SetupSessionDb,
  userId: Id<"users">
): Promise<number> {
  const sessions = await db
    .query("workspaceSetupSessions")
    .withIndex("by_user_last_active", (q) => q.eq("userId", userId))
    .collect();

  let maxOrdinal = 0;
  for (const session of sessions) {
    if (session.draftOrdinal > maxOrdinal) {
      maxOrdinal = session.draftOrdinal;
    }
  }

  return maxOrdinal + 1;
}
