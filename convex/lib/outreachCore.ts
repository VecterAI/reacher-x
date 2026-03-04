// convex/lib/outreachCore.ts
// Core business logic for outreach operations
// Layer 3: Core Logic (following Three-Layer Architecture from AGENT_CONTEXT.txt)

import { Infer } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import {
  outreachTaskTypeValidator,
  outreachTaskTimingValidator,
  outreachStrategyValidator,
} from "../validators";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";

// ============================================================================
// Constants
// ============================================================================

/** Threshold for automatic plan generation (>= 90 score) */
export const AUTO_PLAN_GENERATION_THRESHOLD = 90;

// ============================================================================
// Types
// ============================================================================

export interface OutreachPlanInput {
  prospectId: Id<"prospects">;
  workspaceId: Id<"workspaces">;
  userId: Id<"users">;
  strategy: Infer<typeof outreachStrategyValidator>;
  tasks: OutreachTaskInput[];
  threadId?: string;
}

export interface OutreachTaskInput {
  type: Infer<typeof outreachTaskTypeValidator>;
  description: string;
  timing: Infer<typeof outreachTaskTimingValidator>;
  targetTweetId?: string;
  content?: string;
  mediaUrls?: string[];
  mediaDescriptions?: string[];
  approvalContext?: {
    panelMode?: "approval" | "posted";
    platform?: "twitter" | "linkedin";
    sourcePostId?: string;
    sourcePostData?: unknown;
    sourceContext?: string;
  };
}

export interface ProspectContext {
  prospect: Doc<"prospects">;
  evidencePosts: Array<{ text: string; score: number }>;
  existingPlan: Doc<"outreachPlans"> | null;
  tasks: Doc<"outreachTasks">[];
}

/** Tweet data for engagement analysis (used by analyzeBestEngagement tool) */
export interface TweetDataForEngagement {
  tweetId: string;
  text: string;
  createdAt: string;
  metrics: {
    replyCount: number;
    likeCount: number;
    retweetCount: number;
  };
  isReply: boolean;
  inReplyToScreenName?: string;
}

/** Result from analyzeBestEngagement tool */
export interface AnalyzeBestEngagementResult {
  success: boolean;
  prospectName: string;
  prospectBio?: string;
  tweets: TweetDataForEngagement[];
  error?: string;
}

/** Result from askHuman tool - indicates workflow should pause */
export interface AskHumanResult {
  pending: true;
  message: string;
  question: string;
  context?: string;
  urgency: "low" | "medium" | "high";
  options?: string[];
}

// ============================================================================
// Task Validation
// ============================================================================

/**
 * Validates task inputs before creating/updating tasks.
 * Comment tasks REQUIRE content and targetTweetId.
 */
function validateTaskInputs(tasks: OutreachTaskInput[]): void {
  for (const task of tasks) {
    if (task.type === "comment") {
      if (!task.content) {
        throw new Error(
          `Comment task "${task.description}" requires content (the text to post)`
        );
      }
      if (!task.targetTweetId) {
        throw new Error(
          `Comment task "${task.description}" requires targetTweetId (the tweet to reply to)`
        );
      }
    }

    if (
      task.mediaDescriptions &&
      task.mediaDescriptions.length > (task.mediaUrls?.length ?? 0)
    ) {
      throw new Error(
        `Task "${task.description}" has more mediaDescriptions than mediaUrls`
      );
    }
  }
}

// ============================================================================
// Plan Operations
// ============================================================================

/**
 * Create a new outreach plan for a prospect.
 * Enforces single-plan-per-prospect rule.
 */
export async function createOutreachPlan(
  ctx: MutationCtx,
  input: OutreachPlanInput
): Promise<Id<"outreachPlans">> {
  const now = getCurrentUTCTimestamp();

  // Check for existing active plan
  const existingPlan = await ctx.db
    .query("outreachPlans")
    .withIndex("by_prospect", (q) => q.eq("prospectId", input.prospectId))
    .filter((q) =>
      q.and(
        q.neq(q.field("status"), "completed"),
        q.neq(q.field("status"), "abandoned")
      )
    )
    .first();

  if (existingPlan) {
    throw new Error(
      `Active plan already exists for prospect. Use refinePlan instead.`
    );
  }

  // Create the plan
  const planId = await ctx.db.insert("outreachPlans", {
    prospectId: input.prospectId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    status: "draft",
    strategy: input.strategy,
    threadId: input.threadId,
    version: 1,
    updatedAt: now,
  });

  // Validate all tasks before creating (especially comment tasks need content + targetTweetId)
  validateTaskInputs(input.tasks);

  // Create tasks
  const createdTasks: Array<{
    _id: Id<"outreachTasks">;
    order: number;
    type: OutreachTaskInput["type"];
    description: string;
    status: "pending";
    content?: string;
  }> = [];

  for (let i = 0; i < input.tasks.length; i++) {
    const task = input.tasks[i];
    const taskId = await ctx.db.insert("outreachTasks", {
      planId,
      order: i + 1,
      type: task.type,
      description: task.description,
      status: "pending",
      timing: task.timing,
      targetTweetId: task.targetTweetId,
      content: task.content,
      mediaUrls: task.mediaUrls,
      mediaDescriptions: task.mediaDescriptions,
      approvalContext: task.approvalContext,
    });

    createdTasks.push({
      _id: taskId,
      order: i + 1,
      type: task.type,
      description: task.description,
      status: "pending",
      content: task.content,
    });
  }

  // Log activity
  await ctx.db.insert("prospectActivityLog", {
    prospectId: input.prospectId,
    workspaceId: input.workspaceId,
    type: "plan_created",
    title: "Outreach plan created",
    description: `${input.tasks.length} task${input.tasks.length !== 1 ? "s" : ""} planned — ${input.strategy.tone || "professional"} tone`,
    metadata: {
      planId,
      planSnapshot: {
        status: "draft",
        tasks: createdTasks,
      },
    },
  });

  return planId;
}

