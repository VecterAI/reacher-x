import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { ModelMessage } from "ai";
import {
  buildOutreachModelSessionId,
  buildSafeOutreachContext,
} from "../convex/lib/agentContextHelpers";

const aiSource = readFileSync("convex/lib/ai.ts", "utf8");
const outreachAgentSource = readFileSync(
  "convex/agents/outreach/index.ts",
  "utf8"
);
const chatSource = readFileSync("convex/chat.ts", "utf8");

test("outreach uses one fixed text model with an explicit vision exception", () => {
  assert.match(
    aiSource,
    /OUTREACH_AGENT_MODEL = getConfiguredModel\([\s\S]*?"AI_MAIN_AGENT_MODEL",[\s\S]*?MODELS\.GPT_5_6_SOL/
  );
  assert.doesNotMatch(
    aiSource,
    /AI_OUTREACH_(ROUTER|FAST|STANDARD|RECOVERY)_MODEL/
  );
  assert.doesNotMatch(
    chatSource,
    /classifyOutreachTurn|resolveOutreachTurnModel/
  );
  assert.match(
    chatSource,
    /createOutreachThreadLanguageModel\(args\.threadId\)/
  );
  assert.match(
    chatSource,
    /hiddenContext\.hasVisionInput[\s\S]*?outreachVisionLanguageModel[\s\S]*?createOutreachThreadLanguageModel/
  );
  assert.match(
    outreachAgentSource,
    /createOutreachThreadLanguageModel\(threadId: string\)/
  );
});

test("completed-turn reasoning is removed without changing portable history", () => {
  const historicalAssistant = {
    role: "assistant",
    providerOptions: {
      openrouter: {
        reasoning_details: [
          { type: "reasoning.encrypted", data: "terra-ciphertext" },
        ],
        usage: { cost: 0.01 },
      },
    },
    content: [
      {
        type: "reasoning",
        text: "private reasoning",
        providerOptions: {
          openrouter: {
            reasoning_details: [
              { type: "reasoning.encrypted", data: "terra-ciphertext" },
            ],
          },
        },
      },
      { type: "text", text: "Rahul is a strong match." },
      {
        type: "tool-call",
        toolCallId: "tool-1",
        toolName: "rememberWorkspaceMemory",
        input: { memory: "Find people like Rahul" },
        providerOptions: {
          openrouter: {
            reasoningDetails: [
              { type: "reasoning.encrypted", data: "terra-ciphertext" },
            ],
            cacheControl: { type: "ephemeral" },
          },
        },
      },
    ],
  } as ModelMessage;
  const currentToolContinuation = {
    role: "assistant",
    content: [
      {
        type: "reasoning",
        text: "active reasoning",
        providerOptions: {
          openrouter: {
            reasoning_details: [
              { type: "reasoning.encrypted", data: "sol-ciphertext" },
            ],
          },
        },
      },
    ],
  } as ModelMessage;

  const result = buildSafeOutreachContext({
    search: [],
    recent: [historicalAssistant],
    inputMessages: [],
    inputPrompt: [{ role: "user", content: "Great!" }],
    existingResponses: [currentToolContinuation],
  });

  const sanitizedAssistant = result[0];
  assert.equal(sanitizedAssistant.role, "assistant");
  assert.deepEqual(sanitizedAssistant.providerOptions, {
    openrouter: { usage: { cost: 0.01 } },
  });
  assert.deepEqual(sanitizedAssistant.content, [
    { type: "text", text: "Rahul is a strong match." },
    {
      type: "tool-call",
      toolCallId: "tool-1",
      toolName: "rememberWorkspaceMemory",
      input: { memory: "Find people like Rahul" },
      providerOptions: {
        openrouter: { cacheControl: { type: "ephemeral" } },
      },
    },
  ]);
  assert.strictEqual(result[2], currentToolContinuation);
  assert.equal(
    (historicalAssistant.content as Array<{ type: string }>)[0]?.type,
    "reasoning"
  );
});

test("outreach session affinity no longer varies by model lane", () => {
  assert.equal(
    buildOutreachModelSessionId("thread-123"),
    "reacherx:prospect:thread-123"
  );
  assert.equal(
    buildOutreachModelSessionId("  thread-123  "),
    "reacherx:prospect:thread-123"
  );
});
