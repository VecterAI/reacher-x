import assert from "node:assert/strict";
import { test } from "node:test";
import { api } from "@/convex/_generated/api";
import { createAppServices } from "./appServices";
import type { Id } from "@/convex/_generated/dataModel";

test("workspace selection changes real shell data without discarding either workspace", async () => {
  const { client, state } = createAppServices("workspaces-explained");
  const first = await client.query(api.workspaces.getDefaultWorkspace, {});
  assert.equal(first?.name, "Hire a designer");
  const second = state.workspaces[1];
  await client.mutation(api.workspaces.setDefaultWorkspace, {
    workspaceId: second._id,
  });
  const shell = await client.query(api.shell.getAppShellState, {});
  assert.equal(shell?.effectiveUseCaseKey, "customer_prospecting");
  assert.equal(shell?.activeWorkspaceId, second._id);
  assert.equal(shell?.switcherItems.length, 2);
  assert.equal(
    first?.name,
    "Hire a designer",
    "previous snapshots stay immutable"
  );
  await client.mutation(api.workspaces.setDefaultWorkspace, {
    workspaceId: first!._id,
  });
  assert.equal(
    (await client.query(api.workspaces.getDefaultWorkspace, {}))?._id,
    first!._id
  );
});

test("status changes update the actual summary projection and independent tab results", async () => {
  const { client, state } = createAppServices();
  const prospectId = state.prospects[0]._id;
  const args = {
    workspaceId: state.selectedWorkspaceId,
    status: "new" as const,
    visibilityMode: "ready_only" as const,
    paginationOpts: { numItems: 10, cursor: null },
  };
  const watch = client.watchQuery(
    api.prospectListFeed.listStableWorkspaceProspectSummaries,
    args
  );
  const before = watch.localQueryResult()!;
  assert.ok(before.page.some((row) => row.prospectId === prospectId));
  assert.equal(before.page[0].outreachProgress?.planStatus, "draft");
  assert.ok(before.page.every((row) => row.readyQualifiedEnriched));
  await client.mutation(api.prospects.updateProspectStatus, {
    prospectId,
    status: "in_progress",
  });
  assert.ok(
    !watch.localQueryResult()!.page.some((row) => row.prospectId === prospectId)
  );
  assert.ok(
    before.page.some(
      (row) => row.prospectId === prospectId && row.status === "new"
    )
  );
  const interviewing = await client.query(
    api.prospectListFeed.listStableWorkspaceProspectSummaries,
    { ...args, status: "in_progress" }
  );
  assert.ok(interviewing.page.some((row) => row.prospectId === prospectId));
  await client.mutation(api.prospects.updateProspectStatus, {
    prospectId,
    status: "archived",
  });
  await assert.rejects(
    client.mutation(api.prospects.updateProspectStatus, {
      prospectId,
      status: "in_progress",
    }),
    /Unarchive/
  );
  await client.mutation(api.prospects.updateProspectStatus, {
    prospectId,
    status: "new",
  });
  assert.ok(
    watch.localQueryResult()!.page.some((row) => row.prospectId === prospectId)
  );
});

test("filtering, search and pagination use the same isolated dataset", async () => {
  const { client, state } = createAppServices();
  const args = {
    workspaceId: state.selectedWorkspaceId,
    status: "new" as const,
    paginationOpts: { numItems: 1, cursor: null },
  };
  const first = await client.query(
    api.prospectListFeed.listStableWorkspaceProspectSummaries,
    args
  );
  assert.equal(first.page.length, 1);
  assert.equal(first.isDone, false);
  const next = await client.query(
    api.prospectListFeed.listStableWorkspaceProspectSummaries,
    { ...args, paginationOpts: { numItems: 1, cursor: first.continueCursor } }
  );
  assert.notEqual(first.page[0].prospectId, next.page[0].prospectId);
  const filtered = await client.query(
    api.prospectSummaries.listWorkspaceProspectSummaries,
    { ...args, fitScoreMin: 91, fitScoreMax: 100 }
  );
  assert.equal(filtered.page[0].displayName, "Isabelle Fontaine");
  const search = await client.action(
    api.prospectSearchUnified.searchProspectsUnified,
    { ...args, searchQuery: "Chloe" }
  );
  assert.equal(search.page[0].displayName, "Chloe Dupont");
  await assert.rejects(
    client.query(api.prospectListFeed.listStableWorkspaceProspectSummaries, {
      ...args,
      paginationOpts: { numItems: 1, cursor: "invalid" },
    }),
    /cursor/
  );
});

