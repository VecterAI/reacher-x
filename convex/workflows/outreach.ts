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
import { logger } from "../../shared/lib/logger";

// ============================================================================
// Constants
// ============================================================================

/** Delay between tasks (in ms) */
const DEFAULT_TASK_DELAY_MS = 60 * 60 * 1000; // 1 hour
const outreachWorkflowLogger = logger.withScope("OutreachWorkflow");

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
 * 4. Route comments, DMs, and reactions through approval when required
 * 5. Handle wait tasks (use runAfter for delays)
 * 6. Handle ask_human tasks (use awaitEvent)
 * 7. Mark plan as completed when all tasks done
 */
export const outreachPlanWorkflow = workflowManager.define({
  args: {
    planId: v.id("outreachPlans"),
    executionGeneration: v.number(),
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
    if ((plan.executionGeneration ?? 0) !== args.executionGeneration) {
      return {
        success: true,
        status: "superseded",
      };
    }
    const contactedActivityDescription = `Executing ${tasks.length} task${tasks.length !== 1 ? "s" : ""} — ${plan.strategy.tone || "professional"} tone`;
    let shouldMarkProspectContacted = true;

    const prospect = await step.runQuery(
      internal.prospects.getProspectInternal,
      { prospectId: plan.prospectId }
    );
    if (!prospect || prospect.qualificationStatus !== "qualified") {
      return {
        success: false,
        status: "skipped",
        error: "Prospect is no longer qualified for outreach",
      };
    }

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
    const started = await step.runMutation(internal.outreach.updatePlanStatus, {
      planId: args.planId,
      status: "executing",
      expectedExecutionGeneration: args.executionGeneration,
    });
    if (!started) {
      return { success: true, status: "superseded" };
    }

    // Prospect display fields are used in notifications.
    const prospectDisplayFields = getProspectDisplayFields(prospect);
    const prospectPlatform =
      prospect.platform === "linkedin" ? "linkedin" : "twitter";

    // Step 3: Execute tasks in order, re-reading the latest plan state so
    // refinements to future tasks can take effect while a plan is executing.
    let completedTasks = 0;
    let nextTaskOrder = 1;

    while (true) {
      const latestState = await step.runQuery(
        internal.outreach.getPlanInternal,
        {
          planId: args.planId,
        }
      );
      if (!latestState) {
        return {
          success: false,
          status: "failed",
          error: "Plan disappeared while executing workflow",
        };
      }

      const currentPlan = latestState.plan;
      if ((currentPlan.executionGeneration ?? 0) !== args.executionGeneration) {
        return { success: true, status: "superseded" };
      }
      if (currentPlan.status === "abandoned") {
        return { success: true, status: "abandoned" };
      }
      if (
        currentPlan.status === "paused" ||
        currentPlan.status === "blocked_auth"
      ) {
        return { success: true, status: currentPlan.status };
      }

      const task = latestState.tasks.find(
        (candidate: (typeof latestState.tasks)[number]) =>
          candidate.order >= nextTaskOrder &&
          candidate.status !== "completed" &&
          candidate.status !== "skipped" &&
          candidate.status !== "waiting_manual" &&
          candidate.status !== "waiting_connection" &&
          candidate.status !== "waiting_response"
      );

      if (!task) {
        completedTasks = latestState.tasks.filter(
          (candidate: (typeof latestState.tasks)[number]) =>
            candidate.status === "completed" ||
            candidate.status === "skipped" ||
            candidate.status === "waiting_response"
        ).length;
        break;
      }

      nextTaskOrder = task.order + 1;

      await step.runMutation(internal.outreach.updateTaskStatus, {
        taskId: task._id,
        status: "executing",
      });

      try {
        if (task.type === "comment") {
          // Validate task has required content
          if (
            (!task.content &&
              (prospectPlatform === "linkedin" || !task.mediaUrls?.length)) ||
            !task.targetTweetId
          ) {
            outreachWorkflowLogger.error("Comment task missing required data", {
              planId: String(args.planId),
              taskId: String(task._id),
              workflowId,
            });
            throw new Error("Task missing required content or target tweet ID");
          }

          const agentSettings = await step.runQuery(
            internal.workspaces.getWorkspaceAgentSettingsInternal,
            {
              workspaceId: currentPlan.workspaceId,
            }
          );
          const requiresApproval =
            agentSettings?.autonomyMode !== "autonomous" && !task.approvedAt;

          if (requiresApproval) {
            const approvalSignal = await step.runMutation(
              internal.outreach.createTaskApprovalNotification,
              {
                userId: currentPlan.userId,
                workspaceId: currentPlan.workspaceId,
                prospectId: currentPlan.prospectId,
                planId: args.planId,
                taskId: task._id,
                workflowId,
                content: task.content ?? "",
                platform: prospectPlatform,
                targetTweetId: task.targetTweetId,
                threadId: currentPlan.threadId,
                ...prospectDisplayFields,
              }
            );

            if (!approvalSignal?.approvalEventId) {
              throw new Error("Approval event ID missing for comment task");
            }
            await step.awaitEvent({ id: approvalSignal.approvalEventId });
          }

          // Execute comment task after approval - with delay if specified
          const delayMs = getTaskDelay(task.timing);
          const executionResult = await step.runAction(
            internal.outreachActions.executeCommentTask,
            {
              taskId: task._id,
              planId: args.planId,
              executionGeneration: args.executionGeneration,
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
            if (executionResult.errorClass === "superseded") {
              return { success: true, status: "superseded" };
            }
            const isAuthBlocker =
              executionResult.errorClass === "reauth_required" ||
              executionResult.errorClass === "scope_missing";
            const nextPlanStatus = isAuthBlocker ? "blocked_auth" : "paused";

            await step.runMutation(internal.outreach.updatePlanStatus, {
              planId: args.planId,
              status: nextPlanStatus,
              expectedExecutionGeneration: args.executionGeneration,
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
                  prospectId: currentPlan.prospectId,
                  workspaceId: currentPlan.workspaceId,
                  description: contactedActivityDescription,
                }
              );
              shouldMarkProspectContacted = false;
            } catch (statusSyncError) {
              outreachWorkflowLogger.warn(
                "Failed to sync contacted status after comment",
                {
                  planId: String(args.planId),
                  taskId: String(task._id),
                  workflowId,
                },
                statusSyncError
              );
            }
          }
        } else if (task.type === "react") {
          if (!task.targetTweetId) {
            throw new Error("Reaction task missing required target post ID");
          }

          const agentSettings = await step.runQuery(
            internal.workspaces.getWorkspaceAgentSettingsInternal,
            {
              workspaceId: currentPlan.workspaceId,
            }
          );
          const requiresApproval =
            agentSettings?.autonomyMode !== "autonomous" && !task.approvedAt;

          if (requiresApproval) {
            const approvalSignal = await step.runMutation(
              internal.outreach.createTaskApprovalNotification,
              {
                userId: currentPlan.userId,
                workspaceId: currentPlan.workspaceId,
                prospectId: currentPlan.prospectId,
                planId: args.planId,
                taskId: task._id,
                workflowId,
                content: "",
                platform: prospectPlatform,
                targetTweetId: task.targetTweetId,
                threadId: currentPlan.threadId,
                ...prospectDisplayFields,
              }
            );

            if (!approvalSignal?.approvalEventId) {
              throw new Error("Approval event ID missing for reaction task");
            }
            await step.awaitEvent({ id: approvalSignal.approvalEventId });
          }

          const delayMs = getTaskDelay(task.timing);
          const executionResult = await step.runAction(
            internal.outreachActions.executeReactionTask,
            {
              taskId: task._id,
              planId: args.planId,
              executionGeneration: args.executionGeneration,
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
            if (executionResult.errorClass === "superseded") {
              return { success: true, status: "superseded" };
            }
            const isAuthBlocker =
              executionResult.errorClass === "reauth_required" ||
              executionResult.errorClass === "scope_missing";
            const nextPlanStatus = isAuthBlocker ? "blocked_auth" : "paused";

            await step.runMutation(internal.outreach.updatePlanStatus, {
              planId: args.planId,
              status: nextPlanStatus,
              expectedExecutionGeneration: args.executionGeneration,
            });
            return {
              success: false,
              status: nextPlanStatus,
              error:
                executionResult.errorMessage ||
                "Reaction task execution failed",
            };
          }
        } else if (task.type === "dm") {
          if (!task.content && !(task.mediaUrls && task.mediaUrls.length > 0)) {
            throw new Error("Task missing required DM content");
          }

          const platform = prospectPlatform;
          const agentSettings = await step.runQuery(
            internal.workspaces.getWorkspaceAgentSettingsInternal,
            {
              workspaceId: currentPlan.workspaceId,
            }
          );
          const requiresApproval =
            agentSettings?.autonomyMode !== "autonomous" && !task.approvedAt;

          if (requiresApproval) {
            const approvalSignal = await step.runMutation(
              internal.outreach.createTaskApprovalNotification,
              {
                userId: currentPlan.userId,
                workspaceId: currentPlan.workspaceId,
                prospectId: currentPlan.prospectId,
                planId: args.planId,
                taskId: task._id,
                workflowId,
                content: task.content || "",
                platform,
                threadId: currentPlan.threadId,
                ...prospectDisplayFields,
              }
            );

            if (!approvalSignal?.approvalEventId) {
              throw new Error("Approval event ID missing for DM task");
            }
            await step.awaitEvent({ id: approvalSignal.approvalEventId });
          }

          const delayMs = getTaskDelay(task.timing);
          const executionResult = await step.runAction(
            internal.outreachActions.executeDmTask,
            {
              taskId: task._id,
              planId: args.planId,
              executionGeneration: args.executionGeneration,
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
            if (executionResult.errorClass === "superseded") {
              return { success: true, status: "superseded" };
            }
            if (executionResult.recoveryStarted) {
              return {
                success: true,
                status: "waiting_connection",
              };
            }
            const isAuthBlocker =
              executionResult.errorClass === "reauth_required" ||
              executionResult.errorClass === "scope_missing";
            const nextPlanStatus = isAuthBlocker ? "blocked_auth" : "paused";

            await step.runMutation(internal.outreach.updatePlanStatus, {
              planId: args.planId,
              status: nextPlanStatus,
              expectedExecutionGeneration: args.executionGeneration,
            });

            return {
              success: false,
              status: nextPlanStatus,
              error: executionResult.errorMessage || "DM task execution failed",
            };
          }

          if (shouldMarkProspectContacted) {
            try {
              await step.runMutation(
                internal.outreach.markProspectContactedFromSuccessfulOutreach,
                {
                  prospectId: currentPlan.prospectId,
                  workspaceId: currentPlan.workspaceId,
                  title: "Started outreach",
                  description: contactedActivityDescription,
                }
              );
              shouldMarkProspectContacted = false;
            } catch (statusSyncError) {
              outreachWorkflowLogger.warn(
                "Failed to sync contacted status after DM",
                {
                  planId: String(args.planId),
                  taskId: String(task._id),
                  workflowId,
                },
                statusSyncError
              );
            }
          }
        } else if (task.type === "wait") {
          if (
            task.timing.type === "event" &&
            task.timing.value === "next_post"
          ) {
            const monitorResult = await step.runAction(
              internal.prospectMonitors.createProspectMonitor,
              {
                prospectId: currentPlan.prospectId,
                planId: args.planId,
              }
            );
            if (!monitorResult.success) {
              throw new Error(
                monitorResult.error ||
                  "Could not create the next-post monitor for this prospect."
              );
            }

            await step.awaitEvent({
              name: `prospect_next_post:${task._id}`,
            });
            await step.runMutation(internal.outreach.updateTaskStatus, {
              taskId: task._id,
              status: "completed",
            });
          } else {
            // Wait tasks - complete after configured delay.
            const waitMs = parseWaitDuration(task.timing.value);
            await step.runMutation(
              internal.outreach.updateTaskStatus,
              { taskId: task._id, status: "completed" },
              { runAfter: waitMs }
            );
          }
        } else if (task.type === "ask_human") {
          // Create notification for user
          await step.runMutation(internal.outreach.createHumanNotification, {
            userId: currentPlan.userId,
            workspaceId: currentPlan.workspaceId,
            prospectId: currentPlan.prospectId,
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
        const failedTask = await step.runQuery(
          internal.outreach.getTaskInternal,
          { taskId: task._id }
        );
        const userFacingError = failedTask?.errorMessage || errorMessage;

        outreachWorkflowLogger.error("Outreach task failed", {
          planId: String(args.planId),
          taskId: String(task._id),
          workflowId,
          errorMessage: userFacingError,
        });

        // Critical task failed - pause workflow
        if (
          task.type === "comment" ||
          task.type === "dm" ||
          task.type === "react"
        ) {
          const nextPlanStatus =
            errorMessage.includes("reauth_required") ||
            errorMessage.includes("scope_missing")
              ? "blocked_auth"
              : "paused";
          await step.runMutation(internal.outreach.updatePlanStatus, {
            planId: args.planId,
            status: nextPlanStatus,
            expectedExecutionGeneration: args.executionGeneration,
          });
          if (nextPlanStatus !== "blocked_auth") {
            await step.runMutation(
              internal.outreach.createTaskExecutionFailureNotification,
              {
                taskId: task._id,
                attemptId: `workflow:${workflowId}`,
                message: userFacingError,
              }
            );
          }
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
            error: `Task failed: ${userFacingError}`,
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
    const hasWaitingConnection = latest.tasks.some(
      (task: Doc<"outreachTasks">) => task.status === "waiting_connection"
    );
    const hasIncompleteTasks = latest.tasks.some(
      (task: Doc<"outreachTasks">) =>
        task.status !== "completed" &&
        task.status !== "skipped" &&
        task.status !== "waiting_response" &&
        task.status !== "waiting_connection"
    );

    if (hasWaitingResponse || hasWaitingConnection || hasIncompleteTasks) {
      return {
        success: true,
        status: hasWaitingConnection
          ? "waiting_connection"
          : hasWaitingResponse
            ? "waiting_response"
            : "executing",
      };
    }

    await step.runMutation(internal.outreach.updatePlanStatus, {
      planId: args.planId,
      status: "completed",
      expectedExecutionGeneration: args.executionGeneration,
    });

    await step.runMutation(internal.outreach.logActivity, {
      prospectId: plan.prospectId,
      workspaceId: plan.workspaceId,
      type: "converted",
      title: "Outreach plan completed",
      description: `Completed ${completedTasks} tasks`,
    });

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
      return { workflowId: "" };
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
          return { workflowId: planData.plan.workflowId };
        }
      } catch (statusError) {
        outreachWorkflowLogger.warn(
          "Failed to read existing workflow status",
          { planId: String(args.planId) },
          statusError
        );
      }
    }

    const wfId = await workflowManager.start(
      ctx,
      internal.workflows.outreach.outreachPlanWorkflow,
      {
        planId: args.planId,
        executionGeneration: planData.plan.executionGeneration ?? 0,
      }
    );

    // Store workflowId on plan for sendEvent later
    await ctx.runMutation(internal.outreach.updatePlanWorkflowId, {
      planId: args.planId,
      workflowId: wfId.toString(),
      expectedExecutionGeneration: planData.plan.executionGeneration ?? 0,
    });

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
  },
});

export const sendProspectNextPostEvent = internalAction({
  args: {
    workflowId: v.string(),
    taskId: v.id("outreachTasks"),
  },
  handler: async (ctx, args): Promise<void> => {
    await workflowManager.sendEvent(ctx, {
      name: `prospect_next_post:${args.taskId}`,
      workflowId: args.workflowId as unknown as ReturnType<
        typeof workflowManager.start
      > extends Promise<infer T>
        ? T
        : never,
    });
  },
});
