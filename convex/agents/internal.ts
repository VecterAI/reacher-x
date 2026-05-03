"use node";

// convex/agents/internal.ts
// Internal actions for AI-powered keyword generation
// These are called by both standalone tools and the searchProspects orchestrator

import { internalAction } from "../lib/functionBuilders";
import { v } from "convex/values";
import { z } from "zod";
import { internal } from "../_generated/api";
import { robustGenerateObject } from "../lib/ai";
import {
  prospectPlatformValidator,
  workspaceUseCaseKeyValidator,
} from "../validators";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { getWorkspaceUseCase } from "../../shared/lib/workspaceUseCases";

// ============================================================================
// Schemas
// ============================================================================

const prospectingKeywordsSchema = z.object({
  keywords: z.array(z.string()).min(5).max(20),
  reasoning: z.string(),
});

const socialQueryItemSchema = z.object({
  query: z.string().max(40),
  sourceKeyword: z.string().optional(),
});

const socialQueriesSchema = z.object({
  twitterQueries: z.array(socialQueryItemSchema).max(15),
  linkedinPostQueries: z.array(socialQueryItemSchema).max(15),
  linkedinPeopleQueries: z.array(socialQueryItemSchema).max(15),
  reasoning: z.string(),
});

type GeneratedSocialQuery = z.infer<typeof socialQueryItemSchema>;
type SocialQueryMetadata = {
  query: string;
  sourceKeyword?: string;
  platformTargets: Array<"twitter" | "linkedin">;
  linkedinSurface?: "posts" | "people";
  linkedinSurfaceTargets?: Array<"posts" | "people">;
  queryStyle: "natural_phrase" | "professional_keyword" | "role_title";
  legacyCompatibilitySource: boolean;
};

function dedupeQueryItems(items: GeneratedSocialQuery[]) {
  const seen = new Set<string>();
  const deduped: GeneratedSocialQuery[] = [];

  for (const item of items) {
    const query = item.query.trim();
    if (!query) continue;
    const key = query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({
      query,
      sourceKeyword: item.sourceKeyword?.trim() || undefined,
    });
  }

  return deduped;
}

type DiscoveryGenerationContext = {
  topPerformers: Array<{
    canonicalValue: string;
    prospectsFound: number;
    qualifiedCount: number;
    convertedCount: number;
    replyCount: number;
    replyRate: number;
    qualificationRate: number;
  }>;
  activeQueryCount: number;
  rejectionSummary: {
    exactDuplicates: number;
    semanticDuplicates: number;
    lowNovelty: number;
  };
  recentRejected: Array<{
    rawValue: string;
    sourceTheme?: string;
    status: string;
    duplicateReason?: string;
    noveltyScore: number | null;
  }>;
  retired: Array<{
    rawValue: string;
    sourceTheme?: string;
    retiredAt: number | null;
  }>;
  promotedDiscoveryMemories: Array<{
    type: string;
    title: string;
    summary: string;
    confidence: number;
    impactScore: number;
  }>;
  recentWinningProspects: Array<{
    displayName: string;
    title: string | null;
    briefIntro: string | null;
    matchedKeywords: string[];
    qualificationScore: number | null;
  }>;
};

