"use node";

import type { ProviderMetadata } from "ai";
import { z } from "zod";
import { describeUrl } from "../../shared/lib/urls/describeUrl";
import { URL_ANALYSIS_PROMPT } from "../agents/prompts";
import { extractUsage, getRoutingTelemetry, robustGenerateObject } from "./ai";
import { normalizeWorkspaceNameForSuggestion } from "./workspaceNameHelpers";

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

type SetupUrlAnalysisUsage = ReturnType<typeof extractUsage>;

export type SetupUrlAnalysisTelemetry = {
  contentLength: number;
  model: string;
  pageTitle: string | null;
  providerHint: string;
  providerMetadata?: ProviderMetadata;
  routing: "onboarding";
  timeoutMs: number;
  usage: SetupUrlAnalysisUsage;
  url: string;
  request: {
    prompt: string;
    system: string;
  };
  response: {
    businessName: string;
    keyProblemCount: number;
    targetAudienceCount: number;
    uniqueValue: string;
  };
};

export type SetupUrlAnalysis = {
  businessName: string;
  keyProblems: string[];
  seedDescription: string;
  targetAudience: string[];
  telemetry: SetupUrlAnalysisTelemetry;
  uniqueValue: string;
};

export async function analyzeSetupUrl(args: {
  operation?: string;
  url: string;
}): Promise<SetupUrlAnalysis> {
  const contentResult = await describeUrl(args.url);

  if (!contentResult.success) {
    throw new Error(contentResult.error || "Could not fetch URL content");
  }

  if (!contentResult.content) {
    throw new Error("Could not fetch URL content");
  }

  const prompt = `Analyze this website content and extract business information:

**Website URL:** ${args.url}
**Page Title:** ${contentResult.title || "Unknown"}
**Website Content:**
${contentResult.content}

Extract the business/product name, description, target audience, key problems solved, and unique value proposition.`;
  const routing = "onboarding" as const;
  const routingTelemetry = getRoutingTelemetry(routing);
  const { object, model, usage, providerMetadata } = await robustGenerateObject(
    {
      operation: args.operation ?? "analyzeUrl",
      schema: businessAnalysisSchema,
      system: URL_ANALYSIS_PROMPT,
      prompt,
      temperature: 0.5,
      maxRetries: 2,
      routing,
    }
  );

  return {
    businessName: normalizeWorkspaceNameForSuggestion(
      object.businessName,
      contentResult.title || "Workspace"
    ),
    keyProblems: object.keyProblems,
    seedDescription: object.description,
    targetAudience: object.targetAudience,
    telemetry: {
      contentLength: contentResult.content.length,
      model,
      pageTitle: contentResult.title || null,
      providerHint: routingTelemetry.providerLabel,
      providerMetadata: providerMetadata as ProviderMetadata | undefined,
      routing,
      timeoutMs: routingTelemetry.timeoutMs,
      usage,
      url: args.url,
      request: {
        prompt,
        system: URL_ANALYSIS_PROMPT,
      },
      response: {
        businessName: object.businessName,
        keyProblemCount: object.keyProblems.length,
        targetAudienceCount: object.targetAudience.length,
        uniqueValue: object.uniqueValue,
      },
    },
    uniqueValue: object.uniqueValue,
  };
}
