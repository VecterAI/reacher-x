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
import { createThread, saveMessage } from "@convex-dev/agent";
import { v } from "convex/values";
import { logger } from "../shared/lib/logger";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import {
  getDefaultWorkspaceForUser,
  getUserByIdentity,
  requireOwnedWorkspace,
  requireUser,
} from "./lib/accessHelpers";
import { hasRequiredWorkspaceAgentData } from "./lib/workspaceSetup";
import {
  getActiveSetupSessionForUser,
  getActiveSetupSessionByTargetWorkspaceId,
  getSetupSessionByTargetWorkspaceId,
  getSetupSessionByThreadId,
  getSetupSessionDisplayName,
  hasSetupGenerationData,
  isTerminalSetupSessionStatus,
  resolveNextSetupDraftOrdinal,
} from "./lib/setupSessionCore";
import {
  isSetupSessionAccessibleForUser,
  resolveWorkspaceEntitlementSlot,
  resolveNextEntitlementSlotForUser,
} from "./lib/workspaceEntitlements";
import { getSetupWorkflowEventName } from "./lib/setupWorkflowEvents";
import { buildAdditionalWorkspaceSetupPrompt } from "./agents/prompts";
import { persistRawModelResponse } from "./lib/modelTelemetry";
import {
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
  type SetupInputPhase,
  type SetupVisibleStep,
  type SetupVisibleStepId,
} from "./lib/setupFlowCore";
import { PREVIEW_BATCH_LIMITS } from "./lib/previewBatchLimits";
import { isProspectReadyQualifiedEnriched } from "./lib/readModelHelpers";
import { isPaidPlanTier } from "./lib/planConstants";
import { upsertNotificationByKey } from "./lib/notificationHelpers";
import { deleteWorkspaceCascade } from "./lib/deleteWorkspaceCascade";
import { generateSetupDraft } from "./lib/setupGenerationCore";
import { analyzeSetupUrl } from "./lib/setupUrlAnalysisCore";
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
const SETUP_GREETING_PROMPT = "__INIT__";
const SETUP_GREETING_LOOKBACK = 25;

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
  const requiresConnections = !(googleConnected && connectionState.xConnected);
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
    return { success: true as const, alreadyCompleted: true as const };
  }

  if (session.status !== "awaiting_plan") {
    throw new Error("Setup session is not awaiting a plan choice.");
  }

  const now = getCurrentUTCTimestamp();

  await ctx.db.patch(session._id, {
    status: "awaiting_preferences",
    planChoice,
    statusUpdatedAt: now,
    lastUserActionAt: now,
    lastActiveAt: now,
  });

  await maybeSignalStateChanged(ctx, {
    ...session,
    status: "awaiting_preferences",
    planChoice,
    statusUpdatedAt: now,
    lastUserActionAt: now,
    lastActiveAt: now,
  });

  return { success: true as const };
}

async function getAccessibleActiveSetupSessionForUser(
  ctx: ViewerCtx,
  userId: Id<"users">,
  options?: { includeRefine?: boolean }
): Promise<SetupSessionDoc | null> {
  const session = await getActiveSetupSessionForUser(ctx.db, userId, options);
  if (!session) {
    return null;
  }
  return (await isSetupSessionAccessibleForUser(ctx, session)) ? session : null;
}

