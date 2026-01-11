// convex/outreach.ts
// Public queries and internal mutations for outreach system
// Following existing patterns from prospects.ts

import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { internal, api } from "./_generated/api";
import {
  getProspectActivePlan,
  createOutreachPlan,
  refinePlan as refinePlanCore,
  approvePlan as approvePlanCore,
  getProspectActivityLog,
  logProspectActivity,
  createNotification,
  type OutreachPlanInput,
  type OutreachTaskInput,
} from "./lib/outreachCore";
import {
  extractAvatarUrl,
  extractDisplayName,
  extractScreenName,
} from "./lib/notificationHelpers";
import {
  outreachStrategyValidator,
  outreachTaskTimingValidator,
  outreachTaskTypeValidator,
  outreachPlanStatusValidator,
  outreachTaskStatusValidator,
  prospectActivityTypeValidator,
  prospectTypeValidator,
  prospectStatusValidator,
} from "./validators";

// ============================================================================
// Public Queries
// ============================================================================

/**
 * Get active plan for a prospect (public).
 */
export const getProspectPlan = query({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, { prospectId }) => {
    return await getProspectActivePlan(ctx, prospectId);
  },
});

/**
 * Get activity log for a prospect (public).
 */
export const getActivityLog = query({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, { prospectId }) => {
    return await getProspectActivityLog(ctx, prospectId);
  },
});

/**
 * List notifications for the current user (public).
 * Returns notifications grouped by day (using _creationTime).
 */
export const listNotifications = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();
    if (!user) throw new Error("User not found");

    // Get all notifications for user, ordered by creation time (descending)
    const notifications = await ctx.db
      .query("outreachNotifications")
      .withIndex("by_user_status", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(100);

    return notifications;
  },
});

/**
 * Mark notification as seen (public).
 */
export const markNotificationSeen = mutation({
  args: { notificationId: v.id("outreachNotifications") },
  handler: async (ctx, { notificationId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const notification = await ctx.db.get(notificationId);
    if (!notification) throw new Error("Notification not found");

    await ctx.db.patch(notificationId, {
      status: "seen",
      seenAt: Date.now(),
    });
  },
});

/**
 * Dismiss notification (public).
 */
export const dismissNotification = mutation({
  args: { notificationId: v.id("outreachNotifications") },
  handler: async (ctx, { notificationId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const notification = await ctx.db.get(notificationId);
    if (!notification) throw new Error("Notification not found");

    await ctx.db.patch(notificationId, {
      status: "dismissed",
      dismissedAt: Date.now(),
    });
  },
});

/**
 * Get all tasks for a plan (public).
 */
export const getPlanTasks = query({
  args: { planId: v.id("outreachPlans") },
  handler: async (ctx, { planId }) => {
    return await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan_order", (q) => q.eq("planId", planId))
      .collect();
  },
});

/**
 * Get all interactions (completed comment tasks) for a prospect.
 * Returns data formatted for YourInteractionsTab component.
 */
export const getProspectInteractions = query({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, { prospectId }) => {
    // Find all outreach plans for this prospect
    const plans = await ctx.db
      .query("outreachPlans")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
      .collect();

    if (plans.length === 0) return [];

    // Collect all completed comment tasks across all plans
    const interactions = [];
    for (const plan of plans) {
      const tasks = await ctx.db
        .query("outreachTasks")
        .withIndex("by_plan", (q) => q.eq("planId", plan._id))
        .filter((q) =>
          q.and(
            q.eq(q.field("type"), "comment"),
            q.eq(q.field("status"), "completed")
          )
        )
        .collect();

      for (const task of tasks) {
        // Only include tasks that have a posted tweet result
        if (task.resultData && typeof task.resultData === "object") {
          const resultData = task.resultData as Record<string, unknown>;
          if (resultData.postedTweetId && task.targetTweetId) {
            interactions.push({
              id: task._id,
              threadId: task.targetTweetId, // The original tweet we replied to
              originalPostId: task.targetTweetId,
              repliedAt: task.executedAt || task._creationTime,
              ourTweetId: resultData.postedTweetId as string,
              planId: plan._id,
            });
          }
        }
      }
    }

    // Sort by repliedAt descending (newest first)
    interactions.sort((a, b) => (b.repliedAt || 0) - (a.repliedAt || 0));

    return interactions;
  },
});

// ============================================================================
// Internal Mutations (for agent tools)
// ============================================================================

/**
 * Create a new outreach plan (internal, called by agent).
 */
export const createPlan = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    strategy: outreachStrategyValidator,
    tasks: v.array(
      v.object({
        type: outreachTaskTypeValidator,
        description: v.string(),
        timing: outreachTaskTimingValidator,
        targetTweetId: v.optional(v.string()),
        content: v.optional(v.string()),
      })
    ),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const input: OutreachPlanInput = {
      prospectId: args.prospectId,
      workspaceId: args.workspaceId,
      userId: args.userId,
      strategy: args.strategy,
      tasks: args.tasks,
      threadId: args.threadId,
    };

    return await createOutreachPlan(ctx, input);
  },
});

