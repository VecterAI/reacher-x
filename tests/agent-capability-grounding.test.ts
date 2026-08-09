import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildMainAgentPrompt,
  buildOutreachAgentPrompt,
} from "../convex/agents/prompts";

test("main agent prompt requires live workspace reads for mutable facts", () => {
  const prompt = buildMainAgentPrompt();

  assert.match(prompt, /call `queryWorkspace` before answering/);
  assert.match(prompt, /plan count is not qualification count/);
  assert.match(prompt, /getProspectInteractionHistory/);
});

test("main agent asks clarifying questions without entering a pending tool state", () => {
  const prompt = buildMainAgentPrompt();
  const source = readFileSync("convex/agents/index.ts", "utf8");
  const mainTools = source.match(
    /const mainAgentBaseTools = \{([\s\S]*?)\n\} as const;/
  )?.[1];

  assert.ok(mainTools, "Expected to find the Main Agent tool registry");
  assert.doesNotMatch(mainTools, /\baskHuman\b/);
  assert.doesNotMatch(prompt, /\n- askHuman\n/);
  assert.match(prompt, /ask one short question as a normal assistant response/);
});

test("prospect agent prompt routes real conversation questions to interaction history", () => {
  const prompt = buildOutreachAgentPrompt();

  assert.match(prompt, /call `getProspectInteractionHistory` before answering/);
  assert.match(prompt, /Do not treat public timeline posts/);
});

test("prospect agent refines the active plan without a redundant plan read", () => {
  const prompt = buildOutreachAgentPrompt();

  assert.match(prompt, /call `refinePlan` directly/);
  assert.match(prompt, /do not call `getProspectPlan` immediately before it/);
});

test("prospect agent does not repeatedly introduce itself", () => {
  const prompt = buildOutreachAgentPrompt();

  assert.match(prompt, /Mention your name only in the initial greeting/);
  assert.match(prompt, /never introduce yourself or repeat your name/);
  assert.doesNotMatch(prompt, /Prefer concise first-person introductions/);
  assert.doesNotMatch(prompt, /the FIRST sentence must contain your name/);
});

test("prospect agent treats workspace context and user corrections as authoritative", () => {
  const prompt = buildOutreachAgentPrompt();

  assert.match(prompt, /latest injected workspace context/);
  assert.match(prompt, /user's latest correction are authoritative/);
  assert.match(prompt, /Do not defend the old assumption/);
  assert.match(prompt, /existing plans as editable output/);
});
