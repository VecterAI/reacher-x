// convex/agents/outreach/index.ts
// Outreach Agent definition using @convex-dev/agent + OpenRouter
"use node";

import { Agent, type ContextHandler } from "@convex-dev/agent";
import { generateText, wrapLanguageModel } from "ai";
import { components, internal } from "../../_generated/api";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  type OpenRouterProviderOptions,
  OUTREACH_AGENT_MODEL,
  OUTREACH_AGENT_PROMPT_CACHE_OPTIONS,
  OUTREACH_AGENT_PROVIDER_OPTIONS,
  OUTREACH_FAST_MODEL,
  OUTREACH_FAST_PROVIDER_OPTIONS,
  OUTREACH_ROUTER_MODEL,
  OUTREACH_ROUTER_PROVIDER_OPTIONS,
  OUTREACH_SOL_MODEL,
  OUTREACH_SOL_PROVIDER_OPTIONS,
  OUTREACH_TERRA_MODEL,
  OUTREACH_TERRA_PROVIDER_OPTIONS,
  PINNED_VISION_MODEL,
  PINNED_VISION_PROVIDER_OPTIONS,
  extractUsage,
  extractJsonPayload,
  getOpenRouterExtraBody,
  supportsExplicitPromptCaching,
} from "../../lib/ai";
import {
  openRouterMetadataMiddleware,
  outreachPromptCacheMiddleware,
  sanitizeProviderMetadataForConvex,
} from "../../lib/agentMetadata";
import { getTextEmbeddingModel } from "../../lib/embeddingModels";
import { buildOutreachAgentPrompt } from "../prompts";
import {
  DEFAULT_WORKSPACE_USE_CASE_KEY,
  getWorkspaceUseCase,
} from "../../../shared/lib/workspaceUseCases";
import {
  getSocialContext,
  getProspectInteractionHistory,
  getProspectPlan,
  generatePlan,
  refinePlan,
  inspectWorkspace,
  researchProspect,
  pausePlan,
  resumePlan,
  cancelPlan,
  deletePlan,
  displayEntity,
  askHuman,
  approveTask,
  approveSocialActionRequest,
  rememberWorkspaceMemory,
  searchWorkspaceMemories,
  socialAction,
} from "./tools";
import { getStoredXPostLimitContextForAgentUser } from "./tools/xPostLimitHelpers";
import { logger } from "../../../shared/lib/logger";
import { getStyleMemoryCategory } from "../../lib/styleSourceCore";
import { loadAgentProspectProfileContext } from "../../lib/prospectProfileContextHelpers";
import { formatLinkedInRelationshipPlanGuidance } from "../../lib/linkedinOutreachPlanCore";
import type { LinkedInRelationshipStatus } from "../../lib/linkedinOutreachPlanCore";
import { createManualWideEventLogger } from "../../lib/wideEventLogger";
import { getCurrentUTCTimestamp } from "../../../shared/lib/utils/time/timeUtils";
import {
  OUTREACH_HISTORY_SEARCH_LIMIT,
  OUTREACH_RECENT_MESSAGE_LIMIT,
} from "../../lib/agentContextHelpers";
import {
  buildOutreachModelSessionId,
  buildOutreachRouterPrompt,
  outreachRouteDecisionSchema,
  selectOutreachTextLane,
  type OutreachOperationState,
  type OutreachRouteSelection,
  type OutreachTextModelLane,
} from "../../lib/outreachModelRoutingCore";
import { filterLegacySharedBatchTurns } from "../../lib/planBatchCore";
import type { OutreachAgentCustomContext } from "./context";
import {
  approveWorkspaceProfiles,
  proposeWorkspaceProfiles,
  rejectWorkspaceProfiles,
} from "../tools/workspaceProfileChanges";

const outreachAgentLogger = logger.withScope("OutreachAgent");

// Re-exported base tools so we can merge them with
// any future runtime-resolved tool surfaces at call sites.
export const outreachAgentBaseTools = {
  // Context tools
  getSocialContext,
  getProspectInteractionHistory,
  getProspectPlan,
  inspectWorkspace,
  proposeWorkspaceProfiles,
  approveWorkspaceProfiles,
  rejectWorkspaceProfiles,
  researchProspect,
  // Plan management
  generatePlan,
  refinePlan,
  pausePlan,
  resumePlan,
  cancelPlan,
  deletePlan,
  // Generative UI
  displayEntity,
  // Curated social actions via app-owned policy + executor
  socialAction,
  approveSocialActionRequest,
  // Human-in-the-loop
  askHuman,
  // Task approval
  approveTask,
  // Workspace memory tools
  rememberWorkspaceMemory,
  searchWorkspaceMemories,
} as const;