/**
 * Refine an existing plan (internal, called by agent).
 */
export const updatePlan = internalMutation({
  args: {
    planId: v.id("outreachPlans"),
    strategy: v.optional(outreachStrategyValidator),
    tasks: v.optional(
      v.array(
        v.object({
          type: outreachTaskTypeValidator,
          description: v.string(),
          timing: outreachTaskTimingValidator,
          targetTweetId: v.optional(v.string()),
          content: v.optional(v.string()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    await refinePlanCore(ctx, args.planId, {
      strategy: args.strategy,
      tasks: args.tasks as OutreachTaskInput[] | undefined,
    });
  },
});

/**
 * Approve a plan for execution (internal, called by agent).
 */
export const approvePlanMutation = internalMutation({
  args: { planId: v.id("outreachPlans") },
  handler: async (ctx, { planId }) => {
    await approvePlanCore(ctx, planId);

    // Trigger workflow execution
    await ctx.scheduler.runAfter(
      0,
      internal.workflows.outreach.startOutreachWorkflow,
      { planId }
    );
  },
});

// ============================================================================
// Public Mutations (for UI)
// ============================================================================

/**
 * Approve a plan (public, for UI button).
 */
export const approvePlan = mutation({
  args: { planId: v.id("outreachPlans") },
  handler: async (ctx, { planId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    await approvePlanCore(ctx, planId);

    // Trigger workflow execution
    await ctx.scheduler.runAfter(
      0,
      internal.workflows.outreach.startOutreachWorkflow,
      { planId }
    );
  },
});

/**
 * Pause a plan (public).
 */
export const pausePlan = mutation({
  args: { planId: v.id("outreachPlans") },
  handler: async (ctx, { planId }) => {
    const plan = await ctx.db.get(planId);
    if (!plan) throw new Error("Plan not found");
    if (plan.status !== "executing") {
      throw new Error("Can only pause executing plans");
    }

    await ctx.db.patch(planId, {
      status: "paused",
      updatedAt: Date.now(),
    });
  },
});

/**
 * Abandon a plan (public).
 */
export const abandonPlan = mutation({
  args: { planId: v.id("outreachPlans") },
  handler: async (ctx, { planId }) => {
    const plan = await ctx.db.get(planId);
    if (!plan) throw new Error("Plan not found");

    await ctx.db.patch(planId, {
      status: "abandoned",
      updatedAt: Date.now(),
    });
  },
});

// ============================================================================
// Internal Functions for Workflow
// ============================================================================

/**
 * Get plan and tasks (internal, for workflow).
 */
export const getPlanInternal = internalQuery({
  args: { planId: v.id("outreachPlans") },
  handler: async (ctx, { planId }) => {
    const plan = await ctx.db.get(planId);
    if (!plan) return null;

    const tasks = await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan_order", (q) => q.eq("planId", planId))
      .collect();

    return { plan, tasks };
  },
});

/**
 * Get pending task for a prospect (internal, for approveTask tool).
 * Returns the first task with status "pending", "executing", or "waiting_response"
 * from the prospect's active plan.
 *
 * NOTE: "executing" is included because the workflow sets task status to
 * "executing" before awaitEvent for human approval. This is the state when
 * the task is waiting for user approval.
 *
 * This enables the approveTask tool to auto-discover the task to approve
 * without relying on LLM-provided taskId (prevents hallucination).
 */
export const getPendingTaskForProspect = internalQuery({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, { prospectId }) => {
    // Find active plan (approved or executing)
    const plan = await ctx.db
      .query("outreachPlans")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "approved"),
          q.eq(q.field("status"), "executing")
        )
      )
      .first();

    if (!plan) return null;

    // Find pending, executing (awaiting approval), or waiting_response task
    return await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan", (q) => q.eq("planId", plan._id))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "executing"), // Awaiting human approval
          q.eq(q.field("status"), "waiting_response")
        )
      )
      .first();
  },
});

