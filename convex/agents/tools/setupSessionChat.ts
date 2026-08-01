"use node";

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { classifySetupInput } from "../../lib/setupInputClassificationCore";
import { getWorkspaceUseCase } from "../../../shared/lib/workspaceUseCases";
import { runLoggedAgentTool } from "./logging";

export const submitSetupAudience = createTool({
  description:
    "Validate and submit the user's audience-search description for the current setup thread. Call this for a meaningful request to find or reach people. Pass the user's description faithfully; do not invent missing audience details.",
  inputSchema: z.object({
    description: z
      .string()
      .min(1)
      .describe("The user's audience-search description, copied faithfully"),
    sourceUrl: z
      .url()
      .optional()
      .describe("The source website URL when one was supplied with this turn"),
  }),
  execute: async (ctx, args) =>
    runLoggedAgentTool(
      ctx,
      { moduleName: "submitSetupAudience", args },
      async (logEvent) => {
        if (!ctx.threadId) {
          return {
            success: false as const,
            accepted: false as const,
            message:
              "I couldn't identify the active setup conversation. Please refresh and try again.",
          };
        }

        const session = await ctx.runQuery(
          internal.setupSessions.getByThreadIdInternal,
          { threadId: ctx.threadId }
        );
        if (!session) {
          return {
            success: false as const,
            accepted: false as const,
            message:
              "This conversation is not attached to an active setup draft.",
          };
        }

        if (
          session.status !== "draft" &&
          session.status !== "awaiting_input" &&
          session.status !== "failed"
        ) {
          return {
            success: false as const,
            accepted: false as const,
            message:
              "That setup step has already advanced. I'll use the current setup status instead.",
          };
        }

        const classification = await classifySetupInput(args.description);
        logEvent.set({
          ai: {
            model: classification.telemetry.model,
            provider: classification.telemetry.usage.providerSelected ?? null,
            provider_hint: classification.telemetry.providerHint,
            routing: classification.telemetry.routing,
            timeout_ms: classification.telemetry.timeoutMs,
          },
          onboarding: {
            accepted: classification.accepted,
            classification_reason: classification.reason,
            use_case_key: classification.useCaseKey,
          },
        });

        if (ctx.userId) {
          await ctx.runMutation(internal.agentTelemetry.insertUsageEvent, {
            agentName: "Setup Input Classifier",
            model: classification.telemetry.model,
            provider:
              classification.telemetry.usage.providerSelected ?? undefined,
            providerMetadata: classification.telemetry.providerMetadata,
            threadId: ctx.threadId,
            usage: classification.telemetry.usage,
            userId: ctx.userId as Id<"users">,
          });
        }

        if (!classification.accepted) {
          return {
            success: true as const,
            accepted: false as const,
            reason: classification.reason,
            message: classification.userMessage,
          };
        }

        await ctx.runMutation(
          internal.setupSessions.submitSetupInputFromAgentInternal,
          {
            sessionId: session._id,
            inputMode: args.sourceUrl ? "url" : "manual",
            inputValue: classification.normalizedDescription,
            sourceUrl: args.sourceUrl,
            useCaseKey: classification.useCaseKey,
          }
        );

        const useCase = getWorkspaceUseCase(classification.useCaseKey);

        return {
          success: true as const,
          accepted: true as const,
          useCaseKey: classification.useCaseKey,
          displayName: useCase.displayName,
          entityPlural: useCase.entityPlural,
          profileLabelPlural: useCase.profileLabelPlural,
          message: classification.userMessage,
        };
      }
    ),
});

export const reviseSetupAudience = createTool({
  description:
    "Apply the user's requested changes to the generated ideal profiles for the current setup thread. Call only when ideal profiles are awaiting review and the user asks to add, remove, narrow, broaden, or otherwise revise them.",
  inputSchema: z.object({
    feedback: z
      .string()
      .min(1)
      .describe("The user's requested profile changes, copied faithfully"),
  }),
  execute: async (ctx, args) => {
    if (!ctx.threadId) {
      return {
        success: false as const,
        message: "I couldn't identify the active setup conversation.",
      };
    }

    const session = await ctx.runQuery(
      internal.setupSessions.getByThreadIdInternal,
      { threadId: ctx.threadId }
    );
    if (!session || session.status !== "awaiting_icp_confirmation") {
      return {
        success: false as const,
        message: "The ideal profiles are not currently awaiting revision.",
      };
    }

    await ctx.runMutation(
      internal.setupSessions.submitSetupGenerationFeedbackFromAgentInternal,
      {
        sessionId: session._id,
        feedback: args.feedback.trim(),
      }
    );

    return {
      success: true as const,
      message: "The requested changes are being applied to the ideal profiles.",
    };
  },
});
