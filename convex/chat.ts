// convex/chat.ts
// Chat functions using @convex-dev/agent with streaming support
// Docs: https://docs.convex.dev/agents/streaming

import { v } from "convex/values";
import {
  mutation,
  query,
  internalAction,
  internalMutation,
  action,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { components } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  createThread,
  listUIMessages,
  vStreamArgs,
  syncStreams,
  saveMessage,
} from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { setupAgent } from "./agents";
import { outreachAgent } from "./agents/outreach";
import { ADDITIONAL_WORKSPACE_SETUP_PROMPT } from "./agents/prompts";
import { createNotification } from "./lib/outreachCore";
import { getProspectDisplayFields } from "./lib/notificationHelpers";
import { urgencyLevelValidator } from "./validators";

// ============================================================================
// Thread Management
// ============================================================================

/**
 * Creates a new chat thread for the current user.
 */
export const createChatThread = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get the current user
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Create a new thread - per docs: https://docs.convex.dev/agents/threads
    const threadId = await createThread(ctx, components.agent, {
      userId: user._id,
    });

    return { threadId };
  },
});

/**
 * Creates a fresh setup thread and seeds it with a server-owned prompt.
 * Used for additional-workspace setup flow without client-provided prompt text.
 */
export const createSetupThreadWithPrompt = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Keep prompt server-owned for consistent setup behavior.
    const prompt = ADDITIONAL_WORKSPACE_SETUP_PROMPT;

    const threadId = await createThread(ctx, components.agent, {
      userId: user._id,
      summary: prompt.slice(0, 150),
    });

    const { messageId, message } = await saveMessage(ctx, components.agent, {
      threadId,
      prompt,
    });

    await ctx.scheduler.runAfter(0, internal.chat.streamAgentResponse, {
      threadId,
      promptMessageId: messageId,
    });

    return { threadId, messageId, order: message.order };
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get the current user
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();

    if (!user) {
      throw new Error("User not found");
    }

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
 * Uses title field in format "outreach:prospectId" for filtering.
 */
