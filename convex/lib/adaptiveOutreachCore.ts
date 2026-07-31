import { z } from "zod";
import type { Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  adaptiveOutreachDecisionValidator,
  outreachInteractionChannelValidator,
} from "../validators";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { refinePlan, type OutreachTaskInput } from "./outreachCore";
import {
  ensureCurrentOutreachPlanRevision,
  persistOutreachPlanRevision,
} from "./outreachPlanRevisionCore";
import { dismissNotificationsForTask } from "./notificationHelpers";

const adaptiveTaskTransportSchema = z.object({
  type: z.enum(["comment", "dm", "react", "wait", "ask_human"]),
  description: z.string(),
  timing: z.object({
    type: z.enum(["immediate", "delay", "event", "best_time"]),
    value: z.string().nullable(),
  }),
  targetTweetId: z.string().nullable(),
  targetCommentId: z.string().nullable(),
  reactionType: z
    .enum(["like", "celebrate", "support", "love", "insightful", "funny"])
    .nullable(),
  content: z.string().nullable(),
});

export const adaptiveOutreachDecisionTransportSchema = z.object({
  outcome: z.enum(["continue", "completed", "abandoned"]),
  summary: z.string(),
  reasoning: z.string(),
  strategy: z
    .object({
      rationale: z.string(),
      targetTweetId: z.string().nullable(),
      valueProposition: z.string(),
      tone: z.string(),
    })
    .nullable(),
  tasks: z.array(adaptiveTaskTransportSchema),
});

const adaptiveOutreachDecisionSchema = z
  .object({
    outcome: z.enum(["continue", "completed", "abandoned"]),
    summary: z.string().trim().min(1),
    reasoning: z.string().trim().min(1),
    strategy: z
      .object({
        rationale: z.string().trim().min(1),
        targetTweetId: z.string().trim().min(1).optional(),
        valueProposition: z.string().trim().min(1),
        tone: z.string().trim().min(1),
      })
      .optional(),
    tasks: z
      .array(
        z.object({
          type: z.enum(["comment", "dm", "react", "wait", "ask_human"]),
          description: z.string().trim().min(1),
          timing: z.object({
            type: z.enum(["immediate", "delay", "event", "best_time"]),
            value: z.string().trim().min(1).optional(),
          }),
          targetTweetId: z.string().trim().min(1).optional(),
          targetCommentId: z.string().trim().min(1).optional(),
          reactionType: z
            .enum([
              "like",
              "celebrate",
              "support",
              "love",
              "insightful",
              "funny",
            ])
            .optional(),
          content: z.string().trim().min(1).optional(),
        })
      )
      .max(6),
  })
  .superRefine((decision, ctx) => {
    if (decision.outcome === "continue") {
      if (!decision.strategy) {
        ctx.addIssue({
          code: "custom",
          message: "A continuing plan requires a strategy.",
          path: ["strategy"],
        });
      }
      if (decision.tasks.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "A continuing plan requires at least one task.",
          path: ["tasks"],
        });
      }
    } else if (decision.tasks.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "Terminal decisions cannot contain future tasks.",
        path: ["tasks"],
      });
    }
  });

export type AdaptiveOutreachDecision = Infer<
  typeof adaptiveOutreachDecisionValidator
>;
export type OutreachInteractionChannel = Infer<
  typeof outreachInteractionChannelValidator
>;

