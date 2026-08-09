"use node";

// convex/agents/outreach/tools/refinePlan.ts
// Agent tool for updating outreach plans based on feedback
// Thin wrapper - Layer 1 following Three-Layer Architecture

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../../_generated/api";
import {
  ensureWorkspaceStyleReady,
  extractPlanIdFromThread,
  type ToolContext,
} from "./helpers";
import {
  createPlanPreviewArtifact,
  type AgentArtifactEnvelope,
} from "../../../../shared/lib/json-render/agentArtifacts";
import { X_LONG_FORM_POST_MAX_CHARS } from "../../../../shared/lib/twitter/xPostTextLimit";
import type { Doc, Id } from "../../../_generated/dataModel";
import { repairOverLimitCommentTasks } from "./xPostLimitHelpers";
import { runLoggedAgentTool } from "../../tools/logging";
import { getCurrentUTCTimestamp } from "../../../../shared/lib/utils/time/timeUtils";
import { getMediaCapabilityErrorMessage } from "../../../lib/mediaCapabilityCore";
import { restoreExistingMediaUploadIds } from "../../../lib/agentAttachmentReferenceCore";
import {
  attachmentRefsSchema,
  resolveTaskAttachmentReferences,
} from "./attachmentReferences";
import {
  applyLinkedInRelationshipTaskConstraints,
  hasConcreteOutreachTask,
  isLinkedInDmPlanAllowed,
  linkedInDmBlockedMessage,
  type LinkedInRelationshipStatus,
} from "../../../lib/linkedinOutreachPlanCore";

// ============================================================================
// Schema
// ============================================================================

/**
 * Zod schemas for agent tool validation.
 *
 * NOTE: These Zod schemas duplicate the Convex validators in validators.ts.
 * This is intentional because @convex-dev/agent requires Zod for tool args.
 * Values are aligned with validators.ts - if you add/remove values there,
 * update these schemas too.
 *
 * See: outreachTaskTypeValidator, outreachTaskTimingTypeValidator,
 *      outreachStrategyValidator in convex/validators.ts
 */
const taskSchema = z.object({
  type: z.enum(["comment", "dm", "react", "wait", "ask_human"]),
  description: z.string(),
  timing: z.object({
    type: z.enum(["immediate", "delay", "event", "best_time"]),
    value: z.string().optional(),
  }),
  targetTweetId: z.string().optional(),
  targetCommentId: z.string().optional(),
  reactionType: z
    .enum(["like", "celebrate", "support", "love", "insightful", "funny"])
    .optional(),
  content: z.string().max(X_LONG_FORM_POST_MAX_CHARS).optional(),
  attachmentRefs: attachmentRefsSchema,
  mediaUrls: z
    .array(z.url())
    .max(4)
    .optional()
    .describe(
      "Exact verified URLs already present in the current plan context, or explicitly supplied by a delegated system instruction. Use these to preserve existing plan media. For newly selected files, use attachmentRefs instead."
    ),
  mediaDescriptions: z.array(z.string().max(1_000)).max(4).optional(),
  mediaKinds: z
    .array(z.enum(["image", "gif", "video"]))
    .max(4)
    .optional(),
});

const strategySchema = z.object({
  rationale: z
    .string()
    .describe(
      "A concise strategy explanation. Default to 1-2 short paragraphs, use bullets only when they improve clarity, and never return one oversized wall of text."
    ),
  targetTweetId: z.string().optional().describe("Tweet ID to engage with"),
  valueProposition: z.string().describe("The value we offer this prospect"),
  tone: z
    .string()
    .describe("Communication tone (e.g., 'friendly peer', 'helpful expert')"),
});

// ============================================================================
// Types
// ============================================================================

export interface RefinePlanResult {
  success: boolean;
  message: string;
  plan?: {
    id: string;
    status: string;
    strategy: {
      rationale: string;
      targetTweetId?: string;
      valueProposition: string;
      tone: string;
    };
    version: number;
  };
  tasks?: Array<{
    id: string;
    order: number;
    type: string;
    description: string;
    status: string;
    content?: string;
    targetTweetId?: string;
    targetCommentId?: string;
    reactionType?: string;
    mediaUrls?: string[];
    mediaDescriptions?: string[];
    mediaKinds?: Array<"image" | "gif" | "video">;
  }>;
  artifact?: AgentArtifactEnvelope;
  error?: string;
}

type RefinePlanTaskInput = z.infer<typeof taskSchema>;

function normalizeCommentTasks(
  tasks: RefinePlanTaskInput[],
  strategyTargetTweetId?: string
) {
  return tasks.map((task) =>
    (task.type === "comment" || task.type === "react") &&
    !task.targetTweetId &&
    strategyTargetTweetId
      ? {
          ...task,
          targetTweetId: strategyTargetTweetId,
        }
      : task
  );
}