export const createProspectThread = mutation({
  args: {
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, { prospectId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();
    if (!user) throw new Error("User not found");

    // Verify prospect exists and user has access
    const prospect = await ctx.db.get(prospectId);
    if (!prospect) throw new Error("Prospect not found");
    if (prospect.userId !== user._id) throw new Error("Not authorized");

    // Create thread with prospect linked via title
    const threadId = await createThread(ctx, components.agent, {
      userId: user._id,
      title: `outreach:${prospectId}`,
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();
    if (!user) return null;

    // Check for existing thread for this prospect
    const expectedTitle = `outreach:${prospectId}`;
    const allThreads = await ctx.runQuery(
      components.agent.threads.listThreadsByUserId,
      { userId: user._id, paginationOpts: { numItems: 50, cursor: null } }
    );

    const existingThread = allThreads.page.find(
      (t) => t.title === expectedTitle && t.status === "active"
    );

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();
    if (!user) throw new Error("User not found");

    // Verify prospect exists and user has access
    const prospect = await ctx.db.get(prospectId);
    if (!prospect) throw new Error("Prospect not found");
    if (prospect.userId !== user._id) throw new Error("Not authorized");

    // Create thread with prospect linked via title
    // Use summary field to store first user message for display
    const threadId = await createThread(ctx, components.agent, {
      userId: user._id,
      title: `outreach:${prospectId}`,
      summary: prompt.slice(0, 150),
    });

    // Save the user's prompt message
    const { messageId, message } = await saveMessage(ctx, components.agent, {
      threadId,
      prompt,
    });

    // Schedule outreach agent response
    await ctx.scheduler.runAfter(0, internal.chat.streamOutreachResponse, {
      threadId,
      promptMessageId: messageId,
    });

    console.info(
      `[Chat] Created prospect thread with prompt: threadId=${threadId}, prospectId=${prospectId}`
    );

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();
    if (!user) throw new Error("User not found");

    // Get all user threads
    const allThreads = await ctx.runQuery(
      components.agent.threads.listThreadsByUserId,
      { userId: user._id, paginationOpts }
    );

    // Filter to prospect-specific threads by title pattern
    const expectedTitle = `outreach:${prospectId}`;
    const prospectThreads = allThreads.page.filter(
      (thread) => thread.title === expectedTitle
    );

    return {
      page: prospectThreads,
      continueCursor: allThreads.continueCursor,
      isDone: allThreads.isDone,
    };
  },
});

/**
 * Lists threads for a prospect with their first user message.
 * Used by HistoryPanel to display thread titles.
 * Reads from thread.summary (set on first message) for efficiency.
 */
export const listProspectThreadsWithMessages = query({
  args: {
    prospectId: v.id("prospects"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { prospectId, paginationOpts }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();
    if (!user) throw new Error("User not found");

    // Get all user threads
    const allThreads = await ctx.runQuery(
      components.agent.threads.listThreadsByUserId,
      { userId: user._id, paginationOpts }
    );

    // Filter to prospect-specific threads by title pattern
    const expectedTitle = `outreach:${prospectId}`;
    const prospectThreads = allThreads.page.filter(
      (thread) => thread.title === expectedTitle
    );

    // Map threads with firstMessage from summary field (set on first message)
    const threadsWithMessages = prospectThreads.map((thread) => ({
      ...thread,
      // Use summary field which stores the first user message
      firstMessage: thread.summary || undefined,
    }));

    return {
      page: threadsWithMessages,
      continueCursor: allThreads.continueCursor,
      isDone: allThreads.isDone,
    };
  },
});

/**
 * Archives a thread (soft delete).
 */
export const archiveThread = mutation({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();
    if (!user) throw new Error("User not found");

    // Verify thread exists and user owns it
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId,
    });
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user._id) throw new Error("Not authorized");

    // Archive the thread using updateThread with patch object
    await ctx.runMutation(components.agent.threads.updateThread, {
      threadId,
      patch: {
        status: "archived",
      },
    });
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();
    if (!user) throw new Error("User not found");

    // Verify thread access
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId,
    });
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user._id) throw new Error("Not authorized");

    // If no summary yet, this is the first user message - store it for display
    if (!thread.summary) {
      await ctx.runMutation(components.agent.threads.updateThread, {
        threadId,
        patch: { summary: prompt.slice(0, 150) },
      });
    }

    // Save user message
    const { messageId, message } = await saveMessage(ctx, components.agent, {
      threadId,
      prompt,
    });

    // Schedule outreach agent response
    await ctx.scheduler.runAfter(0, internal.chat.streamOutreachResponse, {
      threadId,
      promptMessageId: messageId,
    });

    return { messageId, order: message.order };
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
      const result = await outreachAgent.streamText(
        ctx,
        { threadId: args.threadId },
        { promptMessageId: args.promptMessageId },
        {
          saveStreamDeltas: {
            chunking: "word",
            throttleMs: 100,
          },
        }
      );

      await result.consumeStream();

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
          console.warn(`[Chat] askHuman call missing args:`, call);
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

        console.info(
          `[Chat] Created askHuman notification for toolCallId: ${call.toolCallId}`
        );
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
      console.error("[Chat] Outreach stream error:", error);
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
        ? `💬 Prospect responded. Reply was posted successfully (tweet ID: ${postedTweetId}).`
        : `✅ Reply posted successfully on X (tweet ID: ${postedTweetId}).`;
    } else if (task.status === "failed") {
      if (failureClass === "reauth_required") {
        bridgeState = "failed_reauth";
        message =
          "⚠️ Posting is blocked because X authentication expired. Reconnect your X account to resume.";
      } else if (failureClass === "scope_missing") {
        bridgeState = "failed_scope";
        message =
          "⚠️ Posting is blocked because X write scope is missing. Reconnect with tweet.write scope to resume.";
      } else {
        bridgeState = "failed_other";
        message = `⚠️ Reply execution failed${task.errorMessage ? `: ${task.errorMessage}` : "."}`;
      }
    }

    if (!bridgeState || !message) {
      return { bridged: false, reason: "no_bridgeable_state" as const };
    }

    if (task.statusBridgeState === bridgeState) {
      return { bridged: false, reason: "already_bridged" as const };
    }

    console.info(
      `[Chat][OutreachBridge] planId=${task.planId} taskId=${taskId} workflowId=${planData.plan.workflowId ?? "unknown"} state=${bridgeState}`
    );

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
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId,
    });
    if (!thread?.title?.startsWith("outreach:")) {
      return { processed: 0 };
    }

    const prospectId = thread.title.replace("outreach:", "") as Id<"prospects">;
    const active = await ctx.runQuery(
      internal.outreach.getProspectActivePlanInternal,
      {
        prospectId,
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
    console.info(
      `[Chat][OutreachReconcile] threadId=${threadId} planId=${active.plan._id} candidateTasks=${candidates.length}`
    );
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
    // Authentication check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get the current user
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();

    if (!user) {
      throw new Error("User not found");
    }

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get the current user
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();

    if (!user) {
      throw new Error("User not found");
    }

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

    return {
      messageId,
      order: message.order,
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
      // Stream text with delta persistence for all clients
      // Per docs: pass { saveStreamDeltas: true } to enable streaming
      const result = await setupAgent.streamText(
        ctx,
        { threadId: args.threadId },
        { promptMessageId: args.promptMessageId },
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

      return {
        text: await result.text,
        finishReason: await result.finishReason,
      };
    } catch (error) {
      console.error("[Chat] Stream error:", error);
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
      // Use a special init prompt to trigger the agent greeting
      // This prompt is filtered out in the UI (see useAgentChat.ts)
      // The agent's system prompt instructs it to call getUserStatus first
      const result = await setupAgent.streamText(
        ctx,
        { threadId: args.threadId },
        { prompt: "__INIT__" },
        {
          saveStreamDeltas: {
            chunking: "word",
            throttleMs: 100,
          },
        }
      );

      await result.consumeStream();

      return {
        text: await result.text,
        finishReason: await result.finishReason,
      };
    } catch (error) {
      console.error("[Chat] Agent greeting error:", error);
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
    const result = await setupAgent.generateText(
      ctx,
      { threadId: args.threadId },
      { prompt: args.message }
    );

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
      console.warn(
        "[Chat] Cannot create askHuman notification: no userId on thread"
      );
      return;
    }
    const userId = thread.userId as Id<"users">;

    // Parse prospect ID from thread title if it's an outreach thread
    let prospectId: Id<"prospects"> | undefined;
    if (thread.title?.startsWith("outreach:")) {
      prospectId = thread.title.replace("outreach:", "") as Id<"prospects">;
    }

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
      prospectScreenName: undefined as string | undefined,
    };
    if (prospectId) {
      const prospect = await ctx.db.get(prospectId);
      prospectDisplayFields = getProspectDisplayFields(prospect);
      prospectWorkspaceId = prospect?.workspaceId;
    }

    // Prefer prospect workspace for strict notification scoping.
    let workspaceId: Id<"workspaces"> | undefined = prospectWorkspaceId;
    if (!workspaceId) {
      const fallbackWorkspace = await ctx.db
        .query("workspaces")
        .withIndex("by_user_default", (q) =>
          q.eq("userId", userId).eq("isDefault", true)
        )
        .first();
      workspaceId = fallbackWorkspace?._id;
    }

    // Create notification (workspaceId may be undefined if user has no workspace)
    if (!workspaceId) {
      console.warn(
        "[Chat] Cannot create askHuman notification: no workspace found"
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

    // Dynamic title with name at the end for natural reading
    const name = prospectDisplayFields.prospectDisplayName || "prospect";
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
    const result = await outreachAgent.streamText(
      ctx,
      { threadId: args.threadId },
      {},
      {
        saveStreamDeltas: {
          chunking: "word",
          throttleMs: 100,
        },
      }
    );

    await result.consumeStream();

    console.info(
      `[Chat] Continued agent after askHuman response for toolCallId: ${args.toolCallId}`
    );

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

    // Get all threads for this prospect
    const expectedTitle = `outreach:${args.prospectId}`;
    const allThreads = await ctx.runQuery(
      components.agent.threads.listThreadsByUserId,
      { userId: user._id, paginationOpts: { numItems: 50, cursor: null } }
    );

    const prospectThreads = allThreads.page.filter(
      (t) => t.title === expectedTitle && t.status === "active"
    );

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
        console.warn(
          `[Chat] Search error for thread ${thread._id}:`,
          error instanceof Error ? error.message : error
        );
      }
    }

    console.info(
      `[Chat] Search complete: ${results.length} threads with matches out of ${prospectThreads.length} searched`
    );

    // Sort by number of matches (threads with more matches first)
    results.sort((a, b) => b.matchCount - a.matchCount);

    return { threads: results };
  },
});
