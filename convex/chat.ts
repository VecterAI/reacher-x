// convex/chat.ts
// Chat functions using @convex-dev/agent with streaming support
// Docs: https://docs.convex.dev/agents/streaming

import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./lib/functionBuilders";
import { internal } from "./_generated/api";
import { components } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import {
  createThread,
  listUIMessages,
  vStreamArgs,
  syncStreams,
  saveMessage,
  type ThreadDoc,
  type UIMessage,
  type StreamArgs,
} from "@convex-dev/agent";
import { setupAgent } from "./agents";
import { outreachAgent, outreachAgentBaseTools } from "./agents/outreach";
import {
  buildOutreachAgentPrompt,
  buildSetupAgentPrompt,
} from "./agents/prompts";
import {
  getDefaultWorkspaceForUser,
  getOwnedProspect,
  getUserByIdentity,
  requireOwnedProspect,
  requireProspectNotArchived,
  requireUser,
} from "./lib/accessHelpers";
import { createNotification } from "./lib/outreachCore";
import { persistRawModelResponse } from "./lib/modelTelemetry";
import { getProspectDisplayFields } from "./lib/notificationHelpers";
import { recordWorkspaceActivityWithDb } from "./lib/workspaceActivity";
import {
  ensureProspectThreadLink,
  getProspectThreadContextByThreadId,
  getProspectThreadLinkByThreadId,
  listProspectThreadLinksByThreadId,
  listProspectThreadLinksByProspect,
} from "./lib/relationshipHelpers";
import { parseSetupThreadState } from "./lib/setupThreadHelpers";
import { urgencyLevelValidator } from "./validators";
import {
  getWorkspaceUseCase,
  type WorkspaceUseCaseDefinition,
} from "../shared/lib/workspaceUseCases";
import { logger } from "../shared/lib/logger";

type ViewerCtx = QueryCtx | MutationCtx;
type ReadableCtx = QueryCtx | MutationCtx | ActionCtx;
type OutreachAgentTools = typeof outreachAgentBaseTools;
const chatLogger = logger.withScope("Chat");

async function getViewerUser(ctx: ViewerCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  return getUserByIdentity(ctx, identity);
}

async function requireViewerUser(ctx: ViewerCtx) {
  return requireUser(ctx, { notFoundMessage: "User not found" });
}

async function resolveSetupUseCaseForThread(
  ctx: ReadableCtx,
  threadId: string
): Promise<WorkspaceUseCaseDefinition> {
  const setupSession = await ctx.runQuery(
    internal.setupSessions.getByThreadIdInternal,
    {
      threadId,
    }
  );
  if (setupSession) {
    return getWorkspaceUseCase(setupSession.useCaseKey);
  }

  const thread = await ctx.runQuery(components.agent.threads.getThread, {
    threadId,
  });

  const parsedState = parseSetupThreadState(thread?.title);
  if (!parsedState || parsedState.kind === "draft") {
    return getWorkspaceUseCase(parsedState?.useCaseKey ?? undefined);
  }

  const workspace = await ctx.runQuery(internal.workspaces.getById, {
    workspaceId: parsedState.workspaceId as Id<"workspaces">,
  });

  return getWorkspaceUseCase(workspace?.useCaseKey);
}

async function resolveOutreachUseCaseForThread(
  ctx: ReadableCtx,
  threadId: string
): Promise<WorkspaceUseCaseDefinition> {
  const threadContext = await ctx.runQuery(
    internal.prospectThreads.getThreadProspectContext,
    {
      threadId,
    }
  );

  if (!threadContext) {
    return getWorkspaceUseCase(undefined);
  }

  const workspace = await ctx.runQuery(internal.workspaces.getById, {
    workspaceId: threadContext.prospect.workspaceId,
  });

  return getWorkspaceUseCase(workspace?.useCaseKey);
}

async function getOutreachToolsForThread(
  ctx: ActionCtx,
  threadId: string
): Promise<OutreachAgentTools> {
  void ctx;
  void threadId;
  return outreachAgentBaseTools;
}

async function getWorkspaceIdForSetupThread(
  ctx: ReadableCtx,
  threadId: string
): Promise<Id<"workspaces"> | null> {
  const setupSession = await ctx.runQuery(
    internal.setupSessions.getByThreadIdInternal,
    {
      threadId,
    }
  );

  return setupSession?.targetWorkspaceId ?? null;
}

async function getPlainTextMessageById(
  ctx: ActionCtx,
  messageId: string
): Promise<string> {
  const [message] = await ctx.runQuery(
    components.agent.messages.getMessagesByIds,
    {
      messageIds: [messageId],
    }
  );
  return typeof message?.text === "string" ? message.text : "";
}

const USER_STOPPED_ERROR_MESSAGE = "Generation stopped.";
const USER_STOPPED_VISIBLE_MESSAGE = "Generation stopped.";
const TIMED_OUT_ERROR_MESSAGE =
  "That response took too long and stopped before it finished.";
const TIMED_OUT_VISIBLE_MESSAGE =
  "That response took too long and stopped before it finished. Please try again.";

async function listPendingAssistantMessages(ctx: ViewerCtx, threadId: string) {
  const pendingMessages = await ctx.runQuery(
    components.agent.messages.listMessagesByThreadId,
    {
      threadId,
      order: "desc",
      statuses: ["pending"],
      paginationOpts: { numItems: 20, cursor: null },
    }
  );

  return pendingMessages.page.filter(
    (message) => message.message?.role === "assistant"
  );
}

async function hasSearchableThreadHistory(
  ctx: ActionCtx,
  args: {
    threadId: string;
    excludeMessageId?: string;
  }
) {
  const messages = await ctx.runQuery(
    components.agent.messages.listMessagesByThreadId,
    {
      threadId: args.threadId,
      order: "desc",
      paginationOpts: { numItems: 25, cursor: null },
    }
  );

  return messages.page.some((message) => {
    if (args.excludeMessageId && message._id === args.excludeMessageId) {
      return false;
    }
    const text = typeof message.text === "string" ? message.text.trim() : "";
    return text.length > 0;
  });
}