// ============================================================================
// Lazy Model Provider
// ============================================================================

function getOpenRouterProvider() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[Outreach Agent] Missing OPENROUTER_API_KEY environment variable."
    );
  }
  return createOpenRouter({
    apiKey,
    headers: {
      "HTTP-Referer": "https://reacherx.com",
      "X-Title": "ReacherX",
    },
  });
}

const openrouter = getOpenRouterProvider();
function createOutreachLanguageModel(
  modelId: string,
  providerOptions: OpenRouterProviderOptions,
  options?: {
    enableExplicitPromptCaching?: boolean;
    sessionId?: string;
  }
) {
  return wrapLanguageModel({
    model: openrouter(modelId, {
      extraBody: {
        ...getOpenRouterExtraBody(providerOptions),
        ...(options?.enableExplicitPromptCaching
          ? OUTREACH_AGENT_PROMPT_CACHE_OPTIONS
          : {}),
        ...(options?.sessionId ? { session_id: options.sessionId } : {}),
      },
    }) as any,
    middleware: [
      ...(options?.enableExplicitPromptCaching
        ? [outreachPromptCacheMiddleware]
        : []),
      openRouterMetadataMiddleware,
    ],
  });
}

const outreachTextModelConfigs: Record<
  OutreachTextModelLane,
  {
    model: string;
    providerOptions: OpenRouterProviderOptions;
    enableExplicitPromptCaching: boolean;
  }
> = {
  fast: {
    model: OUTREACH_FAST_MODEL,
    providerOptions: OUTREACH_FAST_PROVIDER_OPTIONS,
    enableExplicitPromptCaching: false,
  },
  terra: {
    model: OUTREACH_TERRA_MODEL,
    providerOptions: OUTREACH_TERRA_PROVIDER_OPTIONS,
    enableExplicitPromptCaching:
      supportsExplicitPromptCaching(OUTREACH_TERRA_MODEL),
  },
  sol: {
    model: OUTREACH_SOL_MODEL,
    providerOptions: OUTREACH_SOL_PROVIDER_OPTIONS,
    enableExplicitPromptCaching:
      supportsExplicitPromptCaching(OUTREACH_SOL_MODEL),
  },
};

export function createOutreachTextLanguageModel(
  lane: OutreachTextModelLane,
  threadId: string
) {
  const config = outreachTextModelConfigs[lane];
  return createOutreachLanguageModel(config.model, config.providerOptions, {
    enableExplicitPromptCaching: config.enableExplicitPromptCaching,
    sessionId: buildOutreachModelSessionId(threadId, lane),
  });
}

export const outreachLanguageModel = createOutreachLanguageModel(
  OUTREACH_AGENT_MODEL,
  OUTREACH_AGENT_PROVIDER_OPTIONS,
  {
    enableExplicitPromptCaching:
      supportsExplicitPromptCaching(OUTREACH_AGENT_MODEL),
  }
);

export const outreachVisionLanguageModel = createOutreachLanguageModel(
  PINNED_VISION_MODEL,
  PINNED_VISION_PROVIDER_OPTIONS
);

const outreachRouterLanguageModel = createOutreachLanguageModel(
  OUTREACH_ROUTER_MODEL,
  OUTREACH_ROUTER_PROVIDER_OPTIONS
);

// Luna can spend part of this budget on hidden reasoning. Keep enough room for
// the complete JSON object so a valid route is not mistaken for a failure.
const OUTREACH_ROUTER_MAX_OUTPUT_TOKENS = 512;
const OUTREACH_ROUTER_TIMEOUT_MS = 12_000;

