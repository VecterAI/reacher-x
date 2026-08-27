import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./lib/functionBuilders";
import { workflow as workflowManager } from "./lib/workflow";
import type { WorkflowId, WorkflowStatus } from "@convex-dev/workflow";
import { createThread, saveMessage } from "@convex-dev/agent";
import { v } from "convex/values";
import { logger } from "../shared/lib/logger";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import {
  getDefaultWorkspaceForUser,
  getUserByIdentity,
  requireUser,
} from "./lib/accessHelpers";
import { hasRequiredWorkspaceAgentData } from "./lib/workspaceSetup";
import {
  buildPreviewProvisioningFailurePatch,
  buildSetupPreviewCapacityResetPatch,
  getActiveSetupSessionForUser,
  getSetupSessionByTargetWorkspaceId,
  getSetupSessionByThreadId,
  getSetupSessionDisplayName,
  getNextSetupGenerationRevision,
  getSetupWorkflowRecoveryDecision,
  hasSetupGenerationData,
  isSetupPreviewProspectWriteStatus,
  isTerminalSetupSessionStatus,
  resolveNextSetupDraftOrdinal,
  SETUP_WORKFLOW_MACHINE_PROGRESS_STATUSES,
  SETUP_WORKFLOW_STALE_AFTER_MS,
} from "./lib/setupSessionCore";
import {
  isSetupSessionAccessibleForUser,
  resolveNextEntitlementSlotForUser,
} from "./lib/workspaceEntitlements";
import { getSetupWorkflowEventName } from "./lib/setupWorkflowEvents";
import { buildAdditionalWorkspaceSetupPrompt } from "./agents/prompts";
import { persistRawModelResponse } from "./lib/modelTelemetry";
import {
  icpValidator,
  planTierValidator,
  setupInputModeValidator,
  setupPreviewReviewModeValidator,
  setupSessionModeValidator,
  workspaceUseCaseKeyValidator,
} from "./validators";
import {
  getWorkspaceUseCase,
  resolveWorkspaceUseCaseKey,
  type WorkspaceUseCaseKey,
} from "../shared/lib/workspaceUseCases";
import { formatWorkspaceName } from "../shared/lib/workspaceDisplayNames";
import {
  buildSetupFlowState,
  getVisibleSetupStatus,
  getNextSetupStatusAfterConnections,
  getNextSetupStatusAfterProvisioning,
  requiresSetupConnectionsStep,
  type SetupInputPhase,
  type SetupVisibleStep,
  type SetupVisibleStepId,
} from "./lib/setupFlowCore";
import { PREVIEW_BATCH_LIMITS } from "./lib/previewBatchLimits";
import { isProspectReadyQualifiedEnriched } from "./lib/readModelHelpers";
import { isPaidPlanTier } from "./lib/planConstants";
import { upsertNotificationByKey } from "./lib/notificationHelpers";
import { deleteWorkspaceCascade } from "./lib/deleteWorkspaceCascade";
import {
  generateInitialSetupDraft,
  generateSetupProfileRevision,
} from "./lib/setupGenerationCore";
import { analyzeSetupUrl } from "./lib/setupUrlAnalysisCore";
import {
  listWorkspaceIcpSignalMissingIndices,
  reconcileWorkspaceIcpUpdate,
} from "./lib/workspaceIcpSignalsCore";
import {
  markWorkspaceProfilesAsAiGenerated,
  normalizeWorkspaceProfiles,
  validateWorkspaceProfiles,
} from "./lib/workspaceProfileChangeCore";
import {
  haveSamePreviewProspectIds,
  resolveSetupPreviewReviewSnapshot,
  selectInitialSetupPreviewReviewSnapshot,
  type SetupPreviewReviewMode,
  type SetupPreviewReviewSnapshot,
} from "./lib/setupPreviewCore";
import {
  isStoredXConnectionReadyForSetup,
  toStoredXConnectionStatus,
} from "./lib/xConnectionStateCore";

type SetupSessionDoc = Doc<"workspaceSetupSessions">;
const setupSessionsLogger = logger.withScope("SetupSessions");
type ViewerCtx = QueryCtx | MutationCtx;

async function startSetupWorkflow(
  ctx: MutationCtx,
  session: SetupSessionDoc,
  recovery?: { reason: string; now: number }
): Promise<string> {
  const workflowId: Awaited<ReturnType<typeof workflowManager.start>> =
    await workflowManager.start(
      ctx,
      internal.workflows.setup.setupSessionWorkflow,
      { sessionId: session._id },
      { startAsync: true }
    );
  const patch = recovery
    ? {
        workflowId: String(workflowId),
        workflowRecoveryRevision: (session.workflowRecoveryRevision ?? 0) + 1,
        workflowRecoveryAttempts: (session.workflowRecoveryAttempts ?? 0) + 1,
        workflowLastRecoveryAt: recovery.now,
        workflowRecoveryReason: recovery.reason,
        lastActiveAt: recovery.now,
      }
    : {
        workflowId: String(workflowId),
        lastActiveAt: getCurrentUTCTimestamp(),
      };
  await ctx.db.patch("workspaceSetupSessions", session._id, patch);
  return String(workflowId);
}

type SetupPreviewProgressState = {
  discoveredCount: number;
  qualifiedCount: number;
  enrichedCount: number;
  selectedCount: number;
};

type SetupPreviewOrchestrationState = {
  readyCount: number;
  discoveredCandidateCount: number;
  qualifiedCount: number;
  pendingQualificationCount: number;
  inFlightEnrichmentCount: number;
  rankedQualifiedIds: Id<"prospects">[];
  rankedReadyIds: Id<"prospects">[];
  rankedPreviewIds: Id<"prospects">[];
};

const PREVIEW_TARGET_COUNT = PREVIEW_BATCH_LIMITS.readyTargetCount;

type SetupSessionPublicState = {
  sessionId: Id<"workspaceSetupSessions">;
  status: SetupSessionDoc["status"];
  mode: SetupSessionDoc["mode"];
  useCaseKey: WorkspaceUseCaseKey;
  displayName: string;
  draftName: string | null;
  threadId: string;
  panelStep: SetupVisibleStepId;
  currentStepId: SetupVisibleStepId;
  currentStepNumber: number;
  totalSteps: number;
  visibleSteps: SetupVisibleStep[];
  inputPhase: SetupInputPhase | null;
  composerLocked: boolean;
  requiresConnections: boolean;
  requiresPlan: boolean;
  googleConnected: boolean;
  googleEmail: string | null;
  xConnected: boolean;
  inputMode: "url" | "manual" | null;
  sourceUrl: string | null;
  seedDescription: string | null;
  improvedDescription: string | null;
  generationRevision: number;
  generationSourceMessageId: string | null;
  generatedProfiles: NonNullable<SetupSessionDoc["generatedProfiles"]>;
  preferenceChoice: SetupSessionDoc["preferenceChoice"] | null;
  planChoice: SetupSessionDoc["planChoice"] | null;
  targetWorkspaceId: Id<"workspaces"> | null;
  existingWorkspaceId: Id<"workspaces"> | null;
  previewProspectIds: Id<"prospects">[];
  previewDiscoveryStartedAt: number | null;
  previewReadyAt: number | null;
  previewApprovedAt: number | null;
  previewProgress: SetupPreviewProgressState;
  hasGeneration: boolean;
  statusUpdatedAt: number;
  errorMessage: string | null;
};

async function listSetupPreviewProspects(
  db: ViewerCtx["db"],
  session: Pick<
    SetupSessionDoc,
    | "_id"
    | "targetWorkspaceId"
    | "previewDiscoveryStartedAt"
    | "previewRevision"
  >
): Promise<Array<Doc<"prospects">>> {
  if (!session.targetWorkspaceId) {
    return [];
  }

  if (typeof session.previewRevision === "number") {
    return await db
      .query("prospects")
      .withIndex("by_setup_session_revision", (q) =>
        q
          .eq("setupSessionId", session._id)
          .eq("setupRevision", session.previewRevision!)
      )
      .collect();
  }

  if (!session.previewDiscoveryStartedAt) {
    return [];
  }

  return await db
    .query("prospects")
    .withIndex("by_workspace", (q) =>
      q.eq("workspaceId", session.targetWorkspaceId!)
    )
    .collect()
    .then((prospects) =>
      prospects.filter(
        (prospect) =>
          prospect._creationTime >= session.previewDiscoveryStartedAt!
      )
    );
}

function buildPreviewProgressState(
  selectedCount: number,
  prospects: Array<
    Pick<Doc<"prospects">, "qualificationStatus" | "enrichmentStatus">
  >
): SetupPreviewProgressState {
  let qualifiedCount = 0;
  let enrichedCount = 0;

  for (const prospect of prospects) {
    if (prospect.qualificationStatus === "qualified") {
      qualifiedCount += 1;
    }
    if (isProspectReadyQualifiedEnriched(prospect)) {
      enrichedCount += 1;
    }
  }

  return {
    discoveredCount: prospects.length,
    qualifiedCount,
    enrichedCount,
    selectedCount,
  };
}

function isSelectableSetupPreviewCandidate(
  prospect: Pick<Doc<"prospects">, "status" | "qualificationStatus">
) {
  return (
    prospect.status !== "archived" &&
    prospect.qualificationStatus !== "disqualified"
  );
}

function mergeRankedPreviewCandidateGroups(
  groups: Array<Array<Doc<"prospects">>>
): Array<Doc<"prospects">> {
  const seen = new Set<string>();
  const merged: Array<Doc<"prospects">> = [];

  for (const group of groups) {
    for (const prospect of group) {
      const key = String(prospect._id);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(prospect);
    }
  }

  return merged;
}

function buildSetupPreviewOrchestrationState(
  prospects: Array<Doc<"prospects">>
): SetupPreviewOrchestrationState {
  const activeProspects = prospects.filter(
    (prospect) => prospect.status !== "archived"
  );
  const selectableProspects = activeProspects.filter(
    isSelectableSetupPreviewCandidate
  );
  const rankedQualifiedProspects = sortPreviewCandidates(
    selectableProspects.filter(
      (prospect) => prospect.qualificationStatus === "qualified"
    )
  );
  const rankedReadyProspects = sortPreviewCandidates(
    rankedQualifiedProspects.filter((prospect) =>
      isProspectReadyQualifiedEnriched(prospect)
    )
  );
  const rankedDiscoveredProspects = sortPreviewCandidates(selectableProspects);
  const rankedPreviewProspects = mergeRankedPreviewCandidateGroups([
    rankedReadyProspects,
    rankedQualifiedProspects,
    rankedDiscoveredProspects,
  ]);

  let pendingQualificationCount = 0;
  let inFlightEnrichmentCount = 0;

  for (const prospect of activeProspects) {
    if (
      prospect.qualificationStatus !== "qualified" &&
      prospect.qualificationStatus !== "disqualified"
    ) {
      pendingQualificationCount += 1;
    }

    if (
      prospect.qualificationStatus === "qualified" &&
      !isProspectReadyQualifiedEnriched(prospect) &&
      typeof prospect.enrichmentWorkflowId === "string"
    ) {
      inFlightEnrichmentCount += 1;
    }
  }

  return {
    readyCount: rankedReadyProspects.length,
    discoveredCandidateCount: rankedPreviewProspects.length,
    qualifiedCount: rankedQualifiedProspects.length,
    pendingQualificationCount,
    inFlightEnrichmentCount,
    rankedQualifiedIds: rankedQualifiedProspects.map(
      (prospect) => prospect._id
    ),
    rankedReadyIds: rankedReadyProspects.map((prospect) => prospect._id),
    rankedPreviewIds: rankedPreviewProspects.map((prospect) => prospect._id),
  };
}

function sortPreviewCandidates(
  prospects: Array<Doc<"prospects">>
): Array<Doc<"prospects">> {
  return [...prospects].sort((a, b) => {
    const scoreDelta =
      (b.qualificationScore ?? 0) - (a.qualificationScore ?? 0);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
    return (b.updatedAt ?? b._creationTime) - (a.updatedAt ?? a._creationTime);
  });
}

function getResolvedSetupPreviewReviewSnapshot(
  session: Pick<
    SetupSessionDoc,
    "previewProspectIds" | "previewReviewMode" | "status"
  >,
  prospects: Array<Doc<"prospects">>
): SetupPreviewReviewSnapshot | null {
  const orchestrationState = buildSetupPreviewOrchestrationState(prospects);
  return resolveSetupPreviewReviewSnapshot({
    currentPreviewProspectIds:
      session.status === "awaiting_preview_confirmation"
        ? session.previewProspectIds
        : undefined,
    currentPreviewReviewMode:
      session.status === "awaiting_preview_confirmation"
        ? normalizeSetupPreviewReviewMode(session.previewReviewMode)
        : undefined,
    rankedQualifiedIds: orchestrationState.rankedQualifiedIds,
    rankedPreviewIds: orchestrationState.rankedPreviewIds,
    limit: PREVIEW_TARGET_COUNT,
  });
}

