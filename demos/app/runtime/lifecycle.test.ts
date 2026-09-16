import assert from "node:assert/strict";
import { test } from "node:test";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { createAppServices } from "./appServices";
import { createScenarioDraftPlan } from "./scenarioPlanHelpers";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";

function fixture() {
  const service = createAppServices("manage-people-with-reacherx");
  const person = service.state.prospects[0];
  const { data } = createScenarioDraftPlan(service.state, person, {
    threadId: "lifecycle_test",
    description: "Ask about the role",
    content: "Hi Isabelle, would you like the frontend role details?",
    rationale: "Relevant accessibility work",
  });
  const send = () =>
    service.client.mutation(api.outreach.approveTask, {
      taskId: data.tasks[0]._id,
      expectedType: "dm",
    });
  return { ...service, person, data, send };
}

test("plan and task approvals are separate, and sending updates all dependent views", async () => {
  const { client, state, person, data, send } = fixture();
  await assert.rejects(send(), /Approve the plan/);
  await client.mutation(api.outreach.approvePlan, { planId: data.plan._id });
  assert.equal(data.plan.status, "executing");
  assert.equal(data.tasks[0].status, "pending");
  assert.equal(
    state.lifecycle.interactions.filter(
      (entry) =>
        entry.threadId === `demo-conversation-${state.prospects[0]._id}`
    ).length,
    0
  );
  await send();
  assert.equal(data.plan.status, "completed");
  assert.equal(data.tasks[0].status, "completed");
  assert.equal(person.status, "contacted");
  assert.equal(
    state.lifecycle.interactions.filter(
      (entry) =>
        entry.threadId === `demo-conversation-${state.prospects[0]._id}`
    ).length,
    1
  );
  assert.ok(
    state.lifecycle.activity.some((event) => event.type === "contacted")
  );
  await send();
  assert.equal(
    state.lifecycle.interactions.filter(
      (entry) =>
        entry.threadId === `demo-conversation-${state.prospects[0]._id}`
    ).length,
    1,
    "retrying a completed approval cannot send twice"
  );
  await client.close();
});

test("failed sends stay retryable and do not claim completion", async () => {
  const { client, data, send, failNextSend, state } = fixture();
  await client.mutation(api.outreach.approvePlan, { planId: data.plan._id });
  failNextSend();
  await assert.rejects(send(), /connection interrupted/);
  assert.equal(data.tasks[0].status, "failed");
  assert.equal(data.plan.status, "executing");
  assert.equal(
    state.lifecycle.interactions.filter(
      (entry) =>
        entry.threadId === `demo-conversation-${state.prospects[0]._id}`
    ).length,
    0
  );
  await send();
  assert.equal(data.plan.status, "completed");
  assert.equal(
    state.lifecycle.interactions.filter(
      (entry) =>
        entry.threadId === `demo-conversation-${state.prospects[0]._id}`
    ).length,
    1
  );
  await client.close();
});

test("pause, resume, cancellation and archived people gate execution", async () => {
  const { client, data, send, person } = fixture();
  await client.mutation(api.outreach.approvePlan, { planId: data.plan._id });
  await client.mutation(api.outreach.pausePlan, { planId: data.plan._id });
  await assert.rejects(send(), /Approve the plan/);
  await client.mutation(api.outreach.resumePlan, { planId: data.plan._id });
  person.status = "archived";
  await assert.rejects(send(), /not eligible/);
  person.status = "new";
  await client.mutation(api.outreach.cancelPlan, { planId: data.plan._id });
  await assert.rejects(send(), /Approve the plan/);
  assert.equal(data.plan.status, "abandoned");
  await client.close();
});

test("disconnected accounts block sending without inventing delivery", async () => {
  const { client, data, send, state } = fixture();
  await client.mutation(api.outreach.approvePlan, { planId: data.plan._id });
  await client.action(api.linkedin.disconnectLinkedIn, {});
  assert.equal(
    (
      await client.query(api.connectedAccounts.getConnectionSnapshot, {
        platform: "linkedin",
      })
    ).isConnected,
    false
  );
  await assert.rejects(send(), /Reconnect/);
  assert.equal(data.plan.status, "blocked_auth");
  assert.equal(
    state.lifecycle.interactions.filter(
      (entry) =>
        entry.threadId === `demo-conversation-${state.prospects[0]._id}`
    ).length,
    0
  );
  await client.close();
});

