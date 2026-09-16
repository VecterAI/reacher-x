import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { createAppServices } from "./appServices";
import { BLOG_DEMO_IDS } from "@/features/blog/lib/blogDemoHelpers";
import { DEMO_MEMORY_INSTRUCTION } from "./reportingServices";

test("every published story is wired to its own article; self-hosting remains excluded", async () => {
  for (const id of BLOG_DEMO_IDS) {
    const body = await readFile(
      new URL(`../../../content/blog/${id}.mdx`, import.meta.url),
      "utf8"
    );
    assert.ok(body.includes(`scenario="${id}"`));
    assert.ok(!body.includes("<BlogMediaPlaceholder"));
  }
  assert.equal(BLOG_DEMO_IDS.length, 22);
  assert.ok(
    (
      await readFile(
        new URL(
          "../../../content/blog/run-reacherx-yourself.mdx",
          import.meta.url
        ),
        "utf8"
      )
    ).includes("<BlogMediaPlaceholder")
  );
});

for (const retryAll of [false, true])
  test(`a ${retryAll ? "whole-batch" : "single-person"} retry preserves successful plans and failed history`, async () => {
    const { client, state } = createAppServices(
      "create-plans-for-several-people"
    );
    const people = await client.query(api.mediaMentions.searchMentionEntities, {
      query: "",
      workspaceId: state.selectedWorkspaceId,
      allowedKinds: ["prospect"],
    });
    const metadata = {
      version: 1 as const,
      promptTextSource: "user" as const,
      taggedEntities: people.filter((person) =>
        /^use_case_demo_audience_[123]$/.test(person.entityId)
      ),
      attachments: [],
    };
    const result = await client.mutation(
      api.chat.createWorkspaceThreadWithPrompt,
      { prompt: "Create a plan for each tagged person", metadata }
    );
    const initial = await client.query(api.planBatches.getPlanBatchRun, {
      runId: "demo_batch_1" as Id<"planBatchRuns">,
    });
    assert.equal(initial?.failedCount, 1);
    assert.equal(initial?.createdCount, 2);
    const before = structuredClone(
      [...state.plans.values()].filter(
        (p) => p.plan.workspaceId === state.selectedWorkspaceId
      )
    );
    assert.equal(before.length, 2);
    await client.mutation(api.chat.initiateStreamingMessage, {
      threadId: result.threadId,
      prompt: "Retry Lee only",
      metadata: {
        ...metadata,
        taggedEntities: retryAll
          ? metadata.taggedEntities
          : people.filter((p) => p.label === "Lee Park"),
      },
    });
    for (const plan of before)
      assert.deepEqual(state.plans.get(plan.plan.prospectId), plan);
    assert.equal(
      [...state.plans.values()].filter(
        (p) => p.plan.workspaceId === state.selectedWorkspaceId
      ).length,
      3
    );
    assert.equal(
      (
        await client.query(api.planBatches.getPlanBatchRun, {
          runId: "demo_batch_1" as Id<"planBatchRuns">,
        })
      )?.failedCount,
      1
    );
    assert.equal(
      (
        await client.query(api.planBatches.getPlanBatchRun, {
          runId: "demo_batch_2" as Id<"planBatchRuns">,
        })
      )?.createdCount,
      1
    );
    const transcript = await client.query(api.chat.listThreadMessages, {
      threadId: result.threadId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    assert.equal(transcript.page.filter((m) => m.role === "user").length, 2);
    assert.equal(
      transcript.page.filter((m) => m.role === "assistant").length,
      2
    );
  });

test("an unsupported batch target cannot create a successful run or an empty plan", async () => {
  const { client, state } = createAppServices(
    "create-plans-for-several-people"
  );
  state.prospects.find(
    (person) => person._id === "use_case_demo_audience_3"
  )!.displayName = "Unscripted person";
  const taggedEntities = await client.query(
    api.mediaMentions.searchMentionEntities,
    {
      query: "",
      workspaceId: state.selectedWorkspaceId,
      allowedKinds: ["prospect"],
    }
  );
  const before = structuredClone([...state.plans.entries()]);
  await client.mutation(api.chat.createWorkspaceThreadWithPrompt, {
    prompt: "Create a plan for each tagged person",
    metadata: {
      version: 1,
      promptTextSource: "user",
      taggedEntities,
      attachments: [],
    },
  });
  assert.equal(
    await client.query(api.planBatches.getPlanBatchRun, {
      runId: "demo_batch_1" as Id<"planBatchRuns">,
    }),
    null
  );
  assert.deepEqual([...state.plans.entries()], before);
});

test("saving an instruction precedes a later draft and does not leak into another demo", async () => {
  const first = createAppServices("teach-reacherx-what-you-want"),
    other = createAppServices("teach-reacherx-what-you-want");
  const result = await first.client.mutation(
    api.chat.createWorkspaceThreadWithPrompt,
    { prompt: `Remember this for outreach: ${DEMO_MEMORY_INSTRUCTION}` }
  );
  assert.equal(first.reporting.memories.size, 1);
  assert.equal(other.reporting.memories.size, 0);
  await first.client.mutation(api.chat.initiateStreamingMessage, {
    threadId: result.threadId,
    prompt: "Draft an introduction to Isabelle",
  });
  const draft = first.state.plans.get("use_case_demo_candidates_1")!.tasks[0]
    .content!;
  assert.ok(draft.split(/\s+/).length < 80);
  assert.equal((draft.match(/\?/g) ?? []).length, 1);
  assert.doesNotMatch(draft, /meeting|schedule|call/i);
  const history = await first.client.query(
    api.chat.listWorkspaceThreadsWithMessages,
    { paginationOpts: { numItems: 10, cursor: null } }
  );
  assert.equal(history.page[0]._id, result.threadId);
  const firstPage = await first.client.query(api.chat.listThreadMessages, {
    threadId: result.threadId,
    paginationOpts: { numItems: 2, cursor: null },
  });
  assert.equal(firstPage.page.length, 2);
  assert.equal(firstPage.isDone, false);
  const secondPage = await first.client.query(api.chat.listThreadMessages, {
    threadId: result.threadId,
    paginationOpts: { numItems: 2, cursor: firstPage.continueCursor },
  });
  assert.equal(secondPage.page.length, 2);
  assert.equal(secondPage.isDone, true);
});

test("all eight use cases start with setup and create a matching workspace before outreach", async () => {
  for (const scenario of [
    "find-candidates",
    "find-potential-customers",
    "find-investors",
    "find-research-participants",
    "find-partners",
    "find-creators",
    "find-community-members",
    "find-podcast-guests",
  ] as const) {
    const { state, client } = createAppServices(scenario);
    const shell = await client.query(api.shell.getAppShellState, {});
    assert.equal(shell?.locked, true);
    assert.equal(shell?.activeContextType, "setup_session");
    assert.equal(
      [...state.plans.values()].filter(
        ({ plan }) => plan.workspaceId === state.selectedWorkspaceId
      ).length,
      0
    );
    assert.equal(
      state.prospects.filter(
        (person) =>
          person.workspaceId === state.selectedWorkspaceId &&
          person.status === "converted"
      ).length,
      0
    );
    await client.close();
  }
});

test("analytics preserves every production platform category and pending task counts", async () => {
  const { state, client } = createAppServices("read-your-reacherx-analytics");
  const args = {
    workspaceId: state.selectedWorkspaceId,
    range: "30d" as const,
  };
  const result = await client.action(
    api.analytics.getDashboardAnalyticsSnapshot,
    args
  );
  assert.equal(result.status, "success");
  if (result.status !== "success") return;
  assert.equal(result.data.platformDistribution.length, 5);
  assert.ok(
    result.data.platformDistribution.some(
      (point) => point.platform === "Threads"
    )
  );
  assert.ok(
    result.data.platformDistribution.some(
      (point) => point.platform === "Bluesky"
    )
  );
  assert.ok(
    result.data.platformDistribution.some(
      (point) => point.platform === "Reddit"
    )
  );
  const first = state.plans.get(state.prospects[0]._id)!;
  await client.mutation(api.outreach.approvePlan, { planId: first.plan._id });
  const next = await client.action(
    api.analytics.getDashboardAnalyticsSnapshot,
    args
  );
  if (next.status !== "success") throw new Error("Analytics unavailable");
  assert.equal(next.data.pendingApprovals.tasks, 1);
  await client.close();
});

test("secondary customer workspaces never inherit hiring drafts", async () => {
  for (const scenario of BLOG_DEMO_IDS) {
    const { client, state } = createAppServices(scenario);
    for (const { plan, tasks } of state.plans.values()) {
      const workspace = state.workspaces.find(
        (item) => item._id === plan.workspaceId
      )!;
      if (workspace.useCaseKey === "customer_prospecting") {
        for (const task of tasks)
          assert.doesNotMatch(
            task.content ?? "",
            /frontend.*role|product designer role|salary|€80/
          );
      }
    }
    await client.close();
  }
  const { client, state } = createAppServices("teach-reacherx-what-you-want");
  state.selectedWorkspaceId = state.workspaces[1]._id;
  const person = state.prospects.find(
    (item) =>
      item.workspaceId === state.selectedWorkspaceId && item.status === "new"
  )!;
  const thread = await client.mutation(
    api.chat.createWorkspaceThreadWithPrompt,
    { prompt: `Remember this for outreach: ${DEMO_MEMORY_INSTRUCTION}` }
  );
  await client.mutation(api.chat.initiateStreamingMessage, {
    threadId: thread.threadId,
    prompt: `Draft an introduction for ${person.displayName}`,
  });
  const draft = state.plans.get(person._id)!.tasks[0].content!;
  assert.match(draft, /client feedback/);
  assert.doesNotMatch(draft, /frontend|salary|€80/);
  assert.equal(draft.split("?").length - 1, 1);
  assert.ok(draft.split(/\s+/).length < 80);
  await client.close();
});

test("analytics fixtures keep pipeline dates and reply performance consistent", async () => {
  const { state, client } = createAppServices("read-your-reacherx-analytics");
  const people = state.prospects.filter(
    (person) => person.workspaceId === state.selectedWorkspaceId
  );
  for (const person of people) {
    assert.equal(person.stageTimestamps?.new, person._creationTime);
    assert.ok(person.stageTimestamps?.[person.status] !== undefined);
    if (person.status === "in_progress" || person.status === "converted") {
      assert.ok(
        person.stageTimestamps!.in_progress! >=
          person.stageTimestamps!.contacted!
      );
    }
  }
  const inventory = await client.action(
    api.agentOps.getAgentOpsDiscoveryInventoryPageSnapshot,
    { workspaceId: state.selectedWorkspaceId, range: "30d" }
  );
  assert.ok(inventory.rows[0].replyRate > 0);
  assert.ok(inventory.rows[0].replyRate <= 100);
  await client.close();
});

test("starting another demo workspace clears the previous setup draft", async () => {
  const { client } = createAppServices("getting-started-with-reacherx");
  const { sessionId, threadId } = await client.mutation(
    api.setupSessions.startSetupSession,
    { mode: "new_workspace" }
  );
  await client.mutation(api.chat.initiateStreamingMessage, {
    threadId,
    prompt: "Find a contract TypeScript engineer for checkout",
  });
  const drafted = await client.query(api.setupSessions.getSetupSessionState, {
    sessionId,
  });
  assert.ok(drafted?.draftName);
  await client.mutation(api.setupSessions.approveSetupGeneration, {
    sessionId,
    generationRevision: drafted.generationRevision,
  });
  await client.mutation(api.setupSessions.startSetupSession, {
    mode: "new_workspace",
  });
  const restarted = await client.query(api.setupSessions.getSetupSessionState, {
    sessionId,
  });
  assert.equal(restarted?.status, "awaiting_input");
  assert.equal(restarted?.draftName, null);
  assert.equal(restarted?.generationSourceMessageId, null);
  assert.equal(restarted?.inputMode, null);
  await client.close();
});
