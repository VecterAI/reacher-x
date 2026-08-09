// convex/agents/index.ts
// Agent definitions using @convex-dev/agent + OpenRouter

import { Agent } from "@convex-dev/agent";
import { stepCountIs, wrapLanguageModel } from "ai";
import { components, internal } from "../_generated/api";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  type OpenRouterProviderOptions,
  OUTREACH_AGENT_MODEL,
  OUTREACH_AGENT_PROVIDER_OPTIONS,
  PINNED_AGENT_MODEL,
  PINNED_AGENT_PROVIDER_OPTIONS,
  PINNED_VISION_MODEL,
  PINNED_VISION_PROVIDER_OPTIONS,
  getOpenRouterExtraBody,
} from "../lib/ai";
import {
  openRouterMetadataMiddleware,
  sanitizeProviderMetadataForConvex,
} from "../lib/agentMetadata";
import { buildMainAgentPrompt, buildSetupAgentPrompt } from "./prompts";
import { DEFAULT_WORKSPACE_USE_CASE_KEY } from "../../shared/lib/workspaceUseCases";
import { analyzeUrl } from "./tools/analyzeUrl";
import { convertToSocialQueries } from "./tools/convertToSocialQueries";
import { createWorkspace } from "./tools/createWorkspace";
import { enrichProspect } from "./tools/enrichProspect";
import { generateImprovedDescriptionAndICPs } from "./tools/generateImprovedDescription";
import { getUserStatus } from "./tools/getUserStatus";
import {
  approveSetupIdealProfiles,
  reviseSetupAudience,
  submitSetupAudience,
} from "./tools/setupSessionChat";
import { listProspectPlans, managePlanBatch } from "./tools/planBatch";
import { qualifyProspect } from "./tools/qualifyProspect";
import { queryWorkspace } from "./tools/queryWorkspace";
import { rememberWorkspaceMemory } from "./tools/rememberWorkspaceMemory";
import { searchProspects } from "./tools/searchProspects";
import { searchWorkspaceMemories } from "./tools/searchWorkspaceMemories";
import { startWorkspacePlans } from "./tools/startWorkspacePlans";
import { updateWorkspace } from "./tools/updateWorkspace";
import {
  approveWorkspaceProfiles,
  proposeWorkspaceProfiles,
  rejectWorkspaceProfiles,
} from "./tools/workspaceProfileChanges";
import { approveSocialActionRequest } from "./outreach/tools/approveSocialActionRequest";
import { approveTask } from "./outreach/tools/approveTask";
import { displayEntity } from "./outreach/tools/displayEntity";
import { getProspectInteractionHistory } from "./outreach/tools/getProspectInteractionHistory";
import { getProspectPlan } from "./outreach/tools/getProspectPlan";
import { getSocialContext } from "./outreach/tools/getSocialContext";
import { inspectWorkspace } from "./outreach/tools/inspectWorkspace";
import {
  cancelPlan,
  deletePlan,
  pausePlan,
  resumePlan,
} from "./outreach/tools/planLifecycle";
import { researchProspect } from "./outreach/tools/researchProspect";
import { socialAction } from "./outreach/tools/socialAction";
import { stopOnDeferredAgentExecution } from "../lib/deferredAgentTurn";

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
      "HTTP-Referer": "https://reacherx.com",
      "X-Title": "ReacherX",
    },
  });
}

const openrouter = getOpenRouterProvider();
function createWorkspaceLanguageModel(
  modelId: string,
  providerOptions: OpenRouterProviderOptions
) {
  return wrapLanguageModel({
    model: openrouter(modelId, {
      extraBody: getOpenRouterExtraBody(providerOptions),
    }) as any,
    middleware: openRouterMetadataMiddleware,
  });
}

export const workspaceLanguageModel = createWorkspaceLanguageModel(
  // Pin tool-calling setup runs to the validated Cerebras route. This avoids
  // provider roulette for multi-step streamed agent turns.
  PINNED_AGENT_MODEL,
  PINNED_AGENT_PROVIDER_OPTIONS
);

export const workspaceMainLanguageModel = createWorkspaceLanguageModel(
  OUTREACH_AGENT_MODEL,
  OUTREACH_AGENT_PROVIDER_OPTIONS
);

export const workspaceVisionLanguageModel = createWorkspaceLanguageModel(
  PINNED_VISION_MODEL,
  PINNED_VISION_PROVIDER_OPTIONS
);

const mainAgentBaseTools = {
  // Workspace context. Global discovery is intentionally setup-only.
  inspectWorkspace,
  queryWorkspace,
  listProspectPlans,
  managePlanBatch,
  startWorkspacePlans,
  proposeWorkspaceProfiles,
  approveWorkspaceProfiles,
  rejectWorkspaceProfiles,
  // Selected prospect context
  getProspectInteractionHistory,
  getSocialContext,
  getProspectPlan,
  researchProspect,
  // Plan management
  pausePlan,
  resumePlan,
  cancelPlan,
  deletePlan,
  // Direct actions + UI
  displayEntity,
  socialAction,
  approveSocialActionRequest,
  approveTask,
  // Memory
  rememberWorkspaceMemory,
  searchWorkspaceMemories,
} as const;

export const mainAgent = new Agent(components.agent, {
  name: "Main Agent",
  languageModel: workspaceMainLanguageModel,
  instructions: buildMainAgentPrompt(DEFAULT_WORKSPACE_USE_CASE_KEY),
  tools: mainAgentBaseTools,
  stopWhen: [
    stepCountIs(15),
    stopOnDeferredAgentExecution<typeof mainAgentBaseTools>(),
  ],
  contextOptions: {
    recentMessages: 20,
  },
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

// ============================================================================
// Setup Agent
// ============================================================================

/**
 * The Setup Agent handles user onboarding, workspace creation, and ICP generation.
 *
 * Flows:
 * 1. New User: Greet → Get URL/Description → Analyze → Generate ICPs → Approve → Create Workspace
 * 2. Incomplete first workspace: Greet → Get URL/Description → Generate ICPs → Approve → Create Workspace
 * 3. New Workspace: Same as #1 but creates new instead of default
 *
 * @see AGENT_CONTEXT.txt for detailed flow documentation
 */
export const setupAgent = new Agent(components.agent, {
  name: "Setup Agent",
  languageModel: workspaceLanguageModel,
  instructions: buildSetupAgentPrompt(DEFAULT_WORKSPACE_USE_CASE_KEY),
  tools: {
    // Setup tools
    analyzeUrl,
    generateImprovedDescriptionAndICPs,
    getUserStatus,
    submitSetupAudience,
    reviseSetupAudience,
    approveSetupIdealProfiles,
    createWorkspace,
    updateWorkspace,
    // Prospecting tools
    convertToSocialQueries,
    searchProspects,
    // Qualification tools
    qualifyProspect,
    // Enrichment tools
    enrichProspect,
    // Workspace memory tools
    rememberWorkspaceMemory,
    searchWorkspaceMemories,
  },
  // Allow multiple tool calls for complex flows
  maxSteps: 15,
  // Customize model behavior
  contextOptions: {
    recentMessages: 20,
  },
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

// ============================================================================
// Re-exports
// ============================================================================

// Export prompts for external use
export * from "./prompts";

// Export tools for testing/direct use
export * from "./tools";
