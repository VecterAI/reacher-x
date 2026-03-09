// convex/agents/outreach/index.ts
// Outreach Agent definition using @convex-dev/agent + OpenRouter
"use node";

import { Agent, type ContextHandler } from "@convex-dev/agent";
import { components, internal } from "../../_generated/api";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { REASONING_MODEL } from "../../lib/ai";
import { OUTREACH_AGENT_PROMPT } from "../prompts";
import {
  getProspectContext,
  getProspectPlan,
  generatePlan,
  refinePlan,
  analyzeBestEngagement,
  askHuman,
  approveTask,
  displayPost,
} from "./tools";

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

    // Prepend context to all messages
    return [contextMessage, ...args.allMessages];
  } catch (error) {
    console.warn("[Outreach Agent] Failed to fetch prospect context:", error);
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
  languageModel: openrouter(REASONING_MODEL),
  // Enable vector search on message history per docs/convex/agent-usage.md
  textEmbeddingModel: openrouter.textEmbeddingModel(
    "openai/text-embedding-3-small"
  ),
  instructions: OUTREACH_AGENT_PROMPT,
  tools: {
    // Context tools
    getProspectContext,
    getProspectPlan,
    // Plan management
    generatePlan,
    refinePlan,
    // Engagement analysis
    analyzeBestEngagement,
    // Generative UI - renders posts inline in chat
    displayPost,
    // Human-in-the-loop
    askHuman,
    // Task approval
    approveTask,
  },
  // Allow multi-step for complex plan refinement
  maxSteps: 15,
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
});