function normalizeSetupPreviewReviewMode(
  value: unknown
): SetupPreviewReviewMode | undefined {
  if (value === "fallback" || value === "qualified") {
    return value;
  }

  return undefined;
}

function resolveSetupPreviewCandidateIds(
  session: Pick<
    SetupSessionDoc,
    "previewProspectIds" | "previewReviewMode" | "status"
  >,
  prospects: Array<Doc<"prospects">>
): Id<"prospects">[] {
  return (
    getResolvedSetupPreviewReviewSnapshot(session, prospects)
      ?.previewProspectIds ?? []
  );
}

async function getSetupPreviewCandidateIds(
  db: ViewerCtx["db"],
  session: SetupSessionDoc
) {
  if (session.previewProspectIds?.length) {
    return session.previewProspectIds;
  }

  const prospects = await listSetupPreviewProspects(db, session);
  return resolveSetupPreviewCandidateIds(session, prospects);
}

async function markPreviewReady(
  ctx: MutationCtx,
  session: SetupSessionDoc,
  previewSnapshot: SetupPreviewReviewSnapshot
) {
  const now = getCurrentUTCTimestamp();
  const readyAt = session.previewReadyAt ?? now;
  const selectedPreviewProspectIds = previewSnapshot.previewProspectIds.slice(
    0,
    PREVIEW_TARGET_COUNT
  );
  const isFirstReady =
    session.status !== "awaiting_preview_confirmation" ||
    !session.previewReadyAt;
  await ctx.db.patch(session._id, {
    status: "awaiting_preview_confirmation",
    previewProspectIds: selectedPreviewProspectIds,
    previewReviewMode: previewSnapshot.previewReviewMode,
    previewReadyAt: readyAt,
    statusUpdatedAt: now,
    lastAgentActionAt: now,
    lastActiveAt: now,
    errorCode: undefined,
    errorMessage: undefined,
  });

  if (
    isFirstReady &&
    session.targetWorkspaceId &&
    selectedPreviewProspectIds.length > 0
  ) {
    await upsertNotificationByKey(ctx, {
      userId: session.userId,
      workspaceId: session.targetWorkspaceId,
      type: "setup_preview_ready",
      title: "Preview profiles are ready",
      message:
        selectedPreviewProspectIds.length === 1
          ? "We found 1 preview profile. Review it and continue setup."
          : `We found ${selectedPreviewProspectIds.length} preview profiles. Review them and continue setup.`,
      targetHref: `/agent/setup?threadId=${encodeURIComponent(session.setupThreadId)}`,
      notificationKey: `setup-preview-ready:${session._id}:${session.previewRevision ?? 0}`,
      threadId: session.setupThreadId,
    });
  }

  await maybeSignalStateChanged(ctx, {
    ...session,
    status: "awaiting_preview_confirmation",
    previewProspectIds: selectedPreviewProspectIds,
    previewReviewMode: previewSnapshot.previewReviewMode,
    previewReadyAt: readyAt,
    statusUpdatedAt: now,
    lastAgentActionAt: now,
    lastActiveAt: now,
    errorCode: undefined,
    errorMessage: undefined,
  });
}

async function updatePreviewReviewSnapshot(
  ctx: MutationCtx,
  session: SetupSessionDoc,
  previewSnapshot: SetupPreviewReviewSnapshot
) {
  const now = getCurrentUTCTimestamp();
  await ctx.db.patch(session._id, {
    previewProspectIds: previewSnapshot.previewProspectIds,
    previewReviewMode: previewSnapshot.previewReviewMode,
    lastAgentActionAt: now,
    lastActiveAt: now,
  });
}

async function getSetupConnectionState(
  db: ViewerCtx["db"],
  userId: Id<"users">
) {
  const storedXAccount = await db
    .query("xAccounts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  const xStatus = toStoredXConnectionStatus(storedXAccount);

  return {
    xConnected: isStoredXConnectionReadyForSetup(xStatus),
    xStatus,
  };
}

async function getUserPlanTier(db: ViewerCtx["db"], userId: Id<"users">) {
  const plan = await db
    .query("userPlans")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return plan?.tier ?? "free";
}

async function toPublicSetupSessionState(
  ctx: ViewerCtx,
  session: SetupSessionDoc,
  user?: Doc<"users">
): Promise<SetupSessionPublicState> {
  const [previewRows, planTier, connectionState] = await Promise.all([
    listSetupPreviewProspects(ctx.db, session),
    getUserPlanTier(ctx.db, session.userId),
    getSetupConnectionState(ctx.db, session.userId),
  ]);
  const googleEmail = user?.email ?? null;
  const googleConnected = Boolean(googleEmail);
  const requiresConnections = requiresSetupConnectionsStep({
    status: session.status,
    googleConnected,
    xConnected: connectionState.xConnected,
  });
  const visibleStatus = getVisibleSetupStatus({
    status: session.status,
    requiresConnections,
    connectionsCompletedAt: session.connectionsCompletedAt ?? null,
  });
  const flowState = buildSetupFlowState({
    status: visibleStatus,
    requiresConnections,
    requiresPlan: !isPaidPlanTier(planTier),
  });
  const previewCandidateIds = resolveSetupPreviewCandidateIds(
    session,
    previewRows
  );

  return {
    sessionId: session._id,
    status: session.status,
    mode: session.mode,
    useCaseKey: resolveWorkspaceUseCaseKey(session.useCaseKey),
    displayName: getSetupSessionDisplayName(session),
    draftName: session.draftName ?? null,
    threadId: session.setupThreadId,
    panelStep: flowState.currentStepId,
    currentStepId: flowState.currentStepId,
    currentStepNumber: flowState.currentStepNumber,
    totalSteps: flowState.totalSteps,
    visibleSteps: flowState.visibleSteps,
    inputPhase: flowState.inputPhase,
    composerLocked: flowState.composerLocked,
    requiresConnections: flowState.requiresConnections,
    requiresPlan: flowState.requiresPlan,
    googleConnected,
    googleEmail,
    xConnected: connectionState.xConnected,
    inputMode:
      session.inputMode ??
      (session.sourceUrl ? "url" : session.seedDescription ? "manual" : null),
    sourceUrl: session.sourceUrl ?? null,
    seedDescription: session.seedDescription ?? null,
    improvedDescription: session.improvedDescription ?? null,
    generationRevision: session.generationRevision ?? 0,
    generationSourceMessageId: session.generationSourceMessageId ?? null,
    generatedProfiles: session.generatedProfiles ?? [],
    preferenceChoice: session.preferenceChoice ?? null,
    planChoice: session.planChoice ?? null,
    targetWorkspaceId: session.targetWorkspaceId ?? null,
    existingWorkspaceId: session.existingWorkspaceId ?? null,
    previewProspectIds: previewCandidateIds,
    previewDiscoveryStartedAt: session.previewDiscoveryStartedAt ?? null,
    previewReadyAt: session.previewReadyAt ?? null,
    previewApprovedAt: session.previewApprovedAt ?? null,
    previewProgress: buildPreviewProgressState(
      previewCandidateIds.length,
      previewRows
    ),
    hasGeneration: hasSetupGenerationData(session),
    statusUpdatedAt: session.statusUpdatedAt,
    errorMessage: session.errorMessage ?? null,
  };
}

async function requireViewerUser(ctx: ViewerCtx) {
  return requireUser(ctx, { notFoundMessage: "User not found" });
}

async function requireOwnedSetupSession(
  ctx: ViewerCtx,
  sessionId: Id<"workspaceSetupSessions">,
  userId: Id<"users">
) {
  const session = await ctx.db.get(sessionId);
  if (!session) {
    throw new Error("Setup session not found");
  }
  if (session.userId !== userId) {
    throw new Error("Not authorized");
  }
  if (!(await isSetupSessionAccessibleForUser(ctx, session))) {
    throw new Error("Setup session not found");
  }
  return session;
}

async function getOwnedSetupSessionByThreadId(
  ctx: ViewerCtx,
  threadId: string,
  userId: Id<"users">
) {
  const session = await getSetupSessionByThreadId(ctx.db, threadId);
  if (!session) {
    return null;
  }
  if (session.userId !== userId) {
    throw new Error("Not authorized");
  }
  if (!(await isSetupSessionAccessibleForUser(ctx, session))) {
    throw new Error("Setup session not found");
  }
  return session;
}

async function requireOwnedSetupSessionByThreadId(
  ctx: ViewerCtx,
  threadId: string,
  userId: Id<"users">
) {
  const session = await getOwnedSetupSessionByThreadId(ctx, threadId, userId);
  if (!session) {
    throw new Error("Setup session not found");
  }
  return session;
}

const DEFAULT_SETUP_FIT_SCORE_MIN = 70;
const DEFAULT_SETUP_FIT_SCORE_MAX = 100;

async function finalizeSetupSessionReady(
  ctx: MutationCtx,
  session: SetupSessionDoc,
  extras?: {
    planChoice?: Doc<"userPlans">["tier"];
    connectionsCompletedAt?: number;
  }
) {
  if (!session.targetWorkspaceId) {
    throw new Error(
      "Workspace provisioning must finish before setup can complete."
    );
  }

  const now = getCurrentUTCTimestamp();
  const resolvedWorkspaceName = formatWorkspaceName(session.draftName);

  await ctx.runMutation(internal.workspaces.updateWorkspaceInternal, {
    workspaceId: session.targetWorkspaceId,
    rawUserDescription: session.rawUserDescription,
    description: session.improvedDescription ?? session.seedDescription ?? "",
    improvedDescription:
      session.improvedDescription ?? session.seedDescription ?? "",
    icps: session.generatedProfiles ?? [],
    seedDescription: session.seedDescription,
    sourceUrl: getSetupSessionSourceUrl(session),
    descriptionSource: getSetupSessionInputMode(session),
    useCaseKey: resolveWorkspaceUseCaseKey(session.useCaseKey),
    fitScoreMin: DEFAULT_SETUP_FIT_SCORE_MIN,
    fitScoreMax: DEFAULT_SETUP_FIT_SCORE_MAX,
    setupCompletedAt: now,
    isDefault: true,
  });

  const patch = {
    status: "ready" as const,
    preferenceChoice: "qualified_only" as const,
    draftName: resolvedWorkspaceName,
    statusUpdatedAt: now,
    lastUserActionAt: now,
    lastActiveAt: now,
    ...(extras?.planChoice ? { planChoice: extras.planChoice } : {}),
    ...(typeof extras?.connectionsCompletedAt === "number"
      ? { connectionsCompletedAt: extras.connectionsCompletedAt }
      : {}),
  };

  await ctx.db.patch(session._id, patch);
  const useCase = getWorkspaceUseCase(
    resolveWorkspaceUseCaseKey(session.useCaseKey)
  );
  await saveMessage(ctx, components.agent, {
    threadId: session.setupThreadId,
    agentName: "Setup Agent",
    message: {
      role: "assistant",
      content: `${resolvedWorkspaceName} is ready. You can keep chatting here or open ${useCase.pageLabels.entities.toLowerCase()} to review the first matches.`,
    },
  });
  await maybeSignalStateChanged(ctx, {
    ...session,
    ...patch,
  });

  return { success: true as const };
}

async function applySetupPlanSelection(
  ctx: MutationCtx,
  session: SetupSessionDoc,
  planChoice: Doc<"userPlans">["tier"]
) {
  if (session.status === "ready") {
    return { success: true as const, alreadyCompleted: true as const };
  }

  if (
    session.status === "awaiting_preferences" &&
    session.planChoice === planChoice
  ) {
    // Legacy mid-flow rows: finish lean setup instead of staying on preferences.
    return await finalizeSetupSessionReady(ctx, session, { planChoice });
  }

  if (session.status !== "awaiting_plan") {
    throw new Error("Setup session is not awaiting a plan choice.");
  }

  return await finalizeSetupSessionReady(ctx, session, { planChoice });
}

async function getAccessibleActiveSetupSessionForUser(
  ctx: ViewerCtx,
  userId: Id<"users">
): Promise<SetupSessionDoc | null> {
  const session = await getActiveSetupSessionForUser(ctx.db, userId);
  if (!session) {
    return null;
  }
  return (await isSetupSessionAccessibleForUser(ctx, session)) ? session : null;
}

async function maybeSignalStateChanged(
  ctx: MutationCtx,
  session: SetupSessionDoc
) {
  if (!session.workflowId || isTerminalSetupSessionStatus(session.status)) {
    return;
  }

  try {
    await workflowManager.sendEvent(ctx, {
      workflowId: session.workflowId as unknown as ReturnType<
        typeof workflowManager.start
      > extends Promise<infer T>
        ? T
        : never,
      name: getSetupWorkflowEventName(String(session._id), "stateChanged"),
    });
  } catch (error) {
    setupSessionsLogger.warn("Failed to signal workflow state change", {
      error: error instanceof Error ? error.message : String(error),
      sessionId: String(session._id),
      workflowId: session.workflowId,
      status: session.status,
    });
  }
}

async function saveSetupAssistantMessage(
  ctx: ActionCtx,
  session: SetupSessionDoc,
  content: string
) {
  const { messageId } = await saveMessage(ctx, components.agent, {
    threadId: session.setupThreadId,
    agentName: "Setup Agent",
    message: {
      role: "assistant",
      content,
    },
  });
  return messageId;
}

function buildSetupGenerationReadyMessage(args: {
  profileCount: number;
  useCaseKey: WorkspaceUseCaseKey;
}) {
  const useCase = getWorkspaceUseCase(args.useCaseKey);
  return `I generated ${args.profileCount} ${useCase.profileLabelPlural.toLowerCase()} for this draft. Review them below, approve them to start the preview, or tell me what to change in chat.`;
}

function getSetupSessionInputMode(
  session: Pick<SetupSessionDoc, "inputMode" | "sourceUrl">
): "url" | "manual" {
  return session.inputMode ?? (session.sourceUrl ? "url" : "manual");
}

function getSetupSessionSourceUrl(
  session: Pick<SetupSessionDoc, "inputMode" | "sourceUrl">
): string | undefined {
  return getSetupSessionInputMode(session) === "url"
    ? session.sourceUrl
    : undefined;
}

export const getActiveSetupSession = query({
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

    const session = await getAccessibleActiveSetupSessionForUser(ctx, user._id);
    return session ? await toPublicSetupSessionState(ctx, session, user) : null;
  },
});