function allowsDeferredNextPostTarget(tasks: RefinePlanTaskInput[]) {
  return tasks.some(
    (task) =>
      task.type === "wait" &&
      task.timing.type === "event" &&
      task.timing.value === "next_post"
  );
}

// ============================================================================
// Tool
// ============================================================================

/**
 * Update an existing outreach plan based on user feedback.
 * Can update strategy, tasks, or both.
 *
 * NOTE: This tool does NOT accept planId from LLM to prevent ID hallucination.
 * The active plan is automatically found from thread context.
 * Per AGENT_CONTEXT.txt line 419-423.
 */
export const refinePlan = createTool({
  description:
    "Update the existing outreach plan based on user feedback. Use this when the user asks to change the plan, make adjustments, or refine the approach. Can update the strategy, tasks, or both. The plan is automatically found from context - no plan ID needed.",
  inputSchema: z.object({
    strategy: strategySchema.optional().describe("Updated strategy (optional)"),
    tasks: z
      .array(taskSchema)
      .optional()
      .describe("Updated list of tasks (optional - replaces all tasks)"),
  }),
  execute: async (ctx: ToolContext, args): Promise<RefinePlanResult> =>
    runLoggedAgentTool(
      ctx,
      {
        moduleName: "refinePlan",
        args,
      },
      async (logEvent) => {
        const stageTimings: Record<string, number> = {};
        const measureStage = async <T>(
          stage: string,
          runner: () => Promise<T>
        ): Promise<T> => {
          const startedAt = getCurrentUTCTimestamp();
          try {
            return await runner();
          } finally {
            stageTimings[`${stage}_ms`] = getCurrentUTCTimestamp() - startedAt;
            logEvent.set({ timing: stageTimings });
          }
        };

        let mediaFailurePlanId: Id<"outreachPlans"> | null = null;
        try {
          if (!args.strategy && !args.tasks) {
            logEvent.warn(
              "Refine plan called without strategy or task updates"
            );
            return {
              success: false,
              message:
                "Please specify what you'd like to change - the strategy, tasks, or both.",
              error: "Must provide either strategy or tasks to update",
            };
          }

          const normalizedTasksWithReferences = args.tasks
            ? normalizeCommentTasks(args.tasks, args.strategy?.targetTweetId)
            : undefined;
          const userId = ctx.userId as Id<"users"> | null;
          if (!userId) {
            logEvent.warn("User not authenticated for plan refinement");
            return {
              success: false,
              message: "Unable to update plan - not authenticated.",
              error: "User not authenticated",
            };
          }

          const paidEligibility = await measureStage(
            "paid_eligibility",
            async () =>
              await ctx.runQuery(
                internal.plans.getPaidFeatureEligibilityByUserId,
                { userId }
              )
          );
          if (!paidEligibility.allowed) {
            logEvent.warn("Plan refinement blocked by subscription", {
              user: {
                id: userId,
              },
            });
            return {
              success: false,
              message:
                paidEligibility.reason ??
                "Upgrade plan to update outreach plans.",
              error: "Plan required",
            };
          }

          const planId = await measureStage("plan_lookup", async () =>
            extractPlanIdFromThread(
              ctx,
              "refinePlan",
              internal.outreach.getActivePlanForProspect,
              logEvent
            )
          );
          if (!planId) {
            logEvent.warn("No active plan found in thread context");
            return {
              success: false,
              message:
                "Could not find an active plan to update. Please generate a plan first.",
              error: "No active plan found in thread context",
            };
          }
          mediaFailurePlanId = planId;

          const existingPlanData = await measureStage(
            "existing_plan_read",
            async () =>
              ctx.runQuery(internal.outreach.getPlanInternal, { planId })
          );
          const prospect = existingPlanData
            ? await measureStage("prospect_read", async () =>
                ctx.runQuery(internal.prospects.getProspectInternal, {
                  prospectId: existingPlanData.plan.prospectId,
                })
              )
            : null;
          const prospectPlatform =
            prospect?.platform === "linkedin" ? "linkedin" : "twitter";
          const normalizedTasks = normalizedTasksWithReferences
            ? restoreExistingMediaUploadIds(
                await measureStage("attachment_resolution", async () =>
                  resolveTaskAttachmentReferences(
                    ctx,
                    normalizedTasksWithReferences
                  )
                ),
                existingPlanData?.tasks ?? []
              )
            : undefined;

          const hasCommentTasks =
            normalizedTasks?.some((task) => task.type === "comment") ?? false;
          const repairedTaskResult =
            hasCommentTasks && prospectPlatform === "twitter"
              ? await measureStage(
                  "comment_limit_validation",
                  async () =>
                    await repairOverLimitCommentTasks({
                      ctx,
                      userId,
                      tasks: normalizedTasks ?? [],
                    })
                )
              : null;
          const repairedCandidateTasks =
            repairedTaskResult?.tasks ?? normalizedTasks;

          let linkedinRelationship: LinkedInRelationshipStatus | null = null;
          let hasExistingConversation = false;
          if (prospectPlatform === "linkedin" && existingPlanData) {
            try {
              const relationship = await ctx.runAction(
                internal.linkedin.getLinkedInProspectRelationshipInternal,
                {
                  userId,
                  prospectId: existingPlanData.plan.prospectId,
                }
              );
              linkedinRelationship = relationship.status;
              hasExistingConversation = relationship.hasExistingConversation;
            } catch {
              linkedinRelationship = "unknown";
            }
          }
          const constrainedTasks = repairedCandidateTasks
            ? applyLinkedInRelationshipTaskConstraints({
                platform: prospectPlatform,
                relationship: linkedinRelationship,
                hasExistingConversation,
                tasks: repairedCandidateTasks,
              })
            : null;
          if (
            constrainedTasks &&
            constrainedTasks.removedDmCount > 0 &&
            linkedinRelationship &&
            !isLinkedInDmPlanAllowed(
              linkedinRelationship,
              hasExistingConversation
            )
          ) {
            if (!hasConcreteOutreachTask(constrainedTasks.tasks)) {
              return {
                success: false,
                message: linkedInDmBlockedMessage(
                  linkedinRelationship,
                  hasExistingConversation
                ),
                error: "LinkedIn DM blocked without connection",
              };
            }
          }
          let removeTaskIds: Id<"outreachTasks">[] | undefined;
          if (
            !repairedCandidateTasks &&
            prospectPlatform === "linkedin" &&
            existingPlanData &&
            linkedinRelationship &&
            !isLinkedInDmPlanAllowed(
              linkedinRelationship,
              hasExistingConversation
            )
          ) {
            const activeTasks = existingPlanData.tasks.filter(
              (task: Doc<"outreachTasks">) =>
                task.status !== "completed" && task.status !== "skipped"
            );
            const dmTaskIds = activeTasks
              .filter((task: Doc<"outreachTasks">) => task.type === "dm")
              .map((task: Doc<"outreachTasks">) => task._id);
            const remainingTasks = activeTasks.filter(
              (task: Doc<"outreachTasks">) => task.type !== "dm"
            );
            if (
              dmTaskIds.length > 0 &&
              !hasConcreteOutreachTask(remainingTasks)
            ) {
              return {
                success: false,
                message: linkedInDmBlockedMessage(
                  linkedinRelationship,
                  hasExistingConversation
                ),
                error: "Existing LinkedIn DM tasks require public engagement",
              };
            }
            if (dmTaskIds.length > 0) {
              removeTaskIds = dmTaskIds;
            }
          }
          const candidateTasks =
            constrainedTasks?.tasks ?? repairedCandidateTasks;
          const canDeferCommentTarget = candidateTasks
            ? allowsDeferredNextPostTarget(candidateTasks)
            : false;
          const invalidCommentTask = candidateTasks?.find(
            (task) =>
              task.type === "comment" &&
              ((!task.content &&
                (prospectPlatform === "linkedin" || !task.mediaUrls?.length)) ||
                (!task.targetTweetId && !canDeferCommentTarget))
          );
          if (invalidCommentTask) {
            logEvent.warn("Comment task missing content or target", {
              task: {
                type: invalidCommentTask.type,
              },
            });
            return {
              success: false,
              message:
                prospectPlatform === "linkedin"
                  ? "Unable to update the plan because a LinkedIn comment task is missing text or a target post."
                  : "Unable to update the plan because at least one reply task is missing text/media or a target post. Select a specific post first, or use an explicit wait-for-next-post strategy on X before the reply task.",
              error:
                "Comment tasks require supported content and either a target post or an explicit next-post wait strategy",
            };
          }
          const invalidReactionTask = candidateTasks?.find(
            (task) =>
              task.type === "react" &&
              (!task.targetTweetId ||
                Boolean(task.content) ||
                Boolean(task.mediaUrls?.length))
          );
          if (invalidReactionTask) {
            return {
              success: false,
              message:
                "Unable to update the plan because a reaction task needs a target post and cannot contain message content or media.",
              error:
                "Reaction tasks require a target post and cannot contain content or media",
            };
          }

          if (candidateTasks?.some((task) => task.type === "comment")) {
            const styleReady = await measureStage(
              "style_readiness",
              async () =>
                await ensureWorkspaceStyleReady(
                  ctx,
                  "refinePlan",
                  existingPlanData?.plan.workspaceId ?? null,
                  logEvent
                )
            );
            if (!styleReady.ready) {
              return {
                success: false,
                message: styleReady.message,
                error: styleReady.error,
              };
            }
          }

          if (existingPlanData && prospect) {
            const compliance = await measureStage(
              "workspace_memory_compliance",
              async () =>
                await ctx.runAction(
                  internal.memory.evaluateWorkspaceMemoryComplianceInternal,
                  {
                    workspaceId: existingPlanData.plan.workspaceId,
                    userId,
                    prospectId: existingPlanData.plan.prospectId,
                    surface: "manual_prospect",
                    channel: prospectPlatform,
                    query: [
                      prospect.displayName ?? "",
                      prospect.title ?? "",
                      prospect.briefIntro ?? "",
                    ]
                      .filter(Boolean)
                      .join(" "),
                    taskContext:
                      "Refine the selected prospect's existing outreach plan using the requested strategy and task changes.",
                    candidate: JSON.stringify({
                      strategy: args.strategy ?? existingPlanData.plan.strategy,
                      tasks: candidateTasks ?? existingPlanData.tasks,
                    }),
                  }
                )
            );
            if (!compliance.compliant) {
              return {
                success: false,
                message: `The revision conflicts with saved workspace instructions. Regenerate it before saving. ${compliance.repairInstruction}`,
                error: compliance.violations.join("; "),
              };
            }
          }

          await measureStage(
            "plan_update",
            async () =>
              await ctx.runMutation(internal.outreach.updatePlan, {
                planId,
                strategy: args.strategy,
                tasks: candidateTasks,
                removeTaskIds,
                threadId: ctx.threadId ?? undefined,
                planBatchItemId: ctx.planBatchItemId,
              })
          );

          const updatedPlanData = await measureStage(
            "updated_plan_read",
            async () =>
              await ctx.runQuery(internal.outreach.getPlanInternal, {
                planId,
              })
          );
          const updatedTasks = updatedPlanData?.tasks ?? [];

          logEvent.set({
            plan: {
              comment_limit_checked: repairedTaskResult !== null,
              id: planId,
              task_count: updatedTasks.length,
            },
          });

          return {
            success: true,
            message:
              "Plan updated successfully! The changes have been applied.",
            plan: updatedPlanData
              ? {
                  id: updatedPlanData.plan._id,
                  status: updatedPlanData.plan.status,
                  strategy: updatedPlanData.plan.strategy,
                  version: updatedPlanData.plan.version,
                }
              : undefined,
            tasks: updatedTasks.map((task: (typeof updatedTasks)[number]) => ({
              id: task._id,
              order: task.order,
              type: task.type,
              description: task.description,
              status: task.status,
              content: task.content,
              targetTweetId: task.targetTweetId,
              targetCommentId: task.targetCommentId,
              reactionType: task.reactionType,
              mediaUrls: task.mediaUrls,
              mediaDescriptions: task.mediaDescriptions,
              mediaKinds: task.mediaKinds,
            })),
            artifact: updatedPlanData
              ? createPlanPreviewArtifact({
                  planId: updatedPlanData.plan._id,
                  prospectId: updatedPlanData.plan.prospectId,
                  status: updatedPlanData.plan.status,
                  rationale: updatedPlanData.plan.strategy.rationale,
                  tasks: updatedTasks.map(
                    (task: (typeof updatedTasks)[number]) => ({
                      _id: task._id,
                      order: task.order,
                      type: task.type,
                      description: task.description,
                      status: task.status,
                      content: task.content,
                      targetTweetId: task.targetTweetId,
                      targetCommentId: task.targetCommentId,
                      reactionType: task.reactionType,
                    })
                  ),
                })
              : undefined,
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          const mediaErrorMessage = getMediaCapabilityErrorMessage(error);
          if (mediaErrorMessage && mediaFailurePlanId) {
            try {
              await ctx.runMutation(
                internal.outreach.createExistingPlanMediaCapabilityNotification,
                {
                  planId: mediaFailurePlanId,
                  message: mediaErrorMessage,
                }
              );
            } catch (notificationError) {
              logEvent.warn("Could not create media capability notification", {
                error:
                  notificationError instanceof Error
                    ? notificationError.message
                    : String(notificationError),
              });
            }
          }

          logEvent.error(error);

          return {
            success: false,
            message: `Unable to update plan: ${mediaErrorMessage ?? errorMessage}`,
            error: mediaErrorMessage ?? errorMessage,
          };
        }
      }
    ),
});
