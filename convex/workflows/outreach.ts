// convex/workflows/outreach.ts
// Outreach plan execution workflow
// Triggered when plan is approved
// Uses durable workflow for reliability

import { v } from "convex/values";
import { workflow as workflowManager } from "../lib/workflow";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { getProspectDisplayFields } from "../lib/notificationHelpers";

// ============================================================================
// Constants
// ============================================================================

/** Delay between tasks (in ms) */
const DEFAULT_TASK_DELAY_MS = 60 * 60 * 1000; // 1 hour

// ============================================================================
// Outreach Workflow
// ============================================================================

/**
 * Executes an approved outreach plan.
 *
 * Flow:
 * 1. Get plan and tasks
 * 2. Update plan status to executing
 * 3. Execute each task in order
 * 4. Handle wait tasks (use runAfter for delays)
 * 5. Handle ask_human tasks (use awaitEvent)
 * 6. Mark plan as completed when all tasks done
 */
export const outreachPlanWorkflow = workflowManager.define({
  args: {
    planId: v.id("outreachPlans"),
  },
  returns: v.object({
    success: v.boolean(),
    status: v.string(),
    error: v.optional(v.string()),
  }),
  handler: async (
    step,
    args
  ): Promise<{
    success: boolean;
    status: string;
    error?: string;
  }> => {
    // Step 1: Get plan and tasks
    const planData = await step.runQuery(internal.outreach.getPlanInternal, {
      planId: args.planId,
    });

    if (!planData) {
      return {
        success: false,
        status: "failed",
        error: "Plan not found",
      };
    }

    const { plan, tasks } = planData;

    // Validate plan is approved
    if (plan.status !== "approved" && plan.status !== "paused") {
      return {
        success: false,
        status: "skipped",
        error: `Plan is not ready for execution (status: ${plan.status})`,
      };
    }

    // Step 2: Update plan status to executing
    await step.runMutation(internal.outreach.updatePlanStatus, {
      planId: args.planId,
      status: "executing",
    });

    // Log activity
    await step.runMutation(internal.outreach.logActivity, {
      prospectId: plan.prospectId,
      workspaceId: plan.workspaceId,
      type: "contacted",
      title: "Started outreach",
      description: `Executing ${tasks.length} task${tasks.length !== 1 ? "s" : ""} — ${plan.strategy.tone || "professional"} tone`,
    });

    // Update prospect status to "contacted" so they appear in the Contacted tab
    await step.runMutation(internal.outreach.updateProspectStatusInternal, {
      prospectId: plan.prospectId,
      status: "contacted",
    });

    // Fetch prospect for display fields (used in notifications)
    const prospect = await step.runQuery(
      internal.prospects.getProspectInternal,
      { prospectId: plan.prospectId }
    );
    const prospectDisplayFields = getProspectDisplayFields(prospect);

    // Step 3: Execute tasks in order
    let completedTasks = 0;

    for (const task of tasks) {
      // Skip already completed tasks (for resume from pause)
      if (task.status === "completed" || task.status === "skipped") {
        completedTasks++;
        continue;
      }

      // Update task status
      await step.runMutation(internal.outreach.updateTaskStatus, {
        taskId: task._id,
        status: "executing",
      });

      try {
        if (task.type === "comment") {
          // Validate task has required content
          if (!task.content || !task.targetTweetId) {
            console.error(
              `[Outreach] Task ${task._id} missing content or targetTweetId`
            );
            throw new Error("Task missing required content or target tweet ID");
          }

          // Create notification for user to approve the tweet before posting
          await step.runMutation(
            internal.outreach.createTaskApprovalNotification,
            {
              userId: plan.userId,
              workspaceId: plan.workspaceId,
              prospectId: plan.prospectId,
              planId: args.planId,
              taskId: task._id,
              tweetContent: task.content,
              targetTweetId: task.targetTweetId,
              threadId: plan.threadId,
              ...prospectDisplayFields,
            }
          );

          // Wait for human approval before posting
          await step.awaitEvent({
            name: `task_approved:${task._id}`,
          });

          // Execute comment task after approval - with delay if specified
          const delayMs = getTaskDelay(task.timing);
          await step.runAction(
            internal.outreachActions.executeCommentTask,
            {
              taskId: task._id,
              planId: args.planId,
            },
            { runAfter: delayMs > 1000 ? delayMs : undefined }
          );
        } else if (task.type === "wait") {
          // Wait tasks - use a no-op mutation with runAfter
          const waitMs = parseWaitDuration(task.timing.value);
          await step.runMutation(
            internal.outreach.markTaskWaiting,
            { taskId: task._id },
            { runAfter: waitMs }
          );
        } else if (task.type === "ask_human") {
          // Create notification for user
          await step.runMutation(internal.outreach.createHumanNotification, {
            userId: plan.userId,
            workspaceId: plan.workspaceId,
            prospectId: plan.prospectId,
            planId: args.planId,
            taskId: task._id,
            message: task.description,
            ...prospectDisplayFields,
          });

          // Wait for human response using awaitEvent
          await step.awaitEvent({
            name: `human_response:${task._id}`,
          });
        }

        // Mark task as completed
        await step.runMutation(internal.outreach.updateTaskStatus, {
          taskId: task._id,
          status: "completed",
        });

        completedTasks++;
      } catch (error) {
        // Mark task as failed
        await step.runMutation(internal.outreach.updateTaskStatus, {
          taskId: task._id,
          status: "failed",
        });

        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        console.error(`[Outreach] Task ${task._id} failed:`, errorMessage);

        // Critical task failed - pause workflow
        if (task.type === "comment") {
          await step.runMutation(internal.outreach.updatePlanStatus, {
            planId: args.planId,
            status: "paused",
          });

          return {
            success: false,
            status: "paused",
            error: `Task failed: ${errorMessage}`,
          };
        }
      }
    }

    // Step 4: All tasks completed
    await step.runMutation(internal.outreach.updatePlanStatus, {
      planId: args.planId,
      status: "completed",
    });

    // Log completion
    await step.runMutation(internal.outreach.logActivity, {
      prospectId: plan.prospectId,
      workspaceId: plan.workspaceId,
      type: "converted",
      title: "Outreach plan completed",
      description: `Completed ${completedTasks} tasks`,
    });

    console.info(
      `[Outreach] Plan ${args.planId} completed (${completedTasks} tasks)`
    );

    return {
      success: true,
      status: "completed",
    };
  },
});

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse wait duration from timing value.
 */
