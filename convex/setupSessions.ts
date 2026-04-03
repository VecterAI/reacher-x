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
import { createThread, listUIMessages, saveMessage } from "@convex-dev/agent";
import { v } from "convex/values";
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
import {
  buildSetupAgentPrompt,
  buildAdditionalWorkspaceSetupPrompt,
} from "./agents/prompts";
import { persistRawModelResponse } from "./lib/modelTelemetry";
import { setupAgent } from "./agents";
import {
  planTierValidator,
  setupInputModeValidator,
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
  getNextSetupStatusAfterConnections,
  getNextSetupStatusAfterProvisioning,
  type SetupInputPhase,
  type SetupVisibleStep,
  type SetupVisibleStepId,
} from "./lib/setupFlowCore";
import { isProspectReadyQualifiedEnriched } from "./lib/readModelHelpers";

type SetupSessionDoc = Doc<"workspaceSetupSessions">;
type ViewerCtx = QueryCtx | MutationCtx;

type SetupPreviewProgressState = {
  discoveredCount: number;
  qualifiedCount: number;
  enrichedCount: number;
  selectedCount: number;
};

const PREVIEW_TARGET_COUNT = 5;

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
  previewReadyAt: number | null;
  previewApprovedAt: number | null;
  previewProgress: SetupPreviewProgressState;
  hasGeneration: boolean;
  errorMessage: string | null;
};