export const getSetupSessionState = query({
  args: {
    sessionId: v.optional(v.id("workspaceSetupSessions")),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);

    let session: SetupSessionDoc | null = null;
    if (args.sessionId) {
      session = await requireOwnedSetupSession(ctx, args.sessionId, user._id);
    } else if (args.threadId) {
      session = await getOwnedSetupSessionByThreadId(
        ctx,
        args.threadId,
        user._id
      );
    } else {
      session = await getAccessibleActiveSetupSessionForUser(ctx, user._id);
    }

    return session ? await toPublicSetupSessionState(ctx, session, user) : null;
  },
});

export const getSetupPreviewSummaries = query({
  args: {
    sessionId: v.optional(v.id("workspaceSetupSessions")),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);

    let session: SetupSessionDoc | null = null;
    if (args.sessionId) {
      session = await requireOwnedSetupSession(ctx, args.sessionId, user._id);
    } else if (args.threadId) {
      session = await getOwnedSetupSessionByThreadId(
        ctx,
        args.threadId,
        user._id
      );
    } else {
      session = await getAccessibleActiveSetupSessionForUser(ctx, user._id);
    }

    if (!session) {
      return [];
    }

    const candidateIds = await getSetupPreviewCandidateIds(ctx.db, session);
    const prospects = await Promise.all(
      candidateIds.map((prospectId) => ctx.db.get(prospectId))
    );

    return prospects.filter((prospect) => prospect !== null);
  },
});

export const getSetupBootstrapState = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        activeSession: null,
        suggestedMode: null as SetupSessionDoc["mode"] | null,
        requiresFirstWorkspace: false,
      };
    }

    const user = await getUserByIdentity(ctx, identity);
    if (!user) {
      return {
        activeSession: null,
        suggestedMode: null as SetupSessionDoc["mode"] | null,
        requiresFirstWorkspace: false,
      };
    }

    const [activeSession, defaultWorkspace] = await Promise.all([
      getAccessibleActiveSetupSessionForUser(ctx, user._id),
      getDefaultWorkspaceForUser(ctx, user._id),
    ]);
    const requiresFirstWorkspace =
      !defaultWorkspace ||
      !hasRequiredWorkspaceAgentData(defaultWorkspace) ||
      !defaultWorkspace.setupCompletedAt;

    if (activeSession) {
      return {
        activeSession: await toPublicSetupSessionState(
          ctx,
          activeSession,
          user
        ),
        suggestedMode: activeSession.mode,
        requiresFirstWorkspace,
      };
    }

    if (requiresFirstWorkspace) {
      return {
        activeSession: null,
        suggestedMode: "first_workspace" as const,
        requiresFirstWorkspace: true,
      };
    }

    return {
      activeSession: null,
      suggestedMode: null as SetupSessionDoc["mode"] | null,
      requiresFirstWorkspace: false,
    };
  },
});

export const getNewWorkspaceDecisionState = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { activeDraft: null };
    }

    const user = await getUserByIdentity(ctx, identity);
    if (!user) {
      return { activeDraft: null };
    }

    const session = await getAccessibleActiveSetupSessionForUser(ctx, user._id);
    return {
      activeDraft: session
        ? await toPublicSetupSessionState(ctx, session, user)
        : null,
    };
  },
});

export const startSetupSession = mutation({
  args: {
    mode: setupSessionModeValidator,
    useCaseKey: v.optional(workspaceUseCaseKeyValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const activeSession = await getAccessibleActiveSetupSessionForUser(
      ctx,
      user._id
    );
    if (activeSession) {
      return {
        sessionId: activeSession._id,
        threadId: activeSession.setupThreadId,
        reused: true,
      };
    }

    if (args.mode === "new_workspace") {
      const eligibility = await ctx.runQuery(
        internal.plans.getWorkspaceCreationEligibilityByUserId,
        {
          userId: user._id,
        }
      );
      if (!eligibility.allowed) {
        throw new Error(eligibility.reason ?? "Workspace limit reached");
      }
    }

    // Lean setup: skip manual use-case step. Provisional key until description
    // classification runs on submit (defaults to Custom outreach).
    const resolvedUseCaseKey = args.useCaseKey
      ? resolveWorkspaceUseCaseKey(args.useCaseKey)
      : ("general_outreach" satisfies WorkspaceUseCaseKey);
    const threadTitle =
      args.mode === "new_workspace"
        ? "Workspace setup draft"
        : "Workspace setup";
    const threadSummary =
      args.mode === "new_workspace"
        ? buildAdditionalWorkspaceSetupPrompt(resolvedUseCaseKey).slice(0, 150)
        : undefined;

    const now = getCurrentUTCTimestamp();
    const [threadId, draftOrdinal, entitlementSlot] = await Promise.all([
      createThread(ctx, components.agent, {
        userId: user._id,
        title: threadTitle,
        summary: threadSummary,
      }),
      resolveNextSetupDraftOrdinal(ctx.db, user._id),
      resolveNextEntitlementSlotForUser(ctx, user._id),
    ]);
    const sessionId = await ctx.db.insert("workspaceSetupSessions", {
      userId: user._id,
      mode: args.mode,
      status: "awaiting_input",
      setupThreadId: threadId,
      useCaseKey: resolvedUseCaseKey,
      draftOrdinal,
      entitlementSlot,
      lastUserActionAt: now,
      lastActiveAt: now,
      statusUpdatedAt: now,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.setupSessions.startSetupSessionWorkflowInternal,
      {
        sessionId,
      }
    );

    return {
      sessionId,
      threadId,
      reused: false,
    };
  },
});

type SetupWorkflowHealthResult = {
  scheduled: boolean;
  recovered: boolean;
  state: "healthy" | "waiting_for_user" | "started" | "recovered" | "failed";
};

async function ensureSetupWorkflowHealth(
  ctx: MutationCtx,
  session: Doc<"workspaceSetupSessions">,
  now = getCurrentUTCTimestamp()
): Promise<SetupWorkflowHealthResult> {
  let workflowStatus: WorkflowStatus | null = null;
  if (session.workflowId) {
    try {
      workflowStatus = await workflowManager.status(
        ctx,
        session.workflowId as WorkflowId
      );
    } catch (error) {
      setupSessionsLogger.warn("Setup workflow status lookup failed", {
        error: error instanceof Error ? error.message : String(error),
        sessionId: String(session._id),
        workflowId: session.workflowId,
      });
    }
  }

  const decision = getSetupWorkflowRecoveryDecision({
    session,
    workflowStatus,
    now,
  });
  if (decision.kind === "none") {
    return {
      scheduled: false,
      recovered: false,
      state:
        decision.reason === "waiting_for_user"
          ? ("waiting_for_user" as const)
          : ("healthy" as const),
    };
  }
  if (decision.kind === "start") {
    await startSetupWorkflow(ctx, session);
    return { scheduled: true, recovered: false, state: "started" as const };
  }
  if (decision.kind === "fail") {
    if (session.workflowId && workflowStatus?.type === "inProgress") {
      try {
        await workflowManager.cancel(ctx, session.workflowId as WorkflowId);
      } catch (error) {
        setupSessionsLogger.warn("Failed to cancel exhausted setup workflow", {
          error: error instanceof Error ? error.message : String(error),
          sessionId: String(session._id),
          workflowId: session.workflowId,
        });
      }
    }
    await ctx.db.patch("workspaceSetupSessions", session._id, {
      status: "failed",
      workflowId: undefined,
      generationErrorAt:
        session.status === "generating_profiles"
          ? now
          : session.generationErrorAt,
      errorCode: "setup_workflow_recovery_exhausted",
      errorMessage:
        "Agent setup paused after repeated recovery attempts. Please retry your last setup step.",
      lastAgentActionAt: now,
      lastActiveAt: now,
      statusUpdatedAt: now,
    });
    setupSessionsLogger.error("Setup workflow recovery exhausted", {
      sessionId: String(session._id),
      workflowId: session.workflowId,
      status: session.status,
    });
    return { scheduled: false, recovered: false, state: "failed" as const };
  }

  if (session.workflowId && workflowStatus?.type === "inProgress") {
    try {
      await workflowManager.cancel(ctx, session.workflowId as WorkflowId);
    } catch (error) {
      setupSessionsLogger.warn("Failed to cancel stale setup workflow", {
        error: error instanceof Error ? error.message : String(error),
        sessionId: String(session._id),
        workflowId: session.workflowId,
      });
    }
  }
  await startSetupWorkflow(ctx, session, { reason: decision.reason, now });
  setupSessionsLogger.warn("Recovered setup workflow", {
    sessionId: String(session._id),
    previousWorkflowId: session.workflowId,
    reason: decision.reason,
    status: session.status,
  });
  return { scheduled: true, recovered: true, state: "recovered" as const };
}

export const ensureSetupSessionWorkflow = mutation({
  args: {
    threadId: v.string(),
  },
  returns: v.object({
    scheduled: v.boolean(),
    recovered: v.boolean(),
    state: v.union(
      v.literal("healthy"),
      v.literal("waiting_for_user"),
      v.literal("started"),
      v.literal("recovered"),
      v.literal("failed")
    ),
  }),
  handler: async (ctx, { threadId }) => {
    const user = await requireViewerUser(ctx);
    const session = await getSetupSessionByThreadId(ctx.db, threadId);
    if (!session || session.userId !== user._id) {
      throw new Error("Setup session not found");
    }
    if (!(await isSetupSessionAccessibleForUser(ctx, session))) {
      throw new Error("Setup session not found");
    }
    return await ensureSetupWorkflowHealth(ctx, session);
  },
});

/**
 * Small indexed safety net for setup sessions whose user is no longer online.
 * The client-triggered ensure remains the fast path; this pass prevents an
 * abandoned tab from leaving machine-owned setup work wedged indefinitely.
 */
export const recoverStaleSetupWorkflowsInternal = internalMutation({
  args: {},
  returns: v.object({
    checked: v.number(),
    recovered: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx) => {
    const now = getCurrentUTCTimestamp();
    const cutoff = now - SETUP_WORKFLOW_STALE_AFTER_MS;
    const candidateGroups = await Promise.all(
      SETUP_WORKFLOW_MACHINE_PROGRESS_STATUSES.map((status) =>
        ctx.db
          .query("workspaceSetupSessions")
          .withIndex("by_status_updated_at", (q) =>
            q.eq("status", status).lt("statusUpdatedAt", cutoff)
          )
          .take(1)
      )
    );
    const candidates = candidateGroups
      .flat()
      .filter((session) => session.workflowId);

    let recovered = 0;
    let failed = 0;
    for (const session of candidates) {
      const result = await ensureSetupWorkflowHealth(ctx, session, now);
      if (result.state === "recovered") recovered += 1;
      if (result.state === "failed") failed += 1;
    }
    return { checked: candidates.length, recovered, failed };
  },
});

export const discardSetupSession = mutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const session = await requireOwnedSetupSession(
      ctx,
      args.sessionId,
      user._id
    );

    const now = getCurrentUTCTimestamp();

    const linkedWorkspaceIds = new Set<Id<"workspaces">>();
    const deletedProvisionedWorkspaceIds = new Set<Id<"workspaces">>();
    if (session.targetWorkspaceId) {
      linkedWorkspaceIds.add(session.targetWorkspaceId);
    }
    if (session.existingWorkspaceId) {
      linkedWorkspaceIds.add(session.existingWorkspaceId);
    }

    if (
      session.mode === "new_workspace" &&
      session.targetWorkspaceId &&
      !session.existingWorkspaceId
    ) {
      const provisionedWorkspace = await ctx.db.get(session.targetWorkspaceId);
      if (
        provisionedWorkspace &&
        provisionedWorkspace.userId === user._id &&
        !provisionedWorkspace.setupCompletedAt
      ) {
        await deleteWorkspaceCascade(ctx, provisionedWorkspace._id);
        deletedProvisionedWorkspaceIds.add(provisionedWorkspace._id);
      }
    }

    for (const workspaceId of linkedWorkspaceIds) {
      if (deletedProvisionedWorkspaceIds.has(workspaceId)) {
        continue;
      }
      const workspace = await ctx.db.get(workspaceId);
      if (workspace?.onboardingThreadId === session.setupThreadId) {
        await ctx.db.patch(workspaceId, {
          onboardingThreadId: undefined,
          updatedAt: now,
        });
      }
    }
    await ctx.scheduler.runAfter(
      0,
      internal.workspaces.reconcileWorkspaceEntitlementsForUserInternal,
      {
        userId: user._id,
      }
    );

    await ctx.db.patch(args.sessionId, {
      status: "discarded",
      previewWorkflowId: undefined,
      previewProspectIds: undefined,
      previewReviewMode: undefined,
      previewDiscoveryStartedAt: undefined,
      statusUpdatedAt: now,
      discardedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      status: "discarded",
      previewWorkflowId: undefined,
      statusUpdatedAt: now,
      discardedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    if (session.previewWorkflowId) {
      await ctx.scheduler.runAfter(
        0,
        internal.workflows.preview.cancelPreviewWorkflowByIdInternal,
        {
          workflowId: session.previewWorkflowId,
        }
      );
    }
    await ctx.scheduler.runAfter(
      0,
      internal.prospects.deletePreviewProspectsForSessionRevisionInternal,
      {
        sessionId: args.sessionId,
      }
    );

    const defaultWorkspaceAfter = await getDefaultWorkspaceForUser(
      ctx,
      user._id
    );

    return {
      success: true as const,
      hasDefaultWorkspace: defaultWorkspaceAfter !== null,
    };
  },
});

export const selectSetupSessionUseCase = mutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    useCaseKey: workspaceUseCaseKeyValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const session = await requireOwnedSetupSession(
      ctx,
      args.sessionId,
      user._id
    );
    const now = getCurrentUTCTimestamp();

    await ctx.db.patch(args.sessionId, {
      useCaseKey: args.useCaseKey,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      useCaseKey: args.useCaseKey,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    return { success: true };
  },
});

export const advanceSetupSessionFromUseCaseStep = mutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const session = await requireOwnedSetupSession(
      ctx,
      args.sessionId,
      user._id
    );
    const now = getCurrentUTCTimestamp();

    if (session.status !== "draft") {
      return { success: true as const, advanced: false };
    }

    await ctx.db.patch(args.sessionId, {
      status: "awaiting_input",
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      status: "awaiting_input",
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    return { success: true as const, advanced: true };
  },
});

