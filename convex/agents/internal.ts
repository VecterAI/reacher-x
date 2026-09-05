"use node";

// convex/agents/internal.ts
// Internal actions for AI-powered keyword generation
// These are called by both standalone tools and the searchProspects orchestrator

import { internalAction } from "../lib/functionBuilders";
import { v } from "convex/values";
import { z } from "zod";
import { internal } from "../_generated/api";
import {
  generateTextWithJsonParse,
  getRoutingTelemetry,
  robustGenerateObject,
} from "../lib/ai";
import { isRecord } from "../lib/typeGuards";
import {
  prospectPlatformValidator,
  workspaceTargetingSpecValidator,
  workspaceUseCaseKeyValidator,
} from "../validators";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { getWorkspaceUseCase } from "../../shared/lib/workspaceUseCases";
import { getWideEventLogger } from "../lib/wideEventLogger";
import {
  applyTwitterProviderSearchFilters,
  resolveTwitterProspectingSearchMode,
  type TwitterProspectingSearchMode,
} from "../lib/twitterProspectingSearchCore";
import {
  getStricterDiscoveryStage,
  shouldUseLinkedInPeopleDiscovery,
  type DiscoveryStage,
  type WorkspaceTargetingSpec,
} from "../lib/targetingSpecCore";

// ============================================================================
// Schemas
// ============================================================================

const prospectingKeywordsSchema = z.object({
  keywords: z.array(z.string()).min(5).max(20),
  reasoning: z.string(),
});

const socialQueryMetadataSchema = z.object({
  stage: z.enum(["strict", "balanced", "broad"]),
  criterionIds: z.array(z.string().max(48)).max(6),
  sourceKeyword: z.string().optional(),
});

const socialQueryItemSchema = socialQueryMetadataSchema.extend({
  query: z.string().max(120),
});

const twitterSocialQueryItemSchema = socialQueryMetadataSchema.extend({
  query: z.string().max(220),
  searchMode: z.enum(["exact", "raw"]),
});

const socialQueriesSchema = z.object({
  twitterQueries: z.array(twitterSocialQueryItemSchema).max(15),
  linkedinPostQueries: z.array(socialQueryItemSchema).max(15),
  linkedinPeopleQueries: z.array(socialQueryItemSchema).max(15),
  reasoning: z.string(),
});

const modelRoutingValidator = v.union(
  v.literal("fast"),
  v.literal("reasoning"),
  v.literal("onboarding")
);

type GeneratedSocialQuery = z.infer<typeof socialQueryItemSchema> & {
  searchMode?: TwitterProspectingSearchMode;
};
type SocialQueriesObject = z.infer<typeof socialQueriesSchema>;
type SocialQueryMetadata = {
  query: string;
  sourceKeyword?: string;
  platformTargets: Array<"twitter" | "linkedin">;
  linkedinSurface?: "posts" | "people";
  linkedinSurfaceTargets?: Array<"posts" | "people">;
  queryStyle: "natural_phrase" | "professional_keyword" | "role_title";
  twitterSearchMode?: TwitterProspectingSearchMode;
  discoveryStage: DiscoveryStage;
  targetingCriterionIds: string[];
  legacyCompatibilitySource: boolean;
};

const MAX_TWITTER_QUERY_CHARS = 220;
const MAX_LINKEDIN_QUERY_CHARS = 120;
const MAX_SOCIAL_QUERY_ITEMS_PER_GROUP = 15;
const PEOPLE_QUERY_HINTS = [
  "architect",
  "consultant",
  "cto",
  "designer",
  "developer",
  "director",
  "engineer",
  "founder",
  "head",
  "lead",
  "manager",
  "marketer",
  "owner",
  "president",
  "recruiter",
  "specialist",
  "vp",
] as const;

function normalizeSearchText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSocialQueryText(
  value: string,
  platform: "twitter" | "linkedin"
) {
  const normalized = normalizeSearchText(value);
  const limit =
    platform === "twitter" ? MAX_TWITTER_QUERY_CHARS : MAX_LINKEDIN_QUERY_CHARS;
  if (normalized.length <= limit) {
    return normalized;
  }

  const clipped = normalized.slice(0, limit).trimEnd();
  const lastSpace = clipped.lastIndexOf(" ");
  return (lastSpace >= 16 ? clipped.slice(0, lastSpace) : clipped).trimEnd();
}

