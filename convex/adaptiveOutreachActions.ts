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
import { runWithWorkspaceMemoryCompliance } from "./lib/workspaceMemoryCompliance";

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

    const adaptivePrompt = buildAdaptiveOutreachPrompt({
      ...context,
      interactionHistory,
    });
    const workspaceMemoryContext = await ctx.runAction(
      internal.memory.buildWorkspaceMemoryContextInternal,
      {
        workspaceId: context.event.workspaceId,
        userId: context.event.userId,
        prospectId: context.event.prospectId,
        surface: "adaptive_outreach",
        channel:
          context.prospect.platform === "linkedin" ? "linkedin" : "twitter",
        query: [
          context.prospect.displayName ?? "",
          context.prospect.title ?? "",
          context.event.responseText ?? "",
          context.event.channel,
        ]
          .filter(Boolean)
          .join(" "),
      }
    );
    const adaptiveSystem = [
      "You autonomously maintain an outreach plan as new social interactions arrive. Make a concrete next-step decision grounded in the full conversation. Never repeat completed outreach.",
      workspaceMemoryContext.prompt,
    ]
      .filter(Boolean)
      .join("\n\n");
    const generateAdaptiveCandidate = async (repairInstruction?: string) =>
      await outreachAgent.generateObject(
        ctx,
        { userId: String(context.event.userId) },
        {
          schema: adaptiveOutreachDecisionTransportSchema,
          system: adaptiveSystem,
          prompt: repairInstruction
            ? `${adaptivePrompt}\n\nThe previous candidate violated workspace policy. Regenerate the complete object with this repair: ${repairInstruction}`
            : adaptivePrompt,
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
    const complianceResult = await runWithWorkspaceMemoryCompliance<
      Awaited<ReturnType<typeof generateAdaptiveCandidate>>
    >({
      instructions: workspaceMemoryContext.complianceInstructions,
      taskContext: adaptivePrompt,
      maxAttempts: 2,
      serialize: (result) => JSON.stringify(result.object),
      generate: generateAdaptiveCandidate,
    });
    const generated = complianceResult.value;

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