/**
 * Capture the exact setup prompt before the Setup Agent receives it. While the
 * draft is still collecting input, a newer user prompt may replace this value;
 * once accepted, the status advances and the original input is immutable.
 */
export const captureRawSetupInputFromChatInternal = internalMutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    messageId: v.string(),
    rawUserDescription: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (
      !session ||
      !["draft", "awaiting_input", "failed"].includes(session.status)
    ) {
      return { captured: false as const };
    }

    if (!args.rawUserDescription.trim()) {
      return { captured: false as const };
    }
    const rawUserDescription = args.rawUserDescription;

    const now = getCurrentUTCTimestamp();
    await ctx.db.patch(args.sessionId, {
      rawUserDescription,
      // The user-facing seed is intentionally the same verbatim source text.
      // No model output is allowed to replace it.
      seedDescription: rawUserDescription,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    return { captured: true as const, messageId: args.messageId };
  },
});

export const submitSetupInput = mutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    inputMode: setupInputModeValidator,
    inputValue: v.string(),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const session = await requireOwnedSetupSession(
      ctx,
      args.sessionId,
      user._id
    );
    if (
      session.status !== "draft" &&
      session.status !== "awaiting_input" &&
      session.status !== "failed"
    ) {
      throw new Error("Setup session is not awaiting audience input.");
    }

    if (!args.inputValue.trim()) {
      throw new Error("Audience description is required.");
    }
    const rawUserDescription = args.inputValue;

    const now = getCurrentUTCTimestamp();
    const detectedUseCaseKey = resolveWorkspaceUseCaseKey(session.useCaseKey);
    const generationRevision = getNextSetupGenerationRevision(session);

    // The panel path has no agent tool context, so persist the real message
    // first and use its id as the generation anchor.
    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId: session.setupThreadId,
      prompt: rawUserDescription,
    });

    await ctx.db.patch(args.sessionId, {
      status: "generating_profiles",
      previewWorkflowId: undefined,
      inputMode: args.inputMode,
      rawUserDescription,
      seedDescription: rawUserDescription,
      useCaseKey: detectedUseCaseKey,
      generationFeedback: undefined,
      sourceUrl: args.inputMode === "url" ? args.sourceUrl : undefined,
      previewDiscoveryStartedAt: undefined,
      previewProspectIds: undefined,
      previewReviewMode: undefined,
      previewReadyAt: undefined,
      previewApprovedAt: undefined,
      generationRequestedAt: now,
      generationCompletedAt: undefined,
      generationErrorAt: undefined,
      generationRevision,
      generationSourceMessageId: messageId,
      errorCode: undefined,
      errorMessage: undefined,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      status: "generating_profiles",
      previewWorkflowId: undefined,
      inputMode: args.inputMode,
      rawUserDescription,
      seedDescription: rawUserDescription,
      useCaseKey: detectedUseCaseKey,
      generationFeedback: undefined,
      sourceUrl: args.inputMode === "url" ? args.sourceUrl : undefined,
      previewDiscoveryStartedAt: undefined,
      previewProspectIds: undefined,
      previewReviewMode: undefined,
      previewReadyAt: undefined,
      previewApprovedAt: undefined,
      generationRequestedAt: now,
      generationCompletedAt: undefined,
      generationErrorAt: undefined,
      generationRevision,
      generationSourceMessageId: messageId,
      errorCode: undefined,
      errorMessage: undefined,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    if (session.previewWorkflowId) {
      await ctx.scheduler.runAfter(
        0,
        internal.workflows.preview.cancelPreviewWorkflowByIdInternal,
        {
          workflowId: session.previewWorkflowId,
        }
      );
    }
    await ctx.scheduler.runAfter(
      0,
      internal.prospects.deletePreviewProspectsForSessionRevisionInternal,
      {
        sessionId: args.sessionId,
      }
    );

    return { success: true, useCaseKey: detectedUseCaseKey };
  },
});

export const submitSetupInputFromAgentInternal = internalMutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    inputMode: setupInputModeValidator,
    inputValue: v.string(),
    sourceUrl: v.optional(v.string()),
    useCaseKey: workspaceUseCaseKeyValidator,
    generationSourceMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Setup session not found.");
    }
    if (
      session.status !== "draft" &&
      session.status !== "awaiting_input" &&
      session.status !== "failed"
    ) {
      throw new Error("Setup session is not awaiting audience input.");
    }

    const rawUserDescription = session.rawUserDescription?.trim()
      ? session.rawUserDescription
      : args.inputValue;
    if (!rawUserDescription.trim()) {
      throw new Error("Audience description is required.");
    }

    const now = getCurrentUTCTimestamp();
    const generationRevision = getNextSetupGenerationRevision(session);
    await ctx.db.patch(args.sessionId, {
      status: "generating_profiles",
      previewWorkflowId: undefined,
      inputMode: args.inputMode,
      rawUserDescription,
      seedDescription: rawUserDescription,
      useCaseKey: args.useCaseKey,
      generationFeedback: undefined,
      sourceUrl: args.inputMode === "url" ? args.sourceUrl : undefined,
      previewDiscoveryStartedAt: undefined,
      previewProspectIds: undefined,
      previewReviewMode: undefined,
      previewReadyAt: undefined,
      previewApprovedAt: undefined,
      generationRequestedAt: now,
      generationCompletedAt: undefined,
      generationErrorAt: undefined,
      generationRevision,
      generationSourceMessageId: args.generationSourceMessageId,
      errorCode: undefined,
      errorMessage: undefined,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      status: "generating_profiles",
      previewWorkflowId: undefined,
      inputMode: args.inputMode,
      rawUserDescription,
      seedDescription: rawUserDescription,
      useCaseKey: args.useCaseKey,
      generationFeedback: undefined,
      sourceUrl: args.inputMode === "url" ? args.sourceUrl : undefined,
      previewDiscoveryStartedAt: undefined,
      previewProspectIds: undefined,
      previewReviewMode: undefined,
      previewReadyAt: undefined,
      previewApprovedAt: undefined,
      generationRequestedAt: now,
      generationCompletedAt: undefined,
      generationErrorAt: undefined,
      generationRevision,
      generationSourceMessageId: args.generationSourceMessageId,
      errorCode: undefined,
      errorMessage: undefined,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    if (session.previewWorkflowId) {
      await ctx.scheduler.runAfter(
        0,
        internal.workflows.preview.cancelPreviewWorkflowByIdInternal,
        { workflowId: session.previewWorkflowId }
      );
    }
    await ctx.scheduler.runAfter(
      0,
      internal.prospects.deletePreviewProspectsForSessionRevisionInternal,
      { sessionId: args.sessionId }
    );

    return { success: true as const, useCaseKey: args.useCaseKey };
  },
});

export const submitSetupGenerationFeedback = mutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    feedback: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const session = await requireOwnedSetupSession(
      ctx,
      args.sessionId,
      user._id
    );
    if (session.status !== "awaiting_icp_confirmation") {
      throw new Error("Ideal profiles are not awaiting revision.");
    }
    const feedback = args.feedback.trim();
    if (!feedback) {
      throw new Error("Revision feedback is required.");
    }
    const now = getCurrentUTCTimestamp();
    const generationRevision = getNextSetupGenerationRevision(session);

    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId: session.setupThreadId,
      prompt: feedback,
    });

    await ctx.db.patch(args.sessionId, {
      status: "generating_profiles",
      previewWorkflowId: undefined,
      generationFeedback: feedback,
      previewDiscoveryStartedAt: undefined,
      previewProspectIds: undefined,
      previewReviewMode: undefined,
      previewReadyAt: undefined,
      previewApprovedAt: undefined,
      generationRequestedAt: now,
      generationCompletedAt: undefined,
      generationErrorAt: undefined,
      generationRevision,
      generationSourceMessageId: messageId,
      errorCode: undefined,
      errorMessage: undefined,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      status: "generating_profiles",
      previewWorkflowId: undefined,
      generationFeedback: feedback,
      previewDiscoveryStartedAt: undefined,
      previewProspectIds: undefined,
      previewReviewMode: undefined,
      previewReadyAt: undefined,
      previewApprovedAt: undefined,
      generationRequestedAt: now,
      generationCompletedAt: undefined,
      generationErrorAt: undefined,
      generationRevision,
      generationSourceMessageId: messageId,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    if (session.previewWorkflowId) {
      await ctx.scheduler.runAfter(
        0,
        internal.workflows.preview.cancelPreviewWorkflowByIdInternal,
        {
          workflowId: session.previewWorkflowId,
        }
      );
    }
    await ctx.scheduler.runAfter(
      0,
      internal.prospects.deletePreviewProspectsForSessionRevisionInternal,
      {
        sessionId: args.sessionId,
      }
    );

    return { success: true };
  },
});