type ToolPartRecord = {
  type?: unknown;
  state?: unknown;
  input?: unknown;
  output?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function isCompletedToolPart(part: ToolPartRecord): boolean {
  return part.state === "result" || part.state === "output-available";
}

function getToolNameFromPart(part: ToolPartRecord): string | null {
  if (typeof part.type !== "string") {
    return null;
  }
  return part.type.startsWith("tool-") ? part.type.slice(5) : null;
}

async function listSetupPreviewProspects(
  db: ViewerCtx["db"],
  session: Pick<
    SetupSessionDoc,
    "targetWorkspaceId" | "previewDiscoveryStartedAt"
  >
): Promise<Array<Doc<"prospects">>> {
  if (!session.targetWorkspaceId || !session.previewDiscoveryStartedAt) {
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
  session: Pick<SetupSessionDoc, "previewProspectIds">,
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
    selectedCount: session.previewProspectIds?.length ?? 0,
  };
}

function isProspectInSetupPreviewWindow(
  session: Pick<
    SetupSessionDoc,
    "targetWorkspaceId" | "previewDiscoveryStartedAt"
  >,
  prospect: Pick<Doc<"prospects">, "workspaceId" | "_creationTime">
) {
  return (
    Boolean(session.targetWorkspaceId) &&
    Boolean(session.previewDiscoveryStartedAt) &&
    prospect.workspaceId === session.targetWorkspaceId &&
    prospect._creationTime >= (session.previewDiscoveryStartedAt ?? 0)
  );
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

async function getSetupPreviewCandidateIds(
  db: ViewerCtx["db"],
  session: SetupSessionDoc
) {
  if (session.previewProspectIds?.length) {
    return session.previewProspectIds;
  }

  const prospects = await listSetupPreviewProspects(db, session);
  return sortPreviewCandidates(
    prospects.filter((prospect) => isProspectReadyQualifiedEnriched(prospect))
  )
    .slice(0, PREVIEW_TARGET_COUNT)
    .map((prospect) => prospect._id);
}

async function markPreviewReady(
  ctx: MutationCtx,
  session: SetupSessionDoc,
  previewProspectIds: Id<"prospects">[]
) {
  const now = getCurrentUTCTimestamp();
  await ctx.db.patch(session._id, {
    status: "awaiting_preview_confirmation",
    previewProspectIds,
    previewReadyAt: now,
    statusUpdatedAt: now,
    lastAgentActionAt: now,
    lastActiveAt: now,
    errorCode: undefined,
    errorMessage: undefined,
  });

  await maybeSignalStateChanged(ctx, {
    ...session,
    status: "awaiting_preview_confirmation",
    previewProspectIds,
    previewReadyAt: now,
    statusUpdatedAt: now,
    lastAgentActionAt: now,
    lastActiveAt: now,
    errorCode: undefined,
    errorMessage: undefined,
  });
}

async function getSetupConnectionState(
  db: ViewerCtx["db"],
  userId: Id<"users">
) {
  const connectedXAccount = await db
    .query("xAccounts")
    .withIndex("by_user_status", (q) =>
      q.eq("userId", userId).eq("status", "connected")
    )
    .first();

  return {
    xConnected: Boolean(connectedXAccount),
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
  const flowState = buildSetupFlowState({
    status: session.status,
    requiresConnections: !(googleConnected && connectionState.xConnected),
    requiresPlan: planTier !== "pro",
  });

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
    previewProspectIds: session.previewProspectIds ?? [],
    previewReadyAt: session.previewReadyAt ?? null,
    previewApprovedAt: session.previewApprovedAt ?? null,
    previewProgress: buildPreviewProgressState(session, previewRows),
    hasGeneration: hasSetupGenerationData(session),
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
    console.warn(
      "[setupSessions] Failed to signal workflow state change:",
      error
    );
  }
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

function parseLatestGenerationFromMessages(
  messages: Array<{
    order?: number;
    parts?: unknown;
  }>
): {
  improvedDescription: string;
  generatedProfiles: NonNullable<SetupSessionDoc["generatedProfiles"]>;
  suggestedWorkspaceName: string | null;
  errorMessage: string | null;
} | null {
  let latestGeneration: {
    order: number;
    improvedDescription: string;
    generatedProfiles: NonNullable<SetupSessionDoc["generatedProfiles"]>;
    suggestedWorkspaceName: string | null;
  } | null = null;
  let latestAnalysisBusinessName: string | null = null;
  let latestError: string | null = null;

  for (const [index, message] of messages.entries()) {
    const order = typeof message.order === "number" ? message.order : index;
    const parts = Array.isArray(message.parts) ? message.parts : [];
    for (const rawPart of parts) {
      const part = rawPart as ToolPartRecord;
      const toolName = getToolNameFromPart(part);
      if (!toolName || !isCompletedToolPart(part)) {
        continue;
      }

      const output = asRecord(part.output);
      const input = asRecord(part.input);
      const success = output?.success === true;
      if (!success) {
        latestError = getString(output?.error) ?? latestError;
        continue;
      }

      if (toolName === "analyzeUrl") {
        latestAnalysisBusinessName =
          getString(output?.businessName) ?? latestAnalysisBusinessName;
        continue;
      }

      if (toolName !== "generateImprovedDescriptionAndICPs") {
        continue;
      }

      const improvedDescription = getString(output?.improvedDescription);
      if (!improvedDescription) {
        continue;
      }

      const generatedProfiles: NonNullable<
        SetupSessionDoc["generatedProfiles"]
      > = [];
      if (Array.isArray(output?.icps)) {
        for (const candidate of output.icps) {
          const record = asRecord(candidate);
          if (!record) {
            continue;
          }

          generatedProfiles.push({
            title: getString(record.title) ?? "Untitled profile",
            description: getString(record.description) ?? "",
            painPoints: getStringArray(record.painPoints),
            channels: getStringArray(record.channels),
            syntheticPosts: Array.isArray(record.syntheticPosts)
              ? record.syntheticPosts.filter(
                  (value): value is string => typeof value === "string"
                )
              : undefined,
            qualificationKeywords: Array.isArray(record.qualificationKeywords)
              ? record.qualificationKeywords.filter(
                  (value): value is string => typeof value === "string"
                )
              : undefined,
          });
        }
      }

      latestGeneration = {
        order,
        improvedDescription,
        generatedProfiles,
        suggestedWorkspaceName:
          latestAnalysisBusinessName ?? getString(input?.businessName) ?? null,
      };
    }
  }

  if (!latestGeneration) {
    return latestError
      ? {
          improvedDescription: "",
          generatedProfiles: [],
          suggestedWorkspaceName: null,
          errorMessage: latestError,
        }
      : null;
  }

  return {
    ...latestGeneration,
    errorMessage: latestError,
  };
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
      session = await getSetupSessionByThreadId(ctx.db, args.threadId);
      if (session && session.userId !== user._id) {
        throw new Error("Not authorized");
      }
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
      session = await getSetupSessionByThreadId(ctx.db, args.threadId);
      if (session && session.userId !== user._id) {
        throw new Error("Not authorized");
      }
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

export const getSetupPreviewProspect = query({
  args: {
    prospectId: v.id("prospects"),
    sessionId: v.optional(v.id("workspaceSetupSessions")),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);

    let session: SetupSessionDoc | null = null;
    if (args.sessionId) {
      session = await requireOwnedSetupSession(ctx, args.sessionId, user._id);
    } else if (args.threadId) {
      session = await getSetupSessionByThreadId(ctx.db, args.threadId);
      if (session && session.userId !== user._id) {
        throw new Error("Not authorized");
      }
    } else {
      session = await getAccessibleActiveSetupSessionForUser(ctx, user._id);
    }

    if (!session) {
      return null;
    }

    const prospect = await ctx.db.get(args.prospectId);
    if (!prospect || prospect.userId !== user._id) {
      return null;
    }
    if (!isProspectInSetupPreviewWindow(session, prospect)) {
      return null;
    }

    return prospect;
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
      user._id
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

    const resolvedUseCaseKey = resolveWorkspaceUseCaseKey(args.useCaseKey);
    const existingDefaultWorkspace = await getDefaultWorkspaceForUser(
      ctx,
      user._id
    );
    // Always reuse the user's default workspace for first_workspace setup so
    // reset/discard flows never provision a second workspace (free tier limit).
    const existingWorkspaceId =
      args.mode === "first_workspace" && existingDefaultWorkspace
        ? existingDefaultWorkspace._id
        : undefined;

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
    const entitlementSlot =
      existingDefaultWorkspace && args.mode === "first_workspace"
        ? await resolveWorkspaceEntitlementSlot(ctx, existingDefaultWorkspace)
        : await resolveNextEntitlementSlotForUser(ctx, user._id);
    const sessionId = await ctx.db.insert("workspaceSetupSessions", {
      userId: user._id,
      mode: args.mode,
      status: "draft",
      setupThreadId: threadId,
      useCaseKey: resolvedUseCaseKey,
      draftOrdinal,
      existingWorkspaceId,
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

    const activeSession = await getAccessibleActiveSetupSessionForUser(
      ctx,
      user._id
    );
    if (activeSession) {
      throw new Error(
        "You already have an active setup session. Finish or discard it first."
      );
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
    if (session.targetWorkspaceId) {
      linkedWorkspaceIds.add(session.targetWorkspaceId);
    }
    if (session.existingWorkspaceId) {
      linkedWorkspaceIds.add(session.existingWorkspaceId);
    }
    for (const workspaceId of linkedWorkspaceIds) {
      const workspace = await ctx.db.get(workspaceId);
      if (workspace?.onboardingThreadId === session.setupThreadId) {
        await ctx.db.patch(workspaceId, {
          onboardingThreadId: undefined,
          updatedAt: now,
        });
      }
    }

    await ctx.db.patch(args.sessionId, {
      status: "discarded",
      previewProspectIds: undefined,
      previewDiscoveryStartedAt: undefined,
      statusUpdatedAt: now,
      discardedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      status: "discarded",
      statusUpdatedAt: now,
      discardedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

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
      inputMode: args.inputMode,
      seedDescription: args.inputValue,
      sourceUrl: args.inputMode === "url" ? args.sourceUrl : undefined,
      previewDiscoveryStartedAt: undefined,
      previewProspectIds: undefined,
      previewReadyAt: undefined,
      previewApprovedAt: undefined,
      generationRequestedAt: now,
      errorCode: undefined,
      errorMessage: undefined,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      status: "generating_profiles",
      inputMode: args.inputMode,
      seedDescription: args.inputValue,
      sourceUrl: args.inputMode === "url" ? args.sourceUrl : undefined,
      previewDiscoveryStartedAt: undefined,
      previewProspectIds: undefined,
      previewReadyAt: undefined,
      previewApprovedAt: undefined,
      generationRequestedAt: now,
      errorCode: undefined,
      errorMessage: undefined,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

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
      previewDiscoveryStartedAt: undefined,
      previewProspectIds: undefined,
      previewReadyAt: undefined,
      previewApprovedAt: undefined,
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
      previewDiscoveryStartedAt: undefined,
      previewProspectIds: undefined,
      previewReadyAt: undefined,
      previewApprovedAt: undefined,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

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
    if (!session.previewProspectIds?.length) {
      throw new Error(
        "Preview people are still loading. Please wait a moment."
      );
    }

    if (session.refineFromWorkspace) {
      await ctx.db.patch(args.sessionId, {
        status: "discarded",
        discardedAt: now,
        statusUpdatedAt: now,
        lastUserActionAt: now,
        lastActiveAt: now,
      });
      await maybeSignalStateChanged(ctx, {
        ...session,
        status: "discarded",
        discardedAt: now,
        statusUpdatedAt: now,
        lastUserActionAt: now,
        lastActiveAt: now,
      });
      return { success: true as const };
    }

    const flowContext = await ctx.runQuery(
      internal.setupSessions.getSetupUserFlowContextInternal,
      {
        userId: session.userId,
      }
    );
    const nextStatus = getNextSetupStatusAfterProvisioning({
      requiresConnections: !flowContext.xConnected,
      requiresPlan: flowContext.planTier !== "pro",
    });

    await ctx.db.patch(args.sessionId, {
      status: nextStatus,
      previewApprovedAt: now,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      status: nextStatus,
      previewApprovedAt: now,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

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
      requiresPlan: planTier !== "pro",
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
    const now = getCurrentUTCTimestamp();

    await ctx.db.patch(args.sessionId, {
      status: "awaiting_preferences",
      planChoice: args.planChoice,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      status: "awaiting_preferences",
      planChoice: args.planChoice,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    return { success: true };
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

    const result = await setupAgent.streamText(
      ctx,
      { threadId: session.setupThreadId },
      {
        prompt: "__INIT__",
        system: buildSetupAgentPrompt(
          resolveWorkspaceUseCaseKey(session.useCaseKey)
        ),
      },
      {
        saveStreamDeltas: {
          chunking: "word",
          throttleMs: 100,
        },
      }
    );

    await result.consumeStream();
    await persistRawModelResponse(ctx, {
      threadId: session.setupThreadId,
      agentName: "Setup Agent",
      request: result.request,
      response: result.response,
      providerMetadata: result.providerMetadata,
    });

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

    const prompt = feedback?.trim()
      ? buildSetupFeedbackPrompt({
          useCaseKey: resolveWorkspaceUseCaseKey(session.useCaseKey),
          feedback: feedback.trim(),
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

    const result = await setupAgent.streamText(
      ctx,
      { threadId: session.setupThreadId },
      {
        promptMessageId: messageId,
        system: buildSetupAgentPrompt(
          resolveWorkspaceUseCaseKey(session.useCaseKey)
        ),
      },
      {
        saveStreamDeltas: {
          chunking: "word",
          throttleMs: 100,
        },
      }
    );

    await result.consumeStream();
    await persistRawModelResponse(ctx, {
      threadId: session.setupThreadId,
      agentName: "Setup Agent",
      request: result.request,
      response: result.response,
      providerMetadata: result.providerMetadata,
    });

    const messages = await listUIMessages(ctx, components.agent, {
      threadId: session.setupThreadId,
      paginationOpts: { numItems: 60, cursor: null },
    });
    const parsed = parseLatestGenerationFromMessages(messages.page);
    const now = getCurrentUTCTimestamp();

    if (!parsed || parsed.generatedProfiles.length === 0) {
      await ctx.runMutation(
        internal.setupSessions.markGenerationFailedInternal,
        {
          sessionId,
          errorMessage:
            parsed?.errorMessage ??
            "The setup draft could not be generated. Please try again.",
        }
      );
      return { success: false };
    }

    await ctx.runMutation(
      internal.setupSessions.recordGenerationResultInternal,
      {
        sessionId,
        improvedDescription: parsed.improvedDescription,
        generatedProfiles: parsed.generatedProfiles,
        draftName:
          session.draftName ??
          parsed.suggestedWorkspaceName ??
          session.draftName,
        generationCompletedAt: now,
      }
    );

    return { success: true };
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
      previewDiscoveryStartedAt: undefined,
      previewProspectIds: undefined,
      previewReadyAt: undefined,
      previewApprovedAt: undefined,
      generationCompletedAt: args.generationCompletedAt,
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
    await ctx.db.patch(args.sessionId, {
      status: "provisioning_preview_workspace",
      previewDiscoveryStartedAt: undefined,
      previewProspectIds: undefined,
      previewReadyAt: undefined,
      previewApprovedAt: undefined,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });
    await maybeSignalStateChanged(ctx, {
      ...session,
      status: "provisioning_preview_workspace",
      previewDiscoveryStartedAt: undefined,
      previewProspectIds: undefined,
      previewReadyAt: undefined,
      previewApprovedAt: undefined,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });
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
    return prospects
      .filter((prospect) => isProspectReadyQualifiedEnriched(prospect))
      .sort((a, b) => {
        const scoreDelta =
          (b.qualificationScore ?? 0) - (a.qualificationScore ?? 0);
        if (scoreDelta !== 0) {
          return scoreDelta;
        }
        return (
          (b.updatedAt ?? b._creationTime) - (a.updatedAt ?? a._creationTime)
        );
      })
      .map((prospect) => prospect._id);
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
    return buildPreviewProgressState(session, prospects);
  },
});

export const markPreviewReadyInternal = internalMutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    previewProspectIds: v.array(v.id("prospects")),
  },
  handler: async (ctx, { sessionId, previewProspectIds }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) {
      throw new Error("Setup session not found");
    }
    await markPreviewReady(ctx, session, previewProspectIds);
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
      session.status !== "discovering_preview_prospects" ||
      session.previewReadyAt
    ) {
      return {
        updated: false,
        selectedCount: session?.previewProspectIds?.length ?? 0,
      };
    }

    const candidateIds = await getSetupPreviewCandidateIds(ctx.db, session);
    if (candidateIds.length < PREVIEW_TARGET_COUNT) {
      return { updated: false, selectedCount: candidateIds.length };
    }

    const selectedIds = candidateIds.slice(0, PREVIEW_TARGET_COUNT);
    await markPreviewReady(ctx, session, selectedIds);
    return { updated: true, selectedCount: selectedIds.length };
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
          isDefault: true,
          entitlementSlot: session.entitlementSlot ?? 1,
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
    await ctx.runAction(
      internal.workspaces.restartProspectingWorkflowForSetupInternal,
      {
        workspaceId: targetWorkspaceId,
      }
    );
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
      generationErrorAt: now,
      lastAgentActionAt: now,
      lastActiveAt: now,
      statusUpdatedAt: now,
      errorCode: "generation_failed",
      errorMessage,
    });
  },
});
