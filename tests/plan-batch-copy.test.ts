import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getPlanBatchCopy,
  getPlanBatchNotificationCopy,
  getPlanBatchTitleValues,
  type PlanBatchCopyState,
} from "../shared/lib/outreach/planBatchCopy";

function createState(
  overrides: Partial<PlanBatchCopyState> = {}
): PlanBatchCopyState {
  return {
    operation: "create",
    scopeKind: "tagged",
    status: "running",
    targetCount: 2,
    eligibleCount: 2,
    succeededCount: 0,
    failedCount: 0,
    skippedCount: 0,
    createdCount: 0,
    updatedCount: 0,
    targetNames: ["Nick LoPiccolo", "Logan Gott"],
    ...overrides,
  };
}

test("small plan runs use names without exposing technical terms", () => {
  const copy = getPlanBatchCopy(createState());

  assert.deepEqual(copy, {
    title: "Creating outreach plans for Nick LoPiccolo and Logan Gott",
    status: "0 of 2 plans ready",
  });
  assert.doesNotMatch(
    `${copy.title} ${copy.status}`,
    /batch|operation|queued|eligible|succeeded|skipped|—/i
  );
});

test("one prospect uses a clear singular sentence", () => {
  const copy = getPlanBatchCopy(
    createState({
      targetCount: 1,
      eligibleCount: 1,
      targetNames: ["Nick LoPiccolo"],
    })
  );

  assert.deepEqual(copy, {
    title: "Creating an outreach plan for Nick LoPiccolo",
    status: "0 of 1 plan ready",
  });
});

test("three prospects switch to counts to keep the card compact", () => {
  const copy = getPlanBatchCopy(
    createState({
      targetCount: 3,
      eligibleCount: 3,
      targetNames: ["Nick LoPiccolo", "Logan Gott", "Michel Lieben"],
    })
  );

  assert.deepEqual(copy, {
    title: "Creating 3 outreach plans",
    status: "0 of 3 plans ready",
  });
});

test("large plan runs use compact counts instead of prospect names", () => {
  const copy = getPlanBatchCopy(
    createState({
      targetCount: 1842,
      eligibleCount: 1842,
      succeededCount: 726,
      targetNames: [],
    })
  );

  assert.deepEqual(copy, {
    title: "Creating 1,842 outreach plans",
    status: "726 of 1,842 plans ready",
  });
});

test("update requests use update wording", () => {
  const copy = getPlanBatchCopy(
    createState({
      operation: "update",
    })
  );

  assert.deepEqual(copy, {
    title: "Updating outreach plans for Nick LoPiccolo and Logan Gott",
    status: "0 of 2 plans ready",
  });
});

test("mixed work uses neutral wording and reports real results", () => {
  const runningCopy = getPlanBatchCopy(
    createState({
      operation: "create_or_update",
      targetCount: 40,
      eligibleCount: 40,
      targetNames: [],
    })
  );
  const completedCopy = getPlanBatchCopy(
    createState({
      operation: "create_or_update",
      status: "completed",
      targetCount: 40,
      eligibleCount: 40,
      succeededCount: 40,
      createdCount: 25,
      updatedCount: 15,
      targetNames: [],
    })
  );

  assert.equal(runningCopy.title, "Working on 40 outreach plans");
  assert.deepEqual(completedCopy, {
    title: "40 outreach plans are ready",
    status: "25 plans created. 15 plans updated",
  });
});

test("partial and failed runs stay short at any scale", () => {
  const partialCopy = getPlanBatchCopy(
    createState({
      status: "partial",
      targetCount: 40,
      eligibleCount: 40,
      succeededCount: 37,
      failedCount: 3,
      createdCount: 37,
      targetNames: [],
    })
  );
  const failedCopy = getPlanBatchCopy(
    createState({
      status: "failed",
      targetCount: 40,
      eligibleCount: 40,
      failedCount: 40,
      targetNames: [],
    })
  );

  assert.deepEqual(partialCopy, {
    title: "37 of 40 outreach plans are ready",
    status: "3 plans need attention",
  });
  assert.deepEqual(failedCopy, {
    title: "We could not create the outreach plans",
    status: "No plans were changed",
  });
});

