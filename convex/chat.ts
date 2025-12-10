// convex/chat.ts
// Chat functions using @convex-dev/agent with streaming support
// Docs: https://docs.convex.dev/agents/streaming

import { v } from "convex/values";
import { mutation, query, internalAction, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { components } from "./_generated/api";
import { 
  createThread, 
  listUIMessages, 
  vStreamArgs, 
  syncStreams, 
  saveMessage 
} from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { setupAgent } from "./agents";

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
 * Gets the user's most recent thread or creates one.
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
      return { threadId: existingThreads.page[0]._id, isNew: false };
    }

    // Create a new thread
    const threadId = await createThread(ctx, components.agent, {
      userId: user._id,
    });

    return { threadId, isNew: true };
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
    const thread = await ctx.runQuery(
      components.agent.threads.getThread,
      { threadId: args.threadId }
    );

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
    const thread = await ctx.runQuery(
      components.agent.threads.getThread,
      { threadId: args.threadId }
    );

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
    const thread = await ctx.runQuery(
      components.agent.threads.getThread,
      { threadId: args.threadId }
    );

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