test("messages are scoped by prospect and platform, and duplicate submissions are idempotent", async () => {
  const { client, state } = createAppServices();
  const message = {
    prospectId: state.prospects[0]._id,
    platform: "linkedin" as const,
    clientRequestId: "message-1",
    text: "Would you like the role details?",
  };
  await client.mutation(api.outboundMessageOperations.queueMessage, message);
  await client.mutation(api.outboundMessageOperations.queueMessage, message);
  assert.equal(
    (
      await client.query(api.outboundMessageOperations.listForProspect, {
        prospectId: message.prospectId,
        platform: message.platform,
      })
    ).length,
    1
  );
  assert.equal(
    (
      await client.query(api.outboundMessageOperations.listForProspect, {
        prospectId: state.prospects[1]._id,
        platform: "linkedin",
      })
    ).length,
    0
  );
  assert.equal(
    (
      await client.query(api.outboundMessageOperations.listForProspect, {
        prospectId: message.prospectId,
        platform: "twitter",
      })
    ).length,
    0
  );
});

test("conversation and history data match the selected prospect, including filtered counts", async () => {
  const { client, state } = createAppServices();
  const prospectId = state.prospects[0]._id;
  await assert.rejects(
    client.query(api.workspaces.getWorkspaceAgentSettings, {
      workspaceId: "missing" as Id<"workspaces">,
    }),
    /Workspace not found/
  );
  const context = await client.action(
    api.linkedin.getLinkedInConversationPanelContext,
    { prospectId }
  );
  assert.equal(context?.prospect.displayName, state.prospects[0].displayName);
  assert.deepEqual(
    context?.messages.map((message) => message.direction),
    ["sent", "received"]
  );
  assert.match(context.messages[0].text ?? "", /senior frontend engineer/);
  assert.match(context.messages[1].text ?? "", /Thursday/);
  assert.ok(context.messages[0].createdAt);
  assert.ok(context.messages[1].createdAt);
  assert.ok(context.messages[0].createdAt < context.messages[1].createdAt);
  assert.ok(
    context?.messages.every(
      (message) => message.conversationId === context.conversationId
    )
  );
  await assert.rejects(
    client.action(api.linkedin.getLinkedInConversationPanelContext, {
      prospectId: "missing" as Id<"prospects">,
    }),
    /not found/
  );
  const history = await client.query(api.outreach.getActivityLog, {
    prospectId,
    type: "qualified",
    paginationOpts: { cursor: null, numItems: 10 },
  });
  assert.equal(history.page.length, 1);
  assert.equal(history.page[0].type, "qualified");
  const counts = await client.action(
    api.prospectSummaries.getWorkspaceProspectStageCountsSnapshot,
    { workspaceId: state.selectedWorkspaceId, searchQuery: "Isabelle" }
  );
  assert.deepEqual(counts, { new: 1, contacted: 0, in_progress: 0 });
  await assert.rejects(
    client.query(api.outreach.getActivityLog, {
      prospectId,
      paginationOpts: { cursor: null, numItems: 0 },
    }),
    /page size/
  );
});

test("demo plan usage follows the selected workspace and the current API contract", async () => {
  const { client, state } = createAppServices("workspaces-explained");
  const nowMs = await client.action(api.workspacePlanUsage.getServerTime, {});
  assert.ok(Number.isFinite(nowMs));
  for (const workspace of state.workspaces) {
    const usage = await client.query(api.workspacePlanUsage.getCurrent, {
      workspaceId: workspace._id,
      nowMs,
    });
    assert.ok(usage);
    assert.equal(usage.workspaceId, workspace._id);
    assert.equal(
      usage.used,
      state.prospects.filter((person) => person.workspaceId === workspace._id)
        .length
    );
    assert.ok(["finding", "sourcing"].includes(usage.discoveryVerb));
    assert.equal(usage.limitReached, false);
  }
});

test("edited demo plans require approval and deliver each sample message once", async () => {
  const { client, state } = createAppServices("find-potential-customers");
  const data = [...state.plans.values()][0];
  const task = data.tasks[0];
  const args = {
    taskId: task._id,
    expectedType: "dm" as const,
    content: "Where do client approvals get lost?",
  };
  await assert.rejects(
    client.mutation(api.outreach.approveTaskWithEdits, args),
    /Approve the plan/
  );
  await client.mutation(api.outreach.updatePendingTaskDraft, args);
  await client.mutation(api.outreach.approvePlan, { planId: data.plan._id });
  assert.equal(
    (
      await client.query(api.outreach.getAgentPanelContext, {
        prospectId: data.plan.prospectId,
        taskId: task._id,
      })
    )?.approvalReady,
    true
  );
  assert.equal(task.content, args.content);
  assert.equal(
    (await client.mutation(api.outreach.approveTaskWithEdits, args)).duplicate,
    false
  );
  assert.equal(
    (await client.mutation(api.outreach.approveTaskWithEdits, args)).duplicate,
    true
  );
  const messages = await client.query(
    api.outboundMessageOperations.listForProspect,
    { prospectId: data.plan.prospectId, platform: "linkedin" }
  );
  assert.equal(messages.length, 1);
  assert.equal(messages[0].text, args.content);
  assert.equal(data.plan.status, "completed");
});
