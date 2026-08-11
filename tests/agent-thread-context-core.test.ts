import assert from "node:assert/strict";
import test from "node:test";
import { resolveAgentThreadSelection } from "../convex/lib/agentThreadContextCore";

function createEntity(
  overrides: Partial<{
    id: string;
    entityId: string;
    kind: "prospect" | "plan" | "task" | "attachment" | "post";
    label: string;
    mentionText: string;
    secondaryLabel: string;
    workspaceId: string;
    prospectId: string;
    planId: string;
    taskId: string;
    postId: string;
    postUrl: string;
    postPlatform: "twitter" | "linkedin";
  }>
) {
  return {
    id: overrides.id ?? "entity_1",
    entityId: overrides.entityId ?? "entity_1",
    kind: overrides.kind ?? "prospect",
    label: overrides.label ?? "Entity",
    mentionText: overrides.mentionText ?? "Entity",
    secondaryLabel: overrides.secondaryLabel ?? "Entity",
    avatarUrl: null,
    verified: false,
    ...(overrides.workspaceId ? { workspaceId: overrides.workspaceId } : {}),
    ...(overrides.prospectId ? { prospectId: overrides.prospectId } : {}),
    ...(overrides.planId ? { planId: overrides.planId } : {}),
    ...(overrides.taskId ? { taskId: overrides.taskId } : {}),
    ...(overrides.postId ? { postId: overrides.postId } : {}),
    ...(overrides.postUrl ? { postUrl: overrides.postUrl } : {}),
    ...(overrides.postPlatform ? { postPlatform: overrides.postPlatform } : {}),
  };
}

test("workspace threads resolve the latest tagged post context", () => {
  const selection = resolveAgentThreadSelection({
    routeScope: {
      kind: "workspace",
      workspaceId: "workspace_1",
      prospectId: null,
    },
    contextRows: [
      {
        taggedEntities: [
          createEntity({
            id: "post:twitter:123",
            entityId: "123",
            kind: "post",
            label: "Latest launch post",
            mentionText: "Latest launch post",
            secondaryLabel: "X post",
            workspaceId: "workspace_1",
            prospectId: "prospect_1",
            postId: "123",
            postUrl: "https://x.com/example/status/123",
            postPlatform: "twitter",
          }),
        ],
      },
    ],
  });

  assert.deepEqual(selection, {
    workspaceId: "workspace_1",
    prospectId: "prospect_1",
    planId: null,
    taskId: null,
    postId: "123",
    postPlatform: "twitter",
    postUrl: "https://x.com/example/status/123",
    source: "tagged",
    ambiguousProspectIds: [],
  });
});

test("thread selection normalizes sparse post tags before resolving context", () => {
  const selection = resolveAgentThreadSelection({
    routeScope: {
      kind: "workspace",
      workspaceId: "workspace_1",
      prospectId: null,
    },
    contextRows: [
      {
        taggedEntities: [
          createEntity({
            id: "post:twitter:456",
            entityId: "456",
            kind: "post",
            label: "Latest reply",
            mentionText: "Reply: Latest reply",
            secondaryLabel: "X reply",
            workspaceId: "workspace_1",
            prospectId: "prospect_1",
          }),
        ],
      },
    ],
  });

  assert.deepEqual(selection, {
    workspaceId: "workspace_1",
    prospectId: "prospect_1",
    planId: null,
    taskId: null,
    postId: "456",
    postPlatform: "twitter",
    postUrl: "https://x.com/i/status/456",
    source: "tagged",
    ambiguousProspectIds: [],
  });
});

test("prospect threads fall back to the canonical thread scope when nothing is tagged", () => {
  const selection = resolveAgentThreadSelection({
    routeScope: {
      kind: "prospect",
      workspaceId: "workspace_1",
      prospectId: "prospect_1",
    },
    contextRows: [],
  });

  assert.deepEqual(selection, {
    workspaceId: "workspace_1",
    prospectId: "prospect_1",
    planId: null,
    taskId: null,
    postId: null,
    postPlatform: null,
    postUrl: null,
    source: "thread",
    ambiguousProspectIds: [],
  });
});