function formatDiscoveryContextBlock(
  context: DiscoveryGenerationContext | null
): string {
  if (!context) {
    return "";
  }

  const sections: string[] = [];

  if (context.topPerformers.length > 0) {
    sections.push(
      `Top performing live queries:\n${context.topPerformers
        .map(
          (item) =>
            `- "${item.canonicalValue}" | found ${item.prospectsFound}, qualified ${item.qualifiedCount}, replies ${item.replyCount}, conversions ${item.convertedCount}`
        )
        .join("\n")}`
    );
  }

  if (context.promotedDiscoveryMemories.length > 0) {
    sections.push(
      `Promoted discovery lessons:\n${context.promotedDiscoveryMemories
        .map(
          (item) =>
            `- ${item.title}: ${item.summary} (confidence ${item.confidence.toFixed(2)})`
        )
        .join("\n")}`
    );
  }

  if (context.recentRejected.length > 0) {
    sections.push(
      `Recent rejected or duplicate-heavy queries:\n${context.recentRejected
        .map(
          (item) =>
            `- "${item.rawValue}" | ${item.status}${item.duplicateReason ? ` (${item.duplicateReason})` : ""}`
        )
        .join("\n")}`
    );
  }

  if (context.retired.length > 0) {
    sections.push(
      `Recently retired queries:\n${context.retired
        .map((item) => `- "${item.rawValue}"`)
        .join("\n")}`
    );
  }

  if (context.recentWinningProspects.length > 0) {
    sections.push(
      `Recent winning prospect descriptions:\n${context.recentWinningProspects
        .map((item) => {
          const intro = item.briefIntro ?? item.title ?? item.displayName;
          return `- ${item.displayName}: ${intro}`;
        })
        .join("\n")}`
    );
  }

  sections.push(
    `Discovery duplicate pressure: exact=${context.rejectionSummary.exactDuplicates}, semantic=${context.rejectionSummary.semanticDuplicates}, low_novelty=${context.rejectionSummary.lowNovelty}, active_live_queries=${context.activeQueryCount}`
  );

  return sections.length > 0
    ? `\n**Operational memory context:**\n${sections.join("\n\n")}`
    : "";
}

// ============================================================================
// Generate Prospecting Keywords from Synthetic Posts
// ============================================================================

function buildProspectingKeywordsPrompt(useCaseKey?: unknown) {
  const useCase = getWorkspaceUseCase(useCaseKey);

  return `You are an expert at extracting search keywords from social media posts for ${useCase.displayName}.

Your task is to analyze synthetic posts (realistic examples of what target ${useCase.entityPlural.toLowerCase()} would write) and extract keywords or phrases that can be used to find similar posts on Twitter and LinkedIn.

Use this search framing: ${useCase.promptContext.searchIntent}

Extract keywords that:
1. Capture the essence of the pain point, intent signal, or fit signal expressed
2. Are short phrases (2-5 words, max 40 characters)
3. Would match real posts from likely ${useCase.entityPlural.toLowerCase()}
4. Are specific enough to filter out irrelevant results

Focus on:
- Problem-aware keywords
- Outcome-seeking keywords
- Frustration expressions
- Action phrases
- Signals aligned with this workspace's qualification lens: ${useCase.promptContext.qualificationLens}

You may receive operational memory about what is already working, duplicated, exhausted, or recently retired.
Treat that memory as a hard constraint:
- prefer uncovered themes over already-saturated phrases
- do not regenerate obvious variants of queries that already exist
- avoid broad filler wording when memory shows it underperforms

Do NOT extract:
- Generic filler words
- Complete sentences
- Overly broad terms`;
}

