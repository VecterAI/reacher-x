// convex/workflows/outreach.ts
// Outreach plan execution workflow
// Triggered when plan is approved
// Uses durable workflow for reliability

import { v } from "convex/values";
import { workflow as workflowManager } from "../lib/workflow";
import { internal } from "../_generated/api";
import { internalAction } from "../lib/functionBuilders";
import { Doc } from "../_generated/dataModel";
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
    const workflowId = String(step.workflowId);
    const traceBase = `[Outreach][planId=${args.planId} workflowId=${workflowId}]`;

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
    const contactedActivityDescription = `Executing ${tasks.length} task${tasks.length !== 1 ? "s" : ""} — ${plan.strategy.tone || "professional"} tone`;
    let shouldMarkProspectContacted = true;

    // Validate plan is approved
    if (
      plan.status !== "approved" &&
      plan.status !== "paused" &&
      plan.status !== "blocked_auth"
    ) {
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
      if (
        task.status === "completed" ||
        task.status === "skipped" ||
        task.status === "waiting_response"
      ) {
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
          const approvalSignal = await step.runMutation(
            internal.outreach.createTaskApprovalNotification,
            {
              userId: plan.userId,
              workspaceId: plan.workspaceId,
              prospectId: plan.prospectId,
              planId: args.planId,
              taskId: task._id,
              workflowId,
              tweetContent: task.content,
              targetTweetId: task.targetTweetId,
              threadId: plan.threadId,
              ...prospectDisplayFields,
            }
          );

          // Wait for human approval before posting
          if (!approvalSignal?.approvalEventId) {
            throw new Error("Approval event ID missing for comment task");
          }
          await step.awaitEvent({ id: approvalSignal.approvalEventId });

          // Execute comment task after approval - with delay if specified
          const delayMs = getTaskDelay(task.timing);
          const executionResult = await step.runAction(
            internal.outreachActions.executeCommentTask,
            {
              taskId: task._id,
              planId: args.planId,
              workflowId,
            },
            {
              runAfter: delayMs > 1000 ? delayMs : undefined,
              retry: {
                maxAttempts: 3,
                initialBackoffMs: 2_000,
                base: 2,
              },
            }
          );

          if (!executionResult.success) {
            const isAuthBlocker =
              executionResult.errorClass === "reauth_required" ||
              executionResult.errorClass === "scope_missing";
            const nextPlanStatus = isAuthBlocker ? "blocked_auth" : "paused";

            await step.runMutation(internal.outreach.updatePlanStatus, {
              planId: args.planId,
              status: nextPlanStatus,
            });

            return {
              success: false,
              status: nextPlanStatus,
              error:
                executionResult.errorMessage || "Comment task execution failed",
            };
          }

          if (shouldMarkProspectContacted) {
            try {
              await step.runMutation(
                internal.outreach.markProspectContactedFromSuccessfulComment,
                {
                  prospectId: plan.prospectId,
                  workspaceId: plan.workspaceId,
                  description: contactedActivityDescription,
                }
              );
              shouldMarkProspectContacted = false;
            } catch (statusSyncError) {
              console.error(
                `${traceBase} failed-to-sync-contacted-status task=${task._id}`,
                statusSyncError
              );
            }
          }
        } else if (task.type === "wait") {
          // Wait tasks - complete after configured delay.
          const waitMs = parseWaitDuration(task.timing.value);
          await step.runMutation(
            internal.outreach.updateTaskStatus,
            { taskId: task._id, status: "completed" },
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
          await step.runMutation(internal.outreach.updateTaskStatus, {
            taskId: task._id,
            status: "completed",
          });
        } else {
          await step.runMutation(internal.outreach.updateTaskStatus, {
            taskId: task._id,
            status: "completed",
          });
        }

        completedTasks++;
      } catch (error) {
        // Mark task as failed
        await step.runMutation(internal.outreach.updateTaskStatus, {
          taskId: task._id,
          status: "failed",
        });

        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        console.error(
          `${traceBase} task=${task._id} status=failed message=${errorMessage}`
        );

        // Critical task failed - pause workflow
        if (task.type === "comment") {
          const nextPlanStatus =
            errorMessage.includes("reauth_required") ||
            errorMessage.includes("scope_missing")
              ? "blocked_auth"
              : "paused";
          await step.runMutation(internal.outreach.updatePlanStatus, {
            planId: args.planId,
            status: nextPlanStatus,
          });
          await step.runAction(
            internal.chat.bridgeOutreachTaskStatusToThread,
            {
              taskId: task._id,
            },
            { retry: false }
          );

          return {
            success: false,
            status: nextPlanStatus,
            error: `Task failed: ${errorMessage}`,
          };
        }
      }
    }

    // Step 4: Determine terminal state from persisted task statuses.
    const latest = await step.runQuery(internal.outreach.getPlanInternal, {
      planId: args.planId,
    });
    if (!latest) {
      return {
        success: false,
        status: "failed",
        error: "Plan disappeared while finalizing workflow",
      };
    }

    const hasWaitingResponse = latest.tasks.some(
      (task: Doc<"outreachTasks">) => task.status === "waiting_response"
    );
    const hasIncompleteTasks = latest.tasks.some(
      (task: Doc<"outreachTasks">) =>
        task.status !== "completed" &&
        task.status !== "skipped" &&
        task.status !== "waiting_response"
    );

    if (hasWaitingResponse || hasIncompleteTasks) {
      console.info(
        `${traceBase} workflow-finished-nonterminal waiting=${hasWaitingResponse} incomplete=${hasIncompleteTasks}`
      );
      return {
        success: true,
        status: hasWaitingResponse ? "waiting_response" : "executing",
      };
    }

    await step.runMutation(internal.outreach.updatePlanStatus, {
      planId: args.planId,
      status: "completed",
    });

    await step.runMutation(internal.outreach.logActivity, {
      prospectId: plan.prospectId,
      workspaceId: plan.workspaceId,
      type: "converted",
      title: "Outreach plan completed",
      description: `Completed ${completedTasks} tasks`,
    });

    console.info(`${traceBase} completed tasks=${completedTasks}`);
    return { success: true, status: "completed" };
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
    const planData = await ctx.runQuery(internal.outreach.getPlanInternal, {
      planId: args.planId,
    });
    if (!planData) {
      throw new Error("Plan not found");
    }

    const limitState = await ctx.runQuery(
      internal.workflows.prospecting.checkProspectLimitInternal,
      {
        workspaceId: planData.plan.workspaceId,
      }
    );
    if (limitState.limitReached) {
      await ctx.runAction(
        internal.workspaces.reconcileWorkspaceCapacityStateInternal,
        {
          workspaceId: planData.plan.workspaceId,
        }
      );
      return { workflowId: "" };
    }

    if (planData.plan.workflowId) {
      try {
        const existingStatus = await workflowManager.status(
          ctx,
          planData.plan.workflowId as unknown as ReturnType<
            typeof workflowManager.start
          > extends Promise<infer T>
            ? T
            : never
        );
        if (existingStatus.type === "inProgress") {
          console.info(
            `[Outreach] Reusing in-progress workflow ${planData.plan.workflowId} for plan ${args.planId}`
          );
          return { workflowId: planData.plan.workflowId };
        }
      } catch (statusError) {
        console.warn(
          `[Outreach] Failed to read workflow status for plan ${args.planId}`,
          statusError
        );
      }
    }

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
    approvalEventId: v.string(),
    taskId: v.id("outreachTasks"),
  },
  handler: async (ctx, args): Promise<void> => {
    await workflowManager.sendEvent(ctx, {
      id: args.approvalEventId as any,
    });

    console.info(
      `[Outreach] Task ${args.taskId} approved (event ${args.approvalEventId}), workflow resuming`
    );
  },
});