function buildDisabledHistorySearchContextOptions() {
  return {
    recentMessages: 20,
    searchOptions: {
      limit: 0,
      textSearch: false,
      vectorSearch: false,
    },
  };
}

function isEmptyEmbeddingInputError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("Input is empty");
}

async function streamOutreachTextWithFallback(
  ctx: ActionCtx,
  args: {
    threadId: string;
    promptMessageId?: string;
    system: string;
    tools: OutreachAgentTools;
    preferHistorySearch?: boolean;
  }
) {
  const saveStreamDeltas = {
    chunking: "word" as const,
    throttleMs: 100,
  };
  const initialContextOptions = args.preferHistorySearch
    ? undefined
    : buildDisabledHistorySearchContextOptions();

  try {
    return await outreachAgent.streamText(
      ctx,
      { threadId: args.threadId },
      {
        ...(args.promptMessageId
          ? { promptMessageId: args.promptMessageId }
          : {}),
        system: args.system,
        tools: args.tools,
      },
      {
        contextOptions: initialContextOptions,
        saveStreamDeltas,
      }
    );
  } catch (error) {
    if (
      initialContextOptions !== undefined ||
      !isEmptyEmbeddingInputError(error)
    ) {
      throw error;
    }

    chatLogger.warn(
      "Empty embedding batch; retrying outreach stream with history search disabled",
      { threadId: args.threadId }
    );

    return await outreachAgent.streamText(
      ctx,
      { threadId: args.threadId },
      {
        ...(args.promptMessageId
          ? { promptMessageId: args.promptMessageId }
          : {}),
        system: args.system,
        tools: args.tools,
      },
      {
        contextOptions: buildDisabledHistorySearchContextOptions(),
        saveStreamDeltas,
      }
    );
  }
}

async function finalizePendingAssistantMessageForOrder(
  ctx: MutationCtx,
  args: {
    threadId: string;
    order: number;
    errorMessage: string;
    userVisibleMessage?: string;
  }
) {
  const pendingAssistantMessages = await listPendingAssistantMessages(
    ctx,
    args.threadId
  );
  const pendingMessage = pendingAssistantMessages.find(
    (message) => message.order === args.order
  );

  if (!pendingMessage) {
    return false;
  }

  await ctx.runMutation(components.agent.messages.finalizeMessage, {
    messageId: pendingMessage._id,
    result: {
      status: "failed",
      error: args.errorMessage,
    },
  });

  const [updatedMessage] = await ctx.runQuery(
    components.agent.messages.getMessagesByIds,
    {
      messageIds: [pendingMessage._id],
    }
  );

  const visibleMessage = args.userVisibleMessage?.trim();
  if (
    updatedMessage &&
    visibleMessage &&
    (!updatedMessage.text || updatedMessage.text.trim().length === 0)
  ) {
    await ctx.runMutation(components.agent.messages.updateMessage, {
      messageId: pendingMessage._id,
      patch: {
        status: "failed",
        error: args.errorMessage,
        finishReason: "error",
        message: {
          role: "assistant",
          content: visibleMessage,
        },
      },
    });
  }

  return true;
}

type ProspectThreadLinkRow = Pick<
  Doc<"prospectThreads">,
  "_creationTime" | "threadId" | "threadStatus" | "threadSummary"
>;

type ProspectThreadHistoryEntry = {
  _id: string;
  _creationTime: number;
  status: "active" | "archived";
  title?: string;
  firstMessage?: string;
};

function normalizeProspectThreadStatus(
  status:
    | ProspectThreadLinkRow["threadStatus"]
    | ThreadDoc["status"]
    | undefined
): "active" | "archived" {
  return status === "archived" ? "archived" : "active";
}

function shouldFetchProspectThreadFallback(
  row: ProspectThreadLinkRow,
  options: {
    includeFirstMessage?: boolean;
  }
) {
  if (row.threadStatus === undefined) {
    return true;
  }

  return (
    options.includeFirstMessage === true && row.threadSummary === undefined
  );
}

async function buildProspectThreadHistoryEntries(
  ctx: ReadableCtx,
  rows: ProspectThreadLinkRow[],
  options: {
    activeOnly?: boolean;
    includeFirstMessage?: boolean;
  } = {}
) {
  const rowsNeedingFallback = rows.filter((row) =>
    shouldFetchProspectThreadFallback(row, options)
  );
  const fallbackThreads = await Promise.all(
    rowsNeedingFallback.map((row) =>
      ctx.runQuery(components.agent.threads.getThread, {
        threadId: row.threadId,
      })
    )
  );
  const fallbackByThreadId = new Map<string, ThreadDoc | null>(
    rowsNeedingFallback.map((row, index) => [
      row.threadId,
      fallbackThreads[index],
    ])
  );

  const entries: ProspectThreadHistoryEntry[] = [];

  for (const row of rows) {
    const fallbackThread = fallbackByThreadId.get(row.threadId);
    if (
      shouldFetchProspectThreadFallback(row, options) &&
      fallbackThread === null
    ) {
      continue;
    }

    const status = normalizeProspectThreadStatus(
      row.threadStatus ?? fallbackThread?.status
    );
    if (options.activeOnly && status !== "active") {
      continue;
    }

    entries.push({
      _id: row.threadId,
      _creationTime: row._creationTime,
      status,
      title: fallbackThread?.title,
      firstMessage: options.includeFirstMessage
        ? (row.threadSummary ?? fallbackThread?.summary ?? undefined)
        : undefined,
    });
  }

  return entries;
}

// ============================================================================
// Thread Management
// ============================================================================

/**
 * Creates a new chat thread for the current user.
 */
export const createChatThread = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireViewerUser(ctx);

    // Create a new thread - per docs: https://docs.convex.dev/agents/threads
    const threadId = await createThread(ctx, components.agent, {
      userId: user._id,
    });

    return { threadId };
  },
});

/**
 * Gets the user's most recent thread or creates one.
 * If a new thread is created, triggers the agent to send a greeting.
 *
 * NOTE: We only trigger greeting for NEW threads to avoid duplicate messages
 * when the mutation is called twice quickly (e.g., React StrictMode).
 */