test("delays preserve task order and never finish early", async () => {
  const { client, data, send, planLifecycle } = fixture();
  data.tasks.push(
    {
      ...data.tasks[0],
      _id: "demo_wait" as Id<"outreachTasks">,
      type: "wait",
      order: 2,
      timing: { type: "delay", value: "2d" },
    },
    { ...data.tasks[0], _id: "demo_followup" as Id<"outreachTasks">, order: 3 }
  );
  await client.mutation(api.outreach.approvePlan, { planId: data.plan._id });
  await assert.rejects(
    client.mutation(api.outreach.approveTask, {
      taskId: data.tasks[2]._id,
      expectedType: "dm",
    }),
    /preceding/
  );
  await send();
  const due = data.tasks[1].scheduledAt!;
  assert.ok(due > getCurrentUTCTimestamp() + 86400000);
  assert.equal(data.tasks[1].status, "scheduled");
  planLifecycle.advanceDueTasks(due - 1);
  assert.equal(data.tasks[2].approvalReady, false);
  planLifecycle.advanceDueTasks(due);
  assert.equal(data.tasks[1].status, "completed");
  assert.equal(data.tasks[2].approvalReady, true);
  await client.close();
});

test("concurrent approvals produce one delivery", async () => {
  const { client, data, send, state } = fixture();
  await client.mutation(api.outreach.approvePlan, { planId: data.plan._id });
  await Promise.allSettled([send(), send()]);
  assert.equal(
    state.lifecycle.interactions.filter(
      (entry) =>
        entry.threadId === `demo-conversation-${state.prospects[0]._id}`
    ).length,
    1
  );
  assert.equal(data.plan.status, "completed");
  await client.close();
});

test("an approval claims its task before account validation so deletion cannot orphan a send", async () => {
  const { client, data, send, state } = fixture();
  await client.mutation(api.outreach.approvePlan, { planId: data.plan._id });
  const pendingSend = send();
  await assert.rejects(
    client.mutation(api.outreach.deletePlan, { planId: data.plan._id }),
    /Wait for the current send/
  );
  await pendingSend;
  assert.equal(state.plans.has(data.plan.prospectId), true);
  assert.equal(data.plan.status, "completed");
  await client.close();
});

test("autonomous startup continues past an unavailable account to other eligible plans", async () => {
  const { client, data, state, planLifecycle, person } = fixture();
  const otherPerson = state.prospects.find(
    (candidate) =>
      candidate.workspaceId === person.workspaceId &&
      candidate._id !== person._id &&
      candidate.status === "new"
  );
  assert.ok(otherPerson);
  otherPerson.platform = "twitter";
  const { data: otherPlan } = createScenarioDraftPlan(state, otherPerson, {
    threadId: "autonomous_test",
    description: "Ask about the role",
    content: "Would you like the frontend role details?",
    rationale: "Relevant frontend experience",
  });
  await client.action(api.linkedin.disconnectLinkedIn, {});
  await planLifecycle.startAutonomous(person.workspaceId);
  assert.equal(data.plan.status, "draft");
  assert.equal(otherPlan.plan.status, "completed");
  assert.equal(person.status, "new");
  assert.equal(otherPerson.status, "contacted");
  await client.close();
});

test("memory and account snapshots obey their different scopes", async () => {
  const { client, reporting, state } = createAppServices(
    "teach-reacherx-what-you-want"
  );
  reporting.saveMemory("Ask one question and keep it short.");
  const first = state.selectedWorkspaceId;
  const second = state.workspaces[1]._id;
  const args = { workspaceId: second, range: "7d" as const, limit: 10 };
  assert.equal(
    (
      await client.action(
        api.agentOps.getAgentOpsMemoryInventoryPageSnapshot,
        args
      )
    ).rows.length,
    0
  );
  assert.equal(
    (
      await client.action(api.agentOps.getAgentOpsMemoryInventoryPageSnapshot, {
        ...args,
        workspaceId: first,
      })
    ).rows[0].confidence,
    100
  );
  for (const platform of ["twitter", "linkedin"] as const)
    assert.equal(
      (
        await client.query(api.connectedAccounts.getConnectionSnapshot, {
          platform,
        })
      ).isConnected,
      true
    );
  await client.close();
});

