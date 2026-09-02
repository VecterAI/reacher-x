import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chatSource = readFileSync("convex/chat.ts", "utf8");
const contextSource = readFileSync("convex/agents/outreach/index.ts", "utf8");
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

test("agent context uses stored X limits and parallel independent reads", () => {
  assert.match(contextSource, /getStoredXPostLimitContextForAgentUser/);
  assert.doesNotMatch(contextSource, /getEffectivePostLimitForAgentUser/);
  assert.match(
    contextSource,
    /const \[[\s\S]*?workspace[\s\S]*?outreachLearningContext[\s\S]*?profileContext[\s\S]*?\] = await Promise\.all/
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

test("setup agent uses the dedicated onboarding provider lane", () => {
  assert.match(
    aiSource,
    /PINNED_AGENT_MODEL = getConfiguredModel\([\s\S]*?"AI_SETUP_AGENT_MODEL",[\s\S]*?ONBOARDING_MODEL/
  );
  assert.match(
    aiSource,
    /PINNED_AGENT_PROVIDER_OPTIONS[\s\S]*?defaultOptions: ONBOARDING_PROVIDER_OPTIONS/
  );
  assert.match(contextSource, /maxRetries: OUTREACH_AGENT_MAX_RETRIES/);
});

test("prospect agent keeps one fixed Sol text model", () => {
  assert.match(
    aiSource,
    /OUTREACH_AGENT_MODEL = getConfiguredModel\([\s\S]*?"AI_MAIN_AGENT_MODEL",[\s\S]*?MODELS\.GPT_5_6_SOL/
  );
  assert.match(contextSource, /OUTREACH_AGENT_MODEL/);
  assert.match(contextSource, /OUTREACH_AGENT_PROVIDER_OPTIONS/);
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