export const getOrCreateThread = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireViewerUser(ctx);

    // Check if user has any threads - per docs
    const existingThreads = await ctx.runQuery(
      components.agent.threads.listThreadsByUserId,
      { userId: user._id, paginationOpts: { numItems: 1, cursor: null } }
    );

    if (existingThreads.page.length > 0) {
      const threadId = existingThreads.page[0]._id;
      // Return existing thread - do NOT trigger greeting here
      // The greeting may already be in-flight or streamed
      return { threadId, isNew: false };
    }

    // Create a new thread
    const threadId = await createThread(ctx, components.agent, {
      userId: user._id,
    });

    // Trigger the agent to greet the user - only for truly new threads
    await ctx.scheduler.runAfter(0, internal.chat.triggerAgentGreeting, {
      threadId,
    });

    return { threadId, isNew: true };
  },
});

// ============================================================================
// Prospect-Specific Threads (Outreach System)
// ============================================================================

/**
 * Creates a thread for a specific prospect.
 * Keeps a human-readable title, but stores the canonical relationship locally.
 */
export const createProspectThread = mutation({
  args: {
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, { prospectId }) => {
    const user = await requireViewerUser(ctx);
    await requireOwnedProspect(ctx, prospectId, {
      user,
      notFoundMessage: "Prospect not found",
      notAuthorizedMessage: "Not authorized",
    });

    // Keep the title human-readable, but the local relationship table is canonical.
    const threadId = await createThread(ctx, components.agent, {
      userId: user._id,
      title: `outreach:${prospectId}`,
    });

    await ensureProspectThreadLink(ctx, {
      prospectId,
      threadId,
      userId: user._id,
      threadStatus: "active",
    });

    return { threadId };
  },
});

/**
 * Gets an existing thread for a prospect (query only, does not create).
 * Used for lazy thread creation pattern - threads only created on first message.
 */
export const getProspectThread = query({
  args: {
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, { prospectId }) => {
    const user = await getViewerUser(ctx);
    if (!user) return null;

    const prospect = await getOwnedProspect(ctx, prospectId, user._id);
    if (!prospect) return null;

    const links = await listProspectThreadLinksByProspect(ctx.db, prospect._id);
    const prospectThreads = await buildProspectThreadHistoryEntries(
      ctx,
      links,
      {
        activeOnly: true,
      }
    );

    const existingThread = prospectThreads[0];

    return existingThread ? { threadId: existingThread._id } : null;
  },
});

/**
 * Creates a prospect thread AND sends an initial prompt in one flow.
 * Used for "Generate Plan" action where we need auto-prompting.
 * Stores the first message in thread summary for efficient display.
 */
export const createProspectThreadWithPrompt = mutation({
  args: {
    prospectId: v.id("prospects"),
    prompt: v.string(),
  },
  handler: async (ctx, { prospectId, prompt }) => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      throw new Error("Message cannot be empty.");
    }
    const user = await requireViewerUser(ctx);
    const prospectDoc = await requireOwnedProspect(ctx, prospectId, {
      user,
      notFoundMessage: "Prospect not found",
      notAuthorizedMessage: "Not authorized",
    });
    requireProspectNotArchived(prospectDoc);

    // Keep the title human-readable, but store the canonical relationship locally.
    // Use summary field to store first user message for display.
    const threadId = await createThread(ctx, components.agent, {
      userId: user._id,
      title: `outreach:${prospectId}`,
      summary: trimmedPrompt.slice(0, 150),
    });

    await ensureProspectThreadLink(ctx, {
      prospectId,
      threadId,
      userId: user._id,
      threadStatus: "active",
      threadSummary: trimmedPrompt.slice(0, 150),
    });

    // Save the user's prompt message
    const { messageId, message } = await saveMessage(ctx, components.agent, {
      threadId,
      prompt: trimmedPrompt,
    });

    // Schedule outreach agent response
    await ctx.scheduler.runAfter(0, internal.chat.streamOutreachResponse, {
      threadId,
      promptMessageId: messageId,
    });

    return { threadId, messageId, order: message.order };
  },
});

/**
 * Lists all threads for a specific prospect.
 */
export const listProspectThreads = query({
  args: {
    prospectId: v.id("prospects"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { prospectId, paginationOpts }) => {
    const user = await requireViewerUser(ctx);
    await requireOwnedProspect(ctx, prospectId, {
      user,
      notFoundMessage: "Prospect not found",
      notAuthorizedMessage: "Not authorized",
    });

    const page = await ctx.db
      .query("prospectThreads")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
      .order("desc")
      .paginate(paginationOpts);
    const prospectThreads = await buildProspectThreadHistoryEntries(
      ctx,
      page.page,
      {
        activeOnly: true,
      }
    );

    return {
      page: prospectThreads.map((thread) => ({
        _id: thread._id,
        _creationTime: thread._creationTime,
        status: thread.status,
        title: thread.title,
      })),
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

/**
 * Lists threads for a prospect with their first user message.
 * Used by HistoryPanel to display thread titles.
 * Reads from locally cached threadSummary first and falls back only for rows
 * that still need backfilled metadata.
 */
export const listProspectThreadsWithMessages = query({
  args: {
    prospectId: v.id("prospects"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { prospectId, paginationOpts }) => {
    const user = await requireViewerUser(ctx);
    await requireOwnedProspect(ctx, prospectId, {
      user,
      notFoundMessage: "Prospect not found",
      notAuthorizedMessage: "Not authorized",
    });

    const page = await ctx.db
      .query("prospectThreads")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
      .order("desc")
      .paginate(paginationOpts);
    const threadsWithMessages = await buildProspectThreadHistoryEntries(
      ctx,
      page.page,
      {
        activeOnly: true,
        includeFirstMessage: true,
      }
    );

    return {
      page: threadsWithMessages,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

/**
 * Hard-deletes a thread and removes its prospect-thread links.
 *
 */
export const deleteThread = mutation({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }) => {
    const user = await requireViewerUser(ctx);

    // Verify thread exists and user owns it
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId,
    });
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user._id) throw new Error("Not authorized");

    const threadLinks = await listProspectThreadLinksByThreadId(
      ctx.db,
      threadId
    );

    await outreachAgent.deleteThreadAsync(ctx, { threadId });

    await Promise.all(threadLinks.map((link) => ctx.db.delete(link._id)));
  },
});

/**
 * Send message to prospect thread using outreach agent.
 * On first message, stores it in thread summary for display.
 */
export const sendProspectMessage = mutation({
  args: {
    threadId: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, { threadId, prompt }) => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      throw new Error("Message cannot be empty.");
    }
    const user = await requireViewerUser(ctx);

    // Verify thread access
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId,
    });
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user._id) throw new Error("Not authorized");

    const threadLink = await getProspectThreadLinkByThreadId(ctx.db, threadId);
    if (threadLink) {
      const prospectForThread = await ctx.db.get(threadLink.prospectId);
      if (prospectForThread) {
        requireProspectNotArchived(prospectForThread);
      }
    }

    // If no summary yet, this is the first user message - store it for display
    if (!thread.summary) {
      const threadSummary = trimmedPrompt.slice(0, 150);
      await ctx.runMutation(components.agent.threads.updateThread, {
        threadId,
        patch: { summary: threadSummary },
      });
      if (threadLink) {
        await ctx.db.patch(threadLink._id, {
          threadStatus: "active",
          threadSummary,
        });
      }
    }

    // Save user message
    const { messageId, message } = await saveMessage(ctx, components.agent, {
      threadId,
      prompt: trimmedPrompt,
    });

    // Schedule outreach agent response
    await ctx.scheduler.runAfter(0, internal.chat.streamOutreachResponse, {
      threadId,
      promptMessageId: messageId,
    });
    if (threadLink) {
      const prospect = await ctx.db.get(threadLink.prospectId);
      if (prospect) {
        await recordWorkspaceActivityWithDb(ctx, prospect.workspaceId);
      }
    }

    return { messageId, order: message.order };
  },
});

