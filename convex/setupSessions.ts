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
  requireUser,
} from "./lib/accessHelpers";
import { hasRequiredWorkspaceAgentData } from "./lib/workspaceSetup";
import {
  getActiveSetupSessionForUser,
  getSetupSessionByTargetWorkspaceId,
  getSetupSessionByThreadId,
  getSetupSessionDisplayName,
  getSetupSessionPanelStep,
  hasSetupGenerationData,
  isTerminalSetupSessionStatus,
  resolveNextSetupDraftOrdinal,
} from "./lib/setupSessionCore";
import { getSetupWorkflowEventName } from "./lib/setupWorkflowEvents";
import {
  buildSetupAgentPrompt,
  buildAdditionalWorkspaceSetupPrompt,
} from "./agents/prompts";
import { persistRawModelResponse } from "./lib/modelTelemetry";
import { setupAgent } from "./agents";
import {
  planTierValidator,
  setupSessionModeValidator,
  setupSessionPreferenceValidator,
  workspaceUseCaseKeyValidator,
} from "./validators";
import {
  getWorkspaceUseCase,
  resolveWorkspaceUseCaseKey,
  type WorkspaceUseCaseKey,
} from "../shared/lib/workspaceUseCases";
import { formatWorkspaceName } from "../shared/lib/workspaceDisplayNames";

type SetupSessionDoc = Doc<"workspaceSetupSessions">;
type ViewerCtx = QueryCtx | MutationCtx;

