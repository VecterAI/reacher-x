import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("setup input is classified by a structured LLM instead of regex scoring", () => {
  const classifier = read("convex/lib/setupInputClassificationCore.ts");

  assert.match(classifier, /robustGenerateObject/);
  assert.match(classifier, /z\.discriminatedUnion/);
  assert.match(classifier, /gibberish/);
  assert.equal(
    existsSync("convex/lib/setupUseCaseClassifyCore.ts"),
    false,
    "the removed heuristic classifier must not return"
  );
});

test("setup messages are server-guarded and routed through the Setup Agent", () => {
  const chat = read("convex/chat.ts");
  const hook = read("features/agent/hooks/useAgentChat.ts");

  assert.match(chat, /expectedSurface: v\.optional\(v\.literal\("setup"\)\)/);
  assert.match(chat, /This is not an active setup thread/);
  assert.match(hook, /expectedSurface: "setup" as const/);
  assert.doesNotMatch(
    hook,
    /Chat-first setup: composer submits audience input \(not agent stream\)/
  );
});

test("profile review stays conversational while processing gates lock chat", () => {
  const flow = read("convex/lib/setupFlowCore.ts");
  const agentChat = read("features/agent/ui/AgentChat.tsx");

  assert.match(flow, /"awaiting_icp_confirmation",/);
  assert.match(agentChat, /Ask to add, remove, or refine an ideal profile/);
  assert.match(agentChat, /Chat is locked during this setup step/);
  assert.match(agentChat, /!isSetupCollectingAudience/);
  assert.match(agentChat, /showReasoning=\{!isSetupRoute\}/);
  assert.match(agentChat, /\["discarded", "failed", "ready"\]\.includes/);
});

test("empty setup does not expose its hidden greeting loading state", () => {
  const agentChat = read("features/agent/ui/AgentChat.tsx");
  const emptyState = read(
    "features/agent/ui/components/AgentWorkspaceEmptyState.tsx"
  );

  assert.match(
    agentChat,
    /\(isLoading \|\| isStreaming\) && !isSetupAudienceEntry/
  );
  assert.match(agentChat, /isSetupDraftLoading && !hasSetupUserMessage/);
  assert.match(emptyState, /const showAgentMark = !headline/);
});

test("New workspace asks about an existing draft using an authoritative result", () => {
  const draftFlow = read("features/webapp/hooks/useNewWorkspaceDraftFlow.tsx");

  const requestIndex = draftFlow.indexOf(
    'startSetupSession({ mode: "new_workspace" })'
  );
  const reusedIndex = draftFlow.indexOf("if (result.reused)", requestIndex);
  const dialogIndex = draftFlow.indexOf("setDialogDraft", reusedIndex);

  assert.ok(requestIndex >= 0);
  assert.ok(reusedIndex > requestIndex);
  assert.ok(dialogIndex > reusedIndex);
});

test("an active setup draft remains resumable without trapping existing workspaces", () => {
  const shell = read("convex/shell.ts");
  const workspaceStatus = read("convex/workspaces.ts");
  const sidebar = read(
    "features/webapp/ui/components/sidebar/SidebarHeader.tsx"
  );

  assert.doesNotMatch(shell, /Boolean\(accessibleActiveSession\)/);
  assert.doesNotMatch(workspaceStatus, /Boolean\(activeSession\)/);
  assert.match(
    sidebar,
    /disabled=\{switcherItems\.length <= 1 \|\| isSwitchingWorkspace\}/
  );
});

test("a completed workspace recovers from stale setup preference", () => {
  const guard = read(
    "features/webapp/ui/components/OnboardingLockGuardProvider.tsx"
  );
  const agentChat = read("features/agent/ui/AgentChat.tsx");

  assert.match(guard, /shellState\?\.activeContextType === "workspace"/);
  assert.doesNotMatch(guard, /preferredShellContext === "workspace"/);
  assert.match(
    agentChat,
    /setPreferredShellContext\("workspace"\);\s+router\.push\("\/"\)/
  );
});