/** Prospect row for a thread (internal; used by stream guard). */
export const getProspectForThreadInternal = internalQuery({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    const link = await getProspectThreadLinkByThreadId(ctx.db, threadId);
    if (!link) return null;
    return await ctx.db.get(link.prospectId);
  },
});

/**
 * Internal action for streaming outreach agent response.
 * Detects askHuman tool calls and creates notifications.
 */
export const streamOutreachResponse = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const prospect = await ctx.runQuery(
        internal.chat.getProspectForThreadInternal,
        { threadId: args.threadId }
      );
      if (prospect?.status === "archived") {
        return;
      }

      const useCase = await resolveOutreachUseCaseForThread(ctx, args.threadId);
      const tools = await getOutreachToolsForThread(ctx, args.threadId);
      const promptText = await getPlainTextMessageById(
        ctx,
        args.promptMessageId
      );
      const hasSearchablePrompt = promptText.trim().length > 0;
      const hasSearchableHistory = await hasSearchableThreadHistory(ctx, {
        threadId: args.threadId,
        excludeMessageId: args.promptMessageId,
      });
      const shouldUseHistorySearch =
        hasSearchablePrompt && hasSearchableHistory;
      const result = await streamOutreachTextWithFallback(ctx, {
        threadId: args.threadId,
        promptMessageId: args.promptMessageId,
        system: buildOutreachAgentPrompt(useCase),
        tools,
        preferHistorySearch: shouldUseHistorySearch,
      });

      await result.consumeStream();
      await persistRawModelResponse(ctx, {
        threadId: args.threadId,
        agentName: "Outreach Agent",
        request: result.request,
        response: result.response,
        providerMetadata: result.providerMetadata,
      });

      // Check for askHuman tool calls
      const toolCalls = await result.toolCalls;
      const askHumanCalls = toolCalls.filter(
        (tc) => tc.toolName === "askHuman"
      );

      // Create notifications for each askHuman call
      for (const call of askHumanCalls) {
        // Type guard: check if args exists (handles both TypedToolCall and DynamicToolCall)
        const toolArgs =
          "args" in call
            ? (call.args as {
                question: string;
                context?: string;
                urgency?: "low" | "medium" | "high";
                options?: string[];
              })
            : null;

        if (!toolArgs) {
          chatLogger.warn("askHuman tool call missing args", {
            threadId: args.threadId,
            toolCallId: call.toolCallId,
            toolName: call.toolName,
          });
          continue;
        }

        await ctx.runMutation(internal.chat.createAskHumanNotification, {
          threadId: args.threadId,
          toolCallId: call.toolCallId,
          question: toolArgs.question,
          context: toolArgs.context,
          urgency: toolArgs.urgency,
          options: toolArgs.options,
        });
      }

      await ctx.runAction(
        internal.chat.reconcileOutreachTaskStatusAfterStream,
        {
          threadId: args.threadId,
        }
      );

      return {
        text: await result.text,
        finishReason: await result.finishReason,
        pendingAskHuman: askHumanCalls.length > 0,
      };
    } catch (error) {
      chatLogger.error(
        "Outreach stream error",
        {
          threadId: args.threadId,
          promptMessageId: args.promptMessageId,
        },
        error
      );
      throw error;
    }
  },
});

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function getFailureClassFromResultData(resultData: unknown): string | null {
  const resultRecord = asRecord(resultData);
  const errorRecord = asRecord(resultRecord?.error);
  const value = errorRecord?.classification ?? errorRecord?.type;
  return typeof value === "string" ? value : null;
}

function getPostedTweetIdFromResultData(resultData: unknown): string | null {
  const resultRecord = asRecord(resultData);
  const value = resultRecord?.postedTweetId;
  return typeof value === "string" ? value : null;
}

/**
 * Write deterministic status messages for outreach execution directly to thread.
 * This avoids optimistic assistant claims when persistence says otherwise.
 */
