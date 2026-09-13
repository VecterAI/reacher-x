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
  assert.equal(BLOG_DEMO_IDS.length, 21);
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