export const submitSetupGenerationFeedbackFromAgentInternal = internalMutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    feedback: v.string(),
    generationSourceMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.status !== "awaiting_icp_confirmation") {
      throw new Error("Ideal profiles are not awaiting revision.");
    }

    const feedback = args.feedback.trim();
    if (!feedback) {
      throw new Error("Revision feedback is required.");
    }

    const now = getCurrentUTCTimestamp();
    const generationRevision = getNextSetupGenerationRevision(session);
    await ctx.db.patch(args.sessionId, {
      status: "generating_profiles",
      previewWorkflowId: undefined,
      generationFeedback: feedback,
      previewDiscoveryStartedAt: undefined,
      previewProspectIds: undefined,
      previewReviewMode: undefined,
      previewReadyAt: undefined,
      previewApprovedAt: undefined,
      generationRequestedAt: now,
      generationCompletedAt: undefined,
      generationErrorAt: undefined,
      generationRevision,
      generationSourceMessageId: args.generationSourceMessageId,
      errorCode: undefined,
      errorMessage: undefined,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      status: "generating_profiles",
      previewWorkflowId: undefined,
      generationFeedback: feedback,
      previewDiscoveryStartedAt: undefined,
      previewProspectIds: undefined,
      previewReviewMode: undefined,
      previewReadyAt: undefined,
      previewApprovedAt: undefined,
      generationRequestedAt: now,
      generationCompletedAt: undefined,
      generationErrorAt: undefined,
      generationRevision,
      generationSourceMessageId: args.generationSourceMessageId,
      errorCode: undefined,
      errorMessage: undefined,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    return { success: true as const };
  },
});

export const approveSetupGeneration = mutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const session = await requireOwnedSetupSession(
      ctx,
      args.sessionId,
      user._id
    );
    const now = getCurrentUTCTimestamp();

    if (session.status !== "awaiting_preview_confirmation") {
      throw new Error("Preview people are not awaiting confirmation.");
    }
    if (session.refineFromWorkspace) {
      throw new Error(
        "This legacy workspace update session is no longer supported."
      );
    }
    if (!session.targetWorkspaceId) {
      throw new Error("Preview workspace has not been provisioned yet.");
    }
    const approvedPreviewProspectIds = await getSetupPreviewCandidateIds(
      ctx.db,
      session
    );
    if (approvedPreviewProspectIds.length === 0) {
      throw new Error(
        "Preview people are still loading. Please wait a moment."
      );
    }
    const previewRevision = session.previewRevision ?? 0;

    await ctx.runMutation(
      internal.prospects.promoteSetupPreviewProspectsInternal,
      {
        sessionId: args.sessionId,
        workspaceId: session.targetWorkspaceId,
        previewRevision,
        approvedProspectIds: approvedPreviewProspectIds,
      }
    );

    const approvedPreviewProspects = await Promise.all(
      approvedPreviewProspectIds.map((prospectId) => ctx.db.get(prospectId))
    );
    for (const prospect of approvedPreviewProspects) {
      if (
        !prospect ||
        prospect.workspaceId !== session.targetWorkspaceId ||
        prospect.qualificationStatus !== "qualified" ||
        prospect.enrichmentStatus === "enriched"
      ) {
        continue;
      }

      await ctx.scheduler.runAfter(
        typeof prospect.enrichmentWorkflowId === "string"
          ? PREVIEW_BATCH_LIMITS.interCycleDelayMs
          : 0,
        internal.workflows.enrichment.startEnrichment,
        {
          prospectId: prospect._id,
          workspaceId: session.targetWorkspaceId,
        }
      );
    }

    const flowContext = await ctx.runQuery(
      internal.setupSessions.getSetupUserFlowContextInternal,
      {
        userId: session.userId,
      }
    );
    const nextStatus = getNextSetupStatusAfterProvisioning({
      requiresConnections: flowContext.requiresConnections,
      requiresPlan: !isPaidPlanTier(flowContext.planTier),
    });

    const sessionAfterPreview = {
      ...session,
      previewWorkflowId: undefined,
      previewProspectIds: approvedPreviewProspectIds,
      previewApprovedAt: now,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    };

    if (nextStatus === "ready") {
      await finalizeSetupSessionReady(ctx, sessionAfterPreview);
    } else {
      await ctx.db.patch(args.sessionId, {
        status: nextStatus,
        previewWorkflowId: undefined,
        previewProspectIds: approvedPreviewProspectIds,
        previewApprovedAt: now,
        statusUpdatedAt: now,
        lastUserActionAt: now,
        lastActiveAt: now,
      });

      await maybeSignalStateChanged(ctx, {
        ...sessionAfterPreview,
        status: nextStatus,
      });
    }

    if (session.previewWorkflowId) {
      await ctx.scheduler.runAfter(
        0,
        internal.workflows.preview.cancelPreviewWorkflowByIdInternal,
        {
          workflowId: session.previewWorkflowId,
        }
      );
    }
    await ctx.scheduler.runAfter(
      0,
      internal.workspaces.startProspectingWorkflowInternal,
      {
        workspaceId: session.targetWorkspaceId,
      }
    );

    return { success: true };
  },
});

export const completeSetupConnections = mutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    connectedX: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const session = await requireOwnedSetupSession(
      ctx,
      args.sessionId,
      user._id
    );

    if (session.status === "ready") {
      return {
        success: true as const,
        status: "ready" as const,
        alreadyCompleted: true as const,
      };
    }

    if (
      (session.status === "awaiting_plan" ||
        session.status === "awaiting_preferences") &&
      typeof session.connectionsCompletedAt === "number"
    ) {
      return {
        success: true as const,
        status: session.status,
        alreadyCompleted: true as const,
      };
    }

    if (session.status !== "awaiting_connections") {
      throw new Error("Setup session is not awaiting account connections.");
    }

    const now = getCurrentUTCTimestamp();
    const planTier = await getUserPlanTier(ctx.db, user._id);
    const nextStatus = getNextSetupStatusAfterConnections({
      requiresPlan: !isPaidPlanTier(planTier),
    });

    if (nextStatus === "ready") {
      await finalizeSetupSessionReady(ctx, session, {
        connectionsCompletedAt: now,
      });
      return { success: true as const, status: "ready" as const };
    }

    await ctx.db.patch(args.sessionId, {
      status: nextStatus,
      connectionsCompletedAt: now,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      status: nextStatus,
      connectionsCompletedAt: now,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    return { success: true as const, status: nextStatus };
  },
});

export const selectSetupPlan = mutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    planChoice: planTierValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const session = await requireOwnedSetupSession(
      ctx,
      args.sessionId,
      user._id
    );
    return await applySetupPlanSelection(ctx, session, args.planChoice);
  },
});

export const selectSetupPlanByThreadId = mutation({
  args: {
    threadId: v.string(),
    planChoice: planTierValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const session = await requireOwnedSetupSessionByThreadId(
      ctx,
      args.threadId,
      user._id
    );

    return await applySetupPlanSelection(ctx, session, args.planChoice);
  },
});

export const selectSetupPlanFromRedirect = mutation({
  args: {
    threadId: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    planChoice: planTierValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);

    if (args.threadId) {
      const session = await requireOwnedSetupSessionByThreadId(
        ctx,
        args.threadId,
        user._id
      );

      if (args.sessionId) {
        const normalizedSessionId = ctx.db.normalizeId(
          "workspaceSetupSessions",
          args.sessionId
        );
        if (normalizedSessionId && normalizedSessionId !== session._id) {
          setupSessionsLogger.warn(
            "Ignoring mismatched redirect sessionId for setup plan selection",
            {
              expectedSessionId: String(session._id),
              providedSessionId: args.sessionId,
              threadId: args.threadId,
            }
          );
        }
      }

      return await applySetupPlanSelection(ctx, session, args.planChoice);
    }

    if (!args.sessionId) {
      throw new Error("Setup session is missing.");
    }

    const normalizedSessionId = ctx.db.normalizeId(
      "workspaceSetupSessions",
      args.sessionId
    );
    if (!normalizedSessionId) {
      throw new Error("Setup session is invalid or expired.");
    }

    const session = await requireOwnedSetupSession(
      ctx,
      normalizedSessionId,
      user._id
    );
    return await applySetupPlanSelection(ctx, session, args.planChoice);
  },
});

export const selectSetupPreference = mutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    fitScoreMin: v.number(),
    fitScoreMax: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const session = await requireOwnedSetupSession(
      ctx,
      args.sessionId,
      user._id
    );
    if (session.status === "ready") {
      return { success: true as const, alreadyCompleted: true as const };
    }
    if (session.status !== "awaiting_preferences") {
      throw new Error("Setup session is not awaiting preferences.");
    }
    if (!session.targetWorkspaceId) {
      throw new Error("Workspace provisioning must finish before preferences.");
    }
    const now = getCurrentUTCTimestamp();
    const resolvedWorkspaceName = formatWorkspaceName(session.draftName);
    const fitScoreMin = Math.max(
      0,
      Math.min(100, Math.round(args.fitScoreMin))
    );
    const fitScoreMax = Math.max(
      fitScoreMin,
      Math.min(100, Math.round(args.fitScoreMax))
    );
    const preferenceChoice =
      fitScoreMin >= 70 ? "qualified_only" : "qualified_and_exploratory";

    await ctx.runMutation(internal.workspaces.updateWorkspaceInternal, {
      workspaceId: session.targetWorkspaceId,
      rawUserDescription: session.rawUserDescription,
      description: session.improvedDescription ?? session.seedDescription ?? "",
      improvedDescription:
        session.improvedDescription ?? session.seedDescription ?? "",
      icps: session.generatedProfiles ?? [],
      seedDescription: session.seedDescription,
      sourceUrl: getSetupSessionSourceUrl(session),
      descriptionSource: getSetupSessionInputMode(session),
      useCaseKey: resolveWorkspaceUseCaseKey(session.useCaseKey),
      fitScoreMin,
      fitScoreMax,
      setupCompletedAt: now,
      isDefault: true,
    });

    await ctx.db.patch(args.sessionId, {
      status: "ready",
      preferenceChoice,
      draftName: resolvedWorkspaceName,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      status: "ready",
      preferenceChoice,
      draftName: resolvedWorkspaceName,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    return { success: true };
  },
});

export const finalizeSetupSession = mutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    workspaceName: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const session = await requireOwnedSetupSession(
      ctx,
      args.sessionId,
      user._id
    );
    const now = getCurrentUTCTimestamp();
    if (!session.targetWorkspaceId) {
      throw new Error("Workspace is not ready for finalization.");
    }

    await ctx.runMutation(internal.workspaces.updateWorkspaceInternal, {
      workspaceId: session.targetWorkspaceId,
      rawUserDescription: session.rawUserDescription,
      description: session.improvedDescription ?? session.seedDescription ?? "",
      improvedDescription:
        session.improvedDescription ?? session.seedDescription ?? "",
      icps: session.generatedProfiles ?? [],
      seedDescription: session.seedDescription,
      sourceUrl: getSetupSessionSourceUrl(session),
      descriptionSource: getSetupSessionInputMode(session),
      useCaseKey: resolveWorkspaceUseCaseKey(session.useCaseKey),
      setupCompletedAt: now,
      isDefault: true,
    });
    await ctx.db.patch(args.sessionId, {
      status: "ready",
      draftName: formatWorkspaceName(args.workspaceName),
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      status: "ready",
      draftName: formatWorkspaceName(args.workspaceName),
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    return { success: true };
  },
});

export const getByIdInternal = internalQuery({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db.get(sessionId);
  },
});

export const getByThreadIdInternal = internalQuery({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }) => {
    return await getSetupSessionByThreadId(ctx.db, threadId);
  },
});

/**
 * Targeted repair for setup rows created before raw descriptions were stored.
 * It updates only the description fields on the session and its linked
 * workspace; profiles, workflow state, and other workspace data are preserved.
 */