export const bridgeOutreachTaskStatusToThread = internalAction({
  args: {
    taskId: v.id("outreachTasks"),
  },
  handler: async (
    ctx,
    { taskId }
  ): Promise<{
    bridged: boolean;
    reason?:
      | "task_not_found"
      | "thread_missing"
      | "no_bridgeable_state"
      | "already_bridged";
    state?: string;
  }> => {
    const task = await ctx.runQuery(internal.outreach.getTaskInternal, {
      taskId,
    });
    if (!task) return { bridged: false, reason: "task_not_found" as const };

    const planData = await ctx.runQuery(internal.outreach.getPlanInternal, {
      planId: task.planId,
    });
    if (!planData?.plan?.threadId) {
      return { bridged: false, reason: "thread_missing" as const };
    }

    const postedTweetId = getPostedTweetIdFromResultData(task.resultData);
    const failureClass = getFailureClassFromResultData(task.resultData);
    const resultRecord = asRecord(task.resultData);

    let bridgeState: string | null = null;
    let message: string | null = null;

    if (
      (task.status === "waiting_response" || task.status === "completed") &&
      postedTweetId
    ) {
      const responseReceived = resultRecord?.responseReceived === true;
      bridgeState = responseReceived ? "completed_response" : "posted";
      message = responseReceived
        ? `Prospect responded. Reply was posted successfully (tweet ID: ${postedTweetId}).`
        : `Reply posted successfully on X (tweet ID: ${postedTweetId}).`;
    } else if (task.status === "failed") {
      if (failureClass === "reauth_required") {
        bridgeState = "failed_reauth";
        message =
          "Posting is blocked because X authentication expired. Reconnect your X account to resume.";
      } else if (failureClass === "scope_missing") {
        bridgeState = "failed_scope";
        message =
          "Posting is blocked because required X write permissions are missing. Reconnect with tweet.write and media.write to resume.";
      } else {
        bridgeState = "failed_other";
        message = `Reply execution failed${task.errorMessage ? `: ${task.errorMessage}` : "."}`;
      }
    }

    if (!bridgeState || !message) {
      return { bridged: false, reason: "no_bridgeable_state" as const };
    }

    if (task.statusBridgeState === bridgeState) {
      return { bridged: false, reason: "already_bridged" as const };
    }

    await saveMessage(ctx, components.agent, {
      threadId: planData.plan.threadId,
      message: { role: "assistant", content: message },
      agentName: "Outreach Workflow",
    });

    await ctx.runMutation(internal.outreach.markTaskStatusBridgeSent, {
      taskId,
      statusBridgeState: bridgeState,
    });

    return { bridged: true, state: bridgeState };
  },
});

/**
 * Reconcile latest outreach task state after each outreach-agent stream completes.
 */
export const reconcileOutreachTaskStatusAfterStream = internalAction({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }): Promise<{ processed: number }> => {
    const threadContext = await ctx.runQuery(
      internal.prospectThreads.getThreadProspectContext,
      {
        threadId,
      }
    );
    if (!threadContext) {
      return { processed: 0 };
    }

    const active = await ctx.runQuery(
      internal.outreach.getProspectActivePlanInternal,
      {
        prospectId: threadContext.prospectId,
      }
    );
    if (!active) {
      return { processed: 0 };
    }

    const candidates = active.tasks
      .filter(
        (task: (typeof active.tasks)[number]) =>
          task.type === "comment" &&
          (task.status === "waiting_response" ||
            task.status === "completed" ||
            task.status === "failed")
      )
      .sort(
        (a: (typeof active.tasks)[number], b: (typeof active.tasks)[number]) =>
          b.order - a.order
      );

    let processed = 0;
    for (const task of candidates) {
      const result = await ctx.runAction(
        internal.chat.bridgeOutreachTaskStatusToThread,
        {
          taskId: task._id,
        }
      );
      if (result.bridged) {
        processed += 1;
      }
    }

    return { processed };
  },
});

// ============================================================================
// Message Listing (for UI with Streaming)
// ============================================================================

/**
 * When the agent component has no thread doc (stale `threadId` in the URL,
 * dev DB reset, etc.), return an empty page matching `useUIMessages` /
 * `syncStreams` instead of throwing so the UI can recover.
 */
function emptyListThreadMessagesResult(streamArgs: StreamArgs | undefined) {
  const paginated = {
    page: [] as UIMessage[],
    isDone: true,
    continueCursor: "",
  };
  const streams =
    streamArgs === undefined
      ? undefined
      : streamArgs.kind === "list"
        ? { kind: "list" as const, messages: [] }
        : { kind: "deltas" as const, deltas: [] };
  return { ...paginated, streams };
}

/**
 * List messages in a thread with streaming support.
 * Per docs: https://docs.convex.dev/agents/streaming#retrieving-streamed-deltas
 *
 * This query is used by useUIMessages hook on the frontend.
 */
export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    // Required for streaming - per docs
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);

    // Verify user has access to this thread
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId: args.threadId,
    });

    if (!thread) {
      return emptyListThreadMessagesResult(args.streamArgs);
    }

    if (thread.userId !== user._id) {
      throw new Error("Not authorized to access this thread");
    }

    // Fetches the regular non-streaming messages
    // Per docs: pass args directly to listUIMessages
    const paginated = await listUIMessages(ctx, components.agent, args);

    // Sync streaming deltas - per docs
    const streams = await syncStreams(ctx, components.agent, {
      ...args,
      // By default syncStreams only returns streaming messages. Include finished
      // to avoid UI flashes when messages aren't saved in same transaction.
      includeStatuses: ["streaming", "aborted", "finished"],
    });

    return { ...paginated, streams };
  },
});

/**
 * Returns the current generation state for a thread so the UI can reconcile
 * stalled runs into a user-visible failure state.
 */
export const getThreadGenerationState = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }) => {
    const user = await requireViewerUser(ctx);

    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId,
    });
    if (!thread) {
      return null;
    }
    if (thread.userId !== user._id) {
      throw new Error("Not authorized");
    }

    const streams = await ctx.runQuery(components.agent.streams.list, {
      threadId,
      statuses: ["streaming", "aborted"],
    });

    const activeOrders = new Set(
      streams
        .filter((stream) => stream.status === "streaming")
        .map((stream) => stream.order)
    );
    const abortedOrders = new Set(
      streams
        .filter((stream) => stream.status === "aborted")
        .map((stream) => stream.order)
    );

    const pendingAssistantMessages = await listPendingAssistantMessages(
      ctx,
      threadId
    );
    const stalledMessage = pendingAssistantMessages.find(
      (message) =>
        abortedOrders.has(message.order) && !activeOrders.has(message.order)
    );

    if (stalledMessage) {
      return {
        status: "stalled" as const,
        order: stalledMessage.order,
      };
    }

    return {
      status: activeOrders.size > 0 ? ("running" as const) : ("idle" as const),
    };
  },
});

