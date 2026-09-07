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
  const mutationStart = chat.indexOf(
    "export const initiateStreamingMessage = mutation("
  );
  const mutationEnd = chat.indexOf("export const", mutationStart + 20);
  const initiateMutation = chat.slice(mutationStart, mutationEnd);
  const setupLookupIndex = initiateMutation.indexOf(
    "internal.setupSessions.getByThreadIdInternal"
  );
  const expectedSurfaceGuardIndex = initiateMutation.indexOf(
    'if (args.expectedSurface === "setup")'
  );
  const handoffStart = hook.indexOf(
    "// Landing composer handoff: one-shot prompt becomes a real Setup Agent turn."
  );
  const handoffEnd = hook.indexOf(
    "const threadGenerationStateQuery",
    handoffStart
  );
  const landingHandoffBranch = hook.slice(handoffStart, handoffEnd);

  assert.match(chat, /expectedSurface: v\.optional\(v\.literal\("setup"\)\)/);
  assert.match(chat, /This is not an active setup thread/);
  assert.ok(mutationStart >= 0);
  assert.ok(mutationEnd > mutationStart);
  assert.ok(setupLookupIndex >= 0);
  assert.ok(expectedSurfaceGuardIndex > setupLookupIndex);
  assert.match(initiateMutation, /prompt: trimmedPrompt \? args\.prompt : ""/);
  assert.match(initiateMutation, /rawUserDescription: args\.prompt/);
  assert.match(landingHandoffBranch, /buildLandingSetupHandoffRequest/);
  assert.match(landingHandoffBranch, /handoff\.submittedTurn/);
  assert.doesNotMatch(
    hook,
    /Chat-first setup: composer submits audience input \(not agent stream\)/
  );
});

test("landing workspace decisions reuse the shared modal and defer setup bootstrap", () => {
  const landing = read("features/landing/ui/components/LandingPromptCta.tsx");
  const shell = read("features/agent/ui/AgentPageShell.tsx");
  const hook = read("features/agent/hooks/useAgentChat.ts");

  assert.match(landing, /useNewWorkspaceDraftFlow/);
  assert.match(landing, /if \(kind === "continued"\)/);
  assert.match(shell, /useNewWorkspaceDraftFlow/);
  assert.match(shell, /landingDraftFlow\.modal/);
  assert.match(shell, /deferSetupHandoff=\{isLandingDraftDecisionPending\}/);
  assert.match(hook, /!deferSetupHandoff &&/);
  assert.match(hook, /deferSetupHandoff \|\|/);
});

