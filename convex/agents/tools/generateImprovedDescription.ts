"use node";

// convex/agents/tools/generateImprovedDescription.ts
// Generates improved business description and ICPs from seed description

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { getRoutingTelemetry } from "../../lib/ai";
import { generateSetupDraft } from "../../lib/setupGenerationCore";
import type { ICP } from "./schemas";
import { resolveSetupThreadState } from "./workspaceSetupContext";
import { runLoggedAgentTool } from "./logging";

// ============================================================================
// Types
// ============================================================================

export interface GenerateImprovedDescriptionResult {
  success: boolean;
  improvedDescription?: string;
  icps?: ICP[];
  error?: string;
}

// ============================================================================
// Tool
// ============================================================================

/**
 * Generates an improved business description and Ideal Customer Profiles (ICPs).
 *
 * Use this tool after:
 * - Analyzing a URL with analyzeUrl tool
 * - Receiving a manual description from the user
 *
 * The tool takes the raw/seed description and:
 * 1. Improves it to be clear, compelling, and concise
 * 2. Generates 2-4 ICP segments with pain points and channels
 */
export const generateImprovedDescriptionAndICPs = createTool({
  description:
    "Generate an improved business description and Ideal Customer Profiles (ICPs) from a seed description. Use this after analyzing a URL or receiving a manual description from the user.",
  inputSchema: z.object({
    seedDescription: z
      .string()
      .min(10)
      .describe("The original/raw business description to improve"),
    targetAudience: z
      .array(z.string())
      .optional()
      .describe("Optional: Known target audience segments from URL analysis"),
    keyProblems: z
      .array(z.string())
      .optional()
      .describe(
        "Optional: Known problems the business solves from URL analysis"
      ),
  }),
  execute: async (ctx, args): Promise<GenerateImprovedDescriptionResult> =>
    runLoggedAgentTool(
      ctx,
      {
        moduleName: "generateImprovedDescriptionAndICPs",
        args,
      },
      async (logEvent) => {
        const setupThreadState = await resolveSetupThreadState(
          ctx,
          ctx.threadId
        );
        const routingTelemetry = getRoutingTelemetry("onboarding");

        try {
          const generation = await generateSetupDraft({
            operation: "generateImprovedDescriptionAndICPs",
            keyProblems: args.keyProblems,
            seedDescription: args.seedDescription,
            targetAudience: args.targetAudience,
            useCaseKey: setupThreadState?.useCaseKey,
          });

          logEvent.set({
            ai: {
              model: generation.telemetry.model,
              provider: generation.telemetry.usage.providerSelected ?? null,
              provider_hint: generation.telemetry.providerHint,
              routing: generation.telemetry.routing,
              timeout_ms: generation.telemetry.timeoutMs,
            },
            onboarding: {
              icp_count: generation.icps.length,
            },
          });

          return {
            success: true,
            improvedDescription: generation.improvedDescription,
            icps: generation.icps,
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          logEvent.error(error, {
            ai: {
              provider_hint: routingTelemetry.providerLabel,
              routing: "onboarding",
              timeout_ms: routingTelemetry.timeoutMs,
            },
          });
          return {
            success: false,
            error: `Failed to generate improved description and ICPs: ${errorMessage}`,
          };
        }
      }
    ),
});

// Export with shorter alias for convenience
export { generateImprovedDescriptionAndICPs as generateImproved };
