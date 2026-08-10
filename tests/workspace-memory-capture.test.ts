import assert from "node:assert/strict";
import test from "node:test";
import type { ModelMessage } from "ai";
import { resolveWorkspaceMemoryInstruction } from "../convex/lib/workspaceMemoryCaptureCore";

const resourceMessage =
  "Here is the handbook: https://example.com/pineglass?token=exact";
const unrelatedMessage = "Also research Acme's unrelated pricing notes.";
const rememberMessage = "Remember that and use it when relevant.";
const messages: ModelMessage[] = [
  { role: "user", content: resourceMessage },
  { role: "assistant", content: "Got it." },
  { role: "user", content: unrelatedMessage },
  { role: "assistant", content: "Done." },
  { role: "user", content: rememberMessage },
];

test("referential saves retain only the exact cited source and current instruction", () => {
  const captured = resolveWorkspaceMemoryInstruction({
    messages,
    sourceExcerpt: resourceMessage,
    fallback: "fallback",
  });

  assert.equal(captured, `${resourceMessage}\n\n${rememberMessage}`);
  assert.doesNotMatch(captured, /Acme/);
});

test("referential saves reject omitted or invented source excerpts", () => {
  assert.throws(
    () => resolveWorkspaceMemoryInstruction({ messages, fallback: "fallback" }),
    /refers to an earlier message/
  );
  assert.throws(
    () =>
      resolveWorkspaceMemoryInstruction({
        messages,
        sourceExcerpt: "https://attacker.example/invented",
        fallback: "fallback",
      }),
    /copied verbatim/
  );
});