test("stored landing prompts become pending chat turns before setup hydration", () => {
  const hook = read("features/agent/hooks/useAgentChat.ts");
  const agentChat = read("features/agent/ui/AgentChat.tsx");
  const preparationStart = hook.indexOf(
    "// Prepare a stored `/home` prompt before the browser paints"
  );
  const deliveryStart = hook.indexOf(
    "// Landing composer handoff: one-shot prompt becomes a real Setup Agent turn."
  );
  const preparation = hook.slice(preparationStart, deliveryStart);
  const hydrationStart = agentChat.indexOf(
    "const isExplicitSetupThreadHydrating ="
  );
  const hydrationEnd = agentChat.indexOf(
    "const isSetupAudienceEntry =",
    hydrationStart
  );
  const hydrationGate = agentChat.slice(hydrationStart, hydrationEnd);

  assert.ok(preparationStart >= 0);
  assert.ok(deliveryStart > preparationStart);
  assert.match(preparation, /useLayoutEffect\(\(\) =>/);
  assert.match(preparation, /readStoredLandingPromptHandoff/);
  assert.match(preparation, /setPendingTurn\(nextPendingTurn\)/);
  assert.match(hydrationGate, /!hasSetupUserMessage/);
  assert.match(hydrationGate, /messageStatus === "LoadingFirstPage"/);
});

test("new setup threads stay empty until the user sends the first message", () => {
  const setupSessions = read("convex/setupSessions.ts");
  const setupWorkflow = read("convex/workflows/setup.ts");
  const hook = read("features/agent/hooks/useAgentChat.ts");

  assert.doesNotMatch(setupSessions, /SETUP_GREETING_PROMPT|__INIT__/);
  assert.doesNotMatch(setupWorkflow, /postSetupSessionGreetingInternal/);
  assert.doesNotMatch(hook, /ensureSetupGreeting|greetingOrder/);
  assert.match(hook, /ensureSetupSessionWorkflow/);
  assert.match(hook, /legacySetupGreetingOrders/);
});

test("profile review stays conversational while processing gates lock chat", () => {
  const flow = read("convex/lib/setupFlowCore.ts");
  const agentChat = read("features/agent/ui/AgentChat.tsx");

  assert.match(flow, /"awaiting_icp_confirmation",/);
  assert.match(agentChat, /Tell me what to change about these/);
  assert.match(agentChat, /Chat is locked during this setup step/);
  assert.match(agentChat, /!isSetupCollectingAudience/);
  assert.match(agentChat, /showReasoning=\{!isSetupRoute\}/);
  assert.match(agentChat, /\["discarded", "failed", "ready"\]\.includes/);
});

test("setup hydration uses a spinner and setup-only workflow work does not expose Stop", () => {
  const agentChat = read("features/agent/ui/AgentChat.tsx");
  const emptyState = read(
    "features/agent/ui/components/AgentWorkspaceEmptyState.tsx"
  );

  assert.match(agentChat, /isExplicitSetupThreadHydrating/);
  assert.match(agentChat, /aria-label="Loading setup conversation"/);
  assert.match(
    agentChat,
    /isSetupRoute \? isStreaming : isLoading \|\| isStreaming/
  );
  assert.match(emptyState, /const showAgentMark = !headline/);
});

test("setup examples use the existing prospect card and production panel", () => {
  const agentChat = read("features/agent/ui/AgentChat.tsx");
  const snapshots = read("features/agent/lib/setupProfileSnapshots.ts");
  const panel = read("features/agent/ui/components/AgentOnboardingPanel.tsx");
  const examples = read(
    "features/agent/ui/components/onboarding/SetupExampleProfiles.tsx"
  );
  assert.match(agentChat, /listSetupProfileSnapshots/);
  assert.match(snapshots, /generationRevision/);
  assert.match(panel, /SetupExampleProfiles/);
  assert.match(examples, /<ProspectCard/);
  assert.match(panel, /api\.setupSessions\.approveSetupGeneration/);
  assert.doesNotMatch(panel, /setup-mock/);
});

test("setup cards never render beneath the pending Thinking response", () => {
  const agentChat = read("features/agent/ui/AgentChat.tsx");
  const pendingStart = agentChat.indexOf("function PendingAssistantMessage");
  const pendingEnd = agentChat.indexOf(
    "function SetupInlineAgentMessage",
    pendingStart
  );
  const pendingComponent = agentChat.slice(pendingStart, pendingEnd);

  assert.ok(pendingStart >= 0);
  assert.ok(pendingEnd > pendingStart);
  assert.doesNotMatch(pendingComponent, /supplementalContent/);
  assert.doesNotMatch(pendingComponent, /SetupOnboardingInlineCard/);
});

test("example approval is revision-specific and blocked during a pending chat turn", () => {
  const panel = read("features/agent/ui/components/AgentOnboardingPanel.tsx");
  const agentChat = read("features/agent/ui/AgentChat.tsx");
  assert.match(panel, /generationRevision: session.generationRevision/);
  assert.match(panel, /isApproving \|\| approvalDisabled/);
  assert.match(
    agentChat,
    /onSetupTurnPendingChange\?\.\(isLoading \|\| isStreaming\)/
  );
  assert.match(
    read("convex/agents/tools/setupSessionChat.ts"),
    /approveSetupExamples/
  );
});

test("workspace details prefer the immutable raw description", () => {
  const defaults = read("features/webapp/workspace/workspaceFormDefaults.ts");
  const rawDescription = defaults.indexOf("workspace.rawUserDescription");
  const seedDescription = defaults.indexOf("workspace.seedDescription");

  assert.ok(rawDescription >= 0);
  assert.ok(seedDescription > rawDescription);
});

test("X OAuth completion persists the connection step before leaving setup", () => {
  const connectionsStep = read(
    "features/agent/ui/components/onboarding/ConnectionsStep.tsx"
  );
  const onboardingPanel = read(
    "features/agent/ui/components/AgentOnboardingPanel.tsx"
  );
  const setupSessions = read("convex/setupSessions.ts");
  const setupStatusTool = read("convex/agents/tools/getUserStatus.ts");

  assert.match(connectionsStep, /completionSessionIdRef\.current/);
  assert.match(
    connectionsStep,
    /void persistConnectionsStep\(\{ connectedX: true \}\)/
  );
  assert.match(connectionsStep, /onCompleteStep\(result\.status\)/);
  assert.match(onboardingPanel, /<ConnectionsStep/);
  assert.match(
    read("features/agent/ui/AgentChat.tsx"),
    /<OnboardingProgressCard/
  );
  assert.match(setupSessions, /requiresSetupConnectionsStep\(\{/);
  assert.match(setupStatusTool, /requiresSetupConnectionsStep\(\{/);
  assert.match(setupSessions, /alreadyCompleted: true as const/);
});

test("setup profile proposals stay inside assistant content before its footer", () => {
  const agentChat = read("features/agent/ui/AgentChat.tsx");
  const assistantMessageStart = agentChat.indexOf("// Assistant message");
  const supplementalContentIndex = agentChat.indexOf(
    "{supplementalContent}",
    assistantMessageStart
  );
  const sourcesIndex = agentChat.indexOf(
    "{assistantSources.length > 0",
    assistantMessageStart
  );
  const actionsIndex = agentChat.indexOf(
    "{/* Copy action for assistant messages */}",
    assistantMessageStart
  );

  assert.ok(assistantMessageStart >= 0);
  assert.ok(supplementalContentIndex > assistantMessageStart);
  assert.ok(sourcesIndex > supplementalContentIndex);
  assert.ok(actionsIndex > supplementalContentIndex);
});

test("ideal-profile pain chips cannot widen mobile cards or panel forms", () => {
  const profileCard = read(
    "features/prospects/ui/components/ideal-customer-profile/IdealCustomerProfileCard.tsx"
  );
  const painPointsField = read(
    "features/webapp/workspace/WorkspaceIcpPainPointsField.tsx"
  );
  const profilePanel = read(
    "features/agent/ui/components/WorkspaceProfileReviewPanel.tsx"
  );

  assert.match(
    profileCard,
    /<footer className="[^"]*w-full[^"]*max-w-full[^"]*min-w-0[^"]*overflow-hidden/
  );
  assert.match(profileCard, /max-w-full shrink-0 overflow-hidden/);
  assert.match(profileCard, /<span className="min-w-0 truncate">/);
  assert.match(painPointsField, /flex w-full max-w-full min-w-0 flex-wrap/);
  assert.match(painPointsField, /max-w-full min-w-0 shrink items-center/);
  assert.match(painPointsField, /gap-0\.5 overflow-hidden/);
  assert.match(painPointsField, /min-w-0 flex-1 truncate/);
  assert.match(profilePanel, /min-w-0 max-w-full space-y-0/);
});

test("New workspace asks about an existing draft using an authoritative result", () => {
  const draftFlow = read("features/webapp/hooks/useNewWorkspaceDraftFlow.tsx");

  const requestIndex = draftFlow.indexOf("startSetupSession({ mode })");
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