/**
 * Get active plan for a prospect (internal, for refinePlan tool).
 * Returns the plan with status "draft", "approved", or "executing".
 *
 * This enables the refinePlan tool to auto-discover the plan to update
 * without relying on LLM-provided planId (prevents hallucination).
 */
export const getActivePlanForProspect = internalQuery({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, { prospectId }) => {
    return await ctx.db
      .query("outreachPlans")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "draft"),
          q.eq(q.field("status"), "approved"),
          q.eq(q.field("status"), "executing")
        )
      )
      .first();
  },
});

/**
 * Get active plan with tasks for a prospect (internal, for auto plan generation).
 * Returns both plan and tasks. Used to check if plan exists before auto-generating.
 */
export const getProspectActivePlanInternal = internalQuery({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, { prospectId }) => {
    const plan = await ctx.db
      .query("outreachPlans")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "completed"),
          q.neq(q.field("status"), "abandoned")
        )
      )
      .first();

    if (!plan) return null;

    const tasks = await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan_order", (q) => q.eq("planId", plan._id))
      .collect();

    return { plan, tasks };
  },
});

/**
 * Update plan status (internal, for workflow).
 */
export const updatePlanStatus = internalMutation({
  args: {
    planId: v.id("outreachPlans"),
    status: outreachPlanStatusValidator,
  },
  handler: async (ctx, { planId, status }) => {
    await ctx.db.patch(planId, {
      status,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update task status (internal, for workflow).
 */
export const updateTaskStatus = internalMutation({
  args: {
    taskId: v.id("outreachTasks"),
    status: outreachTaskStatusValidator,
  },
  handler: async (ctx, { taskId, status }) => {
    await ctx.db.patch(taskId, {
      status,
      executedAt: status === "completed" ? Date.now() : undefined,
    });
  },
});

/**
 * Log activity (internal, for workflow).
 */
export const logActivity = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
    type: prospectActivityTypeValidator,
    title: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await logProspectActivity(ctx, args);
  },
});

/**
 * Create human notification (internal, for workflow).
 */
export const createHumanNotification = internalMutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    prospectId: v.id("prospects"),
    planId: v.id("outreachPlans"),
    taskId: v.id("outreachTasks"),
    message: v.string(),
    // Prospect display data (denormalized for efficient display)
    prospectAvatarUrl: v.optional(v.string()),
    prospectDisplayName: v.optional(v.string()),
    prospectType: v.optional(prospectTypeValidator),
    prospectScreenName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Dynamic title with name at the end for natural reading
    const name = args.prospectDisplayName || "prospect";
    const title = `needs input for ${name}`;

    await createNotification(ctx, {
      userId: args.userId,
      workspaceId: args.workspaceId,
      type: "ask_human",
      title,
      message: args.message,
      prospectId: args.prospectId,
      planId: args.planId,
      taskId: args.taskId,
      prospectAvatarUrl: args.prospectAvatarUrl,
      prospectDisplayName: args.prospectDisplayName,
      prospectType: args.prospectType,
      prospectScreenName: args.prospectScreenName,
    });
  },
});

// Note: executeCommentTask and parseTwitterError are now in outreachActions.ts
// because they require Node.js runtime (twitter-api-v2 dependency)

/**
 * Get task (internal, for executeCommentTask).
 */
export const getTaskInternal = internalQuery({
  args: { taskId: v.id("outreachTasks") },
  handler: async (ctx, { taskId }) => {
    return await ctx.db.get(taskId);
  },
});

/**
 * Mark task as waiting (no-op mutation used with runAfter for delays).
 */
export const markTaskWaiting = internalMutation({
  args: { taskId: v.id("outreachTasks") },
  handler: async (ctx, { taskId }) => {
    // This is a no-op mutation used with runAfter for scheduling delays
    await ctx.db.patch(taskId, {
      status: "waiting_response",
    });
  },
});

/**
 * Update prospect status (internal, for workflow).
 * Used when outreach plan starts to set prospect status to "contacted".
 */
