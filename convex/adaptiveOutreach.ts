import { v } from "convex/values";
import { internalMutation, internalQuery } from "./lib/functionBuilders";
import { adaptiveOutreachDecisionValidator } from "./validators";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import {
  applyAdaptiveOutreachDecision,
  failAdaptiveOutreachEvent,
} from "./lib/adaptiveOutreachCore";

export const getAdaptiveOutreachContextInternal = internalQuery({
  args: {
    eventId: v.id("outreachInteractionEvents"),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event?.planId) return null;

    const [plan, prospect] = await Promise.all([
      ctx.db.get(event.planId),
      ctx.db.get(event.prospectId),
    ]);
    if (!plan || !prospect) return null;

    const tasks = await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan_order", (q) => q.eq("planId", plan._id))
      .collect();

    return {
      event,
      plan,
      prospect,
      tasks: tasks.filter((task) => task.supersededAt === undefined),
    };
  },
});

export const claimAdaptiveOutreachEventInternal = internalMutation({
  args: {
    eventId: v.id("outreachInteractionEvents"),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event || event.status !== "pending") return false;

    await ctx.db.patch(event._id, {
      status: "processing",
      attemptCount: event.attemptCount + 1,
      errorMessage: undefined,
      updatedAt: getCurrentUTCTimestamp(),
    });
    return true;
  },
});

export const applyAdaptiveOutreachDecisionInternal = internalMutation({
  args: {
    eventId: v.id("outreachInteractionEvents"),
    decision: adaptiveOutreachDecisionValidator,
  },
  handler: async (ctx, args) => {
    return await applyAdaptiveOutreachDecision(ctx, args);
  },
});

export const failAdaptiveOutreachEventInternal = internalMutation({
  args: {
    eventId: v.id("outreachInteractionEvents"),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) return;
    await failAdaptiveOutreachEvent(ctx, event, args.errorMessage);
  },
});