/**
 * Converts a stalled run into a failed assistant message with user-friendly copy.
 * This handles cases where the background Convex action timed out after the
 * stream itself was already marked aborted by the Agent component.
 */
export const reconcileThreadGenerationFailure = mutation({
  args: {
    threadId: v.string(),
    order: v.number(),
    errorMessage: v.optional(v.string()),
    userVisibleMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);

    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId: args.threadId,
    });
    if (!thread) {
      throw new Error("Thread not found");
    }
    if (thread.userId !== user._id) {
      throw new Error("Not authorized");
    }

    const activeStreams = await ctx.runQuery(components.agent.streams.list, {
      threadId: args.threadId,
      statuses: ["streaming"],
    });
    if (activeStreams.some((stream) => stream.order === args.order)) {
      return {
        resolved: false,
        reason: "still_streaming" as const,
      };
    }

    const finalized = await finalizePendingAssistantMessageForOrder(ctx, {
      threadId: args.threadId,
      order: args.order,
      errorMessage: args.errorMessage?.trim() || TIMED_OUT_ERROR_MESSAGE,
      userVisibleMessage:
        args.userVisibleMessage?.trim() || TIMED_OUT_VISIBLE_MESSAGE,
    });

    return finalized
      ? {
          resolved: true,
          order: args.order,
        }
      : {
          resolved: false,
          reason: "no_pending_message" as const,
        };
  },
});

// ============================================================================
// Message Sending (Streaming Pattern)
// ============================================================================

/**
 * Initiates a streaming message send.
 * Per docs: https://docs.convex.dev/agents/agent-usage#saving-the-prompt-then-generating-responses-asynchronously
 *
 * Benefits:
 * - Optimistic UI updates via mutations
 * - Message saved transactionally with other writes
 * - Can safely retry without duplicating prompt
 */
export const initiateStreamingMessage = mutation({
  args: {
    threadId: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);

    // Verify user has access to this thread
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId: args.threadId,
    });

    if (!thread) {
      throw new Error("Thread not found");
    }

    if (thread.userId !== user._id) {
      throw new Error("Not authorized to access this thread");
    }

    // Save the user's message first - per docs
    const { messageId, message } = await saveMessage(ctx, components.agent, {
      threadId: args.threadId,
      prompt: args.prompt,
    });

    // Schedule the streaming action
    await ctx.scheduler.runAfter(0, internal.chat.streamAgentResponse, {
      threadId: args.threadId,
      promptMessageId: messageId,
    });
    const workspaceId = await getWorkspaceIdForSetupThread(ctx, args.threadId);
    if (workspaceId) {
      await recordWorkspaceActivityWithDb(ctx, workspaceId);
    }

    return {
      messageId,
      order: message.order,
    };
  },
});

/**
 * Aborts any active agent streams for a thread owned by the current user.
 * This powers the prompt-input "Stop generating" action in the chat UI.
 */
export const abortThreadStream = mutation({
  args: {
    threadId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { threadId, reason }) => {
    const user = await requireViewerUser(ctx);

    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId,
    });
    if (!thread) {
      throw new Error("Thread not found");
    }
    if (thread.userId !== user._id) {
      throw new Error("Not authorized");
    }

    const activeStreams = await ctx.runQuery(components.agent.streams.list, {
      threadId,
      statuses: ["streaming"],
    });

    let abortedCount = 0;
    const abortedOrders = new Set<number>();
    for (const stream of activeStreams) {
      const aborted = await ctx.runMutation(
        components.agent.streams.abortByOrder,
        {
          threadId,
          order: stream.order,
          reason: reason?.trim() || "Stopped by user",
        }
      );
      if (aborted) {
        abortedCount += 1;
        abortedOrders.add(stream.order);
      }
    }

    let finalizedCount = 0;
    for (const order of abortedOrders) {
      const finalized = await finalizePendingAssistantMessageForOrder(ctx, {
        threadId,
        order,
        errorMessage: reason?.trim() || USER_STOPPED_ERROR_MESSAGE,
        userVisibleMessage: USER_STOPPED_VISIBLE_MESSAGE,
      });

      if (finalized) {
        finalizedCount += 1;
      }
    }

    return {
      abortedCount,
      finalizedCount,
    };
  },
});

/**
 * Internal action that streams the agent response.
 * Per docs: https://docs.convex.dev/agents/streaming#streaming-message-deltas
 *
 * Called asynchronously after the user message is saved.
 */
export const streamAgentResponse = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const useCase = await resolveSetupUseCaseForThread(ctx, args.threadId);
      // Stream text with delta persistence for all clients
      // Per docs: pass { saveStreamDeltas: true } to enable streaming
      const result = await setupAgent.streamText(
        ctx,
        { threadId: args.threadId },
        {
          promptMessageId: args.promptMessageId,
          system: buildSetupAgentPrompt(useCase),
        },
        {
          saveStreamDeltas: {
            // Per docs: chunking can be "word", "line", regex, or custom function
            chunking: "word",
            // Per docs: throttleMs controls how frequently deltas are saved
            throttleMs: 100,
          },
        }
      );

      // Consume the stream to ensure completion
      await result.consumeStream();
      await persistRawModelResponse(ctx, {
        threadId: args.threadId,
        agentName: "Setup Agent",
        request: result.request,
        response: result.response,
        providerMetadata: result.providerMetadata,
      });

      return {
        text: await result.text,
        finishReason: await result.finishReason,
      };
    } catch (error) {
      chatLogger.error(
        "Setup agent stream error",
        {
          threadId: args.threadId,
          promptMessageId: args.promptMessageId,
        },
        error
      );
      throw error;
    }
  },
});

/**
 * Internal action that triggers the agent to send an initial greeting.
 * Called when a new thread is created.
 *
 * The agent will call getUserStatus first (per system prompt) to determine
 * the appropriate greeting based on user state.
 */
