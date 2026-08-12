import assert from "node:assert/strict";
import test from "node:test";
import { resolveTaskDmComposerState } from "../shared/lib/outreach/taskDmComposerHelpers";

const sentPayload = {
  content: "Previously sent text",
  mediaUrls: ["https://cdn.example.com/sent-image.png"],
  mediaDescriptions: ["Previously sent caption"],
  mediaKinds: ["image" as const],
  mediaMetadata: [{ previewUrl: "blob:previous-preview", width: 1200 }],
};

test("pending approval tasks retain their complete draft payload", () => {
  const state = resolveTaskDmComposerState({
    taskId: "task-1",
    taskMode: "approval",
    taskStatus: "pending",
    taskDraft: sentPayload,
  });

  assert.equal(state.behavior, "task-approval");
  assert.strictEqual(state.draft, sentPayload);
});

test("posted tasks expose a blank fresh-send state with no sent payload", () => {
  const state = resolveTaskDmComposerState({
    taskId: "task-1",
    taskMode: "posted",
    taskStatus: "completed",
    taskDraft: sentPayload,
  });

  assert.equal(state.behavior, "fresh-send");
  assert.equal(state.draft, undefined);
});

test("sent task status blocks hydration even with a stale approval mode", () => {
  for (const taskStatus of ["waiting_response", "completed"]) {
    const state = resolveTaskDmComposerState({
      taskId: "task-1",
      taskMode: "approval",
      taskStatus,
      taskDraft: sentPayload,
    });

    assert.equal(state.behavior, "fresh-send");
    assert.equal(state.draft, undefined);
  }
});

test("unsent failed and skipped tasks keep their editable approval payload", () => {
  for (const taskStatus of ["failed", "skipped"]) {
    const state = resolveTaskDmComposerState({
      taskId: "task-1",
      taskMode: "approval",
      taskStatus,
      taskDraft: sentPayload,
    });

    assert.equal(state.behavior, "task-approval");
    assert.strictEqual(state.draft, sentPayload);
  }
});

test("approval-to-posted transitions and task changes produce reset keys", () => {
  const approval = resolveTaskDmComposerState({
    taskId: "task-1",
    taskMode: "approval",
    taskStatus: "pending",
    taskDraft: sentPayload,
  });
  const posted = resolveTaskDmComposerState({
    taskId: "task-1",
    taskMode: "posted",
    taskStatus: "completed",
    taskDraft: sentPayload,
  });
  const nextTask = resolveTaskDmComposerState({
    taskId: "task-2",
    taskMode: "approval",
    taskStatus: "pending",
    taskDraft: sentPayload,
  });

  assert.notEqual(approval.resetKey, posted.resetKey);
  assert.notEqual(approval.resetKey, nextTask.resetKey);
  assert.equal(approval.resetKey, "task-1:task-approval");
  assert.equal(posted.resetKey, "task-1:fresh-send");
});
