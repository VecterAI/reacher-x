import assert from "node:assert/strict";
import test from "node:test";
import { buildOutreachProgressSummary } from "../convex/lib/outreachProgressHelpers";
import { resolveOutreachProgressPresentation } from "../features/prospects/lib/outreachProgressUi";

type ProgressPlan = Parameters<typeof buildOutreachProgressSummary>[0];
type ProgressTask = Parameters<typeof buildOutreachProgressSummary>[1][number];

function createTask(overrides: Partial<ProgressTask> = {}): ProgressTask {
  return {
    order: 1,
    type: "comment",
    description: "Comment on the prospect's latest post",
    status: "pending",
    approvalRequestedAt: undefined,
    approvedAt: undefined,
    ...overrides,
  };
}

function createProgress(
  planStatus: ProgressPlan["status"],
  tasks: ProgressTask[]
) {
  const progress = buildOutreachProgressSummary({ status: planStatus }, tasks);
  if (!progress) {
    throw new Error("Expected an outreach progress summary");
  }
  return progress;
}

test("no plan state renders no prospect-card badge", () => {
  assert.equal(
    resolveOutreachProgressPresentation({ planGenerationStatus: "idle" }),
    null
  );
  assert.equal(
    resolveOutreachProgressPresentation({ planGenerationStatus: "failed" }),
    null
  );
});

test("plan generation renders an active creating-plan badge", () => {
  assert.deepEqual(
    resolveOutreachProgressPresentation({
      planGenerationStatus: "generating",
    }),
    {
      label: "Creating plan",
      title: "The agent is creating an outreach plan",
      indicator: "spinner",
      tone: "active",
    }
  );
});

test("progress summary counts finished tasks and prioritizes the executing task", () => {
  const progress = createProgress("executing", [
    createTask({ order: 1, status: "waiting_response" }),
    createTask({
      order: 2,
      type: "dm",
      description: "Send a short follow-up DM",
      status: "executing",
      approvalRequestedAt: 100,
    }),
    createTask({ order: 3, status: "completed" }),
    createTask({ order: 4, status: "skipped" }),
  ]);

  assert.equal(progress.finishedTaskCount, 3);
  assert.equal(progress.totalTaskCount, 4);
  assert.deepEqual(progress.activeTask, {
    order: 2,
    type: "dm",
    description: "Send a short follow-up DM",
    status: "executing",
    awaitingApproval: true,
  });
});

test("an executing task awaiting approval asks the user to review it", () => {
  const presentation = resolveOutreachProgressPresentation({
    progress: createProgress("executing", [
      createTask({
        order: 2,
        description: "Send a short follow-up DM",
        status: "executing",
        approvalRequestedAt: 100,
      }),
      createTask({ order: 1, status: "completed" }),
    ]),
  });

  assert.equal(
    presentation?.label,
    "Review step 2/2 · Send a short follow-up DM"
  );
  assert.equal(presentation?.indicator, "attention");
  assert.equal(presentation?.tone, "attention");
});

test("a paused plan waiting on a manual X reply clearly asks for action", () => {
  const presentation = resolveOutreachProgressPresentation({
    progress: createProgress("paused", [
      createTask({ status: "waiting_manual" }),
    ]),
  });

  assert.equal(presentation?.label, "Manual reply needed · 0/1");
  assert.equal(presentation?.indicator, "attention");
  assert.equal(presentation?.tone, "attention");
});

test("a connect-first LinkedIn recovery requires no user action", () => {
  const presentation = resolveOutreachProgressPresentation({
    progress: createProgress("paused", [
      createTask({ type: "dm", status: "waiting_connection" }),
    ]),
  });

  assert.equal(presentation?.label, "Connection requested · 0/1");
  assert.equal(presentation?.indicator, "waiting");
  assert.equal(presentation?.tone, "muted");
});

test("active, waiting, blocked, and completed plans get distinct treatments", () => {
  const executing = resolveOutreachProgressPresentation({
    progress: createProgress("executing", [
      createTask({ status: "executing" }),
    ]),
  });
  assert.equal(
    executing?.label,
    "Step 1/1 · Comment on the prospect's latest post"
  );
  assert.equal(executing?.indicator, "spinner");

  const waiting = resolveOutreachProgressPresentation({
    progress: createProgress("executing", [
      createTask({ status: "waiting_response" }),
    ]),
  });
  assert.equal(waiting?.label, "Posted · Waiting for reply · 1/1");
  assert.equal(waiting?.indicator, "waiting");

  const blocked = resolveOutreachProgressPresentation({
    progress: createProgress("blocked_auth", [
      createTask({ status: "completed" }),
      createTask({ order: 2, status: "failed" }),
    ]),
  });
  assert.equal(blocked?.label, "Reconnect required · 1/2");
  assert.equal(blocked?.indicator, "blocked");
  assert.equal(blocked?.tone, "warning");

  const completed = resolveOutreachProgressPresentation({
    progress: createProgress("completed", [
      createTask({ status: "completed" }),
      createTask({ order: 2, status: "skipped" }),
    ]),
  });
  assert.equal(completed?.label, "Complete · 2/2");
  assert.equal(completed?.indicator, "success");
});
test("abandoned plans intentionally remove the prospect-card badge", () => {
  assert.equal(
    buildOutreachProgressSummary({ status: "abandoned" }, [
      createTask({ status: "completed" }),
    ]),
    undefined
  );
});