function parseWaitDuration(value?: string): number {
  if (!value) return DEFAULT_TASK_DELAY_MS;

  const match = value.match(/^(\d+)(h|m|d)?$/i);
  if (!match) return DEFAULT_TASK_DELAY_MS;

  const num = parseInt(match[1], 10);
  const unit = match[2]?.toLowerCase() || "h";

  switch (unit) {
    case "m":
      return num * 60 * 1000;
    case "h":
      return num * 60 * 60 * 1000;
    case "d":
      return num * 24 * 60 * 60 * 1000;
    default:
      return num * 60 * 60 * 1000; // Default to hours
  }
}

/**
 * Get delay between tasks based on timing config.
 */
function getTaskDelay(timing: { type: string; value?: string }): number {
  if (timing.type === "immediate") return 0;
  if (timing.type === "delay" && timing.value) {
    return parseWaitDuration(timing.value);
  }
  if (timing.type === "best_time") {
    // TODO: Implement best time calculation
    return DEFAULT_TASK_DELAY_MS;
  }
  return 0;
}

// ============================================================================
// Workflow Starter
// ============================================================================

export const startOutreachWorkflow = internalAction({
  args: {
    planId: v.id("outreachPlans"),
  },
  handler: async (ctx, args): Promise<{ workflowId: string }> => {
    const wfId = await workflowManager.start(
      ctx,
      internal.workflows.outreach.outreachPlanWorkflow,
      {
        planId: args.planId,
      }
    );

    // Store workflowId on plan for sendEvent later
    await ctx.runMutation(internal.outreach.updatePlanWorkflowId, {
      planId: args.planId,
      workflowId: wfId.toString(),
    });

    console.info(`[Outreach] Started workflow ${wfId} for plan ${args.planId}`);

    return { workflowId: wfId.toString() };
  },
});

/**
 * Resume a paused workflow after human input.
 * Sends event to the workflow awaiting human response.
 */
export const sendHumanResponse = internalAction({
  args: {
    workflowId: v.string(),
    taskId: v.id("outreachTasks"),
  },
  handler: async (ctx, args): Promise<void> => {
    await workflowManager.sendEvent(ctx, {
      name: `human_response:${args.taskId}`,
      workflowId: args.workflowId as unknown as ReturnType<
        typeof workflowManager.start
      > extends Promise<infer T>
        ? T
        : never,
    });

    console.info(
      `[Outreach] Sent human response event for task ${args.taskId}`
    );
  },
});

/**
 * Resume workflow after user approves a task.
 * Called when user clicks "Approve" on a task notification.
 */
export const sendTaskApproval = internalAction({
  args: {
    workflowId: v.string(),
    taskId: v.id("outreachTasks"),
  },
  handler: async (ctx, args): Promise<void> => {
    await workflowManager.sendEvent(ctx, {
      name: `task_approved:${args.taskId}`,
      workflowId: args.workflowId as unknown as ReturnType<
        typeof workflowManager.start
      > extends Promise<infer T>
        ? T
        : never,
    });

    console.info(`[Outreach] Task ${args.taskId} approved, workflow resuming`);
  },
});
