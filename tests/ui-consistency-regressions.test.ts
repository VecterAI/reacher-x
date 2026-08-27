import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const readSource = (file: string) => readFileSync(file, "utf8");

function getApplicationSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return getApplicationSourceFiles(path);
    return /\.(?:js|jsx|mjs|cjs|ts|tsx)$/u.test(entry.name) ? [path] : [];
  });
}

test("application source does not import Lucide icons", () => {
  for (const file of ["app", "features", "shared", "convex"].flatMap(
    getApplicationSourceFiles
  )) {
    assert.doesNotMatch(
      readSource(file),
      /(?:lucide-react|@lucide)/u,
      `${file} must use the custom icon library`
    );
  }
});

test("workspace and notification glyphs use the custom icon library", () => {
  const workspaceSource = readSource(
    "features/webapp/workspace/WorkspaceUseCaseCombobox.tsx"
  );
  const notificationSource = readSource(
    "features/webapp/ui/components/notifications/NotificationsInbox.tsx"
  );
  const iconSource = readSource("shared/ui/components/icons/index.tsx");

  assert.doesNotMatch(workspaceSource, /lucide-react/);
  assert.match(workspaceSource, /KeyboardArrowDownIcon/);
  assert.doesNotMatch(notificationSource, /lucide-react/);
  assert.match(notificationSource, /PsychologyAltIcon/);
  assert.match(notificationSource, /CheckCircleIcon/);
  assert.match(iconSource, /export const PsychologyAltIcon/);
});

test("workspace use-case field uses the shared outreach-goal label", () => {
  const useCasesSource = readSource("shared/lib/workspaceUseCases.ts");

  assert.match(
    useCasesSource,
    /WORKSPACE_USE_CASE_FIELD_LABEL = "Outreach goal"/
  );
  for (const file of [
    "features/webapp/workspace/WorkspaceUseCaseCombobox.tsx",
    "features/webapp/workspace/WorkspacePageSkeleton.tsx",
  ]) {
    const source = readSource(file);
    assert.match(source, /WORKSPACE_USE_CASE_FIELD_LABEL/);
    assert.doesNotMatch(source, /Who to find\/reach/);
  }
});