export const updateProspectStatusInternal = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    status: prospectStatusValidator,
  },
  handler: async (ctx, { prospectId, status }) => {
    const prospect = await ctx.db.get(prospectId);
    if (!prospect) return;

    const now = Date.now();

    // Update stageTimestamps with the new status timestamp
    const newStageTimestamps = {
      ...(prospect.stageTimestamps || {}),
      [status]: now,
    };

    await ctx.db.patch(prospectId, {
      status,
      pipelineStage: status,
      stageTimestamps: newStageTimestamps,
      updatedAt: now,
    });
  },
});

/**
 * Update task result data (internal, for executeCommentTask).
 * Stores posted tweet ID on success, or error details on failure.
 */
export const updateTaskResult = internalMutation({
  args: {
    taskId: v.id("outreachTasks"),
    status: outreachTaskStatusValidator,
    resultData: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, {
      status: args.status,
      resultData: args.resultData,
      errorMessage: args.errorMessage,
      executedAt:
        args.status === "completed" ||
        args.status === "waiting_response" ||
        args.status === "failed"
          ? Date.now()
          : undefined,
    });
  },
});

/**
 * Handle prospect response (internal, called by webhook).
 * Creates notification and updates task status.
 */
export const onProspectResponse = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    planId: v.optional(v.id("outreachPlans")),
    responseTweetId: v.string(),
    responseText: v.optional(v.string()),
    responseData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get plan if provided
    let plan = null;
    if (args.planId) {
      plan = await ctx.db.get(args.planId);
    }

    // If no plan provided, try to find active plan for prospect
    if (!plan) {
      plan = await ctx.db
        .query("outreachPlans")
        .withIndex("by_prospect", (q) => q.eq("prospectId", args.prospectId))
        .filter((q) =>
          q.and(
            q.neq(q.field("status"), "completed"),
            q.neq(q.field("status"), "abandoned")
          )
        )
        .first();
    }

    if (!plan) {
      console.warn(
        `[Outreach] Received response for prospect ${args.prospectId} but no active plan found`
      );
      return { success: false, error: "No active plan" };
    }

    // Find the task that was waiting for response
    const waitingTask = await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan", (q) => q.eq("planId", plan._id))
      .filter((q) => q.eq(q.field("status"), "waiting_response"))
      .first();

    if (waitingTask) {
      // Update task status to completed
      await ctx.db.patch(waitingTask._id, {
        status: "completed",
        resultData: {
          ...(waitingTask.resultData || {}),
          responseReceived: true,
          responseTweetId: args.responseTweetId,
          responseText: args.responseText,
          responseReceivedAt: now,
        },
      });
    }

    // Fetch prospect for display data
    const prospect = await ctx.db.get(args.prospectId);
    const prospectAvatarUrl = extractAvatarUrl(prospect?.data);
    const prospectDisplayName =
      prospect?.displayName || extractDisplayName(prospect?.data);
    const prospectType = prospect?.prospectType;
    const prospectScreenName = extractScreenName(prospect);

    // Update prospect status to "in_progress" when they respond
    if (prospect) {
      await ctx.db.patch(args.prospectId, {
        status: "in_progress",
        pipelineStage: "in_progress",
        stageTimestamps: {
          ...(prospect.stageTimestamps || {}),
          in_progress: now,
        },
        updatedAt: now,
      });
    }

    // Dynamic title using prospect display name
    const title = `${prospectDisplayName || "Prospect"} replied`;

    // Create notification
    await ctx.db.insert("outreachNotifications", {
      userId: plan.userId,
      workspaceId: plan.workspaceId,
      type: "prospect_replied",
      title,
      message: args.responseText
        ? `"${args.responseText.substring(0, 100)}${args.responseText.length > 100 ? "..." : ""}"`
        : "The prospect replied to your outreach.",
      status: "pending",
      prospectId: args.prospectId,
      planId: plan._id,
      taskId: waitingTask?._id,
      // Denormalized prospect data
      prospectAvatarUrl,
      prospectDisplayName,
      prospectType,
      prospectScreenName,
      replyCount: 1,
    });

    // Log activity
    await ctx.db.insert("prospectActivityLog", {
      prospectId: args.prospectId,
      workspaceId: plan.workspaceId,
      type: "responded",
      title: "Response received",
      description: args.responseText,
      metadata: {
        responseTweetId: args.responseTweetId,
        planId: plan._id,
      },
    });

    console.info(
      `[Outreach] Recorded response from prospect ${args.prospectId}, created notification`
    );

    return { success: true };
  },
});