export const repairSetupDescriptionFieldsInternal = internalMutation({
  args: {
    threadId: v.string(),
    rawUserDescription: v.string(),
    improvedDescription: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await getSetupSessionByThreadId(ctx.db, args.threadId);
    if (!session) {
      throw new Error("Setup session not found");
    }

    const rawUserDescription = args.rawUserDescription.trim();
    const improvedDescription = args.improvedDescription.trim();
    if (!rawUserDescription || !improvedDescription) {
      throw new Error("Both descriptions are required");
    }

    const now = getCurrentUTCTimestamp();
    await ctx.db.patch(session._id, {
      rawUserDescription,
      seedDescription: rawUserDescription,
      improvedDescription,
      lastActiveAt: now,
    });

    if (session.targetWorkspaceId) {
      const workspace = await ctx.db.get(session.targetWorkspaceId);
      if (workspace && workspace.userId === session.userId) {
        await ctx.db.patch(workspace._id, {
          rawUserDescription,
          seedDescription: rawUserDescription,
          improvedDescription,
          description: improvedDescription,
          updatedAt: now,
        });
      }
    }

    return {
      repaired: true as const,
      sessionId: session._id,
      workspaceId: session.targetWorkspaceId ?? null,
    };
  },
});

export const getByTargetWorkspaceIdInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    return await getSetupSessionByTargetWorkspaceId(ctx.db, workspaceId);
  },
});

export const getLatestGeneratedProfilesForWorkspaceInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const session = await getSetupSessionByTargetWorkspaceId(
      ctx.db,
      workspaceId
    );

    if (!session?.generatedProfiles?.length) {
      return null;
    }

    return {
      sessionId: session._id,
      generatedProfiles: session.generatedProfiles,
      generationCompletedAt: session.generationCompletedAt ?? null,
    };
  },
});

export const getSetupUserFlowContextInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const [planTier, connectionState] = await Promise.all([
      getUserPlanTier(ctx.db, userId),
      getSetupConnectionState(ctx.db, userId),
    ]);

    return {
      planTier,
      xConnected: connectionState.xConnected,
      requiresConnections: !connectionState.xConnected,
    };
  },
});

export const markWorkflowStartedInternal = internalMutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    workflowId: v.string(),
  },
  handler: async (ctx, { sessionId, workflowId }) => {
    await ctx.db.patch(sessionId, {
      workflowId,
      lastActiveAt: getCurrentUTCTimestamp(),
    });
  },
});

export const markPreviewWorkflowStartedInternal = internalMutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    workflowId: v.string(),
  },
  handler: async (ctx, { sessionId, workflowId }) => {
    await ctx.db.patch(sessionId, {
      previewWorkflowId: workflowId,
      lastActiveAt: getCurrentUTCTimestamp(),
    });
  },
});

export const clearPreviewWorkflowIdInternal = internalMutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    await ctx.db.patch(sessionId, {
      previewWorkflowId: undefined,
      lastActiveAt: getCurrentUTCTimestamp(),
    });
  },
});

export const clearPreviewWorkflowIdIfMatchesInternal = internalMutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    workflowId: v.string(),
  },
  handler: async (ctx, { sessionId, workflowId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session || session.previewWorkflowId !== workflowId) {
      return { cleared: false };
    }

    await ctx.db.patch(sessionId, {
      previewWorkflowId: undefined,
      lastActiveAt: getCurrentUTCTimestamp(),
    });

    return { cleared: true };
  },
});

export const startSetupSessionWorkflowInternal = internalMutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
  },
  returns: v.object({ workflowId: v.string() }),
  handler: async (ctx, { sessionId }): Promise<{ workflowId: string }> => {
    const session = await ctx.db.get("workspaceSetupSessions", sessionId);
    if (!session || isTerminalSetupSessionStatus(session.status)) {
      return { workflowId: "" };
    }
    if (session.workflowId) {
      return { workflowId: session.workflowId };
    }
    return { workflowId: await startSetupWorkflow(ctx, session) };
  },
});

export const cancelPreviewWorkflowInternal = internalAction({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.runQuery(internal.setupSessions.getByIdInternal, {
      sessionId,
    });
    if (!session?.previewWorkflowId) {
      return { cancelled: false };
    }

    await ctx.runAction(
      internal.workflows.preview.cancelPreviewWorkflowByIdInternal,
      {
        workflowId: session.previewWorkflowId,
      }
    );
    await ctx.runMutation(
      internal.setupSessions.clearPreviewWorkflowIdInternal,
      {
        sessionId,
      }
    );
    return { cancelled: true };
  },
});

export const startPreviewWorkflowInternal = internalAction({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    discoveryAttempt: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { sessionId, discoveryAttempt }
  ): Promise<{ workflowId: string }> => {
    const session = await ctx.runQuery(internal.setupSessions.getByIdInternal, {
      sessionId,
    });
    if (
      !session ||
      !session.targetWorkspaceId ||
      typeof session.previewRevision !== "number"
    ) {
      return { workflowId: "" };
    }

    if (
      session.status !== "discovering_preview_prospects" &&
      session.status !== "preview_search_in_progress" &&
      session.status !== "awaiting_preview_confirmation"
    ) {
      return { workflowId: "" };
    }

    if (session.status === "awaiting_preview_confirmation") {
      return { workflowId: session.previewWorkflowId ?? "" };
    }

    if (session.previewWorkflowId) {
      await ctx.runAction(
        internal.setupSessions.cancelPreviewWorkflowInternal,
        {
          sessionId,
        }
      );
    }

    const workflowId = await workflowManager.start(
      ctx,
      internal.workflows.preview.previewWorkflow,
      {
        sessionId,
        workspaceId: session.targetWorkspaceId,
        previewRevision: session.previewRevision,
        source: "setup",
        discoveryAttempt,
      },
      {
        onComplete: internal.workflows.preview.handlePreviewWorkflowComplete,
        context: { sessionId },
      }
    );

    await ctx.runMutation(
      internal.setupSessions.markPreviewWorkflowStartedInternal,
      {
        sessionId,
        workflowId: String(workflowId),
      }
    );

    return { workflowId: String(workflowId) };
  },
});

export const resumePreviewWorkflowIfNeededInternal = internalAction({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
  },
  handler: async (ctx, { sessionId }): Promise<{ resumed: boolean }> => {
    const session = await ctx.runQuery(internal.setupSessions.getByIdInternal, {
      sessionId,
    });
    if (
      !session ||
      !session.targetWorkspaceId ||
      typeof session.previewRevision !== "number" ||
      !["discovering_preview_prospects", "preview_search_in_progress"].includes(
        session.status
      ) ||
      session.previewReadyAt
    ) {
      return { resumed: false };
    }

    if (session.previewWorkflowId) {
      return { resumed: false };
    }

    const orchestrationState = await ctx.runQuery(
      internal.setupSessions.getSetupPreviewOrchestrationStateInternal,
      { sessionId }
    );

    const previewSnapshot = selectInitialSetupPreviewReviewSnapshot({
      rankedQualifiedIds: orchestrationState.rankedQualifiedIds,
      rankedPreviewIds: orchestrationState.rankedPreviewIds,
      limit: PREVIEW_TARGET_COUNT,
    });

    if (previewSnapshot) {
      await ctx.runMutation(internal.setupSessions.markPreviewReadyInternal, {
        sessionId,
        previewProspectIds: previewSnapshot.previewProspectIds,
        previewReviewMode: previewSnapshot.previewReviewMode,
      });
      return { resumed: false };
    }

    const { workflowId } = await ctx.runAction(
      internal.setupSessions.startPreviewWorkflowInternal,
      {
        sessionId,
      }
    );

    return { resumed: workflowId.length > 0 };
  },
});

export const touchAgentActionInternal = internalMutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    const now = getCurrentUTCTimestamp();
    await ctx.db.patch(sessionId, {
      lastAgentActionAt: now,
      lastActiveAt: now,
    });
  },
});

export const runSetupGenerationInternal = internalAction({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    feedback: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId, feedback }) => {
    const session = await ctx.runQuery(internal.setupSessions.getByIdInternal, {
      sessionId,
    });
    if (!session) {
      throw new Error("Setup session not found");
    }

    const generationFeedback =
      feedback?.trim() || session.generationFeedback?.trim() || null;
    const inputMode = getSetupSessionInputMode(session);
    const resolvedUseCaseKey = resolveWorkspaceUseCaseKey(session.useCaseKey);
    const generationRevision = session.generationRevision ?? 0;
    // This is the only text that may anchor an improved description. URL
    // analysis can provide supplemental, source-attributed facts but never
    // replace the user's original submission with an LLM summary.
    const sourceOfTruthSeed =
      session.rawUserDescription?.trim() ??
      session.seedDescription?.trim() ??
      "";
    const isProfileRevision = generationFeedback !== null;
    let generationStage: "url_analysis" | "profile_generation" =
      !isProfileRevision && inputMode === "url"
        ? "url_analysis"
        : "profile_generation";

    try {
      const analyzedUrl =
        !isProfileRevision && inputMode === "url" && session.sourceUrl
          ? await analyzeSetupUrl({
              operation: "setupSessionAnalyzeUrl",
              url: session.sourceUrl,
            })
          : null;

      if (analyzedUrl) {
        await ctx.runMutation(internal.agentTelemetry.insertUsageEvent, {
          agentName: "Setup Agent",
          model: analyzedUrl.telemetry.model,
          provider: analyzedUrl.telemetry.usage.providerSelected ?? undefined,
          providerMetadata: analyzedUrl.telemetry.providerMetadata,
          threadId: session.setupThreadId,
          usage: analyzedUrl.telemetry.usage,
          userId: session.userId,
        });

        await persistRawModelResponse(ctx, {
          threadId: session.setupThreadId,
          agentName: "Setup Agent",
          request: analyzedUrl.telemetry.request,
          response: analyzedUrl.telemetry.response,
          providerMetadata: analyzedUrl.telemetry.providerMetadata,
        });
      }

      generationStage = "profile_generation";
      const initialGeneration = !isProfileRevision
        ? await generateInitialSetupDraft({
            keyProblems: analyzedUrl?.keyProblems,
            operation: "setupSessionGenerateDraft",
            seedDescription: sourceOfTruthSeed,
            targetAudience: analyzedUrl?.targetAudience,
            useCaseKey: resolvedUseCaseKey,
          })
        : null;
      const profileRevision = isProfileRevision
        ? await generateSetupProfileRevision({
            currentImprovedDescription: session.improvedDescription,
            currentProfiles: session.generatedProfiles ?? null,
            operation: "setupSessionReviseProfiles",
            revisionFeedback: generationFeedback,
            seedDescription: sourceOfTruthSeed,
            useCaseKey: resolvedUseCaseKey,
          })
        : null;
      const generation = initialGeneration ?? profileRevision;
      if (!generation) {
        throw new Error("Setup generation mode was not resolved.");
      }
      const improvedDescription =
        initialGeneration?.improvedDescription ??
        session.improvedDescription ??
        sourceOfTruthSeed;
      const generatedProfiles = markWorkspaceProfilesAsAiGenerated(
        generation.icps
      );
      const now = getCurrentUTCTimestamp();

      await ctx.runMutation(internal.agentTelemetry.insertUsageEvent, {
        agentName: "Setup Agent",
        model: generation.telemetry.model,
        provider: generation.telemetry.usage.providerSelected ?? undefined,
        providerMetadata: generation.telemetry.providerMetadata,
        threadId: session.setupThreadId,
        usage: generation.telemetry.usage,
        userId: session.userId,
      });

      await persistRawModelResponse(ctx, {
        threadId: session.setupThreadId,
        agentName: "Setup Agent",
        request: generation.telemetry.request,
        response: generation.telemetry.response,
        providerMetadata: generation.telemetry.providerMetadata,
      });

      const generationResult = await ctx.runMutation(
        internal.setupSessions.recordGenerationResultInternal,
        {
          sessionId,
          generationRevision,
          improvedDescription,
          generatedProfiles,
          draftName:
            session.draftName ??
            (isProfileRevision ? undefined : analyzedUrl?.businessName) ??
            session.draftName,
          generationCompletedAt: now,
        }
      );

      if (!generationResult.updated) {
        return { success: false, stale: true };
      }

      const assistantMessageId = await saveSetupAssistantMessage(
        ctx,
        session,
        buildSetupGenerationReadyMessage({
          profileCount: generatedProfiles.length,
          useCaseKey: resolvedUseCaseKey,
        })
      );
      await ctx.runMutation(
        internal.setupSessions.recordSetupProfileSnapshotInternal,
        {
          sessionId,
          generationRevision,
          assistantMessageId,
          sourceMessageId: session.generationSourceMessageId,
          improvedDescription,
          generatedProfiles,
        }
      );

      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setupSessionsLogger.error("Setup generation failed", {
        error: errorMessage,
        sessionId: String(sessionId),
        stage: generationStage,
        threadId: session.setupThreadId,
      });
      await ctx.runMutation(
        internal.setupSessions.markGenerationFailedInternal,
        {
          sessionId,
          generationRevision,
          errorMessage:
            generationStage === "url_analysis"
              ? "We couldn't analyze that website. Try again or paste a manual description."
              : "The setup draft could not be generated. Please try again.",
        }
      );
      return { success: false };
    }
  },
});

