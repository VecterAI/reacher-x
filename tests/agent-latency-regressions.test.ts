import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chatSource = readFileSync("convex/chat.ts", "utf8");
const contextSource = readFileSync("convex/agents/outreach/index.ts", "utf8");
const workspaceAgentsSource = readFileSync("convex/agents/index.ts", "utf8");
const workspaceMemoryContextSource = readFileSync(
  "convex/agents/workspaceMemoryContext.ts",
  "utf8"
);
const outreachCoreSource = readFileSync("convex/lib/outreachCore.ts", "utf8");
const aiSource = readFileSync("convex/lib/ai.ts", "utf8");
const agentContextSource = readFileSync(
  "convex/lib/agentContextHelpers.ts",
  "utf8"
);
const refinePlanSource = readFileSync(
  "convex/agents/outreach/tools/refinePlan.ts",
  "utf8"
);

test("DM-only plan refinement skips X post-limit validation", () => {
  assert.match(
    refinePlanSource,
    /normalizedTasks\?\.some\(\(task\) => task\.type === "comment"\)/
  );
  assert.match(
    refinePlanSource,
    /const repairedTaskResult =\s+hasCommentTasks/
  );
  assert.match(
    outreachCoreSource,
    /const postLimit = hasXCommentTasks[\s\S]*?getEffectivePostTextLimitForUser/
  );
});

test("agent context uses stored X limits, inline memory, and parallel independent reads", () => {
  assert.match(contextSource, /getStoredXPostLimitContextForAgentUser/);
  assert.doesNotMatch(contextSource, /getEffectivePostLimitForAgentUser/);
  assert.match(
    contextSource,
    /const \[[\s\S]*?workspace[\s\S]*?outreachLearningContext[\s\S]*?profileContext[\s\S]*?outreachPlaybookMessage[\s\S]*?\] = await Promise\.all/
  );
  assert.match(contextSource, /buildWorkspaceMemoryContextFromStore/);
  assert.match(contextSource, /skipSemanticWhenComplete: true/);
  assert.doesNotMatch(
    contextSource,
    /internal\.memory\.getOutreachLearningContextInternal/
  );
});

test("outreach response records critical-path and per-tool timing", () => {
  assert.match(chatSource, /queue_delay_ms/);
  assert.match(chatSource, /context_and_rag_ms/);
  assert.match(chatSource, /first_delta_ready_ms/);
  assert.match(chatSource, /first_saved_delta_ms/);
  assert.match(chatSource, /experimental_onToolCallFinish/);
  assert.match(chatSource, /pre_model_parallel_ms/);
  assert.match(chatSource, /allowSystemInMessages: true/);
});

test("prospect-thread tags do not duplicate the canonical profile snapshot", () => {
  assert.match(
    chatSource,
    /scope\.prospectId === prospect\._id[\s\S]*?canonical thread context supplies the complete profile snapshot/
  );
});

test("main and setup chat default to non-Pro GPT-6 Luna with batched prep and inline memory", () => {
  assert.match(
    aiSource,
    /PINNED_AGENT_MODEL = getConfiguredModel\([^)]*"AI_SETUP_AGENT_MODEL"[^)]*MODELS\.GPT_6_LUNA\b[^)]*\)/
  );
  assert.match(
    aiSource,
    /MAIN_AGENT_MODEL = getConfiguredModel\([^)]*"AI_MAIN_AGENT_MODEL"[^)]*MODELS\.GPT_6_LUNA\b[^)]*\)/
  );
  assert.match(workspaceAgentsSource, /MAIN_AGENT_MODEL/);
  assert.match(workspaceAgentsSource, /MAIN_AGENT_PROVIDER_OPTIONS/);
  assert.match(
    workspaceAgentsSource,
    /maxRetries: WORKSPACE_AGENT_MAX_RETRIES/
  );
  assert.match(contextSource, /maxRetries: OUTREACH_AGENT_MAX_RETRIES/);
  assert.match(chatSource, /internal\.chat\.getWorkspaceAgentTurnPrepInternal/);
  assert.match(
    workspaceMemoryContextSource,
    /loadWorkspaceMemoryContextSnapshotForThreadInternal/
  );
  assert.match(
    workspaceMemoryContextSource,
    /buildWorkspaceMemoryContextFromStore/
  );
  assert.doesNotMatch(workspaceMemoryContextSource, /ctx\.runAction\s*\(/);
});

test("interactive prospect chat uses the fast main model while background outreach stays on Pro", () => {
  assert.match(
    aiSource,
    /OUTREACH_AGENT_MODEL = getConfiguredModel\([^)]*"AI_OUTREACH_AGENT_MODEL"[^)]*MODELS\.GPT_6_LUNA_PRO\b[^)]*\)/
  );
  assert.match(
    contextSource,
    /createOutreachThreadLanguageModel\(threadId: string\)[\s\S]*?MAIN_AGENT_MODEL[\s\S]*?MAIN_AGENT_PROVIDER_OPTIONS/
  );
  assert.match(
    contextSource,
    /outreachLanguageModel = createOutreachLanguageModel\([\s\S]*?OUTREACH_AGENT_MODEL[\s\S]*?OUTREACH_AGENT_PROVIDER_OPTIONS/
  );
  assert.doesNotMatch(chatSource, /classifyOutreachTurn/);
  assert.match(chatSource, /createOutreachThreadLanguageModel/);
});

test("short outreach threads skip history RAG and use compact limits", () => {
  assert.match(agentContextSource, /OUTREACH_RECENT_MESSAGE_LIMIT = 8/);
  assert.match(agentContextSource, /OUTREACH_HISTORY_SEARCH_LIMIT = 4/);
  assert.match(
    agentContextSource,
    /OUTREACH_MIN_MESSAGES_FOR_HISTORY_SEARCH = 8/
  );
  assert.match(chatSource, /searchableMessageCount >=/);
  assert.match(chatSource, /OUTREACH_MIN_MESSAGES_FOR_HISTORY_SEARCH/);
});