function dedupeQueryItems(
  items: GeneratedSocialQuery[],
  platform: "twitter" | "linkedin"
) {
  const seen = new Set<string>();
  const deduped: GeneratedSocialQuery[] = [];

  for (const item of items) {
    const query = normalizeSocialQueryText(item.query, platform);
    if (!query) continue;
    const key = query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({
      query,
      sourceKeyword: item.sourceKeyword
        ? normalizeSearchText(item.sourceKeyword) || undefined
        : undefined,
      stage: item.stage ?? "balanced",
      criterionIds: Array.from(new Set(item.criterionIds ?? [])).slice(0, 6),
      ...(item.searchMode
        ? {
            searchMode: resolveTwitterProspectingSearchMode({
              query,
              requestedMode: item.searchMode,
            }),
          }
        : {}),
    });
  }

  return deduped;
}

function interleaveQueryGroups(
  groups: readonly (readonly string[])[]
): string[] {
  const result: string[] = [];
  const maxLength = Math.max(0, ...groups.map((group) => group.length));
  for (let index = 0; index < maxLength; index += 1) {
    for (const group of groups) {
      const query = group[index];
      if (query) result.push(query);
    }
  }
  return result;
}

function normalizeSocialQueryItemPayload(
  value: unknown,
  platform: "twitter" | "linkedin"
): unknown {
  if (typeof value === "string") {
    const query = normalizeSocialQueryText(value, platform);
    return platform === "twitter"
      ? { query, searchMode: "raw", stage: "balanced", criterionIds: [] }
      : { query, stage: "balanced", criterionIds: [] };
  }

  if (!isRecord(value)) {
    return value;
  }

  const query =
    typeof value.query === "string"
      ? normalizeSocialQueryText(value.query, platform)
      : value.query;

  return {
    ...value,
    query,
    sourceKeyword:
      typeof value.sourceKeyword === "string"
        ? normalizeSearchText(value.sourceKeyword)
        : value.sourceKeyword,
    stage:
      value.stage === "strict" ||
      value.stage === "balanced" ||
      value.stage === "broad"
        ? value.stage
        : "balanced",
    criterionIds: Array.isArray(value.criterionIds)
      ? value.criterionIds
          .filter((item): item is string => typeof item === "string")
          .slice(0, 6)
      : [],
    ...(platform === "twitter"
      ? {
          searchMode:
            typeof query === "string"
              ? resolveTwitterProspectingSearchMode({
                  query,
                  requestedMode: value.searchMode === "exact" ? "exact" : "raw",
                })
              : "raw",
        }
      : {}),
  };
}

function normalizeSocialQueryArrayPayload(
  value: unknown,
  platform: "twitter" | "linkedin"
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, MAX_SOCIAL_QUERY_ITEMS_PER_GROUP)
    .map((item) => normalizeSocialQueryItemPayload(item, platform));
}

function normalizeSocialQueriesPayload(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  return {
    ...value,
    twitterQueries: normalizeSocialQueryArrayPayload(
      value.twitterQueries,
      "twitter"
    ),
    linkedinPostQueries: normalizeSocialQueryArrayPayload(
      value.linkedinPostQueries,
      "linkedin"
    ),
    linkedinPeopleQueries: normalizeSocialQueryArrayPayload(
      value.linkedinPeopleQueries,
      "linkedin"
    ),
    reasoning:
      typeof value.reasoning === "string"
        ? value.reasoning
        : "Converted keywords into platform discovery queries.",
  };
}

function isLikelyPeopleQuery(query: string) {
  const normalized = query.toLowerCase();
  return PEOPLE_QUERY_HINTS.some((hint) => normalized.includes(hint));
}

function copyQueryItems(items: GeneratedSocialQuery[]) {
  return items.map((item) => ({ ...item }));
}

