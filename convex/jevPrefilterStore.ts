// Read-only flag lookup and persistence for Jev pre-filter shadow events.
// The shadow events table is measurement-only and never read by the
// qualification pipeline.

import { v } from "convex/values";
import { env } from "./_generated/server";
import { internalMutation, internalQuery } from "./lib/functionBuilders";
import {
  jevPrefilterDecisionValidator,
  qualificationStatusValidator,
} from "./validators";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";

export const getJevPrefilterModeInternal = internalQuery({
  args: {},
  handler: () => {
    return env.JEV_PREFILTER_MODE?.trim() === "shadow" ? "shadow" : "off";
  },
});

export const recordJevPrefilterShadowEventInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    decision: jevPrefilterDecisionValidator,
    reasons: v.array(v.string()),
    botProbability: v.optional(v.number()),
    model: v.string(),
    costUsd: v.number(),
    latencyMs: v.number(),
    storedQualificationStatus: v.optional(qualificationStatusValidator),
  },
  handler: (ctx, args) => {
    return ctx.db.insert("jevPrefilterShadowEvents", {
      ...args,
      createdAt: getCurrentUTCTimestamp(),
    });
  },
});