export const triggerAgentGreeting = internalAction({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const useCase = await resolveSetupUseCaseForThread(ctx, args.threadId);
      // Use a special init prompt to trigger the agent greeting
      // This prompt is filtered out in the UI (see useAgentChat.ts)
      // The agent's system prompt instructs it to call getUserStatus first
      const result = await setupAgent.streamText(
        ctx,
        { threadId: args.threadId },
        {
          prompt: "__INIT__",
          system: buildSetupAgentPrompt(useCase),
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
        threadId: args.threadId,
        agentName: "Setup Agent",
        request: result.request,
        response: result.response,
        providerMetadata: result.providerMetadata,
      });

      return {
        text: await result.text,
        finishReason: await result.finishReason,
      };
    } catch (error) {
      chatLogger.error(
        "Agent greeting error",
        { threadId: args.threadId },
        error
      );
      throw error;
    }
  },
});

// ============================================================================
// Non-Streaming Fallback
// ============================================================================

/**
 * Sends a message to the agent and gets a response (non-streaming).
 * Per docs: https://docs.convex.dev/agents/agent-usage#basic-approach-synchronous
 *
 * Use this as a fallback when streaming isn't needed.
 */
export const sendMessage = action({
  args: {
    threadId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify user owns/has access to this thread
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId: args.threadId,
    });

    if (!thread) {
      throw new Error("Thread not found");
    }

    // Get the authenticated user to compare IDs
    const user = await ctx.runQuery(internal.users.getUserByWorkosIdInternal, {
      workosUserId: identity.subject,
    });

    if (!user || thread.userId !== user._id) {
      throw new Error("Not authorized to access this thread");
    }

    // Generate text response using the agent - per docs
    const useCase = await resolveSetupUseCaseForThread(ctx, args.threadId);

    const result = await setupAgent.generateText(
      ctx,
      { threadId: args.threadId },
      { prompt: args.message, system: buildSetupAgentPrompt(useCase) }
    );
    await persistRawModelResponse(ctx, {
      userId: user._id,
      threadId: args.threadId,
      agentName: "Setup Agent",
      request: result.request,
      response: result.response,
      providerMetadata: result.providerMetadata,
    });
    const workspaceId = await getWorkspaceIdForSetupThread(ctx, args.threadId);
    if (workspaceId) {
      await ctx.runMutation(
        internal.workspaces.recordWorkspaceActivityInternal,
        {
          workspaceId,
        }
      );
    }

    return {
      text: result.text,
      finishReason: result.finishReason,
    };
  },
});

// ============================================================================
// askHuman Support
// ============================================================================

/**
 * Create notification for askHuman tool call (internal).
 * Called when outreach agent uses askHuman during chat.
 */
export const createAskHumanNotification = internalMutation({
  args: {
    threadId: v.string(),
    toolCallId: v.string(),
    question: v.string(),
    context: v.optional(v.string()),
    urgency: v.optional(urgencyLevelValidator),
    options: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Get thread to find user and prospect
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId: args.threadId,
    });

    if (!thread) {
      throw new Error("Thread not found");
    }

    // Validate userId exists (Agent component types it as optional)
    if (!thread.userId) {
      chatLogger.warn(
        "Cannot create askHuman notification because thread has no userId",
        { threadId: args.threadId }
      );
      return;
    }
    const userId = thread.userId as Id<"users">;

    const threadContext = await getProspectThreadContextByThreadId(
      ctx.db,
      args.threadId
    );
    const prospectId = threadContext?.link.prospectId;
    const prospect = threadContext?.prospect;

    // Fetch prospect for display fields and workspace scoping
    let prospectWorkspaceId: Id<"workspaces"> | undefined;
    let prospectDisplayFields = {
      prospectAvatarUrl: undefined as string | undefined,
      prospectDisplayName: undefined as string | undefined,
      prospectType: undefined as
        | "individual"
        | "organization"
        | "unknown"
        | undefined,
      prospectPlatform: undefined as "twitter" | "linkedin" | undefined,
      prospectScreenName: undefined as string | undefined,
    };
    if (prospect) {
      prospectDisplayFields = getProspectDisplayFields(prospect);
      prospectWorkspaceId = prospect.workspaceId;
    }

    // Prefer prospect workspace for strict notification scoping.
    let workspaceId: Id<"workspaces"> | undefined = prospectWorkspaceId;
    if (!workspaceId) {
      const fallbackWorkspace = await getDefaultWorkspaceForUser(ctx, userId);
      workspaceId = fallbackWorkspace?._id;
    }

    // Create notification (workspaceId may be undefined if user has no workspace)
    if (!workspaceId) {
      chatLogger.warn(
        "Cannot create askHuman notification because no workspace was found",
        { threadId: args.threadId, userId: String(userId) }
      );
      return;
    }

    // Build message with context if provided
    let message = args.question;
    if (args.context) {
      message = `${args.question}\n\nContext: ${args.context}`;
    }
    if (args.options && args.options.length > 0) {
      message += `\n\nOptions: ${args.options.join(", ")}`;
    }

    const workspace = await ctx.db.get(workspaceId);
    const useCase = getWorkspaceUseCase(workspace?.useCaseKey);

    // Dynamic title with name at the end for natural reading
    const name =
      prospectDisplayFields.prospectDisplayName ||
      useCase.entitySingular.toLowerCase();
    const title = `Agent needs your input for ${name}`;

    await createNotification(ctx, {
      userId,
      workspaceId,
      type: "ask_human",
      title,
      message,
      prospectId,
      threadId: args.threadId,
      toolCallId: args.toolCallId,
      ...prospectDisplayFields,
    });
  },
});

/**
 * Respond to an askHuman tool call.
 * Called when user provides input for a pending askHuman request.
 */