test("an untagged current workspace turn clears an older transient tag without durable selection", () => {
  const selection = resolveAgentThreadSelection({
    routeScope: {
      kind: "workspace",
      workspaceId: "workspace_1",
      prospectId: null,
    },
    contextRows: [
      { taggedEntities: [] },
      {
        taggedEntities: [
          createEntity({
            kind: "prospect",
            workspaceId: "workspace_1",
            prospectId: "prospect_1",
          }),
        ],
      },
    ],
  });

  assert.deepEqual(selection, {
    workspaceId: "workspace_1",
    prospectId: null,
    planId: null,
    taskId: null,
    postId: null,
    postPlatform: null,
    postUrl: null,
    source: "thread",
    ambiguousProspectIds: [],
  });
});

test("an untagged follow-up retains the latest durable prospect selection", () => {
  const selection = resolveAgentThreadSelection({
    routeScope: {
      kind: "workspace",
      workspaceId: "workspace_1",
      prospectId: null,
    },
    contextRows: [{ taggedEntities: [] }],
    persistentTargetSelection: {
      workspaceId: "workspace_1",
      prospectIds: ["prospect_nikolay"],
    },
  });

  assert.deepEqual(selection, {
    workspaceId: "workspace_1",
    prospectId: "prospect_nikolay",
    planId: null,
    taskId: null,
    postId: null,
    postPlatform: null,
    postUrl: null,
    source: "tagged",
    ambiguousProspectIds: [],
  });
});

test("task and plan tags preserve their ids for the selected prospect", () => {
  const selection = resolveAgentThreadSelection({
    routeScope: {
      kind: "workspace",
      workspaceId: "workspace_1",
      prospectId: null,
    },
    contextRows: [
      {
        taggedEntities: [
          createEntity({
            id: "plan:plan_1",
            entityId: "plan_1",
            kind: "plan",
            label: "Plan for Logan",
            mentionText: "Plan for Logan",
            secondaryLabel: "draft plan",
            workspaceId: "workspace_1",
            prospectId: "prospect_1",
            planId: "plan_1",
          }),
          createEntity({
            id: "task:task_1",
            entityId: "task_1",
            kind: "task",
            label: "Task 2",
            mentionText: "Task 2",
            secondaryLabel: "comment task",
            workspaceId: "workspace_1",
            prospectId: "prospect_1",
            planId: "plan_1",
            taskId: "task_1",
          }),
        ],
      },
    ],
  });

  assert.equal(selection.workspaceId, "workspace_1");
  assert.equal(selection.prospectId, "prospect_1");
  assert.equal(selection.planId, "plan_1");
  assert.equal(selection.taskId, "task_1");
  assert.equal(selection.source, "tagged");
});

test("workspace threads refuse to silently choose between multiple tagged prospects", () => {
  const selection = resolveAgentThreadSelection({
    routeScope: {
      kind: "workspace",
      workspaceId: "workspace_1",
      prospectId: null,
    },
    contextRows: [
      {
        taggedEntities: [
          createEntity({
            id: "prospect:1",
            entityId: "prospect_1",
            kind: "prospect",
            label: "Logan",
            mentionText: "Logan",
            secondaryLabel: "@logan",
            workspaceId: "workspace_1",
            prospectId: "prospect_1",
          }),
          createEntity({
            id: "prospect:2",
            entityId: "prospect_2",
            kind: "prospect",
            label: "Jane",
            mentionText: "Jane",
            secondaryLabel: "@jane",
            workspaceId: "workspace_1",
            prospectId: "prospect_2",
          }),
        ],
      },
    ],
  });

  assert.equal(selection.workspaceId, "workspace_1");
  assert.equal(selection.prospectId, null);
  assert.equal(selection.source, "tagged");
  assert.deepEqual(selection.ambiguousProspectIds, [
    "prospect_1",
    "prospect_2",
  ]);
});