// ============================================================================
// Workflow Management (for human-in-the-loop approval)
// ============================================================================

/**
 * Update plan with workflow ID (internal).
 * Called when workflow starts to store the ID for sendEvent later.
 * Note: Don't set status here - let the workflow handler do it after checking.
 */
export const updatePlanWorkflowId = internalMutation({
  args: {
    planId: v.id("outreachPlans"),
    workflowId: v.string(),
  },
  handler: async (ctx, { planId, workflowId }) => {
    await ctx.db.patch(planId, {
      workflowId,
      // Don't change status here - the workflow handler checks for "approved"
      // and sets to "executing" after the check passes
      updatedAt: Date.now(),
    });
  },
});

/**
 * Create notification for task approval (internal).
 * Called before executing comment tasks to get human approval.
 */
export const createTaskApprovalNotification = internalMutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    prospectId: v.id("prospects"),
    planId: v.id("outreachPlans"),
    taskId: v.id("outreachTasks"),
    tweetContent: v.string(),
    targetTweetId: v.string(),
    threadId: v.optional(v.string()),
    // Prospect display data
    prospectAvatarUrl: v.optional(v.string()),
    prospectDisplayName: v.optional(v.string()),
    prospectType: v.optional(prospectTypeValidator),
    prospectScreenName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Guarantee threadId: use provided or fallback to plan's threadId
    let threadId = args.threadId;
    if (!threadId) {
      const plan = await ctx.db.get(args.planId);
      if (plan?.threadId) {
        threadId = plan.threadId;
        console.info(
          `[Outreach] Using plan's threadId for notification: ${threadId}`
        );
      }
    }

    // Dynamic title with name at the end for natural reading
    const name = args.prospectDisplayName || "prospect";
    const title = `Approve the reply to ${name}`;

    await ctx.db.insert("outreachNotifications", {
      userId: args.userId,
      workspaceId: args.workspaceId,
      type: "ask_human",
      title,
      message: `"${args.tweetContent.substring(0, 100)}${args.tweetContent.length > 100 ? "..." : ""}"`,
      status: "pending",
      prospectId: args.prospectId,
      planId: args.planId,
      taskId: args.taskId,
      threadId,
      // Denormalized prospect data
      prospectAvatarUrl: args.prospectAvatarUrl,
      prospectDisplayName: args.prospectDisplayName,
      prospectType: args.prospectType,
      prospectScreenName: args.prospectScreenName,
    });

    console.info(
      `[Outreach] Created task approval notification for task ${args.taskId}`
    );
  },
});

/**
 * Approve a specific task (public, for UI).
 * Sends event to resume workflow after user approves.
 */
export const approveTask = mutation({
  args: { taskId: v.id("outreachTasks") },
  handler: async (ctx, { taskId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");

    const plan = await ctx.db.get(task.planId);
    if (!plan) throw new Error("Plan not found");
    if (!plan.workflowId) throw new Error("Workflow not running");

    // Send event to resume workflow
    await ctx.scheduler.runAfter(
      0,
      internal.workflows.outreach.sendTaskApproval,
      {
        workflowId: plan.workflowId,
        taskId,
      }
    );

    console.info(
      `[Outreach] Task ${taskId} approved by user, resuming workflow`
    );
  },
});

/**
 * Approve a specific task (internal, for agent tools).
 * Same as public approveTask but without auth check since agent tools
 * run in scheduled context where ctx.auth is null.
 * Per docs/convex/tools.md line 81: "in scheduled functions, workflows, etc, the auth user will be null"
 */
export const approveTaskInternal = internalMutation({
  args: { taskId: v.id("outreachTasks") },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");

    const plan = await ctx.db.get(task.planId);
    if (!plan) throw new Error("Plan not found");
    if (!plan.workflowId) throw new Error("Workflow not running");

    // Send event to resume workflow
    await ctx.scheduler.runAfter(
      0,
      internal.workflows.outreach.sendTaskApproval,
      {
        workflowId: plan.workflowId,
        taskId,
      }
    );

    console.info(
      `[Outreach] Task ${taskId} approved (internal), resuming workflow`
    );
  },
});