async function getAccessibleActiveSetupSessionForTargetWorkspace(
  ctx: ViewerCtx,
  workspaceId: Id<"workspaces">,
  options?: { includeRefine?: boolean }
): Promise<SetupSessionDoc | null> {
  const session = await getActiveSetupSessionByTargetWorkspaceId(
    ctx.db,
    workspaceId,
    options
  );
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

async function getSetupGreetingThreadState(
  ctx: ViewerCtx | ActionCtx,
  threadId: string
) {
  const messages = await ctx.runQuery(
    components.agent.messages.listMessagesByThreadId,
    {
      threadId,
      order: "desc",
      paginationOpts: { numItems: SETUP_GREETING_LOOKBACK, cursor: null },
    }
  );

  const initMessage =
    messages.page.find(
      (message) =>
        message.message?.role === "user" &&
        message.text === SETUP_GREETING_PROMPT
    ) ?? null;

  const hasAssistantResponse = initMessage
    ? messages.page.some(
        (message) =>
          message.order === initMessage.order &&
          message.message?.role === "assistant"
      )
    : false;

  return {
    initMessage,
    hasAssistantResponse,
  };
}

async function saveSetupAssistantMessage(
  ctx: ActionCtx,
  session: SetupSessionDoc,
  content: string
) {
  await saveMessage(ctx, components.agent, {
    threadId: session.setupThreadId,
    agentName: "Setup Agent",
    message: {
      role: "assistant",
      content,
    },
  });
}

function buildSetupInputPrompt(args: {
  useCaseKey: WorkspaceUseCaseKey;
  inputMode: "url" | "manual";
  inputValue: string;
  sourceUrl?: string | null;
}): string {
  const useCase = getWorkspaceUseCase(args.useCaseKey);
  const detectedUrl = args.sourceUrl?.trim() || null;

  if (args.inputMode === "url" && detectedUrl) {
    return `Use this website URL to set up my ${useCase.displayName} workspace: ${detectedUrl}. Generate the improved description and ${useCase.profileLabelPlural.toLowerCase()} in this thread.`;
  }

  return `Use this description to set up my ${useCase.displayName} workspace:\n\n${args.inputValue}\n\nGenerate the improved description and ${useCase.profileLabelPlural.toLowerCase()} in this thread.`;
}

function buildSetupFeedbackPrompt(args: {
  useCaseKey: WorkspaceUseCaseKey;
  feedback: string;
}): string {
  const useCase = getWorkspaceUseCase(args.useCaseKey);
  return `Please revise the current setup draft using this feedback:\n\n${args.feedback}\n\nKeep the user-facing language aligned with ${useCase.displayName} and regenerate the improved description and ${useCase.profileLabelPlural.toLowerCase()}.`;
}

function buildSetupGenerationReadyMessage(args: {
  profileCount: number;
  useCaseKey: WorkspaceUseCaseKey;
}) {
  const useCase = getWorkspaceUseCase(args.useCaseKey);
  return `I generated ${args.profileCount} ${useCase.profileLabelPlural.toLowerCase()} for this draft. Review them in the onboarding panel and continue when you're happy.`;
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

    const session = await getAccessibleActiveSetupSessionForUser(
      ctx,
      user._id,
      {
        includeRefine: false,
      }
    );
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
      session = await getAccessibleActiveSetupSessionForUser(ctx, user._id, {
        includeRefine: false,
      });
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
      session = await getAccessibleActiveSetupSessionForUser(ctx, user._id, {
        includeRefine: false,
      });
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
      };
    }

    const user = await getUserByIdentity(ctx, identity);
    if (!user) {
      return {
        activeSession: null,
        suggestedMode: null as SetupSessionDoc["mode"] | null,
      };
    }

    const activeSession = await getAccessibleActiveSetupSessionForUser(
      ctx,
      user._id,
      { includeRefine: false }
    );
    if (activeSession) {
      return {
        activeSession: await toPublicSetupSessionState(
          ctx,
          activeSession,
          user
        ),
        suggestedMode: activeSession.mode,
      };
    }

    const defaultWorkspace = await getDefaultWorkspaceForUser(ctx, user._id);
    if (!defaultWorkspace) {
      return {
        activeSession: null,
        suggestedMode: "first_workspace" as const,
      };
    }

    if (!hasRequiredWorkspaceAgentData(defaultWorkspace)) {
      return {
        activeSession: null,
        suggestedMode: "first_workspace" as const,
      };
    }

    // Workspace can have ICPs from preview while onboarding is unfinished
    // (no preference step yet). Without this, deleting a draft or landing on
    // setup with no active session would not auto-bootstrap.
    if (!defaultWorkspace.setupCompletedAt) {
      return {
        activeSession: null,
        suggestedMode: "first_workspace" as const,
      };
    }

    return {
      activeSession: null,
      suggestedMode: null as SetupSessionDoc["mode"] | null,
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

    const session = await getAccessibleActiveSetupSessionForUser(
      ctx,
      user._id,
      {
        includeRefine: false,
      }
    );
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
      user._id,
      { includeRefine: false }
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

    const resolvedUseCaseKey = resolveWorkspaceUseCaseKey(args.useCaseKey);
    const threadTitle =
      args.mode === "new_workspace"
        ? "Workspace setup draft"
        : "Workspace setup";
    const threadSummary =
      args.mode === "new_workspace"
        ? buildAdditionalWorkspaceSetupPrompt(resolvedUseCaseKey).slice(0, 150)
        : undefined;

    const threadId = await createThread(ctx, components.agent, {
      userId: user._id,
      title: threadTitle,
      summary: threadSummary,
    });

    const now = getCurrentUTCTimestamp();
    const draftOrdinal = await resolveNextSetupDraftOrdinal(ctx.db, user._id);
    const entitlementSlot = await resolveNextEntitlementSlotForUser(
      ctx,
      user._id
    );
    const sessionId = await ctx.db.insert("workspaceSetupSessions", {
      userId: user._id,
      mode: args.mode,
      status: "draft",
      setupThreadId: threadId,
      useCaseKey: resolvedUseCaseKey,
      draftOrdinal,
      entitlementSlot,
      lastUserActionAt: now,
      lastActiveAt: now,
      statusUpdatedAt: now,
    });

    const { message } = await saveMessage(ctx, components.agent, {
      threadId,
      prompt: SETUP_GREETING_PROMPT,
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
      greetingOrder: message.order,
      reused: false,
    };
  },
});