test("confirmation copy explains the next step without system terms", () => {
  const copy = getPlanBatchCopy(
    createState({
      scopeKind: "all",
      status: "awaiting_confirmation",
      targetCount: 43,
      eligibleCount: 40,
      skippedCount: 3,
      targetNames: [],
    })
  );

  assert.deepEqual(copy, {
    title: "40 people are ready",
    status: "Reply yes to start creating plans. 3 people cannot be included",
  });
});

test("headline values distinguish names from counts", () => {
  assert.deepEqual(getPlanBatchTitleValues(createState()), [
    { text: "Nick LoPiccolo", kind: "name" },
    { text: "Logan Gott", kind: "name" },
  ]);
  assert.deepEqual(
    getPlanBatchTitleValues(
      createState({
        targetCount: 1842,
        eligibleCount: 1842,
        succeededCount: 726,
        targetNames: [],
      })
    ),
    [{ text: "1,842", kind: "count" }]
  );
  assert.deepEqual(
    getPlanBatchTitleValues(
      createState({
        status: "partial",
        targetCount: 40,
        eligibleCount: 40,
        succeededCount: 37,
        failedCount: 3,
        targetNames: [],
      })
    ),
    [
      { text: "37", kind: "count" },
      { text: "40", kind: "count" },
    ]
  );
});

test("notifications use the same simple copy system", () => {
  const startedCopy = getPlanBatchNotificationCopy(createState());
  const completedCopy = getPlanBatchNotificationCopy(
    createState({
      status: "completed",
      succeededCount: 2,
      createdCount: 2,
    })
  );

  assert.deepEqual(startedCopy, {
    title: "Creating outreach plans for Nick LoPiccolo and Logan Gott",
    status: "We will let you know when the plans are ready.",
  });
  assert.deepEqual(completedCopy, {
    title: "Outreach plans for Nick LoPiccolo and Logan Gott are ready",
    status: "Open the chat when you want to review them.",
  });
});

test("main agent uses semantic model intent without keyword routing", () => {
  const promptSource = readFileSync("convex/agents/prompts.ts", "utf8");
  const toolSource = readFileSync("convex/agents/tools/planBatch.ts", "utf8");
  const coreSource = readFileSync("convex/lib/planBatchCore.ts", "utf8");
  const actionSource = readFileSync("convex/planBatchActions.ts", "utf8");
  const batchSource = readFileSync("convex/planBatches.ts", "utf8");
  const chatSource = readFileSync("convex/chat.ts", "utf8");
  const workflowSource = readFileSync("convex/workflows/planBatch.ts", "utf8");

  assert.doesNotMatch(batchSource, /externalId/);
  assert.doesNotMatch(actionSource, /externalId/);

  assert.match(
    promptSource,
    /When the user says create, use operation=\\`create\\`/
  );
  assert.match(
    promptSource,
    /When the user says update, use operation=\\`update\\`/
  );
  assert.match(toolSource, /\.nullish\(\)/);
  assert.match(toolSource, /kind: z\.literal\("plan_group"\)/);
  assert.match(toolSource, /kind: z\.literal\("named"\)/);
  assert.match(toolSource, /strict: true/);
  assert.match(promptSource, /Never use keyword rules/);
  assert.match(promptSource, /Never reveal a \\`plans_\.\.\.\\` reference/);
  assert.match(
    promptSource,
    /returns execution\.state=\\`deferred\\`, emit no text/
  );
  assert.match(promptSource, /confirm your understanding before acting/);
  assert.match(actionSource, /allowSystemInMessages: true/);
  assert.match(workflowSource, /resumePlanBatchAgentResponse/);
  assert.match(chatSource, /includeStatuses: \["streaming", "aborted"\]/);
  assert.doesNotMatch(
    chatSource,
    /includeStatuses: \["streaming", "aborted", "finished"\]/
  );
  assert.doesNotMatch(batchSource, /savePlanBatchCompletionMessage/);
  assert.doesNotMatch(batchSource, /bridgePlanBatchCompletionToThread/);
  assert.doesNotMatch(toolSource, /reference: run\.reference/);
  assert.doesNotMatch(coreSource, /CREATE_PLAN_REQUEST_PATTERN/);
  assert.doesNotMatch(coreSource, /UPDATE_PLAN_REQUEST_PATTERN/);
});
