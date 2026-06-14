import { v } from "convex/values";
import { internalMutation, query } from "./lib/functionBuilders";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import {
  sanitizeProviderMetadataForConvex,
  sanitizeUsageSnapshotForConvex,
  sanitizeTelemetryPayload,
} from "./lib/agentMetadata";

export const insertUsageEvent = internalMutation({
  args: {
    userId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    agentName: v.optional(v.string()),
    model: v.optional(v.string()),
    provider: v.optional(v.string()),
    usage: v.any(),
    providerMetadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentUsageEvents", {
      userId: args.userId,
      threadId: args.threadId,
      agentName: args.agentName,
      model: args.model,
      provider: args.provider,
      usage: sanitizeUsageSnapshotForConvex(args.usage),
      providerMetadata: sanitizeProviderMetadataForConvex(
        args.providerMetadata
      ),
      recordedAt: getCurrentUTCTimestamp(),
    });
  },
});

export const getThreadModelName = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("agentUsageEvents")
      .withIndex("by_thread_recorded_at", (q) =>
        q.eq("threadId", args.threadId)
      )
      .order("desc")
      .first();

    return event?.model ?? null;
  },
});

export const insertRawResponse = internalMutation({
  args: {
    userId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    agentName: v.optional(v.string()),
    request: v.optional(v.any()),
    response: v.optional(v.any()),
    providerMetadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentRawResponses", {
      ...args,
      request: sanitizeTelemetryPayload(args.request),
      response: sanitizeTelemetryPayload(args.response),
      providerMetadata: sanitizeProviderMetadataForConvex(
        args.providerMetadata
      ),
      recordedAt: getCurrentUTCTimestamp(),
    });
  },
});