export const generateProspectingKeywordsAction = internalAction({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    syntheticPosts: v.array(v.string()),
    businessContext: v.optional(v.string()),
    useCaseKey: v.optional(workspaceUseCaseKeyValidator),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    prospectingKeywords?: string[];
    reasoning?: string;
    error?: string;
  }> => {
    const startTime = getCurrentUTCTimestamp();

    console.info(
      "[generateProspectingKeywords] Starting with",
      args.syntheticPosts.length,
      "synthetic posts"
    );

    const discoveryContext = args.workspaceId
      ? ((await ctx.runQuery(
          internal.memory.getDiscoveryGenerationContextInternal,
          {
            workspaceId: args.workspaceId,
          }
        )) as DiscoveryGenerationContext)
      : null;

    const userPrompt = `Extract prospecting keywords from these synthetic posts.

**Synthetic Posts (realistic examples of what prospects would write):**
${args.syntheticPosts.map((post, i) => `${i + 1}. "${post}"`).join("\n")}

${args.businessContext ? `**Business context:**\n${args.businessContext}` : ""}
${formatDiscoveryContextBlock(discoveryContext)}

Extract 10-15 unique keywords or short phrases that:
1. Capture pain points expressed in these posts
2. Would help find similar posts on social media
3. Are short and searchable (2-5 words, max 40 characters each)
4. Are varied - don't repeat similar concepts

Focus on extracting the core problem/need expressions from each post.
Only return net-new keywords in uncovered themes when memory indicates existing themes are already saturated.`;

    try {
      const { object, model } = await robustGenerateObject({
        operation: "generateProspectingKeywords",
        schema: prospectingKeywordsSchema,
        system: buildProspectingKeywordsPrompt(args.useCaseKey),
        prompt: userPrompt,
        temperature: 0.7,
        maxRetries: 2,
      });

      const durationMs = getCurrentUTCTimestamp() - startTime;

      console.info(
        "[generateProspectingKeywords] Generated",
        object.keywords.length,
        "keywords using",
        model,
        "in",
        durationMs,
        "ms"
      );

      return {
        success: true,
        prospectingKeywords: object.keywords,
        reasoning: object.reasoning,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      console.error(
        "[generateProspectingKeywords] Failed:",
        errorMessage,
        "after",
        getCurrentUTCTimestamp() - startTime,
        "ms"
      );

      return {
        success: false,
        error: `Failed to generate keywords: ${errorMessage}`,
      };
    }
  },
});

// ============================================================================
// Convert to Social Queries
// ============================================================================

function buildSocialQueryPrompt(useCaseKey?: unknown) {
  const useCase = getWorkspaceUseCase(useCaseKey);

  return `You are an expert at social media language and targeted discovery for ${useCase.displayName}.

Your task is to convert search keywords into platform-specific discovery queries that would match likely ${useCase.entityPlural.toLowerCase()}.

Use this search framing: ${useCase.promptContext.searchIntent}

**CRITICAL: CHARACTER LIMIT**
Every query MUST be 40 characters or less. Count the characters before including each query.
Queries longer than 40 characters will NOT return results on social platforms.
Aim for 25-40 characters. Shorter is better for search matching.

Return three separate groups:
1. twitterQueries
- Natural first-person phrasing
- Conversational, emotional, post-like wording
- Frustration, intent, recommendation, or help-seeking language

2. linkedinPostQueries
- Short professional or topical phrases
- Problem, stack, role, function, tooling, workflow, or OSS signals
- Better suited for post discovery than exact natural-language sentence matching

3. linkedinPeopleQueries
- Short role/title style phrases
- Hiring-oriented terms such as job titles, specialties, or seniority variants
- Examples: "frontend developer", "staff frontend engineer", "react native developer"

Each query should:
- Be MAXIMUM 40 characters
- Be short and high-signal
- Avoid duplicates across all groups
- Stay specific to this workspace's qualification lens

The qualification lens for this workspace is: ${useCase.promptContext.qualificationLens}`;
}

