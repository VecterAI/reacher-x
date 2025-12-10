// convex/agents/index.ts
// Agent definitions using @convex-dev/agent + OpenRouter

import { Agent } from "@convex-dev/agent";
import { components } from "../_generated/api";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { REASONING_MODEL } from "../lib/ai";
import { SETUP_AGENT_PROMPT } from "./prompts";
import {
  analyzeUrl,
  generateImprovedDescriptionAndICPs,
  getUserStatus,
  createWorkspace,
  updateWorkspace,
} from "./tools";

// ============================================================================
// Lazy Model Provider
// ============================================================================

/**
 * Creates a language model using OpenRouter.
 * The API key is read from environment at runtime.
 * 
 * OpenRouter provides:
 * - Access to 400+ models
 * - Auto fallbacks
 * - Provider routing
 * - Tool calling support
 */
function getOpenRouterProvider() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[Agent] Missing OPENROUTER_API_KEY environment variable. " +
        "Get it from: https://openrouter.ai/settings/keys"
    );
  }
  return createOpenRouter({
    apiKey,
    headers: {
      "HTTP-Referer": "https://reacherx.io",
      "X-Title": "ReacherX",
    },
  });
}

const openrouter = getOpenRouterProvider();

// ============================================================================
// Setup Agent
// ============================================================================

/**
 * The Setup Agent handles user onboarding, workspace creation, and ICP generation.
 * 
 * Flows:
 * 1. New User: Greet → Get URL/Description → Analyze → Generate ICPs → Approve → Create Workspace
 * 2. v3→v4 Migration: Detect → Show existing → Generate ICPs → Approve → Update Workspace
 * 3. New Workspace: Same as #1 but creates new instead of default
 * 
 * @see AGENT_CONTEXT.txt for detailed flow documentation
 */
export const setupAgent = new Agent(components.agent, {
  name: "Setup Agent",
  languageModel: openrouter(REASONING_MODEL),
  instructions: SETUP_AGENT_PROMPT,
  tools: {
    analyzeUrl,
    generateImprovedDescriptionAndICPs,
    getUserStatus,
    createWorkspace,
    updateWorkspace,
  },
  // Allow multiple tool calls for complex flows
  maxSteps: 10,
  // Customize model behavior
  contextOptions: {
    recentMessages: 20,
  },
});

// ============================================================================
// Re-exports
// ============================================================================

// Export prompts for external use
export * from "./prompts";

// Export tools for testing/direct use
export * from "./tools";
