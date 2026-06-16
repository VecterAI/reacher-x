"use node";

// convex/agents/tools/analyzeUrl.ts
// URL analysis tool using Exa SDK

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { robustGenerateObject } from "../../lib/ai";
import { URL_ANALYSIS_PROMPT } from "../prompts";
import { getCurrentUTCTimestamp } from "../../../shared/lib/utils/time/timeUtils";
import { normalizeWorkspaceNameForSuggestion } from "../../lib/workspaceNameHelpers";
import { describeUrl } from "../../../shared/lib/urls/describeUrl";
import type { ConvexWideEventLogger } from "../../lib/wideEventLogger";
import { runLoggedAgentTool } from "./logging";

// ============================================================================
// Schemas
// ============================================================================

const businessAnalysisSchema = z.object({
  businessName: z
    .string()
    .describe("The name of the business, product, or service"),
  description: z
    .string()
    .describe(
      "A clear, concise description of what the business/product/service does (2-3 sentences)"
    ),
  targetAudience: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe("Types of people or organizations who are the best fit"),
  keyProblems: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe(
      "Problems, needs, or motivations relevant to the target audience"
    ),
  uniqueValue: z
    .string()
    .describe("What makes this offering unique or different"),
});

async function getUrlContent(
  url: string,
  logEvent: ConvexWideEventLogger
): Promise<{
  success: boolean;
  content?: string;
  title?: string;
  error?: string;
}> {
  const startTime = getCurrentUTCTimestamp();

  try {
    const result = await describeUrl(url);
    if (!result.success) {
      logEvent.warn("Failed to fetch URL content", {
        url_analysis: {
          duration_ms: getCurrentUTCTimestamp() - startTime,
          error: result.error,
          url,
        },
      });
      return {
        success: false,
        error: result.error,
      };
    }

    logEvent.set({
      url_analysis: {
        content_length: result.content.length,
        duration_ms: getCurrentUTCTimestamp() - startTime,
        title: result.title,
        url,
      },
    });

    return {
      success: true,
      content: result.content,
      title: result.title,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Network error";
    logEvent.warn("URL fetch threw before analysis", {
      url_analysis: {
        duration_ms: getCurrentUTCTimestamp() - startTime,
        error: errorMessage,
        url,
      },
    });
    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// Tool
// ============================================================================

/**
 * Analyzes a URL to extract business information.
 * Uses Exa SDK for content extraction and AI for analysis.
 */
export const analyzeUrl = createTool({
  description:
    "Analyze a website URL to extract business information including name, description, target audience, and key problems solved. Use this when a user provides their website URL.",
  inputSchema: z.object({
    url: z.string().url().describe("The website URL to analyze"),
  }),
  execute: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    businessName?: string;
    seedDescription?: string;
    targetAudience?: string[];
    keyProblems?: string[];
    uniqueValue?: string;
    error?: string;
  }> =>
    runLoggedAgentTool(
      ctx,
      {
        moduleName: "analyzeUrl",
        args,
        includeArgKeys: ["url"],
      },
      async (logEvent) => {
        const contentResult = await getUrlContent(args.url, logEvent);

        if (!contentResult.success || !contentResult.content) {
          return {
            success: false,
            error: contentResult.error || "Could not fetch URL content",
          };
        }

        const userPrompt = `Analyze this website content and extract business information:

**Website URL:** ${args.url}
**Page Title:** ${contentResult.title || "Unknown"}
**Website Content:**
${contentResult.content}

Extract the business/product name, description, target audience, key problems solved, and unique value proposition.`;

        try {
          const { object, model } = await robustGenerateObject({
            operation: "analyzeUrl",
            schema: businessAnalysisSchema,
            system: URL_ANALYSIS_PROMPT,
            prompt: userPrompt,
            temperature: 0.5,
            maxRetries: 2,
            routing: "fast",
          });

          logEvent.set({
            ai: {
              model,
            },
            business: {
              name: object.businessName,
              target_audience_count: object.targetAudience.length,
            },
          });

          return {
            success: true,
            businessName: normalizeWorkspaceNameForSuggestion(
              object.businessName,
              contentResult.title || "Workspace"
            ),
            seedDescription: object.description,
            targetAudience: object.targetAudience,
            keyProblems: object.keyProblems,
            uniqueValue: object.uniqueValue,
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          logEvent.error(error, {
            url_analysis: {
              url: args.url,
            },
          });
          return {
            success: false,
            error: `Failed to analyze URL: ${errorMessage}`,
          };
        }
      }
    ),
});