function buildKeywordFallbackSocialQueries(args: {
  keywords: string[];
  includeTwitter: boolean;
  includeLinkedIn: boolean;
}): SocialQueriesObject {
  const rawItems = args.keywords.map((keyword) => ({
    query: keyword,
    sourceKeyword: keyword,
    stage: "balanced" as const,
    criterionIds: [],
  }));
  const twitterQueries = dedupeQueryItems(rawItems, "twitter").slice(
    0,
    MAX_SOCIAL_QUERY_ITEMS_PER_GROUP
  );
  const linkedinQueries = dedupeQueryItems(rawItems, "linkedin").slice(
    0,
    MAX_SOCIAL_QUERY_ITEMS_PER_GROUP
  );
  const peopleQueries = linkedinQueries.filter((item) =>
    isLikelyPeopleQuery(item.query)
  );

  return {
    twitterQueries: args.includeTwitter
      ? twitterQueries.map((item) => ({
          ...item,
          searchMode: "raw" as const,
        }))
      : [],
    linkedinPostQueries: args.includeLinkedIn
      ? copyQueryItems(linkedinQueries)
      : [],
    linkedinPeopleQueries: args.includeLinkedIn
      ? copyQueryItems(peopleQueries)
      : [],
    reasoning:
      "AI query conversion was unavailable, so discovery is using keyword-based fallback queries.",
  };
}

function buildSocialQueryActionResult(args: {
  object: SocialQueriesObject;
  includeTwitter: boolean;
  includeLinkedIn: boolean;
  includeLinkedInPeople: boolean;
  targetingSpec?: WorkspaceTargetingSpec;
}): {
  success: true;
  socialQueries: string[];
  queriesByPlatform: {
    twitter: string[];
    linkedin: {
      posts: string[];
      people: string[];
    };
  };
  queryMetadata: SocialQueryMetadata[];
  reasoning: string;
} {
  const validCriterionIds = new Set(
    args.targetingSpec?.criteria.map((criterion) => criterion.id) ?? []
  );
  const getValidCriterionIds = (criterionIds: string[] | undefined) =>
    Array.from(new Set(criterionIds ?? []))
      .filter((criterionId) => validCriterionIds.has(criterionId))
      .slice(0, 6);
  const twitterInputs = args.object.twitterQueries.map((item) => ({
    ...item,
    query: applyTwitterProviderSearchFilters({
      query: item.query,
      stage: item.stage,
      filters: args.targetingSpec?.searchFilters?.twitter,
      maxLength: MAX_TWITTER_QUERY_CHARS,
    }),
  }));
  const twitterQueries = args.includeTwitter
    ? dedupeQueryItems(twitterInputs, "twitter")
    : [];
  const linkedinPostQueries = args.includeLinkedIn
    ? dedupeQueryItems(args.object.linkedinPostQueries, "linkedin")
    : [];
  const linkedinPeopleQueries = args.includeLinkedInPeople
    ? dedupeQueryItems(args.object.linkedinPeopleQueries, "linkedin")
    : [];

  const metadataMap = new Map<string, SocialQueryMetadata>();
  const appendMetadata = (
    items: GeneratedSocialQuery[],
    metadata: Omit<
      SocialQueryMetadata,
      | "query"
      | "sourceKeyword"
      | "twitterSearchMode"
      | "discoveryStage"
      | "targetingCriterionIds"
    >
  ) => {
    for (const item of items) {
      const key = item.query.toLowerCase();
      const incomingCriterionIds = getValidCriterionIds(item.criterionIds);
      const existing = metadataMap.get(key);
      if (existing) {
        const incomingStage = item.stage ?? "balanced";
        const platformTargets = Array.from(
          new Set<"twitter" | "linkedin">([
            ...existing.platformTargets,
            ...metadata.platformTargets,
          ])
        );
        const linkedinSurfaceTargets = Array.from(
          new Set<"posts" | "people">([
            ...(existing.linkedinSurfaceTargets ?? []),
            ...(metadata.linkedinSurfaceTargets ?? []),
          ])
        );
        const mergedMetadata: SocialQueryMetadata = {
          ...existing,
          platformTargets,
          discoveryStage: getStricterDiscoveryStage(
            existing.discoveryStage,
            incomingStage
          ),
          targetingCriterionIds: Array.from(
            new Set([
              ...existing.targetingCriterionIds,
              ...incomingCriterionIds,
            ])
          ).slice(0, 6),
        };

        if (linkedinSurfaceTargets.length > 0) {
          mergedMetadata.linkedinSurfaceTargets = linkedinSurfaceTargets;
          if (linkedinSurfaceTargets.length === 1) {
            mergedMetadata.linkedinSurface = linkedinSurfaceTargets[0];
          } else {
            delete mergedMetadata.linkedinSurface;
          }
        }

        metadataMap.set(key, mergedMetadata);
        continue;
      }

      metadataMap.set(key, {
        query: item.query,
        sourceKeyword: item.sourceKeyword,
        ...metadata,
        twitterSearchMode: item.searchMode,
        discoveryStage: item.stage ?? "balanced",
        targetingCriterionIds: incomingCriterionIds,
      });
    }
  };

  appendMetadata(twitterQueries, {
    platformTargets: ["twitter"],
    queryStyle: "natural_phrase",
    legacyCompatibilitySource: false,
  });
  appendMetadata(linkedinPostQueries, {
    platformTargets: ["linkedin"],
    linkedinSurface: "posts",
    linkedinSurfaceTargets: ["posts"],
    queryStyle: "professional_keyword",
    legacyCompatibilitySource: false,
  });
  appendMetadata(linkedinPeopleQueries, {
    platformTargets: ["linkedin"],
    linkedinSurface: "people",
    linkedinSurfaceTargets: ["people"],
    queryStyle: "role_title",
    legacyCompatibilitySource: false,
  });

  // LEGACY COMPAT: keep a flattened socialQueries array until all
  // consumers read queriesByPlatform/queryMetadata and historical
  // social_query rows without per-platform metadata have been aged out.
  const socialQueries = interleaveQueryGroups([
    twitterQueries.map((item) => item.query),
    linkedinPostQueries.map((item) => item.query),
    linkedinPeopleQueries.map((item) => item.query),
  ]);

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
    reasoning: args.object.reasoning,
  };
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
  operatorInstructions?: string[];
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
  if (context.operatorInstructions?.length) {
    sections.push(
      `Applicable operator instructions (verbatim JSON):\n${context.operatorInstructions.map((instruction) => JSON.stringify(instruction)).join("\n")}`
    );
  }

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
            `- ${JSON.stringify({ title: item.title, lesson: item.summary, confidence: item.confidence })}`
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