export function buildAdaptiveOutreachPrompt(args: {
  prospect: Doc<"prospects">;
  plan: Doc<"outreachPlans">;
  tasks: Doc<"outreachTasks">[];
  event: Doc<"outreachInteractionEvents">;
  interactionHistory: unknown;
}): string {
  return [
    "Re-plan this prospect's outreach after a new inbound interaction.",
    "Act as an autonomous sales assistant: choose the next best move instead of asking the user to decide.",
    "Return outcome=completed when the outreach objective is already achieved, abandoned when the prospect clearly declines or outreach must stop, otherwise continue with a revised strategy and only the future tasks still needed.",
    "Never repeat a completed action. Keep the sequence concise. Respond on the same public thread when that is the natural next move; use a DM only when appropriate.",
    "For a public reply, consider reacting to the prospect's post/comment before replying when that is natural. Do not add reactions mechanically. Never create a reaction task for a DM.",
    "X supports only a like. LinkedIn supports like, celebrate, support, love, insightful, and funny.",
    `Prospect: ${args.prospect.displayName ?? "Unknown prospect"} (${args.prospect.platform})`,
    `Inbound channel: ${args.event.channel}`,
    `Inbound text: ${args.event.responseText ?? "(no text supplied)"}`,
    `Inbound message ID: ${args.event.responseMessageId}`,
    `Conversation/post ID: ${args.event.conversationId ?? "(not supplied)"}`,
    `Current strategy: ${JSON.stringify(args.plan.strategy)}`,
    `Current tasks: ${JSON.stringify(
      args.tasks
        .filter((task) => task.supersededAt === undefined)
        .map((task) => ({
          order: task.order,
          type: task.type,
          description: task.description,
          status: task.status,
          content: task.content,
        }))
    )}`,
    `Recent interaction history: ${JSON.stringify(args.interactionHistory)}`,
  ].join("\n\n");
}

export function parseAdaptiveOutreachDecision(
  value: unknown,
  event: Pick<
    Doc<"outreachInteractionEvents">,
    "channel" | "responseMessageId" | "conversationId" | "responseText"
  >
): AdaptiveOutreachDecision {
  const transport = adaptiveOutreachDecisionTransportSchema.parse(value);
  const parsed = adaptiveOutreachDecisionSchema.parse({
    ...transport,
    strategy: transport.strategy
      ? {
          ...transport.strategy,
          targetTweetId: transport.strategy.targetTweetId ?? undefined,
        }
      : undefined,
    tasks: transport.tasks.map((task) => ({
      ...task,
      timing: {
        ...task.timing,
        value: task.timing.value ?? undefined,
      },
      targetTweetId: task.targetTweetId ?? undefined,
      targetCommentId: task.targetCommentId ?? undefined,
      reactionType: task.reactionType ?? undefined,
      content: task.content ?? undefined,
    })),
  });

  const platform = event.channel.startsWith("linkedin")
    ? "linkedin"
    : "twitter";
  const tasks: OutreachTaskInput[] = parsed.tasks.map((task) => {
    if (task.type !== "comment" && task.type !== "react") {
      return task;
    }

    const isPublicInteraction =
      event.channel === "twitter_reply" || event.channel === "linkedin_comment";
    if (task.type === "react" && !isPublicInteraction) {
      throw new Error("Reaction tasks cannot target private messages.");
    }

    const targetTweetId =
      platform === "twitter"
        ? event.responseMessageId
        : event.conversationId || task.targetTweetId;
    if (!targetTweetId) {
      throw new Error(
        "A LinkedIn public interaction requires the source post identifier."
      );
    }

    return {
      ...task,
      targetTweetId,
      targetCommentId:
        platform === "linkedin" ? event.responseMessageId : undefined,
      reactionType:
        task.type === "react" ? (task.reactionType ?? "like") : undefined,
      approvalContext: {
        platform,
        sourceContext: event.responseText,
      },
    };
  });

  return {
    outcome: parsed.outcome,
    summary: parsed.summary,
    reasoning: parsed.reasoning,
    strategy: parsed.strategy,
    tasks,
  };
}

