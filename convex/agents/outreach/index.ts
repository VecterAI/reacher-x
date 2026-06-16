// convex/agents/outreach/index.ts
// Outreach Agent definition using @convex-dev/agent + OpenRouter
"use node";

import { Agent, type ContextHandler } from "@convex-dev/agent";
import { wrapLanguageModel } from "ai";
import { components, internal } from "../../_generated/api";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  AGENT_PROVIDER_OPTIONS,
  REASONING_MODEL,
  getOpenRouterExtraBody,
} from "../../lib/ai";
import {
  openRouterMetadataMiddleware,
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
  getProspectPlan,
  generatePlan,
  refinePlan,
  displayEntity,
  askHuman,
  approveTask,
  approveSocialActionRequest,
  rememberWorkspaceMemory,
  searchWorkspaceMemories,
  socialAction,
} from "./tools";
import {
  getEffectivePostLimitForAgentUser,
  getStoredXSubscriptionTypeForAgentUser,
} from "./tools/xPostLimitHelpers";
import { logger } from "../../../shared/lib/logger";

const outreachAgentLogger = logger.withScope("OutreachAgent");

// Re-exported base tools so we can merge them with
// any future runtime-resolved tool surfaces at call sites.
export const outreachAgentBaseTools = {
  // Context tools
  getSocialContext,
  getProspectPlan,
  // Plan management
  generatePlan,
  refinePlan,
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
const outreachLanguageModel = wrapLanguageModel({
  model: openrouter(REASONING_MODEL, {
    extraBody: getOpenRouterExtraBody(AGENT_PROVIDER_OPTIONS),
  }) as any,
  middleware: openRouterMetadataMiddleware,
});

const OUTREACH_AGENT_MAX_OUTPUT_TOKENS = 1024;

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

  try {
    const threadContext = await ctx.runQuery(
      internal.prospectThreads.getThreadProspectContext,
      {
        threadId: args.threadId,
      }
    );

    if (!threadContext) {
      return args.allMessages;
    }

    const prospect = threadContext.prospect;
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId: prospect.workspaceId,
    });
    const useCase = getWorkspaceUseCase(workspace?.useCaseKey);
    const outreachLearningContext = await ctx.runAction(
      internal.memory.getOutreachLearningContextInternal,
      {
        workspaceId: String(prospect.workspaceId),
        userId: String(prospect.userId),
        title: prospect.title,
        briefIntro: prospect.briefIntro,
        painPoints:
          prospect.painPoints?.map(
            (painPoint: { pain: string }) => painPoint.pain
          ) || [],
        matchedKeywords: prospect.matchedKeywords || [],
        finance: prospect.finance?.displayValue,
      }
    );

    // Build pain points summary
    const painPointsSummary =
      prospect.painPoints && prospect.painPoints.length > 0
        ? prospect.painPoints
            .map((p: { pain: string }) => `• ${p.pain}`)
            .join("\n")
        : "None identified yet";

    // Inject prospect context as system message
    // NOTE: Do NOT include IDs in the prompt - the LLM tends to modify them.
    // Tools extract IDs from thread context automatically.
    const useCaseMessage = {
      role: "system" as const,
      content: `## Current Workspace Use Case

**Use Case:** ${useCase.displayName}
**Target Label:** ${useCase.entityPlural}
**Success Label:** ${useCase.pageLabels.converts}
**Qualification Lens:** ${useCase.promptContext.qualificationLens}
**Outreach Goal:** ${useCase.promptContext.outreachGoal}
**Success Definition:** ${useCase.promptContext.successDefinition}

Use this vocabulary in user-facing responses. Internal tool names still refer to prospects.`,
    };

    const contextMessage = {
      role: "system" as const,
      content: `## Current Prospect Context

**Name:** ${prospect.displayName || "Unknown"}
**Title:** ${prospect.title || "Not specified"}
**Platform:** ${prospect.platform}
**Status:** ${prospect.status}
**Brief Intro:** ${prospect.briefIntro || "Not available"}

**Pain Points:**
${painPointsSummary}

---
You are chatting about this specific prospect. You already have their context.
- Do NOT ask for IDs - the tools will extract them automatically from the thread context.
- Always refer to the prospect by name ("${prospect.displayName || "the prospect"}"), never by ID.
- When calling tools, you don't need to provide prospectId or workspaceId - they are automatically available.`,
    };

    const workspaceMemoryMessage = {
      role: "system" as const,
      content: `## Workspace Strategy Memory

Relevant reusable memories:
${outreachLearningContext.relevantMemories.map((item: string) => `- ${item}`).join("\n") || "- None"}

Winning patterns:
${outreachLearningContext.winningPatterns.map((item: string) => `- ${item}`).join("\n") || "- None"}

Common objections or weak patterns:
${outreachLearningContext.objections.map((item: string) => `- ${item}`).join("\n") || "- None"}

Similar prior cases:
${outreachLearningContext.similarCases.map((item: string) => `- ${item}`).join("\n") || "- None"}

Use this memory as guidance when generating or refining outreach plans. Prefer patterns with clear operational pain, avoid weak or repetitive angles, and adapt to the current prospect rather than copying prior phrasing.`,
    };

    const xSubscriptionType = await getStoredXSubscriptionTypeForAgentUser(
      ctx,
      prospect.userId
    );
    const effectivePostLimit = await getEffectivePostLimitForAgentUser(
      ctx,
      prospect.userId
    );
    const xLimitMessage = {
      role: "system" as const,
      content:
        effectivePostLimit.mode === "short"
          ? `## Connected X Account Limit

The workspace user's connected X account subscription type is ${xSubscriptionType ?? "unknown"}.
For X replies/posts, you MUST keep all draft text within ${effectivePostLimit.maxWeighted} weighted characters.
When in doubt, write shorter.
If a draft would run long, compress it before calling plan or social-action tools.`
          : `## Connected X Account Limit

The workspace user's connected X account subscription type is ${xSubscriptionType ?? "unknown"}.
This account supports long-form X posts. Keep X reply/post draft text within ${effectivePostLimit.maxChars} raw characters.
Still prefer concise writing unless the user clearly wants a longer post.`,
    };

    // 4th block: Writing Style Profile (deterministic retrieval by category)
    let writingStyleMessage: { role: "system"; content: string } | null = null;
    try {
      const styleMemories = await ctx.runQuery(
        internal.memory.findRelevantBuiltInAgentMemoriesInternal,
        {
          userId: String(prospect.userId),
          workspaceId: String(prospect.workspaceId),
          query: "writing style profile voice",
          categories: ["writing_style_profile"],
          limit: 1,
        }
      );

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
    } catch (styleError) {
      outreachAgentLogger.warn(
        "Failed to fetch writing style profile",
        styleError
      );
    }

    // Prepend context to all messages
    return [
      useCaseMessage,
      contextMessage,
      workspaceMemoryMessage,
      xLimitMessage,
      ...(writingStyleMessage ? [writingStyleMessage] : []),
      ...args.allMessages,
    ];
  } catch (error) {
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
export const outreachAgent = new Agent(components.agent, {
  name: "Outreach Agent",
  languageModel: outreachLanguageModel,
  // Enable vector search on message history per docs/convex/agent-usage.md
  textEmbeddingModel: getTextEmbeddingModel() as any,
  instructions: buildOutreachAgentPrompt(DEFAULT_WORKSPACE_USE_CASE_KEY),
  tools: outreachAgentBaseTools,
  // Allow multi-step for complex plan refinement
  maxSteps: 15,
  callSettings: {
    maxOutputTokens: OUTREACH_AGENT_MAX_OUTPUT_TOKENS,
  },
  contextOptions: {
    recentMessages: 20,
    // Enable hybrid text + vector search per docs/convex/llm-context.md
    searchOptions: {
      limit: 10,
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
});
