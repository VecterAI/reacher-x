import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const aiSource = readFileSync("convex/lib/ai.ts", "utf8");
const setupClassificationSource = readFileSync(
  "convex/lib/setupInputClassificationCore.ts",
  "utf8"
);
const setupGenerationSource = readFileSync(
  "convex/lib/setupGenerationCore.ts",
  "utf8"
);
const prospectingSource = readFileSync(
  "convex/workflows/prospecting.ts",
  "utf8"
);
const qualificationSource = readFileSync(
  "convex/workflows/qualification.ts",
  "utf8"
);
const workspacePageSource = readFileSync(
  "features/webapp/workspace/WorkspacePage.tsx",
  "utf8"
);
const setupSessionsSource = readFileSync("convex/setupSessions.ts", "utf8");
const workspacesSource = readFileSync("convex/workspaces.ts", "utf8");

test("onboarding has a dedicated Sol route", () => {
  assert.match(
    aiSource,
    /ONBOARDING_MODEL = getConfiguredModel\([\s\S]*?"AI_ONBOARDING_MODEL",[\s\S]*?MODELS\.GPT_5_6_SOL/
  );
  assert.match(aiSource, /providerLabel: ONBOARDING_PROVIDER_LABEL/);
  assert.match(
    aiSource,
    /ONBOARDING_PROVIDER_OPTIONS[\s\S]*?createGpt56ProviderOptions\(\{ requireParameters: false \}\)[\s\S]*?requireParameters: false/
  );
  assert.match(setupClassificationSource, /routing = "onboarding" as const/);
  assert.match(setupGenerationSource, /routing = "onboarding" as const/);
  assert.match(qualificationSource, /routing: "onboarding"/);
});

test("keyword generation uses Sol and receives original intent", () => {
  assert.match(
    readFileSync("convex/agents/internal.ts", "utf8"),
    /const routing = args.routing \?\? "onboarding"/
  );
  assert.match(prospectingSource, /buildDiscoveryBusinessContext\(workspace\)/);
});

test("workspace description edits regenerate targeting directly", () => {
  assert.match(workspacePageSource, /regenerateWorkspaceTargeting/);
  assert.match(workspacePageSource, /rawUserDescription/);
  assert.doesNotMatch(workspacePageSource, /startWorkspaceRefineSession/);
  assert.doesNotMatch(workspacePageSource, /rollbackWorkspace/);
});

test("legacy workspace refine APIs stay removed", () => {
  assert.doesNotMatch(setupSessionsSource, /startWorkspaceRefineSession/);
  assert.doesNotMatch(workspacesSource, /commitWorkspaceRefine/);
  assert.doesNotMatch(workspacesSource, /rollbackWorkspace/);
});

test("the UI does not misreport a post-save prospecting failure", () => {
  assert.match(
    workspacePageSource,
    /!regeneratedTargeting\.prospectingRestarted[\s\S]*?Workspace and targeting updated[\s\S]*?could not restart automatically/
  );
});