export const ensureSetupGreeting = mutation({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }) => {
    const user = await requireViewerUser(ctx);
    const session = await getSetupSessionByThreadId(ctx.db, threadId);
    if (!session || session.userId !== user._id) {
      throw new Error("Setup session not found");
    }
    if (!(await isSetupSessionAccessibleForUser(ctx, session))) {
      throw new Error("Setup session not found");
    }

    // Workspace page "Refine audience": skip greeting noise.
    if (session.targetWorkspaceId && session.status === "awaiting_input") {
      return { scheduled: false, order: null as number | null };
    }

    if (!session.workflowId && !isTerminalSetupSessionStatus(session.status)) {
      await ctx.scheduler.runAfter(
        0,
        internal.setupSessions.startSetupSessionWorkflowInternal,
        {
          sessionId: session._id,
        }
      );
    }

    let { initMessage, hasAssistantResponse } =
      await getSetupGreetingThreadState(ctx, session.setupThreadId);

    if (!initMessage) {
      const saved = await saveMessage(ctx, components.agent, {
        threadId: session.setupThreadId,
        prompt: SETUP_GREETING_PROMPT,
      });
      initMessage = {
        ...saved.message,
        _id: saved.messageId,
      };
      hasAssistantResponse = false;
    }

    if (hasAssistantResponse) {
      return {
        scheduled: false,
        order: initMessage.order,
      };
    }

    await ctx.scheduler.runAfter(0, internal.chat.streamAgentResponse, {
      threadId: session.setupThreadId,
      promptMessageId: initMessage._id,
    });

    return {
      scheduled: true,
      order: initMessage.order,
    };
  },
});

/**
 * Start a setup session anchored to an existing workspace for the Refine-audience flow (/workspace).
 */