type SetupSessionPublicState = {
  sessionId: Id<"workspaceSetupSessions">;
  status: SetupSessionDoc["status"];
  mode: SetupSessionDoc["mode"];
  useCaseKey: WorkspaceUseCaseKey;
  displayName: string;
  draftName: string | null;
  threadId: string;
  panelStep: ReturnType<typeof getSetupSessionPanelStep>;
  sourceUrl: string | null;
  seedDescription: string | null;
  improvedDescription: string | null;
  generatedProfiles: NonNullable<SetupSessionDoc["generatedProfiles"]>;
  preferenceChoice: SetupSessionDoc["preferenceChoice"] | null;
  planChoice: SetupSessionDoc["planChoice"] | null;
  targetWorkspaceId: Id<"workspaces"> | null;
  existingWorkspaceId: Id<"workspaces"> | null;
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

function toPublicSetupSessionState(
  session: SetupSessionDoc
): SetupSessionPublicState {
  return {
    sessionId: session._id,
    status: session.status,
    mode: session.mode,
    useCaseKey: resolveWorkspaceUseCaseKey(session.useCaseKey),
    displayName: getSetupSessionDisplayName(session),
    draftName: session.draftName ?? null,
    threadId: session.setupThreadId,
    panelStep: getSetupSessionPanelStep(session.status),
    sourceUrl: session.sourceUrl ?? null,
    seedDescription: session.seedDescription ?? null,
    improvedDescription: session.improvedDescription ?? null,
    generatedProfiles: session.generatedProfiles ?? [],
    preferenceChoice: session.preferenceChoice ?? null,
    planChoice: session.planChoice ?? null,
    targetWorkspaceId: session.targetWorkspaceId ?? null,
    existingWorkspaceId: session.existingWorkspaceId ?? null,
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
  return session;
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

function buildUseCaseConfirmationMessage(
  useCaseKey: WorkspaceUseCaseKey
): string {
  const useCase = getWorkspaceUseCase(useCaseKey);
  return `Using the ${useCase.displayName} setup flow now. Share a website URL or a short description and I will generate the improved description and ${useCase.profileLabelPlural.toLowerCase()} for this draft.`;
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

    const session = await getActiveSetupSessionForUser(ctx.db, user._id);
    return session ? toPublicSetupSessionState(session) : null;
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
      session = await getActiveSetupSessionForUser(ctx.db, user._id);
    }

    return session ? toPublicSetupSessionState(session) : null;
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

    const activeSession = await getActiveSetupSessionForUser(ctx.db, user._id);
    if (activeSession) {
      return {
        activeSession: toPublicSetupSessionState(activeSession),
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

    const session = await getActiveSetupSessionForUser(ctx.db, user._id);
    return {
      activeDraft: session ? toPublicSetupSessionState(session) : null,
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
    const activeSession = await getActiveSetupSessionForUser(ctx.db, user._id);
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
    const existingWorkspaceId =
      args.mode === "first_workspace" &&
      existingDefaultWorkspace &&
      !hasRequiredWorkspaceAgentData(existingDefaultWorkspace)
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
    const sessionId = await ctx.db.insert("workspaceSetupSessions", {
      userId: user._id,
      mode: args.mode,
      status: "draft",
      setupThreadId: threadId,
      useCaseKey: resolvedUseCaseKey,
      draftOrdinal,
      existingWorkspaceId,
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

    await ctx.db.patch(args.sessionId, {
      status: "discarded",
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

    return { success: true };
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
    inputMode: v.union(v.literal("url"), v.literal("manual")),
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
      status: "generating",
      seedDescription: args.inputValue,
      sourceUrl: args.sourceUrl,
      generationRequestedAt: now,
      errorCode: undefined,
      errorMessage: undefined,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      status: "generating",
      seedDescription: args.inputValue,
      sourceUrl: args.sourceUrl,
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
      status: "generating",
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
      status: "generating",
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

    await ctx.db.patch(args.sessionId, {
      status: "awaiting_connections",
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      status: "awaiting_connections",
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

    await ctx.db.patch(args.sessionId, {
      status: "awaiting_plan",
      connectionsCompletedAt: now,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      status: "awaiting_plan",
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
    preferenceChoice: setupSessionPreferenceValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const session = await requireOwnedSetupSession(
      ctx,
      args.sessionId,
      user._id
    );
    if (session.status !== "awaiting_preferences") {
      throw new Error("Setup session is not awaiting preferences.");
    }
    const now = getCurrentUTCTimestamp();
    const resolvedWorkspaceName = formatWorkspaceName(session.draftName);

    await ctx.db.patch(args.sessionId, {
      status: "provisioning_workspace",
      preferenceChoice: args.preferenceChoice,
      draftName: resolvedWorkspaceName,
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      status: "provisioning_workspace",
      preferenceChoice: args.preferenceChoice,
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

    await ctx.db.patch(args.sessionId, {
      status: "provisioning_workspace",
      draftName: formatWorkspaceName(args.workspaceName),
      statusUpdatedAt: now,
      lastUserActionAt: now,
      lastActiveAt: now,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      status: "provisioning_workspace",
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
          inputMode: session.sourceUrl ? "url" : "manual",
          inputValue: session.seedDescription ?? "",
          sourceUrl: session.sourceUrl,
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
      status: "awaiting_review",
      improvedDescription: args.improvedDescription,
      generatedProfiles: args.generatedProfiles,
      draftName: args.draftName,
      generationCompletedAt: args.generationCompletedAt,
      lastAgentActionAt: now,
      lastActiveAt: now,
      statusUpdatedAt: now,
      errorCode: undefined,
      errorMessage: undefined,
    });
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

export const postUseCaseSelectedMessageInternal = internalAction({
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

    await saveSetupAssistantMessage(
      ctx,
      session,
      buildUseCaseConfirmationMessage(
        resolveWorkspaceUseCaseKey(session.useCaseKey)
      )
    );
    await ctx.runMutation(internal.setupSessions.touchAgentActionInternal, {
      sessionId,
    });
  },
});

export const finalizeProvisioningInternal = internalAction({
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
    let targetWorkspaceId: Id<"workspaces">;

    if (session.existingWorkspaceId) {
      await ctx.runMutation(internal.workspaces.updateWorkspaceInternal, {
        workspaceId: session.existingWorkspaceId,
        seedDescription: session.seedDescription,
        improvedDescription: session.improvedDescription,
        description: session.improvedDescription,
        icps: session.generatedProfiles,
        sourceUrl: session.sourceUrl,
        descriptionSource: session.sourceUrl ? "url" : "manual",
        useCaseKey: resolveWorkspaceUseCaseKey(session.useCaseKey),
        setupCompletedAt: getCurrentUTCTimestamp(),
      });
      targetWorkspaceId = session.existingWorkspaceId;
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
          sourceUrl: session.sourceUrl,
          descriptionSource: session.sourceUrl ? "url" : "manual",
          useCaseKey: resolveWorkspaceUseCaseKey(session.useCaseKey),
          isDefault: true,
        }
      );
    }

    await ctx.runMutation(internal.workspaces.setOnboardingThreadInternal, {
      workspaceId: targetWorkspaceId,
      threadId: session.setupThreadId,
    });

    await ctx.runMutation(
      internal.setupSessions.recordProvisionedWorkspaceInternal,
      {
        sessionId,
        targetWorkspaceId,
        workspaceName: normalizedWorkspaceName,
      }
    );

    await ctx.runAction(internal.workspaces.startProspectingWorkflowInternal, {
      workspaceId: targetWorkspaceId,
    });

    await saveSetupAssistantMessage(
      ctx,
      session,
      `Workspace created as ${normalizedWorkspaceName}. I am starting the initial discovery flow now and will keep this draft locked until the first ready results are available.`
    );
    await ctx.runMutation(internal.setupSessions.touchAgentActionInternal, {
      sessionId,
    });

    return { targetWorkspaceId };
  },
});

export const recordProvisionedWorkspaceInternal = internalMutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    targetWorkspaceId: v.id("workspaces"),
    workspaceName: v.string(),
  },
  handler: async (ctx, { sessionId, targetWorkspaceId, workspaceName }) => {
    const now = getCurrentUTCTimestamp();
    await ctx.db.patch(sessionId, {
      targetWorkspaceId,
      draftName: workspaceName,
      status: "waiting_for_first_ready_profile",
      statusUpdatedAt: now,
      lastAgentActionAt: now,
      lastActiveAt: now,
      errorCode: undefined,
      errorMessage: undefined,
    });
  },
});

export const markReadyFromWorkspaceInternal = internalMutation({
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
      session.status === "ready" ||
      session.status === "discarded"
    ) {
      return { updated: false };
    }

    const workspaceStats = await ctx.db
      .query("workspaceStats")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();
    if (!workspaceStats || workspaceStats.readyQualifiedEnrichedCount <= 0) {
      return { updated: false };
    }

    const now = getCurrentUTCTimestamp();
    await ctx.db.patch(session._id, {
      status: "ready",
      statusUpdatedAt: now,
      lastActiveAt: now,
      lastAgentActionAt: now,
    });

    await maybeSignalStateChanged(ctx, {
      ...session,
      status: "ready",
      statusUpdatedAt: now,
      lastActiveAt: now,
      lastAgentActionAt: now,
    });

    return { updated: true, sessionId: session._id };
  },
});