test("deleting a plan cannot reuse a sent task's idempotency key", async () => {
  const { client, state, person, data, send } = fixture();
  await client.mutation(api.outreach.approvePlan, { planId: data.plan._id });
  await send();
  await client.mutation(api.outreach.deletePlan, { planId: data.plan._id });
  const next = createScenarioDraftPlan(state, person, {
    threadId: "later",
    description: "Share more details",
    content: "Here are the responsibilities you asked for.",
    rationale: "Follow up with requested details",
  }).data;
  assert.ok(next.plan.version > data.plan.version);
  assert.notEqual(next.tasks[0]._id, data.tasks[0]._id);
  await client.mutation(api.outreach.approvePlan, { planId: next.plan._id });
  await client.mutation(api.outreach.approveTask, {
    taskId: next.tasks[0]._id,
    expectedType: "dm",
  });
  assert.equal(
    (
      await client.query(api.outboundMessageOperations.listForProspect, {
        prospectId: person._id,
        platform: person.platform,
      })
    ).length,
    2
  );
  await client.close();
});

test("simultaneous manual sends with one request ID persist exactly one message", async () => {
  const { client, person } = fixture();
  const args = {
    prospectId: person._id,
    platform: person.platform as "linkedin",
    clientRequestId: "concurrent-manual",
    text: "Could I share the role details?",
  };
  const [first, second] = await Promise.all([
    client.mutation(api.outboundMessageOperations.queueMessage, args),
    client.mutation(api.outboundMessageOperations.queueMessage, args),
  ]);
  assert.equal(first.operationId, second.operationId);
  const messages = await client.query(
    api.outboundMessageOperations.listForProspect,
    { prospectId: person._id, platform: "linkedin" }
  );
  assert.equal(messages.length, 1);
  await client.close();
});

test("long waits schedule bounded timers and remain pending at each early wakeup", async () => {
  const { client, data, send, planLifecycle } = fixture();
  const timers: number[] = [];
  client.schedule = (_callback, delay) => {
    timers.push(delay);
  };
  data.tasks.push({
    ...data.tasks[0],
    _id: "long_wait" as Id<"outreachTasks">,
    type: "wait",
    order: 2,
    timing: { type: "delay", value: "60d" },
  });
  await client.mutation(api.outreach.approvePlan, { planId: data.plan._id });
  await send();
  assert.deepEqual(timers, [2147483647]);
  planLifecycle.advanceDueTasks(data.tasks[1].scheduledAt! - 1);
  assert.equal(data.tasks[1].status, "scheduled");
  assert.equal(data.plan.status, "executing");
  planLifecycle.advanceDueTasks(data.tasks[1].scheduledAt!);
  assert.equal(data.plan.status, "completed");
  await client.close();
});

test("direct messages appear in activity history without becoming public interaction posts", async () => {
  const { client, person, data, send } = fixture();
  await client.mutation(api.outreach.approvePlan, { planId: data.plan._id });
  await send();
  const paginationOpts = { cursor: null, numItems: 20 };
  const interactions = await client.query(
    api.interactions.getProspectInteractionsPage,
    { prospectId: person._id, paginationOpts }
  );
  assert.ok(interactions.page.every((entry) => entry.interactionType !== "dm"));
  assert.ok(
    interactions.page.every(
      (entry) => entry.replyText !== data.tasks[0].content
    )
  );
  const history = await client.query(api.outreach.getActivityLog, {
    prospectId: person._id,
    paginationOpts,
  });
  assert.ok(
    history.page.some(
      (event) =>
        event.type === "contacted" &&
        event.description === data.tasks[0].content
    )
  );
  await client.close();
});

test("analytics issues follow pause, failure and successful retry", async () => {
  const { client, state, data, send, failNextSend } = fixture();
  const read = async () => {
    // Reporting windows are half-open; move past the mutation's millisecond.
    await new Promise((resolve) => setTimeout(resolve, 2));
    const result = await client.action(
      api.analytics.getDashboardAnalyticsSnapshot,
      { workspaceId: state.selectedWorkspaceId, range: "30d" }
    );
    if (result.status !== "success") throw new Error("Analytics unavailable");
    return result.data;
  };
  await client.mutation(api.outreach.approvePlan, { planId: data.plan._id });
  await client.mutation(api.outreach.pausePlan, { planId: data.plan._id });
  assert.equal((await read()).issues.paused, 1);
  assert.equal((await read()).pendingApprovals.tasks, 0);
  await client.mutation(api.outreach.resumePlan, { planId: data.plan._id });
  failNextSend();
  await assert.rejects(send());
  assert.equal((await read()).issues.failed, 1);
  await send();
  assert.equal((await read()).issues.value, 0);
  assert.equal((await read()).pendingApprovals.tasks, 0);
  await client.close();
});