test("workspace interpretation is hidden while editing and disabled while viewing", () => {
  for (const file of [
    "features/webapp/workspace/WorkspacePage.tsx",
    "features/landing/ui/components/use-case-demo/pages/DemoWorkspacePage.tsx",
  ]) {
    const source = readSource(file);
    assert.match(
      source,
      /\{!isEditing \? \([\s\S]{0,400}name="improvedDescription"[\s\S]{0,600}<Textarea[\s\S]{0,200}\bdisabled\b/,
      `${file} must render the improved description only in disabled view mode`
    );
  }
});

test("pricing exposes the custom fallback and profile titles yield to the shared badge", () => {
  const pricingSource = readSource(
    "features/landing/ui/components/sections/PricingSection.tsx"
  );
  const profileCardSource = readSource(
    "features/prospects/ui/components/ideal-customer-profile/IdealCustomerProfileCard.tsx"
  );

  assert.match(
    pricingSource,
    /For anything else[\s\S]*?value="general_outreach"[\s\S]*?>\s*Other\s*</
  );
  assert.match(profileCardSource, /from "@\/shared\/ui\/components\/Badge"/);
  assert.match(profileCardSource, /min-w-0 flex-1 truncate/);
  assert.match(profileCardSource, /<Badge[\s\S]*?variant="outline"/);
  assert.match(profileCardSource, /AGENT_GENERATED_PROFILE_LABEL/);
  assert.equal(
    readSource("shared/lib/workspaceProfileProvenance.ts").includes(
      'AGENT_GENERATED_PROFILE_LABEL = "△ Agent generated"'
    ),
    true
  );
  for (const file of [
    "features/prospects/ui/components/ideal-customer-profile/IdealCustomerProfileCard.tsx",
    "features/webapp/workspace/WorkspacePage.tsx",
    "features/landing/ui/components/use-case-demo/pages/DemoWorkspacePage.tsx",
  ]) {
    assert.doesNotMatch(readSource(file), /:\s*"AI-generated"/);
  }
});

test("the desktop upgrade panel separates from its content with a left border", () => {
  const source = readSource("features/billing/ui/PlansPage.tsx");

  assert.match(source, /md:border-l/);
  assert.doesNotMatch(source, /md:border-r/);
});

test("the workspace status bar uses active use-case terminology", () => {
  const source = readSource(
    "features/webapp/ui/components/WorkspaceSystemStatusFeedBar.tsx"
  );

  assert.match(source, /useActiveUseCaseLabels/);
  assert.match(source, /entitySingular/);
  assert.match(source, /entityPlural/);
  assert.doesNotMatch(source, /prospect(?:s)?\s+(?:pending|not ready)/i);
});

test("the landing avatar menu reads the authoritative onboarding lock", () => {
  const source = readSource("features/landing/ui/components/Header.tsx");

  assert.doesNotMatch(source, /\$onboardingLock/);
  assert.match(
    source,
    /const locked = shellState\?\.locked \?\? shellStateQuery\.isPending/
  );
});

test("task approval panels render LinkedIn comments with LinkedIn UI", () => {
  const panelSource = readSource(
    "features/agent/ui/components/AgentDynamicPanel.tsx"
  );
  const outreachSource = readSource("convex/outreach.ts");

  assert.match(panelSource, /const platform = data\.platform/);
  assert.match(panelSource, /if \(platform === "linkedin"\)/);
  assert.match(panelSource, /task-linkedin-comment:/);
  assert.match(panelSource, /<LinkedInPostCard/);
  assert.match(panelSource, /<LinkedInReplyComposer/);
  assert.match(panelSource, /<LinkedInCommentItem/);
  assert.match(panelSource, /placeholder="Add a comment\.\.\."/);
  assert.doesNotMatch(
    panelSource,
    /data\.originalPost\?\.platform \|\| "twitter"/
  );
  assert.match(outreachSource, /matchesLinkedInPostReference/);
});

test("LinkedIn unavailable states use shared actionable alerts", () => {
  const commentThreadSource = readSource(
    "features/webapp/ui/components/linkedin/LinkedInCommentThread.tsx"
  );
  const conversationSource = readSource(
    "features/prospects/ui/components/LinkedInConversationPanel.tsx"
  );

  assert.doesNotMatch(commentThreadSource, /Limited thread sync/);
  assert.match(commentThreadSource, /resolveLinkedInRecoveryAction/);
  assert.match(commentThreadSource, /<AlertTitle>\{unavailableTitle\}/);
  assert.doesNotMatch(
    conversationSource,
    /rounded-\[20px\][^\n]*Messaging unavailable/
  );
  assert.match(conversationSource, /<AlertTitle>Messaging unavailable/);
  assert.match(conversationSource, /messagingRecoveryAction\.label/);
});

test("LinkedIn comments use a structural initial loading state", () => {
  const commentThreadSource = readSource(
    "features/webapp/ui/components/linkedin/LinkedInCommentThread.tsx"
  );
  const skeletonSource = readSource(
    "features/webapp/ui/components/linkedin/LinkedInCommentThreadSkeleton.tsx"
  );

  assert.match(
    commentThreadSource,
    /const isInitialLoading = loading && !thread/
  );
  assert.match(commentThreadSource, /disabled=\{loading\}/);
  assert.match(commentThreadSource, /<LinkedInCommentThreadSkeleton/);
  assert.match(
    commentThreadSource,
    /previewScenario\?\.loading \? null : \(previewScenario\?\.thread \?\? null\)/
  );
  assert.doesNotMatch(commentThreadSource, /h-16 w-full rounded-\[20px\]/);
  assert.match(skeletonSource, /<LinkedInReplyComposer/);
  assert.match(skeletonSource, /placeholder="Add a comment\.\.\."/);
  assert.match(skeletonSource, /disabled/);
  assert.equal(
    (skeletonSource.match(/<LinkedInCommentItemSkeleton \/>/g) ?? []).length,
    3
  );
  assert.match(skeletonSource, /role="status"/);
  assert.match(skeletonSource, /aria-label="Loading comments"/);
});

test("DM panels use circular loading and X/Twitter product copy", () => {
  const xConversationSource = readSource(
    "features/prospects/ui/components/XConversationPanel.tsx"
  );
  const linkedInConversationSource = readSource(
    "features/prospects/ui/components/LinkedInConversationPanel.tsx"
  );

  for (const source of [xConversationSource, linkedInConversationSource]) {
    assert.match(source, /<Spinner/);
    assert.match(source, /variant="circle"/);
    assert.doesNotMatch(source, /<Skeleton/);
  }

  assert.match(xConversationSource, /Loading X\/Twitter conversation/);
  assert.match(xConversationSource, /Could not load X\/Twitter conversation/);
  assert.doesNotMatch(xConversationSource, /Could not load X conversation/);
});

test("circular spinners use the primary color without local overrides", () => {
  const spinnerSource = readSource("shared/ui/components/Spinner.tsx");
  assert.match(spinnerSource, /text-primary animate-spin/);

  for (const file of [
    "shared/ui/components/InfiniteScrollTrigger.tsx",
    "features/agent/ui/AgentChat.tsx",
    "features/agent/ui/components/AgentOnboardingPanelSpinner.tsx",
    "features/prospects/ui/components/XConversationPanel.tsx",
    "features/prospects/ui/components/LinkedInConversationPanel.tsx",
    "features/composer/ui/components/MediaUploadSection.tsx",
  ]) {
    const source = readSource(file);
    for (const match of source.matchAll(/<Spinner\b[\s\S]*?\/>/g)) {
      if (match[0].includes('variant="circle"')) {
        assert.doesNotMatch(
          match[0],
          /text-(?:muted-foreground|foreground|primary-foreground)/,
          `${file} must not override the shared circle-spinner color`
        );
      }
    }
  }
});

test("voice-note controls stay compact, themed, and continuously seekable", () => {
  const composerSource = readSource(
    "features/composer/ui/components/voice-note-composer/VoiceNoteComposer.tsx"
  );
  const timeSource = readSource(
    "features/composer/ui/components/voice-note-composer/VoiceNoteTime.tsx"
  );
  const waveformSource = readSource("shared/ui/components/Waveform.tsx");

  assert.match(composerSource, /items-center gap-1/);
  assert.match(composerSource, /size="xsIcon"/);
  assert.match(composerSource, /min-h-10/);
  assert.match(composerSource, /TooltipContent/);
  assert.doesNotMatch(composerSource, /bg-destructive/);
  assert.doesNotMatch(composerSource, /isRecording && "text-destructive"/);
  assert.doesNotMatch(composerSource, />\s*(?:Delete|Cancel|Stop|Send)\s*</u);
  assert.match(timeSource, /AnimatedNumber/);
  assert.match(timeSource, /minimumIntegerDigits: 2/);

  assert.match(waveformSource, /type="range"/);
  assert.match(waveformSource, /touch-pan-y/);
  assert.match(waveformSource, /getComputedStyle\(container\)\.color/);
  assert.match(waveformSource, /MutationObserver/);
  assert.doesNotMatch(waveformSource, /getPropertyValue\("--foreground"\)/);
  assert.doesNotMatch(waveformSource, /onPointerDown/);
  assert.doesNotMatch(waveformSource, /focus-within:ring/);
});

test("conversation history opens at the latest page and preserves scroll position", () => {
  const conversationViewportSource = readSource(
    "features/prospects/ui/components/ConversationMessageViewport.tsx"
  );

  assert.match(conversationViewportSource, /defaultScrollPosition="end"/);
  assert.match(conversationViewportSource, /preserveScrollOnPrepend/);
  assert.match(conversationViewportSource, /scrollToEnd/);
  assert.match(conversationViewportSource, /Loading earlier messages/);
  assert.match(conversationViewportSource, /Retry earlier messages/);
});

test("Agent history loads at the start edge with a circular spinner", () => {
  const agentChatSource = readSource("features/agent/ui/AgentChat.tsx");

  assert.match(agentChatSource, /function AgentHistoryLoadingIndicator/);
  assert.match(agentChatSource, /onScroll=\{handleMessageScroll\}/);
  assert.match(agentChatSource, /scrollTop > AGENT_HISTORY_PRELOAD_DISTANCE/);
  assert.match(agentChatSource, /messageStatus === "LoadingMore"/);
  assert.match(agentChatSource, /Loading earlier messages/);
  assert.match(agentChatSource, /<Spinner/);
  assert.match(agentChatSource, /variant="circle"/);
  assert.doesNotMatch(agentChatSource, /messageId="load-more"/);
  assert.doesNotMatch(agentChatSource, /RefreshIcon/);
});

test("desktop side panels own a left divider and mobile panels have no side borders", () => {
  const pageLayoutSource = readSource(
    "features/webapp/ui/components/page/PageLayout.tsx"
  );

  assert.match(
    pageLayoutSource,
    /border-x-0 md:border-border md:border-l md:border-r-0/
  );
  assert.doesNotMatch(pageLayoutSource, /min-w-0 md:border-r(?:\s|["'])/);

  for (const file of [
    "app/(webapp)/page.tsx",
    "app/(webapp)/archives/page.tsx",
    "app/(webapp)/post/linkedin/[id]/page.tsx",
    "app/(webapp)/post/x/[id]/page.tsx",
    "features/agent/ui/AgentPageShell.tsx",
    "features/webapp/ui/pages/UseCaseSuccessPage.tsx",
  ]) {
    assert.match(
      readSource(file),
      /DESKTOP_PANEL_BORDER_CLASS_NAME/,
      `${file} must use the shared panel border contract`
    );
  }

  const dedicatedProspectPage = readSource(
    "features/prospects/ui/pages/UseCaseProspectPage.tsx"
  );
  assert.doesNotMatch(dedicatedProspectPage, /DESKTOP_PANEL_BORDER_CLASS_NAME/);
  assert.match(dedicatedProspectPage, /\[&_\[data-page-layout\]\]:border-x-0/);

  for (const file of [
    "features/agent/ui/components/AgentOnboardingPanel.tsx",
    "features/agent/ui/components/AgentOnboardingPanelSpinner.tsx",
  ]) {
    const source = readSource(file);
    assert.match(source, /DESKTOP_PANEL_BORDER_CLASS_NAME/);
    assert.doesNotMatch(source, /md:border-r(?:\s|["'])/);
  }
});

test("dedicated prospect routes keep unresolved data in the profile skeleton", () => {
  const source = readSource(
    "features/prospects/ui/pages/UseCaseProspectPage.tsx"
  );

  assert.match(source, /selectedProspectId !== prospectId \|\| loading/);
  assert.match(source, /loading=\{isResolvingRouteProspect\}/);
  assert.match(source, /!routeProspect && !isResolvingRouteProspect/);
});
