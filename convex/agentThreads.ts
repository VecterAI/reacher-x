// convex/agentThreads.ts
// v4: Agent threads and messages management

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getUserFromIdentity } from "./lib/userUtils";
import {
  createAgentThreadArgsValidator,
  addAgentMessageArgsValidator,
  updateAgentThreadStatusArgsValidator,
  agentThreadTypeValidator,
} from "./validators";

/**
 * Get the current user's active onboarding thread
 */
export const getActiveOnboardingThread = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await getUserFromIdentity(ctx, identity, false);
    if (!user) return null;

    const thread = await ctx.db
      .query("agentThreads")
      .withIndex("by_user_type", (q) =>
        q.eq("userId", user._id).eq("type", "onboarding")
      )
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "awaiting_approval")
        )
      )
      .first();

    return thread;
  },
});

/**
 * Get a thread by ID (with auth check)
 */
export const getThread = query({
  args: { threadId: v.id("agentThreads") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await getUserFromIdentity(ctx, identity, false);
    if (!user) return null;

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== user._id) return null;

    return thread;
  },
});

/**
 * Get messages for a thread
 */
export const getThreadMessages = query({
  args: { threadId: v.id("agentThreads") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await getUserFromIdentity(ctx, identity, false);
    if (!user) return [];

    // Verify thread belongs to user
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== user._id) return [];

    const messages = await ctx.db
      .query("agentMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    // Sort by creation time (using Convex's automatic _creationTime)
    return messages.sort((a, b) => a._creationTime - b._creationTime);
  },
});

/**
 * Get all threads for the current user
 */
export const getUserThreads = query({
  args: {
    type: v.optional(agentThreadTypeValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await getUserFromIdentity(ctx, identity, false);
    if (!user) return [];

    let query = ctx.db
      .query("agentThreads")
      .withIndex("by_user", (q) => q.eq("userId", user._id));

    if (args.type) {
      query = ctx.db
        .query("agentThreads")
        .withIndex("by_user_type", (q) =>
          q.eq("userId", user._id).eq("type", args.type!)
        );
    }

    const threads = await query.collect();

    // Sort by most recent first
    const sorted = threads.sort((a, b) => b.updatedAt - a.updatedAt);

    if (args.limit) {
      return sorted.slice(0, args.limit);
    }

    return sorted;
  },
});

/**
 * Create a new agent thread
 */
export const createThread = mutation({
  args: createAgentThreadArgsValidator,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await getUserFromIdentity(ctx, identity);
    const now = Date.now();

    const threadId = await ctx.db.insert("agentThreads", {
      userId: user._id,
      workspaceId: args.workspaceId,
      type: args.type,
      status: "active",
      metadata: args.metadata,
      updatedAt: now,
    });

    return threadId;
  },
});

/**
 * Add a message to a thread
 */
export const addMessage = mutation({
  args: addAgentMessageArgsValidator,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await getUserFromIdentity(ctx, identity);

    // Verify thread belongs to user
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== user._id) {
      throw new Error("Thread not found");
    }

    const now = Date.now();

    // Add the message
    const messageId = await ctx.db.insert("agentMessages", {
      threadId: args.threadId,
      role: args.role,
      content: args.content,
      toolCalls: args.toolCalls,
      toolResults: args.toolResults,
      thoughtType: args.thoughtType,
    });

    // Update thread's updatedAt
    await ctx.db.patch(args.threadId, { updatedAt: now });

    return messageId;
  },
});

/**
 * Update thread status
 */
export const updateThreadStatus = mutation({
  args: updateAgentThreadStatusArgsValidator,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await getUserFromIdentity(ctx, identity);

    // Verify thread belongs to user
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== user._id) {
      throw new Error("Thread not found");
    }

    const updateData: {
      status: typeof args.status;
      updatedAt: number;
      metadata?: unknown;
    } = {
      status: args.status,
      updatedAt: Date.now(),
    };

    if (args.metadata !== undefined) {
      updateData.metadata = args.metadata;
    }

    await ctx.db.patch(args.threadId, updateData);

    return { success: true };
  },
});

/**
 * Link a thread to a workspace (after workspace creation)
 */
export const linkThreadToWorkspace = mutation({
  args: {
    threadId: v.id("agentThreads"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await getUserFromIdentity(ctx, identity);

    // Verify thread belongs to user
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== user._id) {
      throw new Error("Thread not found");
    }

    // Verify workspace belongs to user
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.userId !== user._id) {
      throw new Error("Workspace not found");
    }

    await ctx.db.patch(args.threadId, {
      workspaceId: args.workspaceId,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