export const respondToAskHuman = internalAction({
  args: {
    threadId: v.string(),
    toolCallId: v.string(),
    response: v.string(),
    notificationId: v.optional(v.id("outreachNotifications")),
  },
  handler: async (ctx, args) => {
    if (!args.response.trim()) {
      throw new Error("Response cannot be empty.");
    }
    // Save tool result message per human-agents.md docs
    await saveMessage(ctx, components.agent, {
      threadId: args.threadId,
      agentName: "User",
      message: {
        role: "tool",
        content: [
          {
            type: "tool-result",
            result: args.response,
            toolCallId: args.toolCallId,
            toolName: "askHuman",
          },
        ],
      },
    });

    // Mark notification as seen if provided
    if (args.notificationId) {
      await ctx.runMutation(internal.chat.markNotificationSeen, {
        notificationId: args.notificationId,
      });
    }

    // Continue agent generation with the tool result
    const useCase = await resolveOutreachUseCaseForThread(ctx, args.threadId);
    const tools = await getOutreachToolsForThread(ctx, args.threadId);

    const result = await streamOutreachTextWithFallback(ctx, {
      threadId: args.threadId,
      system: buildOutreachAgentPrompt(useCase),
      tools,
      preferHistorySearch: true,
    });

    await result.consumeStream();
    await persistRawModelResponse(ctx, {
      threadId: args.threadId,
      agentName: "Outreach Agent",
      request: result.request,
      response: result.response,
      providerMetadata: result.providerMetadata,
    });

    return {
      text: await result.text,
      finishReason: await result.finishReason,
    };
  },
});

/**
 * Mark notification as seen (internal).
 */
export const markNotificationSeen = internalMutation({
  args: {
    notificationId: v.id("outreachNotifications"),
  },
  handler: async (ctx, { notificationId }) => {
    await ctx.db.patch(notificationId, {
      status: "seen",
    });
  },
});

// ============================================================================
// Vector Search for Thread History
// ============================================================================

/**
 * Extracts a preview snippet centered around the matching text.
 * Used by searchProspectMessages to show relevant context in thread cards.
 *
 * @param content - Full message content
 * @param query - Search query to find
 * @param maxLength - Maximum preview length (default 150)
 * @returns Preview string with ellipsis if truncated
 */
function extractMatchPreview(
  content: string,
  query: string,
  maxLength: number = 150
): string {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerContent.indexOf(lowerQuery);

  if (matchIndex === -1) {
    // Fallback: no exact match found (likely vector search semantic match)
    return (
      content.slice(0, maxLength) + (content.length > maxLength ? "..." : "")
    );
  }

  // Calculate context to show around the match
  const queryLength = query.length;
  const contextSize = Math.floor((maxLength - queryLength) / 2);
  const start = Math.max(0, matchIndex - contextSize);
  const end = Math.min(content.length, matchIndex + queryLength + contextSize);

  let preview = content.slice(start, end);
  if (start > 0) preview = "..." + preview;
  if (end < content.length) preview = preview + "...";

  return preview;
}

/**
 * Search messages in prospect threads using hybrid text + vector search.
 * Uses agent's built-in search capabilities per docs/convex/llm-context.md.
 *
 * Returns matching threads with preview of matched content.
 */
export const searchProspectMessages = action({
  args: {
    prospectId: v.id("prospects"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.runQuery(internal.users.getUserByWorkosIdInternal, {
      workosUserId: identity.subject,
    });
    if (!user) throw new Error("User not found");

    const prospect = await ctx.runQuery(
      internal.prospects.getProspectInternal,
      {
        prospectId: args.prospectId,
      }
    );
    if (!prospect || prospect.userId !== user._id) {
      throw new Error("Prospect not found");
    }

    const threadLinks = await ctx.runQuery(
      internal.prospectThreads.listThreadLinksForProspect,
      {
        prospectId: args.prospectId,
      }
    );
    const prospectThreads = threadLinks
      .filter((threadLink) => threadLink.userId === user._id)
      .filter(
        (threadLink) =>
          normalizeProspectThreadStatus(threadLink.threadStatus) === "active"
      )
      .map((threadLink) => ({
        _id: threadLink.threadId,
        _creationTime: threadLink._creationTime,
        status: normalizeProspectThreadStatus(threadLink.threadStatus),
      }));

    if (prospectThreads.length === 0) {
      return { threads: [] };
    }

    // Search type for results
    type SearchResult = {
      threadId: string;
      thread: (typeof prospectThreads)[0];
      matchPreview: string;
      matchCount: number;
    };

    const results: SearchResult[] = [];

    // Search messages in each thread using agent's fetchContextMessages
    for (const thread of prospectThreads) {
      try {
        const messages = await outreachAgent.fetchContextMessages(ctx, {
          userId: user._id,
          threadId: thread._id,
          searchText: args.query,
          contextOptions: {
            recentMessages: 0, // Only search results, no recent
            searchOptions: {
              limit: args.limit ?? 10, // Increased limit for better recall
              textSearch: true, // Text search for keyword matching
              vectorSearch: true, // Vector search for semantic similarity
            },
          },
        });

        if (messages.length > 0) {
          // Helper to extract text from message content
          const extractText = (
            content: (typeof messages)[0]["message"]
          ): string => {
            const c = content?.content;
            if (typeof c === "string") return c;
            if (Array.isArray(c)) {
              return c
                .map((part) => {
                  if (typeof part === "string") return part;
                  if (
                    typeof part === "object" &&
                    part !== null &&
                    "text" in part
                  ) {
                    return String((part as { text: unknown }).text);
                  }
                  return "";
                })
                .join(" ");
            }
            return "";
          };

          // Find message containing the exact query (case-insensitive)
          // Both text search and vector search may return semantically similar
          // but not exact matches - we only want to show threads where the
          // query substring actually exists.
          const lowerQuery = args.query.toLowerCase();
          let matchedText = "";
          for (const msg of messages) {
            const text = extractText(msg.message);
            if (text.toLowerCase().includes(lowerQuery)) {
              matchedText = text;
              break;
            }
          }

          // Only include thread if we found an exact match
          // This ensures "No matching threads" is shown when query isn't found
          if (matchedText) {
            const matchPreview = extractMatchPreview(matchedText, args.query);
            results.push({
              threadId: thread._id,
              thread,
              matchPreview,
              matchCount: messages.length,
            });
          }
        }
      } catch (error) {
        // Log but continue with other threads
        chatLogger.warn(
          "Thread history search failed",
          {
            prospectId: String(args.prospectId),
            threadId: thread._id,
          },
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }

    // Sort by number of matches (threads with more matches first)
    results.sort((a, b) => b.matchCount - a.matchCount);

    return { threads: results };
  },
});