export const recordGenerationResultInternal = internalMutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    generationRevision: v.optional(v.number()),
    improvedDescription: v.string(),
    generatedProfiles: v.array(icpValidator),
    draftName: v.optional(v.string()),
    generationCompletedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (
      !session ||
      session.status !== "generating_profiles" ||
      (args.generationRevision !== undefined &&
        (session.generationRevision ?? 0) !== args.generationRevision)
    ) {
      return { updated: false as const };
    }

    const now = getCurrentUTCTimestamp();
    await ctx.db.patch(args.sessionId, {
      status: "awaiting_icp_confirmation",
      improvedDescription: args.improvedDescription,
      generatedProfiles: args.generatedProfiles,
      draftName: args.draftName,
      previewWorkflowId: undefined,
      previewDiscoveryStartedAt: undefined,
      previewProspectIds: undefined,
      previewReviewMode: undefined,
      previewReadyAt: undefined,
      previewApprovedAt: undefined,
      generationCompletedAt: args.generationCompletedAt,
      generationErrorAt: undefined,
      generationFeedback: undefined,
      lastAgentActionAt: now,
      lastActiveAt: now,
      statusUpdatedAt: now,
      errorCode: undefined,
      errorMessage: undefined,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      status: "awaiting_icp_confirmation",
      improvedDescription: args.improvedDescription,
      generatedProfiles: args.generatedProfiles,
      draftName: args.draftName,
      generationCompletedAt: args.generationCompletedAt,
      statusUpdatedAt: now,
      lastAgentActionAt: now,
      lastActiveAt: now,
    });

    return { updated: true as const };
  },
});

export const recordSetupProfileSnapshotInternal = internalMutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    generationRevision: v.number(),
    assistantMessageId: v.string(),
    sourceMessageId: v.optional(v.string()),
    improvedDescription: v.string(),
    generatedProfiles: v.array(icpValidator),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (
      !session ||
      (session.generationRevision ?? 0) !== args.generationRevision ||
      !args.sourceMessageId ||
      !args.improvedDescription.trim() ||
      !args.generatedProfiles.length
    ) {
      return { inserted: false as const };
    }

    const existing = await ctx.db
      .query("setupProfileSnapshots")
      .withIndex("by_session_revision", (q) =>
        q
          .eq("sessionId", args.sessionId)
          .eq("generationRevision", args.generationRevision)
      )
      .unique();
    if (existing) {
      return { inserted: false as const, snapshotId: existing._id };
    }

    const snapshotId = await ctx.db.insert("setupProfileSnapshots", {
      userId: session.userId,
      sessionId: session._id,
      setupThreadId: session.setupThreadId,
      sourceMessageId: args.sourceMessageId,
      assistantMessageId: args.assistantMessageId,
      generationRevision: args.generationRevision,
      mode: session.mode,
      useCaseKey: resolveWorkspaceUseCaseKey(session.useCaseKey),
      improvedDescription: args.improvedDescription,
      generatedProfiles: args.generatedProfiles,
      createdAt: getCurrentUTCTimestamp(),
    });

    return { inserted: true as const, snapshotId };
  },
});

export const listSetupProfileSnapshots = query({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    const user = await requireViewerUser(ctx);
    const session = await getSetupSessionByThreadId(ctx.db, threadId);
    if (!session || session.userId !== user._id) {
      throw new Error("Setup session not found");
    }

    const snapshots = await ctx.db
      .query("setupProfileSnapshots")
      .withIndex("by_setup_thread", (q) => q.eq("setupThreadId", threadId))
      .order("desc")
      .take(30);

    return snapshots.reverse().map((snapshot) => ({
      sessionId: snapshot.sessionId,
      mode: snapshot.mode,
      sourceMessageId: snapshot.sourceMessageId,
      assistantMessageId: snapshot.assistantMessageId,
      generationRevision: snapshot.generationRevision,
      useCaseKey: resolveWorkspaceUseCaseKey(snapshot.useCaseKey),
      generatedProfiles: snapshot.generatedProfiles,
      createdAt: snapshot.createdAt,
    }));
  },
});

async function approveSetupIcpsForSession(
  ctx: MutationCtx,
  session: SetupSessionDoc,
  generatedProfiles: NonNullable<SetupSessionDoc["generatedProfiles"]>,
  options?: {
    sourceMessageId?: string;
  }
) {
  if (session.status !== "awaiting_icp_confirmation") {
    throw new Error("Ideal profiles are not awaiting confirmation.");
  }
  if (generatedProfiles.length < 3) {
    throw new Error("At least three ideal profiles are required.");
  }

  const normalizedProfiles = normalizeWorkspaceProfiles(generatedProfiles);
  validateWorkspaceProfiles(normalizedProfiles);
  const reconciliation = reconcileWorkspaceIcpUpdate({
    existingIcps: session.generatedProfiles ?? [],
    incomingIcps: normalizedProfiles,
    markChangedProfilesManual: true,
  });

  const now = getCurrentUTCTimestamp();
  const nextPreviewRevision = (session.previewRevision ?? 0) + 1;
  const sourceMessageId = options?.sourceMessageId?.trim();
  const nextSessionState = {
    status: "provisioning_preview_workspace",
    generatedProfiles: reconciliation.nextIcps,
    previewRevision: nextPreviewRevision,
    previewWorkflowId: undefined,
    previewDiscoveryStartedAt: undefined,
    previewProspectIds: undefined,
    previewReviewMode: undefined,
    previewReadyAt: undefined,
    previewApprovedAt: undefined,
    errorCode: undefined,
    errorMessage: undefined,
    statusUpdatedAt: now,
    lastUserActionAt: now,
    lastActiveAt: now,
    ...(sourceMessageId ? { generationSourceMessageId: sourceMessageId } : {}),
  } as const;
  await ctx.db.patch(session._id, nextSessionState);
  await maybeSignalStateChanged(ctx, {
    ...session,
    ...nextSessionState,
  });
  if (session.previewWorkflowId) {
    await ctx.scheduler.runAfter(
      0,
      internal.workflows.preview.cancelPreviewWorkflowByIdInternal,
      {
        workflowId: session.previewWorkflowId,
      }
    );
  }
  await ctx.scheduler.runAfter(
    0,
    internal.prospects.deletePreviewProspectsForSessionRevisionInternal,
    {
      sessionId: session._id,
      previewRevision: nextPreviewRevision,
      deleteOlderRevisions: true,
    }
  );
  return {
    success: true as const,
    status: "provisioning_preview_workspace" as const,
    previewRevision: nextPreviewRevision,
  };
}

/**
 * The setup chat is the approval surface. Resolve the session server-side so
 * the model never supplies an ID, then anchor the durable transition to the
 * user message that explicitly approved the current profiles.
 */
export const approveSetupIdealProfilesFromAgentInternal = internalMutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    sourceMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Setup session not found.");
    }

    return await approveSetupIcpsForSession(
      ctx,
      session,
      session.generatedProfiles ?? [],
      { sourceMessageId: args.sourceMessageId }
    );
  },
});

export const confirmSetupIcps = mutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const session = await requireOwnedSetupSession(
      ctx,
      args.sessionId,
      user._id
    );
    return await approveSetupIcpsForSession(
      ctx,
      session,
      session.generatedProfiles ?? []
    );
  },
});

export const approveSetupIcps = mutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    generatedProfiles: v.array(icpValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const session = await requireOwnedSetupSession(
      ctx,
      args.sessionId,
      user._id
    );
    return await approveSetupIcpsForSession(
      ctx,
      session,
      args.generatedProfiles
    );
  },
});

export const getSetupPreviewCandidateIdsInternal = internalQuery({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) {
      return [] as Id<"prospects">[];
    }

    const prospects = await listSetupPreviewProspects(ctx.db, session);
    return resolveSetupPreviewCandidateIds(session, prospects);
  },
});

export const getSetupPreviewProgressInternal = internalQuery({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) {
      return {
        discoveredCount: 0,
        qualifiedCount: 0,
        enrichedCount: 0,
        selectedCount: 0,
      };
    }

    const prospects = await listSetupPreviewProspects(ctx.db, session);
    const previewCandidateIds = resolveSetupPreviewCandidateIds(
      session,
      prospects
    );
    return buildPreviewProgressState(previewCandidateIds.length, prospects);
  },
});

export const getSetupPreviewOrchestrationStateInternal = internalQuery({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) {
      return {
        readyCount: 0,
        discoveredCandidateCount: 0,
        qualifiedCount: 0,
        pendingQualificationCount: 0,
        inFlightEnrichmentCount: 0,
        rankedQualifiedIds: [] as Id<"prospects">[],
        rankedReadyIds: [] as Id<"prospects">[],
        rankedPreviewIds: [] as Id<"prospects">[],
      };
    }

    const prospects = await listSetupPreviewProspects(ctx.db, session);
    return buildSetupPreviewOrchestrationState(prospects);
  },
});

export const markPreviewReadyInternal = internalMutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    previewProspectIds: v.array(v.id("prospects")),
    previewReviewMode: setupPreviewReviewModeValidator,
  },
  handler: async (
    ctx,
    { sessionId, previewProspectIds, previewReviewMode }
  ) => {
    const session = await ctx.db.get(sessionId);
    if (!session) {
      throw new Error("Setup session not found");
    }
    await markPreviewReady(ctx, session, {
      previewProspectIds,
      previewReviewMode:
        normalizeSetupPreviewReviewMode(previewReviewMode) ?? "fallback",
    });
  },
});

export const syncSetupPreviewCandidatesInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const session = await getSetupSessionByTargetWorkspaceId(
      ctx.db,
      workspaceId
    );
    if (
      !session ||
      ![
        "discovering_preview_prospects",
        "preview_search_in_progress",
        "awaiting_preview_confirmation",
      ].includes(session.status)
    ) {
      return {
        updated: false,
        selectedCount: session?.previewProspectIds?.length ?? 0,
      };
    }

    const prospects = await listSetupPreviewProspects(ctx.db, session);
    const previewSnapshot = getResolvedSetupPreviewReviewSnapshot(
      session,
      prospects
    );

    if (!previewSnapshot) {
      if (!session.previewWorkflowId) {
        await ctx.scheduler.runAfter(
          0,
          internal.setupSessions.resumePreviewWorkflowIfNeededInternal,
          {
            sessionId: session._id,
          }
        );
      }
      return {
        updated: false,
        selectedCount: 0,
      };
    }

    if (session.status === "awaiting_preview_confirmation") {
      const currentPreviewProspectIds = session.previewProspectIds ?? [];
      const currentPreviewReviewMode = normalizeSetupPreviewReviewMode(
        session.previewReviewMode
      );
      const snapshotChanged =
        currentPreviewReviewMode !== previewSnapshot.previewReviewMode ||
        !haveSamePreviewProspectIds(
          currentPreviewProspectIds,
          previewSnapshot.previewProspectIds
        );

      if (!snapshotChanged) {
        return {
          updated: false,
          selectedCount: previewSnapshot.previewProspectIds.length,
        };
      }

      await updatePreviewReviewSnapshot(ctx, session, previewSnapshot);
      return {
        updated: true,
        selectedCount: previewSnapshot.previewProspectIds.length,
      };
    }

    await markPreviewReady(ctx, session, previewSnapshot);
    return {
      updated: true,
      selectedCount: previewSnapshot.previewProspectIds.length,
    };
  },
});

export const recordApprovedSetupProfileSignalsInternal = internalMutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    previewRevision: v.number(),
    generatedProfiles: v.array(icpValidator),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get("workspaceSetupSessions", args.sessionId);
    if (
      !session ||
      session.status !== "provisioning_preview_workspace" ||
      session.previewRevision !== args.previewRevision
    ) {
      return { updated: false as const };
    }

    if (
      listWorkspaceIcpSignalMissingIndices(args.generatedProfiles).length > 0
    ) {
      throw new Error("Approved setup profiles are missing targeting signals.");
    }

    await ctx.db.patch("workspaceSetupSessions", args.sessionId, {
      generatedProfiles: args.generatedProfiles,
      lastAgentActionAt: getCurrentUTCTimestamp(),
    });

    return { updated: true as const };
  },
});