export async function classifyOutreachTurn(args: {
  currentPrompt: string;
  recentMessages: Array<{ role: "user" | "assistant"; text: string }>;
  operationState: OutreachOperationState;
}): Promise<{
  selection: OutreachRouteSelection;
  model: string;
  provider?: string;
  usage: Record<string, unknown>;
  providerMetadata?: unknown;
}> {
  const result = await generateText({
    model: outreachRouterLanguageModel,
    system:
      "You are ReacherX's internal semantic model router. Classify the required reasoning depth for one prospect-agent turn. Return only one valid JSON object with the exact keys lane, confidence, reason, and rationale; keep rationale under 12 words and never answer the user's request.",
    prompt: `${buildOutreachRouterPrompt(args)}\n\nReturn only the JSON object. Use one of the provided reason codes exactly.`,
    temperature: 0,
    maxOutputTokens: OUTREACH_ROUTER_MAX_OUTPUT_TOKENS,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(OUTREACH_ROUTER_TIMEOUT_MS),
  });
  const extractedUsage = extractUsage(result);
  const decision = outreachRouteDecisionSchema.parse(
    JSON.parse(extractJsonPayload(result.text))
  );

  return {
    selection: selectOutreachTextLane(decision),
    model: extractedUsage.modelSelected ?? OUTREACH_ROUTER_MODEL,
    provider: extractedUsage.providerSelected,
    usage: {
      ...result.usage,
      ...(extractedUsage.cost === undefined
        ? {}
        : { cost: extractedUsage.cost }),
      ...(extractedUsage.modelSelected
        ? { modelSelected: extractedUsage.modelSelected }
        : {}),
      ...(extractedUsage.providerSelected
        ? { providerSelected: extractedUsage.providerSelected }
        : {}),
    },
    providerMetadata: result.providerMetadata,
  };
}

const OUTREACH_AGENT_MAX_OUTPUT_TOKENS = 1024;
const OUTREACH_AGENT_MAX_RETRIES = 0;

// ============================================================================
// Context Handler - Injects prospect data into LLM context
// Per docs/convex/llm-context.md: Use contextHandler to inject prospect context
// ============================================================================

/**
 * Context handler that resolves the linked prospect relationship and injects
 * prospect data as a system message, so the agent doesn't need to ask for IDs.
 */
