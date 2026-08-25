import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  OUTREACH_ROUTER_AGENT_NAME,
  buildOutreachModelSessionId,
  buildOutreachRouterPrompt,
  compactOutreachRouterMessages,
  selectOutreachTextLane,
  summarizeOutreachOperationState,
} from "../convex/lib/outreachModelRoutingCore";

const aiSource = readFileSync("convex/lib/ai.ts", "utf8");
const outreachAgentSource = readFileSync(
  "convex/agents/outreach/index.ts",
  "utf8"
);
const chatSource = readFileSync("convex/chat.ts", "utf8");
const telemetrySource = readFileSync("convex/agentTelemetry.ts", "utf8");

test("router context is compact, chronological, and excludes the current turn", () => {
  const messages = compactOutreachRouterMessages(
    [
      { id: "1", role: "system", text: "hidden context" },
      { id: "2", role: "user", text: " First question " },
      { id: "3", role: "assistant", text: "First answer" },
      { id: "4", role: "tool", text: "tool result" },
      { id: "5", role: "user", text: "Current question" },
    ],
    "5"
  );

  assert.deepEqual(messages, [
    { role: "user", text: "First question" },
    { role: "assistant", text: "First answer" },
  ]);
});

test("semantic lane selection defaults low-confidence decisions to Sol", () => {
  assert.equal(
    selectOutreachTextLane({
      lane: "fast",
      confidence: 0.77,
      reason: "simple_status_or_display",
      rationale: "Probably simple, but uncertain.",
    }).selectedLane,
    "sol"
  );
  assert.equal(
    selectOutreachTextLane({
      lane: "fast",
      confidence: 0.95,
      reason: "simple_status_or_display",
      rationale: "Only displaying stored state.",
    }).selectedLane,
    "fast"
  );
  assert.equal(
    selectOutreachTextLane({
      lane: "sol",
      confidence: 0.91,
      reason: "repeated_correction",
      rationale: "The earlier correction was not understood.",
    }).selectedLane,
    "sol"
  );
});

test("router prompt distinguishes capability truth from basic plan operations", () => {
  const prompt = buildOutreachRouterPrompt({
    currentPrompt:
      "Re-read the workspace description and tell me if the plan assumes a demo.",
    recentMessages: [],
    operationState: summarizeOutreachOperationState({
      prospectStatus: "qualified",
      planStatus: "draft",
      taskStatuses: ["pending", "pending", "approved"],
    }),
  });

  assert.match(prompt, /semantic intent and conversational state/);
  assert.match(prompt, /workspace\/product capability checks/);
  assert.match(prompt, /not a simple plan operation/);
  assert.match(prompt, /plan generation or refinement/);
  assert.match(prompt, /"pending":2/);
});

test("each model lane receives separate thread-level session affinity", () => {
  const terra = buildOutreachModelSessionId("thread-123", "terra");
  const sol = buildOutreachModelSessionId("thread-123", "sol");

  assert.equal(terra, "reacherx:prospect:terra:thread-123");
  assert.equal(sol, "reacherx:prospect:sol:thread-123");
  assert.notEqual(terra, sol);
});

test("OpenRouter routing pins GPT-5.6 to standard OpenAI with Azure fallback", () => {
  assert.match(aiSource, /GPT_5_6_LUNA: "openai\/gpt-5\.6-luna"/);
  assert.match(aiSource, /GPT_5_6_TERRA: "openai\/gpt-5\.6-terra"/);
  assert.match(aiSource, /GPT_5_6_SOL: "openai\/gpt-5\.6-sol"/);
  assert.match(
    aiSource,
    /only: \[OPENROUTER_PROVIDERS\.OPENAI, OPENROUTER_PROVIDERS\.AZURE\]/
  );
  assert.match(
    aiSource,
    /order: \[OPENROUTER_PROVIDERS\.OPENAI, OPENROUTER_PROVIDERS\.AZURE\]/
  );
  assert.match(
    aiSource,
    /OUTREACH_ROUTER_PROVIDER_OPTIONS[\s\S]*?requireParameters: false/
  );
  assert.match(
    aiSource,
    /"AI_OUTREACH_ROUTER_MODEL",[\s\S]*?MODELS\.GPT_5_6_LUNA/
  );
  assert.match(
    outreachAgentSource,
    /JSON\.parse\(extractJsonPayload\(result\.text\)\)/
  );
});

test("prospect chat uses one agent with semantic per-turn model overrides", () => {
  assert.match(chatSource, /classifyOutreachTurn/);
  assert.match(chatSource, /resolveOutreachTurnModel/);
  assert.match(chatSource, /model: resolvedRoute\.model/);
  assert.match(chatSource, /hasVisionInput: hiddenContext\.hasVisionInput/);
  assert.match(outreachAgentSource, /createOutreachTextLanguageModel/);
  assert.match(
    outreachAgentSource,
    /terra:[\s\S]*?supportsExplicitPromptCaching\([\s\S]*?OUTREACH_TERRA_MODEL/
  );
  assert.match(
    outreachAgentSource,
    /sol:[\s\S]*?supportsExplicitPromptCaching\(OUTREACH_SOL_MODEL\)/
  );
  assert.match(
    outreachAgentSource,
    /fast:[\s\S]*?enableExplicitPromptCaching: false/
  );
});

test("router usage is measurable without replacing the answer-model badge", () => {
  assert.match(chatSource, /agentName: OUTREACH_ROUTER_AGENT_NAME/);
  assert.match(telemetrySource, /candidate\.agentName !==/);
  assert.match(telemetrySource, /OUTREACH_ROUTER_AGENT_NAME/);
  assert.match(telemetrySource, /candidate\.provider !== "openai\.embedding"/);
  assert.match(chatSource, /modelByAssistantOrder/);
  assert.match(
    chatSource,
    /return model \? \{ \.\.\.message, model \} : message/
  );
  assert.equal(OUTREACH_ROUTER_AGENT_NAME, "Outreach Turn Router");
});

test("router leaves enough output budget for Luna reasoning plus valid JSON", () => {
  assert.match(outreachAgentSource, /OUTREACH_ROUTER_MAX_OUTPUT_TOKENS = 512/);
  assert.match(outreachAgentSource, /keep rationale under 12 words/);
});
