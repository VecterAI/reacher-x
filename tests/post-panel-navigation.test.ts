import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (file: string) => readFileSync(file, "utf8");

test("generic X posts and quoted X posts use the dedicated Post panel contract", () => {
  const tweetSource = readSource(
    "features/webapp/ui/components/tweet/Tweet.tsx"
  );
  const quoteSource = readSource(
    "features/webapp/ui/components/tweet/QuoteTweetCard.tsx"
  );
  const navigationSource = readSource(
    "features/webapp/hooks/usePostNavigation.ts"
  );

  assert.match(tweetSource, /openTwitterPost\(tweet, resolvedOpenBehavior\)/);
  assert.match(quoteSource, /openTwitterPost\(tweet,/);
  assert.doesNotMatch(tweetSource, /pushPanel\("conversation"/);
  assert.doesNotMatch(quoteSource, /pushPanel\("conversation"/);
  assert.match(navigationSource, /openPanel\("twitter-post"/);
});

test("generic and quoted LinkedIn posts use the LinkedIn Post panel contract", () => {
  const postSource = readSource(
    "features/webapp/ui/components/linkedin/LinkedInPostCard.tsx"
  );
  const quoteSource = readSource(
    "features/webapp/ui/components/linkedin/QuoteLinkedInCard.tsx"
  );
  const navigationSource = readSource(
    "features/webapp/hooks/usePostNavigation.ts"
  );

  assert.match(postSource, /openLinkedInPost\(post, resolvedOpenBehavior/);
  assert.match(quoteSource, /openLinkedInPost\(post,/);
  assert.match(navigationSource, /openPanel\("linkedin-post-thread"/);
});

test("prospect evidence posts open the dedicated full-post panel", () => {
  const panelSource = readSource(
    "features/prospects/ui/components/EvidencePostsPanel.tsx"
  );
  const listSource = readSource(
    "features/prospects/ui/components/EvidencePostsList.tsx"
  );

  assert.match(panelSource, /pushPanel\("twitter-post"/);
  assert.match(panelSource, /pushPanel\("linkedin-post-thread"/);
  assert.match(panelSource, /onPostSelect=\{handlePostSelect\}/);
  assert.match(
    listSource,
    /<LinkedInPostCard[\s\S]*onClick=\{\s*onPostSelect[\s\S]*linkedInPostsById/
  );
  assert.match(listSource, /shouldIgnorePostCardClick\(event\)/);
  assert.match(listSource, /onPostSelect\([\s\S]*tweetsById/);
});

test("explicit interaction conversations and reply composition remain separate", () => {
  const interactionsSource = readSource(
    "features/prospects/ui/components/tabs/YourInteractionsTab.tsx"
  );
  const replyProviderSource = readSource(
    "features/prospects/contexts/ProspectProfileContext.tsx"
  );

  assert.match(interactionsSource, /pushPanel\("conversation"/);
  assert.match(interactionsSource, /groupProspectInteractionsByThread/);
  assert.match(interactionsSource, /fallbackTweets/);
  assert.match(interactionsSource, /AvatarStack/);
  assert.match(interactionsSource, /Show conversation/);
  assert.match(interactionsSource, /Open thread/);
  assert.match(interactionsSource, /TweetSkeleton/);
  assert.match(interactionsSource, /mergeConversationTweetWithFallback/);
  assert.doesNotMatch(
    interactionsSource,
    /LoadingFirstPage"\s*\|\|\s*isSyncing/
  );
  assert.doesNotMatch(interactionsSource, /InteractionReplyPreview/);
  assert.match(replyProviderSource, /pushPanel\("post-compose"/);
});

test("conversation hydration enriches posts without reordering rendered items", () => {
  const panelSource = readSource(
    "features/prospects/ui/components/ConversationPanel.tsx"
  );

  assert.match(panelSource, /mergeConversationTweetsPreservingOrder/);
  assert.match(panelSource, /hasRenderableTweetContent/);
});

test("public interactions sync only while the tab is open", () => {
  const profileSource = readSource(
    "features/prospects/ui/components/ProspectProfilePanel.tsx"
  );
  const interactionsSource = readSource(
    "features/prospects/ui/components/tabs/YourInteractionsTab.tsx"
  );

  assert.match(profileSource, /syncEnabled=\{activeTab === "interactions"\}/);
  assert.doesNotMatch(profileSource, /refreshProspectInteractions/);
  assert.match(
    interactionsSource,
    /if \(!syncEnabled \|\| readOnly \|\| isPreview\)/
  );
  const disabledSyncBranch = interactionsSource.match(
    /if \(!syncEnabled \|\| readOnly \|\| isPreview\) \{([\s\S]*?)return;\n    \}/
  )?.[1];
  assert.ok(disabledSyncBranch);
  assert.doesNotMatch(disabledSyncBranch, /activeSyncRef\.current = null/);
  assert.match(interactionsSource, /force: true/);
  assert.match(
    interactionsSource,
    /isSyncing[\s\S]*?Syncing latest interactions…/
  );
});

test("public interaction discovery enforces ownership and dispatches by platform", () => {
  const actionSource = readSource("convex/interactionsActions.ts");

  assert.match(actionSource, /prospect\.userId !== args\.userId/);
  assert.match(
    actionSource,
    /prospect\.platform === "linkedin"[\s\S]*runLinkedInProspectInteractionDiscovery/
  );
  assert.match(actionSource, /runTwitterProspectInteractionDiscovery/);
});

test("direct X replies retain prospect context for immediate recording", () => {
  const replySource = readSource(
    "features/prospects/ui/components/ReplyPanel.tsx"
  );
  const actionSource = readSource("convex/x.ts");

  assert.match(replySource, /prospectId:/);
  assert.match(replySource, /conversationId:/);
  assert.match(actionSource, /upsertTwitterInteraction/);
  assert.match(actionSource, /origin: "manual_reacherx"/);
});

test("page-originated panels start a clean stack and nested panels push", () => {
  const stackSource = readSource(
    "features/prospects/contexts/PanelStackContext.tsx"
  );
  const twitterProfileSource = readSource(
    "features/webapp/ui/components/tweet/useTwitterProfileNavigation.ts"
  );

  assert.match(stackSource, /openRootPanel/);
  assert.match(twitterProfileSource, /panelStack\.currentPanel/);
  assert.match(twitterProfileSource, /panelStack\.openRootPanel/);
  assert.match(twitterProfileSource, /panelStack\.pushPanel/);
});

test("prospect surfaces render root platform panels without a selected prospect", () => {
  for (const file of [
    "app/(webapp)/page.tsx",
    "app/(webapp)/archives/page.tsx",
    "features/webapp/ui/pages/UseCaseSuccessPage.tsx",
  ]) {
    const source = readSource(file);
    assert.match(source, /const hasOpenPanel = currentPanel !== null/);
    assert.doesNotMatch(source, /const hasOpenPanel = prospectId !== null/);
  }

  const agentSource = readSource("features/agent/ui/AgentPageShell.tsx");
  assert.match(agentSource, /const showStandalonePanel =/);
  assert.match(agentSource, /currentPanel !== null/);
});

test("task editing replaces active agent panels instead of hiding behind them", () => {
  const taskSource = readSource(
    "features/prospects/ui/components/outreach-plan/TaskItem.tsx"
  );
  const agentSource = readSource("features/agent/ui/AgentPageShell.tsx");

  assert.match(taskSource, /const handleEdit[\s\S]*onViewTask\?\.\(\{/);
  assert.match(taskSource, /if \(onViewTask\) \{\s*return;/);
  assert.match(
    agentSource,
    /const showStandalonePanel =[\s\S]*!hasPanelContext[\s\S]*!isPlanPanelActive/
  );
  assert.doesNotMatch(
    agentSource,
    /agentRightSurfaceActive && \(hasPanelContext \|\| isPlanPanelActive\)/
  );
});

test("both Post panels use the desktop left divider without a right divider", () => {
  for (const file of [
    "features/prospects/ui/components/TwitterPostPanel.tsx",
    "features/webapp/ui/components/linkedin/LinkedInPostThreadPanel.tsx",
  ]) {
    const source = readSource(file);
    assert.match(source, /md:border-l/);
    assert.match(source, /md:border-r-0/);
  }
});