export const recordPreviewWorkspaceProvisionedInternal = internalMutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    targetWorkspaceId: v.id("workspaces"),
    workspaceName: v.string(),
  },
  handler: async (ctx, { sessionId, targetWorkspaceId, workspaceName }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) {
      throw new Error("Setup session not found");
    }

    const now = getCurrentUTCTimestamp();
    await ctx.db.patch(sessionId, {
      targetWorkspaceId,
      draftName: workspaceName,
      status: "discovering_preview_prospects",
      previewWorkflowId: undefined,
      previewDiscoveryStartedAt: now,
      statusUpdatedAt: now,
      lastAgentActionAt: now,
      lastActiveAt: now,
      errorCode: undefined,
      errorMessage: undefined,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      targetWorkspaceId,
      draftName: workspaceName,
      status: "discovering_preview_prospects",
      previewWorkflowId: undefined,
      previewDiscoveryStartedAt: now,
      statusUpdatedAt: now,
      lastAgentActionAt: now,
      lastActiveAt: now,
      errorCode: undefined,
      errorMessage: undefined,
    });
  },
});

export const provisionDraftWorkspaceForPreviewInternal = internalAction({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.runQuery(internal.setupSessions.getByIdInternal, {
      sessionId,
    });
    if (!session) {
      throw new Error("Setup session not found");
    }
    if (
      !session.generatedProfiles ||
      !session.improvedDescription ||
      typeof session.previewRevision !== "number"
    ) {
      throw new Error("Setup session is missing generated workspace data");
    }

    let approvedProfiles = session.generatedProfiles;
    const missingSignalIndices =
      listWorkspaceIcpSignalMissingIndices(approvedProfiles);
    if (missingSignalIndices.length > 0) {
      try {
        const signalRefresh = await ctx.runAction(
          internal.workspaceIcpSignals
            .generateWorkspaceIcpSignalsForProfilesInternal,
          {
            icps: approvedProfiles,
            targetIndices: missingSignalIndices,
            useCaseKey: resolveWorkspaceUseCaseKey(session.useCaseKey),
            workspaceDescription: session.improvedDescription,
          }
        );

        if (!signalRefresh.success) {
          await ctx.runMutation(
            internal.setupSessions.markPreviewProvisioningFailedInternal,
            {
              sessionId,
              previewRevision: session.previewRevision,
              errorCode: "preview_targeting_refresh_failed",
              errorMessage:
                "We couldn't refresh targeting for every ideal profile. Please approve them again to retry.",
            }
          );
          return { targetWorkspaceId: null };
        }

        const persisted = await ctx.runMutation(
          internal.setupSessions.recordApprovedSetupProfileSignalsInternal,
          {
            sessionId,
            previewRevision: session.previewRevision,
            generatedProfiles: signalRefresh.icps,
          }
        );
        if (!persisted.updated) {
          return { targetWorkspaceId: null };
        }
        approvedProfiles = signalRefresh.icps;
      } catch (error) {
        setupSessionsLogger.error("Setup profile signal refresh failed", {
          error: error instanceof Error ? error.message : String(error),
          sessionId: String(sessionId),
          threadId: session.setupThreadId,
        });
        await ctx.runMutation(
          internal.setupSessions.markPreviewProvisioningFailedInternal,
          {
            sessionId,
            previewRevision: session.previewRevision,
            errorCode: "preview_targeting_refresh_failed",
            errorMessage:
              "We couldn't refresh targeting for every ideal profile. Please approve them again to retry.",
          }
        );
        return { targetWorkspaceId: null };
      }
    }

    const normalizedWorkspaceName = formatWorkspaceName(session.draftName);
    let targetWorkspaceId: Id<"workspaces">;

    try {
      const linkedWorkspaceId =
        session.targetWorkspaceId ?? session.existingWorkspaceId ?? null;

      if (linkedWorkspaceId) {
        if (session.refineFromWorkspace) {
          throw new Error(
            "This legacy workspace update session is no longer supported."
          );
        }
        await ctx.runMutation(internal.workspaces.updateWorkspaceInternal, {
          workspaceId: linkedWorkspaceId,
          rawUserDescription: session.rawUserDescription,
          seedDescription: session.seedDescription,
          improvedDescription: session.improvedDescription,
          description: session.improvedDescription,
          icps: approvedProfiles,
          sourceUrl: getSetupSessionSourceUrl(session),
          descriptionSource: getSetupSessionInputMode(session),
          useCaseKey: resolveWorkspaceUseCaseKey(session.useCaseKey),
          fitScoreMin: 70,
          fitScoreMax: 100,
        });
        targetWorkspaceId = linkedWorkspaceId;
      } else {
        targetWorkspaceId = await ctx.runMutation(
          internal.workspaces.createWorkspaceInternal,
          {
            userId: session.userId,
            name: normalizedWorkspaceName,
            description: session.improvedDescription,
            rawUserDescription:
              session.rawUserDescription ?? session.seedDescription,
            seedDescription:
              session.seedDescription ?? session.improvedDescription,
            improvedDescription: session.improvedDescription,
            icps: approvedProfiles,
            sourceUrl: getSetupSessionSourceUrl(session),
            descriptionSource: getSetupSessionInputMode(session),
            useCaseKey: resolveWorkspaceUseCaseKey(session.useCaseKey),
            isDefault: false,
            entitlementSlot: session.entitlementSlot ?? 1,
            consumeReservedEntitlementSlot: session.entitlementSlot ?? 1,
            consumingSetupSessionId: session._id,
            fitScoreMin: 70,
            fitScoreMax: 100,
          }
        );
      }

      await ctx.runMutation(internal.workspaces.setOnboardingThreadInternal, {
        workspaceId: targetWorkspaceId,
        threadId: session.setupThreadId,
      });
      await ctx.runMutation(
        internal.setupSessions.recordPreviewWorkspaceProvisionedInternal,
        {
          sessionId,
          targetWorkspaceId,
          workspaceName: normalizedWorkspaceName,
        }
      );
    } catch (error) {
      console.error("[SetupSessions] Preview workspace provisioning failed", {
        error: error instanceof Error ? error.message : String(error),
        sessionId: String(sessionId),
        threadId: session.setupThreadId,
      });
      await ctx.runMutation(
        internal.setupSessions.markPreviewProvisioningFailedInternal,
        {
          sessionId,
          previewRevision: session.previewRevision,
          errorMessage:
            "We couldn't start the preview. Please approve these ideal profiles again to retry.",
        }
      );
      return { targetWorkspaceId: null };
    }

    await ctx.runAction(internal.setupSessions.startPreviewWorkflowInternal, {
      sessionId,
    });
    await saveSetupAssistantMessage(
      ctx,
      session,
      `Draft workspace ${normalizedWorkspaceName} is ready. I'm now finding real ${getWorkspaceUseCase(resolveWorkspaceUseCaseKey(session.useCaseKey)).entityPlural.toLowerCase()} for the preview.`
    );
    await ctx.runMutation(internal.setupSessions.touchAgentActionInternal, {
      sessionId,
    });

    return { targetWorkspaceId };
  },
});

export const markGenerationFailedInternal = internalMutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    generationRevision: v.optional(v.number()),
    errorMessage: v.string(),
  },
  handler: async (ctx, { sessionId, generationRevision, errorMessage }) => {
    const session = await ctx.db.get(sessionId);
    if (
      !session ||
      session.status !== "generating_profiles" ||
      (generationRevision !== undefined &&
        (session.generationRevision ?? 0) !== generationRevision)
    ) {
      return { updated: false as const };
    }

    const now = getCurrentUTCTimestamp();
    await ctx.db.patch(sessionId, {
      status: "awaiting_input",
      generationCompletedAt: undefined,
      generationErrorAt: now,
      lastAgentActionAt: now,
      lastActiveAt: now,
      statusUpdatedAt: now,
      errorCode: "generation_failed",
      errorMessage,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      status: "awaiting_input",
      generationCompletedAt: undefined,
      generationErrorAt: now,
      lastAgentActionAt: now,
      lastActiveAt: now,
      statusUpdatedAt: now,
      errorCode: "generation_failed",
      errorMessage,
    });

    return { updated: true as const };
  },
});

export const markPreviewProvisioningFailedInternal = internalMutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    previewRevision: v.number(),
    errorCode: v.optional(v.string()),
    errorMessage: v.string(),
  },
  handler: async (
    ctx,
    { sessionId, previewRevision, errorCode, errorMessage }
  ) => {
    const session = await ctx.db.get("workspaceSetupSessions", sessionId);
    if (
      !session ||
      session.status !== "provisioning_preview_workspace" ||
      session.previewRevision !== previewRevision
    ) {
      return { updated: false as const };
    }

    await ctx.db.patch(
      "workspaceSetupSessions",
      sessionId,
      buildPreviewProvisioningFailurePatch({
        now: getCurrentUTCTimestamp(),
        errorCode,
        errorMessage,
      })
    );

    return { updated: true as const };
  },
});

export const clearErroneousPreviewCapacityStateInternal = internalMutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get("workspaceSetupSessions", sessionId);
    if (
      !session?.targetWorkspaceId ||
      !isSetupPreviewProspectWriteStatus(session.status)
    ) {
      return { cleared: false as const };
    }

    const workspace = await ctx.db.get("workspaces", session.targetWorkspaceId);
    if (
      !workspace ||
      workspace.userId !== session.userId ||
      workspace.setupCompletedAt !== undefined ||
      workspace.prospectingWorkflowStatus !== "limit_reached"
    ) {
      return { cleared: false as const };
    }

    await ctx.db.patch(
      "workspaces",
      workspace._id,
      buildSetupPreviewCapacityResetPatch()
    );

    return { cleared: true as const };
  },
});

export const markPreviewWorkflowSemanticFailureInternal = internalMutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    retryable: v.boolean(),
    errorCode: v.string(),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get("workspaceSetupSessions", args.sessionId);
    if (
      !session ||
      !["discovering_preview_prospects", "preview_search_in_progress"].includes(
        session.status
      ) ||
      session.previewReadyAt
    ) {
      return { updated: false as const };
    }

    const now = getCurrentUTCTimestamp();
    const nextStatus = args.retryable
      ? ("awaiting_icp_confirmation" as const)
      : ("failed" as const);
    const patch = {
      status: nextStatus,
      previewWorkflowId: undefined,
      previewDiscoveryStartedAt: undefined,
      previewProspectIds: undefined,
      previewReviewMode: undefined,
      previewReadyAt: undefined,
      previewApprovedAt: undefined,
      lastAgentActionAt: now,
      lastActiveAt: now,
      statusUpdatedAt: now,
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
    };

    await ctx.db.patch("workspaceSetupSessions", args.sessionId, patch);
    await maybeSignalStateChanged(ctx, { ...session, ...patch });

    return { updated: true as const };
  },
});

export const markPreviewDiscoveryFailedInternal = internalMutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    errorMessage: v.string(),
  },
  handler: async (ctx, { sessionId, errorMessage: _errorMessage }) => {
    const session = await ctx.db.get(sessionId);
    if (
      !session ||
      !["discovering_preview_prospects", "preview_search_in_progress"].includes(
        session.status
      ) ||
      session.previewReadyAt
    ) {
      return;
    }

    const now = getCurrentUTCTimestamp();
    await ctx.db.patch(sessionId, {
      status: "preview_search_in_progress",
      previewWorkflowId: undefined,
      previewReviewMode: undefined,
      previewReadyAt: undefined,
      lastAgentActionAt: now,
      lastActiveAt: now,
      statusUpdatedAt: now,
      errorCode: undefined,
      errorMessage: undefined,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      status: "preview_search_in_progress",
      previewWorkflowId: undefined,
      previewReviewMode: undefined,
      previewReadyAt: undefined,
      lastAgentActionAt: now,
      lastActiveAt: now,
      statusUpdatedAt: now,
      errorCode: undefined,
      errorMessage: undefined,
    });
  },
});

export const markPreviewSearchInProgressInternal = internalMutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (
      !session ||
      !["discovering_preview_prospects", "preview_search_in_progress"].includes(
        session.status
      ) ||
      session.previewReadyAt
    ) {
      return;
    }

    const now = getCurrentUTCTimestamp();
    await ctx.db.patch(sessionId, {
      status: "preview_search_in_progress",
      previewWorkflowId: undefined,
      previewReviewMode: undefined,
      lastAgentActionAt: now,
      lastActiveAt: now,
      statusUpdatedAt: now,
      errorCode: undefined,
      errorMessage: undefined,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      status: "preview_search_in_progress",
      previewWorkflowId: undefined,
      previewReviewMode: undefined,
      lastAgentActionAt: now,
      lastActiveAt: now,
      statusUpdatedAt: now,
      errorCode: undefined,
      errorMessage: undefined,
    });
  },
});
