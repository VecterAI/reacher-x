import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { mergeConversationHistoryMessages } from "../features/prospects/lib/conversationHistoryHelpers";

test("conversation pages merge without duplicates in chronological order", () => {
  const current = [
    { id: "3", createdAt: "2026-08-10T12:00:00.000Z", text: "latest" },
    { id: "2", createdAt: "2026-08-10T11:00:00.000Z", text: "current" },
  ];
  const olderPage = [
    { id: "1", createdAt: "2026-08-10T10:00:00.000Z", text: "older" },
    {
      id: "2",
      createdAt: "2026-08-10T11:00:00.000Z",
      text: "provider overlap",
    },
  ];

  const merged = mergeConversationHistoryMessages(current, olderPage);

  assert.deepEqual(
    merged.map((message) => message.id),
    ["1", "2", "3"]
  );
  assert.equal(merged[1]?.text, "current");
});

test("both conversation hooks request exactly one bounded older page", () => {
  for (const file of [
    "features/prospects/hooks/useProspectDmPanel.ts",
    "features/prospects/hooks/useProspectLinkedInPanel.ts",
  ]) {
    const source = readFileSync(file, "utf8");

    assert.match(source, /ConversationHistoryPage/);
    assert.match(source, /cursor,/);
    assert.match(source, /limit: 25/);
    assert.match(source, /mergeConversationHistoryMessages/);
    assert.doesNotMatch(source, /while\s*\(/);
  }
});

test("conversation panels expose upward history loading and recovery copy", () => {
  for (const file of [
    "features/prospects/ui/components/XConversationPanel.tsx",
    "features/prospects/ui/components/LinkedInConversationPanel.tsx",
  ]) {
    const source = readFileSync(file, "utf8");

    assert.match(source, /<ConversationHistoryPagination/);
    assert.match(source, /Could not load earlier messages\. Try again\./);
  }

  const paginationSource = readFileSync(
    "features/prospects/ui/components/ConversationHistoryPagination.tsx",
    "utf8"
  );
  assert.match(paginationSource, /<InfiniteScrollTrigger/);
  assert.match(paginationSource, /hasMore=\{hasMore\}/);
  assert.match(paginationSource, /showKeyboardFallback=\{false\}/);
  assert.doesNotMatch(paginationSource, /<Button/);
  assert.doesNotMatch(paginationSource, /userScrolledUp|canScroll/);

  const xSource = readFileSync(
    "features/prospects/ui/components/XConversationPanel.tsx",
    "utf8"
  );
  assert.match(
    xSource,
    /X\/Twitter provides conversation history from the past 30/
  );
});