export async function applyAdaptiveOutreachDecision(
  ctx: MutationCtx,
  args: {
    eventId: Id<"outreachInteractionEvents">;
    decision: AdaptiveOutreachDecision;
  }
): Promise<{
  applied: boolean;
  outcome: AdaptiveOutreachDecision["outcome"];
  planId?: Id<"outreachPlans">;
  planVersion?: number;
}> {
  const event = await ctx.db.get("outreachInteractionEvents", args.eventId);
  if (!event || !event.planId) {
    return { applied: false, outcome: args.decision.outcome };
  }
  if (event.status === "completed" || event.status === "superseded") {
    return {
      applied: false,
      outcome: args.decision.outcome,
      planId: event.planId,
      planVersion: event.appliedPlanVersion,
    };
  }

  const plan = await ctx.db.get("outreachPlans", event.planId);
  if (!plan) {
    await failAdaptiveOutreachEvent(
      ctx,
      event,
      "Outreach plan no longer exists."
    );
    return { applied: false, outcome: args.decision.outcome };
  }

  if (
    plan.version !== event.basePlanVersion ||
    (plan.executionGeneration ?? 0) !== event.executionGeneration
  ) {
    await ctx.db.patch(event._id, {
      status: "superseded",
      errorMessage: "A newer plan or interaction superseded this decision.",
      updatedAt: getCurrentUTCTimestamp(),
      completedAt: getCurrentUTCTimestamp(),
    });
    return {
      applied: false,
      outcome: args.decision.outcome,
      planId: plan._id,
      planVersion: plan.version,
    };
  }

  const now = getCurrentUTCTimestamp();
  const tasks = await ctx.db
    .query("outreachTasks")
    .withIndex("by_plan_order", (q) => q.eq("planId", plan._id))
    .collect();
  await ensureCurrentOutreachPlanRevision(ctx, plan, tasks);

  if (args.decision.outcome === "continue") {
    if (!args.decision.strategy || args.decision.tasks.length === 0) {
      throw new Error("Continuing outreach requires a strategy and tasks.");
    }
    await refinePlan(ctx, plan._id, {
      strategy: args.decision.strategy,
      tasks: args.decision.tasks,
      status: "approved",
      revisionTrigger: {
        kind: "interaction_replan",
        actor: "agent",
        reason: args.decision.summary,
        sourceEventKey: event.eventKey,
        interactionChannel: event.channel,
        responseMessageId: event.responseMessageId,
      },
    });
  } else {
    const nextVersion = plan.version + 1;
    for (const task of tasks) {
      if (task.status !== "completed" && task.supersededAt === undefined) {
        await ctx.db.patch(task._id, {
          status: "skipped",
          supersededAt: now,
          supersededByVersion: nextVersion,
        });
        await dismissNotificationsForTask(ctx, task._id);
      }
    }
    await ctx.db.patch(plan._id, {
      status: args.decision.outcome,
      version: nextVersion,
      workflowId: undefined,
      updatedAt: now,
    });
    const terminalPlan = await ctx.db.get("outreachPlans", plan._id);
    const terminalTasks = await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan_order", (q) => q.eq("planId", plan._id))
      .collect();
    if (!terminalPlan) {
      throw new Error("Terminal outreach plan could not be reloaded.");
    }
    await persistOutreachPlanRevision(ctx, {
      plan: terminalPlan,
      tasks: terminalTasks,
      previousVersion: plan.version,
      trigger: {
        kind: "interaction_replan",
        actor: "agent",
        reason: args.decision.summary,
        sourceEventKey: event.eventKey,
        interactionChannel: event.channel,
        responseMessageId: event.responseMessageId,
      },
    });
  }

  const appliedPlan = await ctx.db.get("outreachPlans", plan._id);
  if (!appliedPlan) {
    throw new Error("Applied outreach plan could not be reloaded.");
  }
  await ctx.db.patch(event._id, {
    status: "completed",
    decisionOutcome: args.decision.outcome,
    decisionSummary: args.decision.summary,
    appliedPlanVersion: appliedPlan.version,
    errorMessage: undefined,
    updatedAt: now,
    completedAt: now,
  });

  return {
    applied: true,
    outcome: args.decision.outcome,
    planId: plan._id,
    planVersion: appliedPlan.version,
  };
}

export async function failAdaptiveOutreachEvent(
  ctx: MutationCtx,
  event: Doc<"outreachInteractionEvents">,
  errorMessage: string
): Promise<void> {
  if (event.status === "completed" || event.status === "superseded") {
    return;
  }
  const now = getCurrentUTCTimestamp();
  await ctx.db.patch(event._id, {
    status: "failed",
    errorMessage,
    updatedAt: now,
    completedAt: now,
  });
  await ctx.db.insert("outreachNotifications", {
    userId: event.userId,
    workspaceId: event.workspaceId,
    type: "error",
    title: "Couldn’t update the outreach plan",
    message:
      "The new response was saved, but automatic replanning failed. The plan remains paused.",
    status: "pending",
    prospectId: event.prospectId,
    planId: event.planId,
    notificationKey: `adaptive-outreach-failed:${event.eventKey}`,
    eventVersion: 1,
    eventUpdatedAt: now,
  });
}
