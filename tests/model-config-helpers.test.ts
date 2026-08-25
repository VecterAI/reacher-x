import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  MODEL_ENVIRONMENT_KEYS,
  getConfiguredModel,
} from "../convex/lib/modelConfigHelpers";

const expectedModelEnvironmentKeys = [
  "AI_FAST_MODEL",
  "AI_REASONING_MODEL",
  "AI_AUTOCOMPLETE_MODEL",
  "AI_ONBOARDING_MODEL",
  "AI_SETUP_AGENT_MODEL",
  "AI_MAIN_AGENT_MODEL",
  "AI_OUTREACH_ROUTER_MODEL",
  "AI_OUTREACH_FAST_MODEL",
  "AI_OUTREACH_STANDARD_MODEL",
  "AI_OUTREACH_RECOVERY_MODEL",
  "AI_VISION_MODEL",
  "AI_TEXT_EMBEDDING_MODEL",
] as const;

test("model roles use the complete stable environment key set", () => {
  assert.deepEqual(MODEL_ENVIRONMENT_KEYS, expectedModelEnvironmentKeys);
});

test("configured models are trimmed and empty values use the safe fallback", () => {
  assert.equal(
    getConfiguredModel("AI_FAST_MODEL", "fallback/model", {
      AI_FAST_MODEL: "  provider/new-model  ",
    }),
    "provider/new-model"
  );
  assert.equal(
    getConfiguredModel("AI_FAST_MODEL", "fallback/model", {
      AI_FAST_MODEL: "   ",
    }),
    "fallback/model"
  );
});

test("Convex and local environment templates document every model role", () => {
  const convexConfig = readFileSync("convex/convex.config.ts", "utf8");
  const envExample = readFileSync(".env.example", "utf8");
  const envLocal = readFileSync(".env.local", "utf8");

  for (const key of expectedModelEnvironmentKeys) {
    assert.match(convexConfig, new RegExp(`\\b${key}:`));
    assert.match(envExample, new RegExp(`^# ${key}=`, "m"));
    assert.match(envLocal, new RegExp(`^${key}=\\S+`, "m"));
  }
});
