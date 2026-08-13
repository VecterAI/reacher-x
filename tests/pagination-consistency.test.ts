import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (file: string) => readFileSync(file, "utf8");

test("notifications use cursor pagination while toasts monitor pending items", () => {
  const pageSource = readSource("app/(webapp)/notifications/page.tsx");
  const inboxSource = readSource(
    "features/webapp/ui/components/notifications/NotificationsInbox.tsx"
  );
  const outreachSource = readSource("convex/outreach.ts");
  const toastHookSource = readSource(
    "shared/hooks/useOutreachNotificationToast.ts"
  );

  assert.match(pageSource, /usePaginatedQuery/);
  assert.match(pageSource, /initialNumItems: NOTIFICATIONS_PAGE_SIZE/);
  assert.match(pageSource, /notificationsQuery\.loadMore/);
  assert.match(inboxSource, /<InfiniteScrollTrigger/);
  assert.match(outreachSource, /paginationOpts: paginationOptsValidator/);
  assert.match(outreachSource, /\.paginate\(paginationOpts\)/);
  assert.match(outreachSource, /export const listPendingNotifications/);
  assert.match(toastHookSource, /api\.outreach\.listPendingNotifications/);
});

test("activity logs load the next cursor page from the shared trigger", () => {
  const backendSource = readSource("convex/outreach.ts");
  const tabSource = readSource(
    "features/prospects/ui/components/tabs/ActivityLogTab.tsx"
  );

  assert.match(backendSource, /export const getActivityLog = query/);
  assert.match(backendSource, /paginationOpts: paginationOptsValidator/);
  assert.match(backendSource, /activityQuery\.paginate\(paginationOpts\)/);
  assert.match(tabSource, /usePaginatedQuery/);
  assert.match(tabSource, /<InfiniteScrollTrigger/);
  assert.match(tabSource, /dataQuery\.loadMore\(ACTIVITIES_PER_PAGE\)/);
  assert.doesNotMatch(tabSource, /setLimit|loadingLimit/);
});

test("the legacy X conversation panel forwards reply cursors", () => {
  const validatorSource = readSource("convex/validators.ts");
  const actionSource = readSource("convex/socialapi.ts");
  const panelSource = readSource(
    "features/prospects/ui/components/ConversationPanel.tsx"
  );

  assert.match(
    validatorSource,
    /getDynamicThreadDataArgsValidator[\s\S]*repliesCursor/
  );
  assert.match(actionSource, /repliesCursor[\s\S]*getConversationContext/);
  assert.match(panelSource, /<InfiniteScrollTrigger/);
  assert.match(panelSource, /loadConversation\(nextRepliesCursor\)/);
});

test("Agent observability remains table-based pagination", () => {
  const dashboardSource = readSource(
    "features/agent-ops/ui/AgentOpsDashboard.tsx"
  );
  const paginationSource = readSource(
    "shared/ui/components/TablePagination.tsx"
  );

  assert.match(dashboardSource, /TablePagination/);
  assert.doesNotMatch(dashboardSource, /InfiniteScrollTrigger/);
  assert.match(paginationSource, /pageSize/);
});