Generate a tiered mix instead of making every keyword equally narrow:
- strict: preserves distinctive target, intent, and constraint language
- balanced: preserves target identity and core intent while omitting one filter-like detail
- broad but accurate: preserves the relationship goal or qualifying signal for recall without contradicting any requirement

Order the first five keywords as strict, strict, balanced, balanced, broad. Repeat that mix for any remaining keywords so small search batches still contain both precision and recall.

Focus on:
- Problem-aware keywords
- Outcome-seeking keywords
- Frustration expressions
- Action phrases
- Signals aligned with this workspace's qualification lens: ${useCase.promptContext.qualificationLens}

You may receive operational memory about what is already working, duplicated, exhausted, or recently retired.
Treat prior outcomes and learned observations as advisory evidence. Current user intent and the authoritative targeting specification take precedence over every historical pattern. Never turn an old preference into a mandatory condition. In particular:
- prefer uncovered themes over already-saturated phrases
- do not regenerate obvious variants of queries that already exist
- avoid broad filler wording when memory shows it underperforms

The original audience request and current workspace description may both appear in business context. Treat the original audience request as the source of truth for who the user wants to reach and why. Presets provide vocabulary and qualification guidance, but they must not override that intent.

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
    routing: v.optional(modelRoutingValidator),
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
    const logEvent = getWideEventLogger(ctx);
    logEvent?.set({
      discovery: {
        has_business_context: Boolean(args.businessContext),
        synthetic_post_count: args.syntheticPosts.length,
      },
      workspace: {
        id: args.workspaceId ?? undefined,
      },
    });

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
Use the business context to keep the keywords aligned with the user's original target and relationship goal. Do not infer the target from synthetic posts alone.
Only return net-new keywords in uncovered themes when memory indicates existing themes are already saturated.`;
    const routing = args.routing ?? (args.workspaceId ? "reasoning" : "fast");
    const routingTelemetry = getRoutingTelemetry(routing);

    try {
      const generation =
        routing === "fast"
          ? await generateTextWithJsonParse({
              operation: "generateProspectingKeywords",
              schema: prospectingKeywordsSchema,
              system: buildProspectingKeywordsPrompt(args.useCaseKey),
              prompt: userPrompt,
              temperature: 0.7,
              maxRetries: 2,
              routing: "fast",
            })
          : await robustGenerateObject({
              operation: "generateProspectingKeywords",
              schema: prospectingKeywordsSchema,
              system: buildProspectingKeywordsPrompt(args.useCaseKey),
              prompt: userPrompt,
              temperature: 0.7,
              maxRetries: 2,
              routing,
            });
      const { object, model, usage } = generation;

      const durationMs = getCurrentUTCTimestamp() - startTime;
      logEvent?.set({
        ai: {
          model,
          provider: usage.providerSelected ?? null,
          provider_hint: routingTelemetry.providerLabel,
          routing,
          timeout_ms: routingTelemetry.timeoutMs,
        },
        discovery: {
          duration_ms: durationMs,
          keyword_count: object.keywords.length,
        },
      });

      return {
        success: true,
        prospectingKeywords: object.keywords,
        reasoning: object.reasoning,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logEvent?.error(error, {
        ai: {
          provider_hint: routingTelemetry.providerLabel,
          routing,
          timeout_ms: routingTelemetry.timeoutMs,
        },
        discovery: {
          duration_ms: getCurrentUTCTimestamp() - startTime,
        },
      });

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
- Twitter queries must be at most 220 characters so named entities and useful operators are preserved.
- LinkedIn queries must be at most 120 characters.
- Prefer the shortest query that retains the intended evidence signal.

Return three separate groups:
1. twitterQueries
- Natural first-person phrasing plus short role/profile/company/topic terms
- Conversational pain, intent, recommendation, or help-seeking language
- Profile-fit terms that can lead to seed accounts for expansion
- For every Twitter query, return searchMode as either "exact" or "raw"
- Use "exact" only for a coherent 2-5 word phrase that people plausibly write verbatim
- Use "raw" for keyword combinations, broader intent, hashtags, operators, or sentence fragments
- For exact mode, do not include quotation marks; the backend adds them
- For raw mode, use SocialAPI-supported Twitter operators when the targeting specification explicitly provides the matching constraint. Operators belong inside the query string. Supported examples include quoted phrases, parentheses, OR, exclusions with -, from:, to:, lang:, near:, within:, since_time:, until_time:, min_faves:, min_retweets:, min_replies:, and filter:replies
- Never invent an operator value. Strict queries should apply supported constraints; balanced and broad queries may progressively omit preferences while preserving the requested relationship and any explicit exclusion

2. linkedinPostQueries
- Short professional or topical phrases
- Problem, stack, role, function, tooling, workflow, or OSS signals
- Better suited for post discovery than exact natural-language sentence matching

3. linkedinPeopleQueries
- Short role/title style phrases
- Hiring-oriented terms such as job titles, specialties, or seniority variants
- Examples: "frontend developer", "staff frontend engineer", "react native developer"
- Do not stuff locations or languages into the people query text. The provider adapter applies those documented filters directly when the targeting specification contains them

Each query should:
- Be short and high-signal
- Avoid duplicates across all groups
- Stay specific to this workspace's qualification lens
- Include stage as strict, balanced, or broad
- Keep lang:, near:, and within: out of generated query text: the provider adapter owns these structured filters and applies them only in strict discovery. Balanced and broad queries omit these filters; final qualification still evaluates every original criterion.
- Include criterionIds for the targeting criteria it is intended to discover

Generate a tiered mix in every requested group:
- strict queries preserve several distinctive target and intent signals
- balanced queries preserve the target identity and core intent while dropping one filter-like detail
- broad but accurate queries preserve the relationship goal or qualifying signal without contradicting a requirement

Order the first five queries in each group as strict, strict, balanced, balanced, broad. Repeat that mix for additional queries. A broad discovery query improves recall, but final qualification still enforces the full workspace description and profile constraints.

The original audience request in business context is the source of truth. Use-case presets must not change who the user is trying to find.

The qualification lens for this workspace is: ${useCase.promptContext.qualificationLens}`;
}

