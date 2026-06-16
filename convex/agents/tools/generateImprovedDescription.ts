"use node";

// convex/agents/tools/generateImprovedDescription.ts
// Generates improved business description and ICPs from seed description

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { robustGenerateObject } from "../../lib/ai";
import { buildProfileGenerationPrompt } from "../prompts";
import { icpSchema, type ICP } from "./schemas";
import { resolveSetupThreadState } from "./workspaceSetupContext";
import { getWorkspaceUseCase } from "../../../shared/lib/workspaceUseCases";
import { runLoggedAgentTool } from "./logging";

// ============================================================================
// Schemas
// ============================================================================

const improvedDescriptionAndIcpsSchema = z.object({
  improvedDescription: z
    .string()
    .describe(
      "An improved, clear, and compelling business description (2-3 sentences)"
    ),
  icps: z
    .array(icpSchema)
    .min(2)
    .max(4)
    .describe("2-4 distinct Ideal Customer Profile segments"),
});

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
  args: z.object({
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
  handler: async (ctx, args): Promise<GenerateImprovedDescriptionResult> =>
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
        const useCase = getWorkspaceUseCase(setupThreadState?.useCaseKey);
        const systemPrompt = buildProfileGenerationPrompt(
          setupThreadState?.useCaseKey
        );

        const userPrompt = `Improve this business description and create 2-4 ${useCase.profileLabelPlural}:

**Original Description:**
${args.seedDescription}

${args.targetAudience?.length ? `**Known Target Audience:** ${args.targetAudience.join(", ")}` : ""}

${args.keyProblems?.length ? `**Problems Solved:** ${args.keyProblems.join(", ")}` : ""}

Create:
1. A clear, compelling improved description (2-3 sentences)
2. 2-4 distinct profiles with pain points and preferred social channels`;

        try {
          const { object, model } = await robustGenerateObject({
            operation: "generateImprovedDescriptionAndICPs",
            schema: improvedDescriptionAndIcpsSchema,
            system: systemPrompt,
            prompt: userPrompt,
            temperature: 0.6,
            maxRetries: 2,
            routing: "fast",
          });

          logEvent.set({
            ai: {
              model,
            },
            onboarding: {
              icp_count: object.icps.length,
            },
          });

          return {
            success: true,
            improvedDescription: object.improvedDescription,
            icps: object.icps,
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          logEvent.error(error);
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
