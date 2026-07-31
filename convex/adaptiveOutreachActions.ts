"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { outreachAgent } from "./agents/outreach";
import { internalAction } from "./lib/functionBuilders";
import {
  adaptiveOutreachDecisionTransportSchema,
  buildAdaptiveOutreachPrompt,
  parseAdaptiveOutreachDecision,
  type AdaptiveOutreachDecision,
} from "./lib/adaptiveOutreachCore";
import { persistRawModelResponse } from "./lib/modelTelemetry";

export const generateAdaptiveOutreachDecisionInternal = internalAction({
  args: {
    eventId: v.id("outreachInteractionEvents"),
  },
  handler: async (ctx, args): Promise<AdaptiveOutreachDecision> => {
    const context = await ctx.runQuery(
      internal.adaptiveOutreach.getAdaptiveOutreachContextInternal,
      args
    );
    if (!context) {
      throw new Error("Adaptive outreach context is unavailable.");
    }

    const interactionHistory = await ctx.runQuery(
      internal.interactions.getProspectInteractionHistoryInternal,
      {
        userId: context.event.userId,
        prospectId: context.event.prospectId,
        platform: context.prospect.platform,
        kinds: ["dm", "comment", "reply"],
        direction: "all",
        limit: 30,
      }
    );

    const generated = await outreachAgent.generateObject(
      ctx,
      { userId: String(context.event.userId) },
      {
        schema: adaptiveOutreachDecisionTransportSchema,
        system:
          "You autonomously maintain an outreach plan as new social interactions arrive. Make a concrete next-step decision grounded in the full conversation. Never repeat completed outreach.",
        prompt: buildAdaptiveOutreachPrompt({
          ...context,
          interactionHistory,
        }),
        maxOutputTokens: 2_500,
      },
      {
        storageOptions: { saveMessages: "none" },
        contextOptions: {
          recentMessages: 0,
          searchOtherThreads: false,
          searchOptions: {
            limit: 0,
            textSearch: false,
            vectorSearch: false,
          },
        },
      }
    );

    await persistRawModelResponse(ctx, {
      userId: String(context.event.userId),
      agentName: "Adaptive Outreach Agent",
      request: generated.request,
      response: generated.response,
      providerMetadata: generated.providerMetadata,
    });

    return parseAdaptiveOutreachDecision(generated.object, context.event);
  },
});