/**
 * Update an existing plan with refinements.
 */
export async function refinePlan(
  ctx: MutationCtx,
  planId: Id<"outreachPlans">,
  updates: {
    strategy?: OutreachPlanInput["strategy"];
    tasks?: OutreachTaskInput[];
  }
): Promise<void> {
  const plan = await ctx.db.get(planId);
  if (!plan) throw new Error("Plan not found");
  if (plan.status !== "draft") {
    throw new Error("Can only refine draft plans");
  }

  const now = getCurrentUTCTimestamp();

  // Update strategy if provided
  if (updates.strategy) {
    await ctx.db.patch(planId, {
      strategy: updates.strategy,
      version: plan.version + 1,
      updatedAt: now,
    });
  }

  // Replace tasks if provided
  if (updates.tasks) {
    // Validate all tasks (especially comment tasks need content + targetTweetId)
    validateTaskInputs(updates.tasks);

    // Delete existing tasks
    const existingTasks = await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan", (q) => q.eq("planId", planId))
      .collect();

    for (const task of existingTasks) {
      await ctx.db.delete(task._id);
    }

    // Create new tasks
    for (let i = 0; i < updates.tasks.length; i++) {
      const task = updates.tasks[i];
      await ctx.db.insert("outreachTasks", {
        planId,
        order: i + 1,
        type: task.type,
        description: task.description,
        status: "pending",
        timing: task.timing,
        targetTweetId: task.targetTweetId,
        content: task.content,
        mediaUrls: task.mediaUrls,
        mediaDescriptions: task.mediaDescriptions,
        approvalContext: task.approvalContext,
      });
    }
  }
}

/**
 * Approve a plan for execution.
 */
export async function approvePlan(
  ctx: MutationCtx,
  planId: Id<"outreachPlans">
): Promise<void> {
  const plan = await ctx.db.get(planId);
  if (!plan) throw new Error("Plan not found");
  if (plan.status !== "draft") {
    throw new Error("Can only approve draft plans");
  }

  await ctx.db.patch(planId, {
    status: "approved",
    updatedAt: getCurrentUTCTimestamp(),
  });
}

/**
 * Get a prospect's active plan.
 */
export async function getProspectActivePlan(
  ctx: QueryCtx,
  prospectId: Id<"prospects">
): Promise<{
  plan: Doc<"outreachPlans">;
  tasks: Doc<"outreachTasks">[];
} | null> {
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
}

// ============================================================================
// Activity Log Operations
// ============================================================================

/**
 * Get prospect activity log.
 */
export async function getProspectActivityLog(
  ctx: QueryCtx,
  prospectId: Id<"prospects">,
  options?: { limit?: number; type?: Doc<"prospectActivityLog">["type"] }
): Promise<Doc<"prospectActivityLog">[]> {
  if (options?.type) {
    const typedQuery = ctx.db
      .query("prospectActivityLog")
      .withIndex("by_prospect_type", (q) =>
        q.eq("prospectId", prospectId).eq("type", options.type!)
      )
      .order("desc");

    if (options.limit !== undefined) {
      return await typedQuery.take(options.limit);
    }
    return await typedQuery.collect();
  }

  const activityQuery = ctx.db
    .query("prospectActivityLog")
    .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
    .order("desc");

  if (options?.limit !== undefined) {
    return await activityQuery.take(options.limit);
  }

  return await activityQuery.collect();
}

/**
 * Log an activity for a prospect.
 */
export async function logProspectActivity(
  ctx: MutationCtx,
  input: {
    prospectId: Id<"prospects">;
    workspaceId: Id<"workspaces">;
    type: Doc<"prospectActivityLog">["type"];
    title: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<Id<"prospectActivityLog">> {
  return await ctx.db.insert("prospectActivityLog", {
    ...input,
  });
}

// ============================================================================
// Notification Operations
// ============================================================================

/**
 * Create a notification.
 */
export async function createNotification(
  ctx: MutationCtx,
  input: {
    userId: Id<"users">;
    workspaceId: Id<"workspaces">;
    type: Doc<"outreachNotifications">["type"];
    title: string;
    message: string;
    prospectId?: Id<"prospects">;
    planId?: Id<"outreachPlans">;
    taskId?: Id<"outreachTasks">;
    toolCallId?: string;
    threadId?: string;
    // Denormalized prospect data for efficient display
    prospectAvatarUrl?: string;
    prospectDisplayName?: string;
    prospectType?: Doc<"prospects">["prospectType"];
    prospectScreenName?: string;
    replyCount?: number;
  }
): Promise<Id<"outreachNotifications">> {
  return await ctx.db.insert("outreachNotifications", {
    ...input,
    status: "pending",
  });
}
