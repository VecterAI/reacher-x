"use node";

// convex/agents/tools/analyzeUrl.ts
// URL analysis tool using Exa SDK

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import Exa from "exa-js";
import { robustGenerateObject } from "../../lib/ai";
import { URL_ANALYSIS_PROMPT } from "../prompts";
import { getCurrentUTCTimestamp } from "../../../shared/lib/utils/time/timeUtils";
import { normalizeWorkspaceNameForSuggestion } from "../../lib/workspaceNameHelpers";

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

// ============================================================================
// Helpers
// ============================================================================

function createExaClient(): Exa {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    throw new Error("[Exa] Missing EXA_API_KEY environment variable");
  }
  return new Exa(apiKey);
}

async function getUrlContent(url: string): Promise<{
  success: boolean;
  content?: string;
  title?: string;
  error?: string;
}> {
  const startTime = getCurrentUTCTimestamp();

  try {
    const exa = createExaClient();

    console.info("[getUrlContent] Fetching URL:", url);

    const result = await exa.getContents([url], {
      text: true,
      livecrawl: "preferred",
    });

    const page = result.results?.[0];

    if (!page?.text || page.text.trim().length < 50) {
      console.warn(
        "[getUrlContent] Insufficient content from URL:",
        url,
        "length:",
        page?.text?.length || 0,
        "in",
        getCurrentUTCTimestamp() - startTime,
        "ms"
      );
      return {
        success: false,
        error: "Could not extract sufficient content from URL",
      };
    }

    // Truncate for LLM context limits
    const maxChars = 8000;
    const content =
      page.text.length > maxChars ? page.text.slice(0, maxChars) : page.text;

    console.info(
      "[getUrlContent] Fetched",
      content.length,
      "chars from",
      url,
      "in",
      getCurrentUTCTimestamp() - startTime,
      "ms"
    );

    return {
      success: true,
      content,
      title: page.title ?? undefined,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Network error";
    console.error(
      "[getUrlContent] Failed to fetch URL:",
      url,
      "error:",
      errorMessage,
      "in",
      getCurrentUTCTimestamp() - startTime,
      "ms"
    );
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
  args: z.object({
    url: z.string().url().describe("The website URL to analyze"),
  }),
  handler: async (
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
  }> => {
    // Step 1: Fetch content from URL
    const contentResult = await getUrlContent(args.url);

    if (!contentResult.success || !contentResult.content) {
      return {
        success: false,
        error: contentResult.error || "Could not fetch URL content",
      };
    }

    // Step 2: Analyze with AI using robust structured output
    const userPrompt = `Analyze this website content and extract business information:

**Website URL:** ${args.url}
**Page Title:** ${contentResult.title || "Unknown"}
**Website Content:**
${contentResult.content}

Extract the business/product name, description, target audience, key problems solved, and unique value proposition.`;

    try {
      // Use robustGenerateObject which has retry logic and model fallbacks
      const { object, model } = await robustGenerateObject({
        operation: "analyzeUrl",
        schema: businessAnalysisSchema,
        system: URL_ANALYSIS_PROMPT,
        prompt: userPrompt,
        temperature: 0.5,
        maxRetries: 2,
      });

      console.info(
        "[analyzeUrl] Analysis complete using",
        model,
        "business:",
        object.businessName
      );

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
      return {
        success: false,
        error: `Failed to analyze URL: ${errorMessage}`,
      };
    }
  },
});
