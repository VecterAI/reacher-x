"use node";

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { classifySetupInput } from "../../lib/setupInputClassificationCore";
import { getWorkspaceUseCase } from "../../../shared/lib/workspaceUseCases";
import { runLoggedAgentTool } from "./logging";
import { getToolPromptMessageId } from "./workspaceMemoryHelpers";

type SetupApprovalToolResult =
  | {
      success: true;
      status: string;
    }
  | {
      success: false;
      status: string | null;
      error: string;
    };

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

        const rawDescription = session.rawUserDescription?.trim();
        if (!rawDescription) {
          return {
            success: false as const,
            accepted: false as const,
            message:
              "I couldn't retrieve the original setup description. Please send it again.",
          };
        }
        const classification = await classifySetupInput(rawDescription);
        const generationSourceMessageId = getToolPromptMessageId(ctx);
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
          };
        }

        await ctx.runMutation(
          internal.setupSessions.submitSetupInputFromAgentInternal,
          {
            sessionId: session._id,
            inputMode: args.sourceUrl ? "url" : "manual",
            inputValue: rawDescription,
            sourceUrl: args.sourceUrl,
            useCaseKey: classification.useCaseKey,
            generationSourceMessageId,
          }
        );

        const useCase = getWorkspaceUseCase(classification.useCaseKey);

        return {
          success: true as const,
          accepted: true as const,
          useCaseKey: classification.useCaseKey,
          displayName: useCase.displayName,
          entityPlural: useCase.entityPlural,
          nextStep: `Generating example ${useCase.entityPlural.toLowerCase()} for review. The panel shows example profiles. Use getSetupTargeting if the user asks about the underlying ICPs.`,
        };
      }
    ),
});

export const reviseSetupAudience = createTool({
  description:
    "Apply the user's requested changes to the generated example profiles for the current setup thread. Call only when example profiles are awaiting review and the user asks to add, remove, narrow, broaden, or otherwise revise them.",
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
        message: "The example profiles are not currently awaiting revision.",
      };
    }

    await ctx.runMutation(
      internal.setupSessions.submitSetupGenerationFeedbackFromAgentInternal,
      {
        sessionId: session._id,
        feedback: args.feedback.trim(),
        generationSourceMessageId: getToolPromptMessageId(ctx),
      }
    );

    return {
      success: true as const,
      message:
        "The requested changes are being applied to the example profiles.",
    };
  },
});

export const approveSetupExamples = createTool({
  description:
    "Approve the currently displayed example profiles for the current setup conversation. Call only after the user explicitly approves those profiles. This promotes only the existing profile set; the improved description is background-only and is never regenerated or edited by this tool.",
  inputSchema: z.object({}),
  execute: async (ctx): Promise<SetupApprovalToolResult> => {
    if (!ctx.threadId || !ctx.userId) {
      return {
        success: false as const,
        status: null,
        error: "No active setup conversation was found.",
      };
    }

    const session: {
      _id: Id<"workspaceSetupSessions">;
      userId: Id<"users">;
      status: string;
      generationRevision?: number;
    } | null = await ctx.runQuery(
      internal.setupSessions.getByThreadIdInternal,
      { threadId: ctx.threadId }
    );
    if (!session || session.userId !== ctx.userId) {
      return {
        success: false as const,
        status: null,
        error: "This conversation is not attached to an active setup draft.",
      };
    }

    if (session.status !== "awaiting_icp_confirmation") {
      return {
        success: false as const,
        status: session.status,
        error: "The examples are not awaiting approval.",
      };
    }

    const result = await ctx.runMutation(
      internal.setupSessions.approveSetupExamplesFromAgentInternal,
      {
        sessionId: session._id,
        userId: session.userId,
        generationRevision: session.generationRevision ?? 0,
      }
    );
    return { success: result.success, status: result.status };
  },
});

type SetupTargetingResult =
  | { success: false; error: string }
  | {
      success: true;
      status: string;
      generationRevision?: number;
      profiles: Array<
        Pick<
          NonNullable<Doc<"workspaces">["icps"]>[number],
          | "title"
          | "description"
          | "painPoints"
          | "channels"
          | "syntheticExamples"
        >
      >;
      targetingSpec: Doc<"workspaces">["targetingSpec"] | null;
    };

/** Read the current thread's saved targeting; never accept model-supplied IDs. */
export const getSetupTargeting = createTool({
  description:
    "Read the actual saved ideal profiles and targeting criteria for this setup conversation. Use when the user asks about the ICPs, target audience, or why the examples fit. Do not infer a replacement audience when answering.",
  inputSchema: z.object({}),
  execute: async (ctx): Promise<SetupTargetingResult> => {
    if (!ctx.threadId || !ctx.userId)
      return { success: false, error: "No active setup conversation." };
    const session = await ctx.runQuery(
      internal.setupSessions.getByThreadIdInternal,
      { threadId: ctx.threadId }
    );
    if (!session || session.userId !== ctx.userId)
      return { success: false, error: "Setup conversation not found." };
    const workspace =
      session.status === "ready" && session.targetWorkspaceId
        ? await ctx.runQuery(internal.workspaces.getById, {
            workspaceId: session.targetWorkspaceId,
          })
        : null;
    const currentWorkspace =
      workspace?.userId === ctx.userId ? workspace : null;
    return {
      success: true,
      status: session.status,
      generationRevision: session.generationRevision,
      profiles: (currentWorkspace?.icps ?? session.generatedProfiles ?? []).map(
        ({ title, description, painPoints, channels, syntheticExamples }) => ({
          title,
          description,
          painPoints,
          channels,
          syntheticExamples,
        })
      ),
      targetingSpec:
        currentWorkspace?.targetingSpec ?? session.targetingSpec ?? null,
    };
  },
});
