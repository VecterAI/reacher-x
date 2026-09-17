import assert from "node:assert/strict";
import { test } from "node:test";
import { api } from "@/convex/_generated/api";
import { createAppServices } from "./appServices";
import {
  REACH_OUT_PREFERENCE,
  REACH_OUT_MEMORY_DRAFT,
  REACH_OUT_VIDEO_PROMPT,
  REACH_OUT_VIDEO_DRAFT,
  REACH_OUT_BUBBLE_PROMPT,
  REACH_OUT_BUBBLE_TASKS,
  REACH_OUT_UNICODE_PROMPT,
  REACH_OUT_UNICODE_TASKS,
} from "@/features/blog/lib/reachOutDemoCopy";

test("the saved writing instruction changes Nora's draft and stays in its workspace", async () => {
  const { client, state, reporting } = createAppServices(
    "reach-out-writing-preferences"
  );
  try {
    const { threadId } = await client.mutation(
      api.chat.createWorkspaceThreadWithPrompt,
      {
        prompt: "Draft a first message to Nora",
      }
    );
    const person = state.prospects[0];
    assert.notEqual(
      state.plans.get(person._id)?.tasks[0].content,
      REACH_OUT_MEMORY_DRAFT
    );
    assert.equal(reporting.memories.size, 0);
    await client.mutation(api.chat.initiateStreamingMessage, {
      threadId,
      prompt: `Remember this for outreach: ${REACH_OUT_PREFERENCE}`,
    });
    assert.equal(
      [...reporting.memories.values()][0].summary,
      REACH_OUT_PREFERENCE
    );
    await client.mutation(api.chat.initiateStreamingMessage, {
      threadId,
      prompt: "Draft a first message to Nora using that preference",
    });
    const plan = state.plans.get(person._id)!;
    assert.equal(plan.tasks[0].content, REACH_OUT_MEMORY_DRAFT);
    assert.match(plan.tasks[0].content!, /^Hi Nora, how .*\?/);
    assert.doesNotMatch(plan.tasks[0].content!, /our product|I'm building/);
    assert.equal(plan.plan.status, "draft");
    assert.equal(
      state.lifecycle.interactions.filter(
        (entry) => entry.threadId === `demo-conversation-${person._id}`
      ).length,
      0
    );
    state.selectedWorkspaceId = state.workspaces[1]._id;
    assert.equal(reporting.memories.size, 0);
    state.selectedWorkspaceId = state.workspaces[0]._id;
    assert.equal(reporting.memories.size, 1);
    const replay = createAppServices("reach-out-writing-preferences");
    assert.equal(replay.reporting.memories.size, 0);
    await replay.client.close();
  } finally {
    await client.close();
  }
});

test("the first-message video needs review, survives a failed send, and sends only once", async () => {
  const { client, state, failNextSend } = createAppServices(
    "reach-out-personal-video"
  );
  try {
    const person = state.prospects[0];
    const context = await client.action(
      api.linkedin.getLinkedInConversationPanelContext,
      { prospectId: person._id }
    );
    assert.ok(context);
    assert.equal(context.messages.length, 0);
    await client.mutation(api.chat.createWorkspaceThreadWithPrompt, {
      prompt: REACH_OUT_VIDEO_PROMPT,
      metadata: {
        version: 1,
        promptTextSource: "user",
        taggedEntities: [],
        attachments: [
          {
            uploadId: null,
            fileName: "client-feedback.mp4",
            mediaUrl: "/media/client-feedback.mp4",
          },
        ],
      },
    });
    const plan = state.plans.get(person._id)!;
    const task = plan.tasks[0];
    assert.equal(task.content, REACH_OUT_VIDEO_DRAFT);
    assert.deepEqual(task.mediaUrls, ["/media/client-feedback.mp4"]);
    const send = () =>
      client.mutation(api.outreach.approveTask, {
        taskId: task._id,
        expectedType: "dm",
      });
    await assert.rejects(send(), /Approve the plan/);
    await client.mutation(api.outreach.approvePlan, { planId: plan.plan._id });
    assert.equal(
      state.lifecycle.interactions.filter(
        (entry) => entry.threadId === `demo-conversation-${person._id}`
      ).length,
      0
    );
    failNextSend();
    await assert.rejects(send(), /connection interrupted/);
    assert.equal(task.status, "failed");
    await send();
    await send();
    const sent = await client.query(
      api.outboundMessageOperations.listForProspect,
      { prospectId: person._id, platform: "linkedin" }
    );
    assert.equal(sent.length, 1);
    assert.equal(sent[0].text, REACH_OUT_VIDEO_DRAFT);
    assert.deepEqual(sent[0].mediaUrls, ["/media/client-feedback.mp4"]);
    assert.equal(plan.plan.status, "completed");
  } finally {
    await client.close();
  }
});

for (const story of [
  {
    scenario: "reach-out-message-bubbles",
    prompt: REACH_OUT_BUBBLE_PROMPT,
    messages: REACH_OUT_BUBBLE_TASKS,
  },
  {
    scenario: "reach-out-unicode-formatting",
    prompt: REACH_OUT_UNICODE_PROMPT,
    messages: REACH_OUT_UNICODE_TASKS,
  },
] as const)
  test(`${story.scenario}: Agent creates ordered drafts, approval and retry preserve each message exactly once`, async () => {
    const { client, state, failNextSend } = createAppServices(story.scenario);
    try {
      const person = state.prospects[0];
      await client.mutation(api.chat.createWorkspaceThreadWithPrompt, {
        prompt: story.prompt,
      });
      const plan = state.plans.get(person._id)!;
      assert.deepEqual(
        plan.tasks.map((task) => task.content),
        story.messages.map((message) => message.content)
      );
      assert.deepEqual(
        plan.tasks.map((task) => task.order),
        story.messages.map((_, index) => index + 1)
      );
      assert.equal(
        new Set(plan.tasks.map((task) => task._id)).size,
        story.messages.length
      );
      const common = { prospectId: person._id, platform: "linkedin" as const };
      const sent = () =>
        client.query(api.outboundMessageOperations.listForProspect, common);
      const approve = (index: number) =>
        client.mutation(api.outreach.approveTask, {
          taskId: plan.tasks[index]._id,
          expectedType: "dm",
        });
      await assert.rejects(approve(0), /Approve the plan/);
      assert.deepEqual(await sent(), []);
      await client.mutation(api.outreach.approvePlan, {
        planId: plan.plan._id,
      });
      assert.deepEqual(await sent(), []);
      if (plan.tasks.length > 1)
        await assert.rejects(approve(1), /preceding tasks/);
      for (let index = 0; index < plan.tasks.length; index++) {
        if (index === plan.tasks.length - 1) {
          failNextSend();
          await assert.rejects(approve(index), /connection interrupted/);
          assert.equal(plan.tasks[index].status, "failed");
          assert.equal((await sent()).length, index);
        }
        await approve(index);
        await approve(index);
        assert.equal((await sent()).length, index + 1);
      }
      assert.deepEqual(
        (await sent()).map((message) => message.text),
        story.messages.map((message) => message.content)
      );
      assert.equal(plan.plan.status, "completed");
      const replay = createAppServices(story.scenario);
      assert.deepEqual(
        await replay.client.query(
          api.outboundMessageOperations.listForProspect,
          common
        ),
        []
      );
      await replay.client.close();
    } finally {
      await client.close();
    }
  });