export const startWorkspaceRefineSession = mutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const workspace = await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized",
    });

    const activeRefineSession =
      await getAccessibleActiveSetupSessionForTargetWorkspace(
        ctx,
        workspace._id,
        { includeRefine: true }
      );
    if (activeRefineSession?.refineFromWorkspace) {
      return {
        sessionId: activeRefineSession._id,
        threadId: activeRefineSession.setupThreadId,
        reused: true,
      };
    }

    const activeSession =
      await getAccessibleActiveSetupSessionForTargetWorkspace(
        ctx,
        workspace._id,
        { includeRefine: false }
      );
    if (activeSession) {
      return {
        sessionId: activeSession._id,
        threadId: activeSession.setupThreadId,
        reused: true,
      };
    }

    const resolvedUseCaseKey = resolveWorkspaceUseCaseKey(workspace.useCaseKey);
    const threadId = await createThread(ctx, components.agent, {
      userId: user._id,
      title: "Refine audience",
      summary: "Refining ideal customer profiles for your workspace.",
    });

    const now = getCurrentUTCTimestamp();
    const draftOrdinal = await resolveNextSetupDraftOrdinal(ctx.db, user._id);
    const entitlementSlot = await resolveWorkspaceEntitlementSlot(
      ctx,
      workspace
    );
    const seed =
      workspace.seedDescription?.trim() || workspace.description?.trim() || "";
    const improved =
      workspace.improvedDescription?.trim() ||
      workspace.description?.trim() ||
      "";

    const sessionId = await ctx.db.insert("workspaceSetupSessions", {
      userId: user._id,
      mode: "first_workspace",
      status: "awaiting_input",
      setupThreadId: threadId,
      useCaseKey: resolvedUseCaseKey,
      draftOrdinal,
      existingWorkspaceId: workspace._id,
      targetWorkspaceId: workspace._id,
      entitlementSlot,
      refineFromWorkspace: true,
      draftName: workspace.name,
      seedDescription: seed,
      improvedDescription: improved,
      generatedProfiles: workspace.icps ?? [],
      sourceUrl: workspace.sourceUrl,
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

    return { sessionId, threadId };
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
    const now = getCurrentUTCTimestamp();

    await ctx.db.patch(args.sessionId, {
      status: "generating_profiles",
      previewWorkflowId: undefined,
      inputMode: args.inputMode,
      seedDescription: args.inputValue,
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
      seedDescription: args.inputValue,
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

    return { success: true };
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
    const now = getCurrentUTCTimestamp();

    await ctx.db.patch(args.sessionId, {
      status: "generating_profiles",
      previewWorkflowId: undefined,
      generationFeedback: args.feedback.trim(),
      previewDiscoveryStartedAt: undefined,
      previewProspectIds: undefined,
      previewReviewMode: undefined,
      previewReadyAt: undefined,
      previewApprovedAt: undefined,
      generationRequestedAt: now,
      generationCompletedAt: undefined,
      generationErrorAt: undefined,
      errorCode: undefined,
      errorMessage: undefined,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    await saveMessage(ctx, components.agent, {
      threadId: session.setupThreadId,
      prompt: `Please revise the current setup draft using this feedback:\n\n${args.feedback.trim()}`,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      status: "generating_profiles",
      previewWorkflowId: undefined,
      generationFeedback: args.feedback.trim(),
      previewDiscoveryStartedAt: undefined,
      previewProspectIds: undefined,
      previewReviewMode: undefined,
      previewReadyAt: undefined,
      previewApprovedAt: undefined,
      generationRequestedAt: now,
      generationCompletedAt: undefined,
      generationErrorAt: undefined,
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

    if (session.refineFromWorkspace) {
      await ctx.db.patch(args.sessionId, {
        status: "discarded",
        previewWorkflowId: undefined,
        previewProspectIds: approvedPreviewProspectIds,
        discardedAt: now,
        previewApprovedAt: now,
        statusUpdatedAt: now,
        lastUserActionAt: now,
        lastActiveAt: now,
      });
      await maybeSignalStateChanged(ctx, {
        ...session,
        status: "discarded",
        previewWorkflowId: undefined,
        previewProspectIds: approvedPreviewProspectIds,
        discardedAt: now,
        previewApprovedAt: now,
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
        internal.workspaces.restartProspectingWorkflowForSetupInternal,
        {
          workspaceId: session.targetWorkspaceId,
        }
      );
      return { success: true as const };
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
      ...session,
      status: nextStatus,
      previewWorkflowId: undefined,
      previewProspectIds: approvedPreviewProspectIds,
      previewApprovedAt: now,
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
    const now = getCurrentUTCTimestamp();
    const planTier = await getUserPlanTier(ctx.db, user._id);
    const nextStatus = getNextSetupStatusAfterConnections({
      requiresPlan: !isPaidPlanTier(planTier),
    });

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

    return { success: true };
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

export const startSetupSessionWorkflowInternal = internalAction({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
  },
  handler: async (ctx, { sessionId }): Promise<{ workflowId: string }> => {
    const workflowId: Awaited<ReturnType<typeof workflowManager.start>> =
      await workflowManager.start(
        ctx,
        internal.workflows.setup.setupSessionWorkflow,
        { sessionId }
      );

    await ctx.runMutation(internal.setupSessions.markWorkflowStartedInternal, {
      sessionId,
      workflowId: String(workflowId),
    });

    return { workflowId: String(workflowId) };
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
        source: session.refineFromWorkspace ? "refine" : "setup",
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

export const postSetupSessionGreetingInternal = internalAction({
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

    // Workspace page "Refine audience": session is seeded and targets an existing workspace — skip greeting noise.
    if (session.targetWorkspaceId && session.status === "awaiting_input") {
      return;
    }

    let { initMessage, hasAssistantResponse } =
      await getSetupGreetingThreadState(ctx, session.setupThreadId);
    if (!initMessage) {
      const saved = await saveMessage(ctx, components.agent, {
        threadId: session.setupThreadId,
        prompt: SETUP_GREETING_PROMPT,
      });
      initMessage = {
        ...saved.message,
        _id: saved.messageId,
      };
      hasAssistantResponse = false;
    }

    if (!hasAssistantResponse) {
      try {
        await ctx.scheduler.runAfter(0, internal.chat.streamAgentResponse, {
          threadId: session.setupThreadId,
          promptMessageId: initMessage._id,
        });
      } catch (error) {
        setupSessionsLogger.error("Failed to schedule setup greeting stream", {
          error: error instanceof Error ? error.message : String(error),
          sessionId: String(sessionId),
          threadId: session.setupThreadId,
          promptMessageId: initMessage._id,
        });
      }
    }

    await ctx.runMutation(internal.setupSessions.touchAgentActionInternal, {
      sessionId,
    });
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
    const prompt = generationFeedback
      ? buildSetupFeedbackPrompt({
          useCaseKey: resolveWorkspaceUseCaseKey(session.useCaseKey),
          feedback: generationFeedback,
        })
      : buildSetupInputPrompt({
          useCaseKey: resolveWorkspaceUseCaseKey(session.useCaseKey),
          inputMode: getSetupSessionInputMode(session),
          inputValue: session.seedDescription ?? "",
          sourceUrl: getSetupSessionSourceUrl(session) ?? null,
        });

    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId: session.setupThreadId,
      prompt,
    });
    void messageId;

    const inputMode = getSetupSessionInputMode(session);
    const resolvedUseCaseKey = resolveWorkspaceUseCaseKey(session.useCaseKey);
    let generationStage: "url_analysis" | "profile_generation" =
      inputMode === "url" ? "url_analysis" : "profile_generation";

    try {
      const analyzedUrl =
        inputMode === "url" && session.sourceUrl
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
      const generation = await generateSetupDraft({
        currentImprovedDescription: session.improvedDescription,
        currentProfiles: session.generatedProfiles ?? null,
        keyProblems: analyzedUrl?.keyProblems,
        operation: "setupSessionGenerateDraft",
        revisionFeedback: generationFeedback,
        seedDescription:
          analyzedUrl?.seedDescription ?? session.seedDescription ?? "",
        targetAudience: analyzedUrl?.targetAudience,
        useCaseKey: resolvedUseCaseKey,
      });
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

      await ctx.runMutation(
        internal.setupSessions.recordGenerationResultInternal,
        {
          sessionId,
          improvedDescription: generation.improvedDescription,
          generatedProfiles: generation.icps,
          draftName:
            session.draftName ?? analyzedUrl?.businessName ?? session.draftName,
          generationCompletedAt: now,
        }
      );

      await saveSetupAssistantMessage(
        ctx,
        session,
        buildSetupGenerationReadyMessage({
          profileCount: generation.icps.length,
          useCaseKey: resolvedUseCaseKey,
        })
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
    improvedDescription: v.string(),
    generatedProfiles: v.array(
      v.object({
        title: v.string(),
        description: v.string(),
        painPoints: v.array(v.string()),
        channels: v.array(v.string()),
        syntheticPosts: v.optional(v.array(v.string())),
        qualificationKeywords: v.optional(v.array(v.string())),
      })
    ),
    draftName: v.optional(v.string()),
    generationCompletedAt: v.number(),
  },
  handler: async (ctx, args) => {
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
    if (session.status !== "awaiting_icp_confirmation") {
      throw new Error("Ideal profiles are not awaiting confirmation.");
    }
    const now = getCurrentUTCTimestamp();
    const nextPreviewRevision = (session.previewRevision ?? 0) + 1;
    await ctx.db.patch(args.sessionId, {
      status: "provisioning_preview_workspace",
      previewRevision: nextPreviewRevision,
      previewWorkflowId: undefined,
      previewDiscoveryStartedAt: undefined,
      previewProspectIds: undefined,
      previewReviewMode: undefined,
      previewReadyAt: undefined,
      previewApprovedAt: undefined,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });
    await maybeSignalStateChanged(ctx, {
      ...session,
      status: "provisioning_preview_workspace",
      previewRevision: nextPreviewRevision,
      previewWorkflowId: undefined,
      previewDiscoveryStartedAt: undefined,
      previewProspectIds: undefined,
      previewReviewMode: undefined,
      previewReadyAt: undefined,
      previewApprovedAt: undefined,
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
        previewRevision: nextPreviewRevision,
        deleteOlderRevisions: true,
      }
    );
    return { success: true as const };
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
    if (!session.generatedProfiles || !session.improvedDescription) {
      throw new Error("Setup session is missing generated workspace data");
    }

    const normalizedWorkspaceName = formatWorkspaceName(session.draftName);
    const linkedWorkspaceId =
      session.targetWorkspaceId ?? session.existingWorkspaceId ?? null;
    let targetWorkspaceId: Id<"workspaces">;

    if (linkedWorkspaceId) {
      await ctx.runMutation(
        internal.workspaces.captureRefineRollbackSnapshotInternal,
        { workspaceId: linkedWorkspaceId }
      );
      await ctx.runMutation(internal.workspaces.updateWorkspaceInternal, {
        workspaceId: linkedWorkspaceId,
        seedDescription: session.seedDescription,
        improvedDescription: session.improvedDescription,
        description: session.improvedDescription,
        icps: session.generatedProfiles,
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
          seedDescription:
            session.seedDescription ?? session.improvedDescription,
          improvedDescription: session.improvedDescription,
          icps: session.generatedProfiles,
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
    errorMessage: v.string(),
  },
  handler: async (ctx, { sessionId, errorMessage }) => {
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
