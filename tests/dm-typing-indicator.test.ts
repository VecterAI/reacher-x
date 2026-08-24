import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("the X typing indicator uses only real conversation presence", () => {
  const hook = read("features/prospects/hooks/useTwitterConversationTyping.ts");
  const panel = read("features/prospects/ui/components/XConversationPanel.tsx");

  assert.match(hook, /api\.conversationTypingPresence\.getTwitterForProspect/);
  assert.match(panel, /<ConversationTypingIndicator/);
});

test("the visible typing bubble contains dots without redundant copy", () => {
  const indicator = read(
    "features/prospects/ui/components/conversation-message/ConversationTypingIndicator.tsx"
  );
  const globalStyles = read("app/globals.css");

  assert.match(indicator, /conversation-typing-dot/);
  assert.match(indicator, /className="sr-only"/);
  assert.doesNotMatch(indicator, /<p[^>]*>[^<]*is typing/);
  assert.match(globalStyles, /@keyframes conversation-typing-dot/);
  assert.match(globalStyles, /prefers-reduced-motion: reduce/);
});
