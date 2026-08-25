"use node";

// convex/agents/tools/analyzeUrl.ts
// URL analysis tool using Exa SDK

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { getRoutingTelemetry } from "../../lib/ai";
import { analyzeSetupUrl } from "../../lib/setupUrlAnalysisCore";
import { runLoggedAgentTool } from "./logging";

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
    url: z.url().describe("The website URL to analyze"),
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
        const routingTelemetry = getRoutingTelemetry("onboarding");

        try {
          const analysis = await analyzeSetupUrl({
            operation: "analyzeUrl",
            url: args.url,
          });

          logEvent.set({
            url_analysis: {
              content_length: analysis.telemetry.contentLength,
              title: analysis.telemetry.pageTitle,
              url: analysis.telemetry.url,
            },
            ai: {
              model: analysis.telemetry.model,
              provider: analysis.telemetry.usage.providerSelected ?? null,
              provider_hint: analysis.telemetry.providerHint,
              routing: analysis.telemetry.routing,
              timeout_ms: analysis.telemetry.timeoutMs,
            },
            business: {
              name: analysis.businessName,
              target_audience_count: analysis.targetAudience.length,
            },
          });

          return {
            success: true,
            businessName: analysis.businessName,
            seedDescription: analysis.seedDescription,
            targetAudience: analysis.targetAudience,
            keyProblems: analysis.keyProblems,
            uniqueValue: analysis.uniqueValue,
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