const prospectContextHandler: ContextHandler = async (ctx, args) => {
  if (!args.threadId) {
    return args.allMessages;
  }
  const threadId = args.threadId;

  const logEvent = createManualWideEventLogger({
    kind: "manual",
    operation: "outreachAgent.context",
    context: {
      thread: { id: threadId },
      context: {
        input_message_count: args.allMessages.length,
        recent_message_count: args.recent.length,
        search_message_count: args.search.length,
      },
    },
  });
  const stageTimings: Record<string, number> = {};
  const measureStage = async <T>(
    stage: string,
    runner: () => Promise<T>
  ): Promise<T> => {
    const startedAt = getCurrentUTCTimestamp();
    try {
      return await runner();
    } finally {
      stageTimings[`${stage}_ms`] = getCurrentUTCTimestamp() - startedAt;
      logEvent.set({ timing: stageTimings });
    }
  };

  try {
    const threadContext = await measureStage(
      "thread_context",
      async () =>
        await ctx.runQuery(internal.prospectThreads.getThreadProspectContext, {
          threadId,
        })
    );

    if (!threadContext) {
      logEvent.emitSuccess(undefined, {
        context: { outcome: "no_prospect_context" },
      });
      return args.allMessages;
    }

    const prospect = threadContext.prospect;
    const [
      workspace,
      workspaceInspection,
      outreachLearningContext,
      profileContext,
      xPostLimitContext,
      styleMemories,
      linkedinRelationshipContext,
    ] = await Promise.all([
      measureStage(
        "workspace",
        async () =>
          await ctx.runQuery(internal.workspaces.getById, {
            workspaceId: prospect.workspaceId,
          })
      ),
      measureStage(
        "workspace_inspection",
        async () =>
          await ctx.runQuery(
            internal.workspaces.getWorkspaceInspectionInternal,
            {
              workspaceId: prospect.workspaceId,
            }
          )
      ),
      measureStage(
        "learning_rag",
        async () =>
          await ctx.runAction(
            internal.memory.getOutreachLearningContextInternal,
            {
              workspaceId: String(prospect.workspaceId),
              userId: String(prospect.userId),
              platform:
                prospect.platform === "linkedin" ? "linkedin" : "twitter",
              title: prospect.title,
              briefIntro: prospect.briefIntro,
              painPoints:
                prospect.painPoints?.map(
                  (painPoint: { pain: string }) => painPoint.pain
                ) || [],
              matchedKeywords: prospect.matchedKeywords || [],
              finance: prospect.finance?.displayValue,
              prospectId: String(prospect._id),
            }
          )
      ),
      measureStage(
        "prospect_profile",
        async () => await loadAgentProspectProfileContext(ctx, prospect)
      ),
      measureStage(
        "stored_x_limit",
        async () =>
          await getStoredXPostLimitContextForAgentUser(ctx, prospect.userId)
      ),
      measureStage("writing_style", async () => {
        try {
          return await ctx.runQuery(
            internal.memory.listPinnedWorkspaceMemoriesInternal,
            {
              workspaceId: String(prospect.workspaceId),
              category: getStyleMemoryCategory(
                prospect.platform === "linkedin" ? "linkedin" : "twitter"
              ),
              limit: 1,
            }
          );
        } catch (styleError) {
          outreachAgentLogger.warn(
            "Failed to fetch writing style profile",
            styleError
          );
          return [];
        }
      }),
      measureStage("linkedin_relationship", async () => {
        if (prospect.platform !== "linkedin") {
          return null;
        }
        try {
          const relationship = await ctx.runAction(
            internal.linkedin.getLinkedInProspectRelationshipInternal,
            {
              userId: prospect.userId,
              prospectId: prospect._id,
            }
          );
          return relationship;
        } catch (relationshipError) {
          outreachAgentLogger.warn(
            "Failed to fetch LinkedIn relationship for plan context",
            relationshipError
          );
          return {
            status: "unknown" as LinkedInRelationshipStatus,
            hasExistingConversation: false,
          };
        }
      }),
    ]);
    const useCase = getWorkspaceUseCase(workspace?.useCaseKey);
    const { effectivePostLimit, subscriptionType: xSubscriptionType } =
      xPostLimitContext;

    // Inject prospect context as system message
    // NOTE: Do NOT include IDs in the prompt - the LLM tends to modify them.
    // Tools extract IDs from thread context automatically.
    const useCaseMessage = {
      role: "system" as const,
      content: `## Current Workspace Context

**Workspace:** ${workspaceInspection?.name || workspace?.name || "Unknown"}
**Offering:** ${workspaceInspection?.description || "No workspace description stored"}
**Use Case:** ${useCase.displayName}
**Target Label:** ${useCase.entityPlural}
**Success Label:** ${useCase.pageLabels.converts}
**Qualification Lens:** ${useCase.promptContext.qualificationLens}
**Outreach Goal:** ${useCase.promptContext.outreachGoal}
**Success Definition:** ${useCase.promptContext.successDefinition}

**Ideal Customer Profiles (ICPs):**
${
  workspaceInspection?.icps.length
    ? workspaceInspection.icps
        .map(
          (
            icp: {
              title: string;
              description: string;
              painPoints: string[];
              channels: string[];
            },
            index: number
          ) => `${index + 1}. ${icp.title}: ${icp.description}
   Pain points: ${icp.painPoints.join(", ") || "None stored"}
   Channels: ${icp.channels.join(", ") || "None stored"}`
        )
        .join("\n")
    : "No ICPs stored"
}

Treat the offering and ICPs above as required grounding for every plan. Use this vocabulary in user-facing responses. Internal tool names still refer to prospects.`,
    };

    const contextMessage = {
      role: "system" as const,
      content: `${profileContext}

You are chatting about this specific prospect and already have the complete profile-panel context above.
- Do NOT ask for IDs - the tools will extract them automatically from the thread context.
- Always refer to the prospect by name ("${prospect.displayName || "the prospect"}"), never by ID.
- When calling tools, you don't need to provide prospectId or workspaceId - they are automatically available.`,
    };

    const workspaceMemoryMessage = {
      role: "system" as const,
      content:
        outreachLearningContext.policyPrompt ||
        "## Workspace Memory Policy\n\nNo applicable workspace memories were found.",
    };

    const xLimitMessage = {
      role: "system" as const,
      content:
        effectivePostLimit.mode === "short"
          ? xSubscriptionType
            ? `## Connected X Account Limit

The workspace user's connected X account subscription type is ${xSubscriptionType ?? "unknown"}.
For X replies/posts, you MUST keep all draft text within ${effectivePostLimit.maxWeighted} weighted characters.
When in doubt, write shorter.
If a draft would run long, rewrite it shorter before calling plan or social-action tools.`
            : `## Connected X Account Limit

The workspace user's connected X account subscription type is currently unavailable.
Use the safe fallback limit: keep all X replies/posts within ${effectivePostLimit.maxWeighted} weighted characters.
Do not assume long-form posting is available until the account metadata refreshes.`
          : `## Connected X Account Limit

The workspace user's connected X account subscription type is ${xSubscriptionType ?? "unknown"}.
This account supports long-form X posts. Keep X reply/post draft text within ${effectivePostLimit.maxChars} raw characters.
Still prefer concise writing unless the user clearly wants a longer post.`,
    };

    const linkedinRelationshipMessage =
      linkedinRelationshipContext != null
        ? {
            role: "system" as const,
            content: formatLinkedInRelationshipPlanGuidance(
              linkedinRelationshipContext.status,
              linkedinRelationshipContext.hasExistingConversation
            ),
          }
        : null;

    // 4th block: Writing Style Profile (deterministic retrieval by category)
    let writingStyleMessage: { role: "system"; content: string } | null = null;
    if (styleMemories.length > 0) {
      const profile = styleMemories[0];
      const styleText = profile.parsed?.narrative || profile.promptLine || "";
      if (styleText) {
        writingStyleMessage = {
          role: "system" as const,
          content: `## Your Writing Voice

You are writing AS this user. All outreach messages must match their personal voice.

${styleText}

RULES:
- Mirror their vocabulary, tone, humor, and sentence structure exactly.
- Do NOT add formality, buzzwords, or marketing speak they wouldn't use.
- Elevate clarity and persuasion while keeping their authentic voice.
- If they're casual, be casual. If they're direct, be direct.
- Their edit corrections (if any in the profile) override all other style guidance.
- NEVER sound like a LinkedIn recruiter, corporate marketer, or generic AI.`,
        };
      }
    }

    const isolatedMessages = filterLegacySharedBatchTurns(args.allMessages);

    // Prepend context to all messages
    const messages = [
      useCaseMessage,
      contextMessage,
      workspaceMemoryMessage,
      xLimitMessage,
      ...(linkedinRelationshipMessage ? [linkedinRelationshipMessage] : []),
      ...(writingStyleMessage ? [writingStyleMessage] : []),
      ...isolatedMessages,
    ];
    logEvent.emitSuccess(messages, {
      context: {
        output_message_count: messages.length,
        workspace_memory_count:
          outreachLearningContext.relevantMemories.length +
          outreachLearningContext.operatorPreferences.length +
          outreachLearningContext.winningPatterns.length +
          outreachLearningContext.objections.length +
          outreachLearningContext.similarCases.length,
      },
      prospect: { id: prospect._id },
      workspace: { id: prospect.workspaceId },
    });
    return messages;
  } catch (error) {
    logEvent.emitError(error);
    outreachAgentLogger.warn("Failed to fetch prospect context", error);
  }

  // No prospect context - return messages as-is
  return args.allMessages;
};