export const convertToSocialQueriesAction = internalAction({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    keywords: v.array(v.string()),
    platforms: v.array(prospectPlatformValidator),
    businessContext: v.optional(v.string()),
    targetingSpec: v.optional(workspaceTargetingSpecValidator),
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
    const logEvent = getWideEventLogger(ctx);
    logEvent?.set({
      discovery: {
        has_business_context: Boolean(args.businessContext),
        input_keyword_count: args.keywords.length,
        platforms: args.platforms,
      },
      workspace: {
        id: args.workspaceId ?? undefined,
      },
    });

    const includeTwitter = args.platforms.includes("twitter");
    const includeLinkedIn = args.platforms.includes("linkedin");
    const includeLinkedInPeople =
      includeLinkedIn && shouldUseLinkedInPeopleDiscovery(args.targetingSpec);
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
${args.targetingSpec ? `\n**Authoritative targeting specification:**\n${JSON.stringify(args.targetingSpec, null, 2)}` : ""}
${formatDiscoveryContextBlock(discoveryContext)}

Return grouped queries that are net-new relative to the operational memory above.

Use the business context to preserve the user's original target and relationship goal. Build a precision-and-recall mix rather than making every query equally narrow.

When Twitter is requested:
- generate a balanced mix of post-like first-person phrasing and short role, company, profile, or topical terms
- set searchMode="exact" only for short phrases likely to appear verbatim
- otherwise set searchMode="raw"; do not add quotation marks yourself

When LinkedIn is requested:
- generate linkedinPostQueries as short professional/topic phrases
- ${
      includeLinkedInPeople
        ? "generate linkedinPeopleQueries as short role/title phrases"
        : "return an empty linkedinPeopleQueries array because this targeting specification contains a required activity-only criterion that people search results cannot prove"
    }

For every query, include the source keyword, strict/balanced/broad stage, and only real criterion IDs from the targeting specification. Strict queries preserve named entities and required intent. Balanced queries may omit one preference. Broad queries may omit preferences but never reverse core intent or include an exclusion.
If a platform is not requested, return an empty array for that group.`;
    const routing = "fast" as const;
    const routingTelemetry = getRoutingTelemetry(routing);

    try {
      const { object, model, usage } = await robustGenerateObject({
        operation: "convertToSocialQueries",
        schema: socialQueriesSchema,
        system: buildSocialQueryPrompt(args.useCaseKey),
        prompt: userPrompt,
        temperature: 0.45,
        maxRetries: 1,
        routing,
        normalizeParsed: normalizeSocialQueriesPayload,
        failureLogLevel: "info",
      });

      const durationMs = getCurrentUTCTimestamp() - startTime;
      logEvent?.set({
        ai: {
          model,
          provider: usage.providerSelected ?? null,
          provider_hint: routingTelemetry.providerLabel,
          routing,
          timeout_ms: routingTelemetry.timeoutMs,
        },
        discovery: {
          duration_ms: durationMs,
          linkedin_people_query_count: object.linkedinPeopleQueries.length,
          linkedin_post_query_count: object.linkedinPostQueries.length,
          twitter_query_count: object.twitterQueries.length,
        },
      });

      return buildSocialQueryActionResult({
        object,
        includeTwitter,
        includeLinkedIn,
        includeLinkedInPeople,
        targetingSpec: args.targetingSpec,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logEvent?.warn("AI conversion failed; using keyword fallback", {
        ai: {
          error: errorMessage,
          provider_hint: routingTelemetry.providerLabel,
          routing,
          timeout_ms: routingTelemetry.timeoutMs,
        },
        discovery: {
          duration_ms: getCurrentUTCTimestamp() - startTime,
        },
      });

      return buildSocialQueryActionResult({
        object: buildKeywordFallbackSocialQueries({
          keywords: args.keywords,
          includeTwitter,
          includeLinkedIn,
        }),
        includeTwitter,
        includeLinkedIn,
        includeLinkedInPeople,
        targetingSpec: args.targetingSpec,
      });
    }
  },
});