export const convertToSocialQueriesAction = internalAction({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    keywords: v.array(v.string()),
    platforms: v.array(prospectPlatformValidator),
    businessContext: v.optional(v.string()),
    useCaseKey: v.optional(workspaceUseCaseKeyValidator),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    socialQueries?: string[];
    queriesByPlatform?: {
      twitter: string[];
      linkedin: {
        posts: string[];
        people: string[];
      };
    };
    queryMetadata?: SocialQueryMetadata[];
    reasoning?: string;
    error?: string;
  }> => {
    const startTime = getCurrentUTCTimestamp();

    console.info(
      "[convertToSocialQueries] Starting with",
      args.keywords.length,
      "keywords for",
      args.platforms.join(", ")
    );

    const includeTwitter = args.platforms.includes("twitter");
    const includeLinkedIn = args.platforms.includes("linkedin");
    const platformContext =
      includeTwitter && includeLinkedIn
        ? "Twitter and LinkedIn"
        : includeTwitter
          ? "Twitter/X"
          : "LinkedIn";

    const discoveryContext = args.workspaceId
      ? ((await ctx.runQuery(
          internal.memory.getDiscoveryGenerationContextInternal,
          {
            workspaceId: args.workspaceId,
          }
        )) as DiscoveryGenerationContext)
      : null;

    const userPrompt = `Convert these keywords into platform-specific discovery queries for ${platformContext}.

**Keywords to convert:**
${args.keywords.map((kw, i) => `${i + 1}. ${kw}`).join("\n")}
${args.businessContext ? `\n**Business context:**\n${args.businessContext}` : ""}
${formatDiscoveryContextBlock(discoveryContext)}

Return grouped queries that are net-new relative to the operational memory above.

When Twitter is requested:
- generate post-like, first-person phrasing

When LinkedIn is requested:
- generate linkedinPostQueries as short professional/topic phrases
- generate linkedinPeopleQueries as short role/title phrases

For every query, include the source keyword it came from.
If a platform is not requested, return an empty array for that group.`;

    try {
      const { object, model } = await robustGenerateObject({
        operation: "convertToSocialQueries",
        schema: socialQueriesSchema,
        system: buildSocialQueryPrompt(args.useCaseKey),
        prompt: userPrompt,
        temperature: 0.8,
        maxRetries: 2,
      });

      const durationMs = getCurrentUTCTimestamp() - startTime;

      console.info(
        "[convertToSocialQueries] Generated",
        object.twitterQueries.length +
          object.linkedinPostQueries.length +
          object.linkedinPeopleQueries.length,
        "queries using",
        model,
        "in",
        durationMs,
        "ms"
      );

      const twitterQueries = includeTwitter
        ? dedupeQueryItems(object.twitterQueries)
        : [];
      const linkedinPostQueries = includeLinkedIn
        ? dedupeQueryItems(object.linkedinPostQueries)
        : [];
      const linkedinPeopleQueries = includeLinkedIn
        ? dedupeQueryItems(object.linkedinPeopleQueries)
        : [];

      const metadataMap = new Map<string, SocialQueryMetadata>();
      const appendMetadata = (
        items: GeneratedSocialQuery[],
        metadata: Omit<SocialQueryMetadata, "query" | "sourceKeyword">
      ) => {
        for (const item of items) {
          const key = item.query.toLowerCase();
          if (metadataMap.has(key)) {
            continue;
          }

          metadataMap.set(key, {
            query: item.query,
            sourceKeyword: item.sourceKeyword,
            ...metadata,
          });
        }
      };

      appendMetadata(twitterQueries, {
        platformTargets: ["twitter"],
        queryStyle: "natural_phrase",
        legacyCompatibilitySource: true,
      });
      appendMetadata(linkedinPostQueries, {
        platformTargets: ["linkedin"],
        linkedinSurface: "posts",
        linkedinSurfaceTargets: ["posts"],
        queryStyle: "professional_keyword",
        legacyCompatibilitySource: true,
      });
      appendMetadata(linkedinPeopleQueries, {
        platformTargets: ["linkedin"],
        linkedinSurface: "people",
        linkedinSurfaceTargets: ["people"],
        queryStyle: "role_title",
        legacyCompatibilitySource: true,
      });

      // LEGACY COMPAT: keep a flattened socialQueries array until all
      // consumers read queriesByPlatform/queryMetadata and historical
      // social_query rows without per-platform metadata have been aged out.
      const socialQueries = Array.from(metadataMap.values()).map(
        (item) => item.query
      );

      return {
        success: true,
        socialQueries,
        queriesByPlatform: {
          twitter: twitterQueries.map((item) => item.query),
          linkedin: {
            posts: linkedinPostQueries.map((item) => item.query),
            people: linkedinPeopleQueries.map((item) => item.query),
          },
        },
        queryMetadata: Array.from(metadataMap.values()),
        reasoning: object.reasoning,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      console.error(
        "[convertToSocialQueries] Failed:",
        errorMessage,
        "after",
        getCurrentUTCTimestamp() - startTime,
        "ms"
      );

      return {
        success: false,
        error: `Failed to convert keywords: ${errorMessage}`,
      };
    }
  },
});