// ============================================================================
// Outreach Agent Definition
// ============================================================================

/**
 * The Outreach Agent handles personalized outreach plan generation and execution.
 *
 * Flows:
 * 1. Generate Plan: Analyze prospect → Create strategy → Generate tasks
 * 2. Refine Plan: Get feedback → Update tasks → Re-present
 * 3. Approve Plan: Mark ready → Trigger workflow
 * 4. Ask Human: Pause for complex decisions
 *
 * Context Injection:
 * The contextHandler automatically resolves the linked prospect from the local
 * prospect-thread relationship and injects that prospect data as a system
 * message, so the agent doesn't need to ask for IDs.
 */
export const outreachAgent = new Agent<OutreachAgentCustomContext>(
  components.agent,
  {
    name: "Outreach Agent",
    languageModel: outreachLanguageModel,
    // Enable vector search on message history per docs/convex/agent-usage.md
    embeddingModel: getTextEmbeddingModel(),
    instructions: buildOutreachAgentPrompt(DEFAULT_WORKSPACE_USE_CASE_KEY),
    tools: outreachAgentBaseTools,
    // Allow multi-step for complex plan refinement
    maxSteps: 15,
    callSettings: {
      maxOutputTokens: OUTREACH_AGENT_MAX_OUTPUT_TOKENS,
      // OpenRouter already performs provider failover. Retrying the whole HTTP
      // request here can add another upstream timeout before the user sees text.
      maxRetries: OUTREACH_AGENT_MAX_RETRIES,
    },
    contextOptions: {
      recentMessages: OUTREACH_RECENT_MESSAGE_LIMIT,
      // Enable hybrid text + vector search per docs/convex/llm-context.md
      searchOptions: {
        limit: OUTREACH_HISTORY_SEARCH_LIMIT,
        textSearch: true,
        vectorSearch: true,
      },
    },
    // Inject prospect context from the canonical thread relationship
    contextHandler: prospectContextHandler,
    usageHandler: async (ctx, args) => {
      await ctx.runMutation(internal.agentTelemetry.insertUsageEvent, {
        userId: args.userId,
        threadId: args.threadId,
        agentName: args.agentName,
        model: args.model,
        provider: args.provider,
        usage: args.usage,
        providerMetadata: sanitizeProviderMetadataForConvex(
          args.providerMetadata
        ),
      });
    },
  }
);
