import assert from "node:assert/strict";
import { test } from "node:test";
import { api } from "@/convex/_generated/api";
import { createAppServices } from "./appServices";
import { createScenarioDraftPlan } from "./scenarioPlanHelpers";
import { normalizeLinkedInPost } from "@/shared/lib/linkedin/post";
import { BLOG_DEMO_IDS } from "@/features/blog/lib/blogDemoHelpers";

test("public comment edits, task ordering, completion and history use one saved result", async () => {
  const { client, state } = createAppServices("find-potential-customers");
  const person = state.prospects[0];
  const { data } = createScenarioDraftPlan(state, person, {
    threadId: "test",
    description: "Ask about feedback",
    content: "Where do approvals get lost?",
    rationale: person.briefIntro!,
  });
  const [comment, dm] = data.tasks;
  assert.deepEqual(
    data.tasks.map((task) => task.type),
    ["comment", "dm"]
  );
  const paginationOpts = { cursor: null, numItems: 10 };
  assert.deepEqual(
    (
      await client.query(api.interactions.getProspectInteractionsPage, {
        prospectId: person._id,
        paginationOpts,
      })
    ).page,
    []
  );
  await client.mutation(api.outreach.approvePlan, { planId: data.plan._id });
  await assert.rejects(
    client.mutation(api.outreach.approveTask, {
      taskId: dm._id,
      expectedType: "dm",
    }),
    /preceding tasks/
  );
  assert.equal(
    (
      await client.query(api.outreach.getAgentPanelContext, {
        prospectId: person._id,
        targetTweetId: comment.targetTweetId,
      })
    )?.resolvedTaskId,
    comment._id
  );
  assert.equal(
    await client.query(api.outreach.getAgentPanelContext, {
      prospectId: person._id,
      taskId: dm._id,
      targetTweetId: comment.targetTweetId,
    }),
    null
  );
  const content = "Do clients approve in email or in the document?";
  await client.mutation(api.outreach.updatePendingTaskDraft, {
    taskId: comment._id,
    expectedType: "comment",
    content,
  });
  await client.mutation(api.outreach.approveTask, {
    taskId: comment._id,
    expectedType: "comment",
  });
  assert.equal(comment.status, "completed");
  assert.equal(dm.approvalReady, true);
  assert.equal(data.plan.status, "executing");
  await client.mutation(api.outreach.approveTask, {
    taskId: comment._id,
    expectedType: "comment",
  });
  const interactions = await client.query(
    api.interactions.getProspectInteractionsPage,
    { prospectId: person._id, paginationOpts }
  );
  assert.equal(interactions.page.length, 1);
  assert.equal(interactions.page[0].replyText, content);
  assert.ok(normalizeLinkedInPost(interactions.page[0].sourcePostData));
  const context = await client.action(
    api.linkedin.getLinkedInPostThreadContext,
    { prospectId: person._id, postId: comment.targetTweetId }
  );
  assert.equal(context.topLevelComments.items[0].text, content);
  await client.mutation(api.outreach.approveTask, {
    taskId: dm._id,
    expectedType: "dm",
  });
  assert.equal(data.plan.status, "completed");
  assert.ok(
    data.tasks.every(
      (task) => task.status === "completed" && !task.approvalReady
    )
  );
  await assert.rejects(
    client.mutation(api.outreach.updatePendingTaskDraft, {
      taskId: comment._id,
      expectedType: "comment",
      content: "Changed after posting",
    }),
    /no longer editable/
  );
  await client.close();
});

test("every story has multiple distinct, valid source posts with consistent profile identities", async () => {
  for (const scenario of BLOG_DEMO_IDS) {
    const { client, state } = createAppServices(scenario);
    for (const person of state.prospects.filter(
      (person) => person.discoverySource === "search_post"
    )) {
      assert.ok(
        (person.evidencePosts?.length ?? 0) >= 2,
        `${scenario}: ${person.displayName}`
      );
      assert.equal(
        new Set(person.evidencePosts!.map((post) => post.id_str ?? post.postID))
          .size,
        person.evidencePosts!.length
      );
      if (person.platform === "linkedin")
        for (const post of person.evidencePosts!) {
          assert.match(post.postID, /^urn:li:activity:\d+$/);
          assert.ok(normalizeLinkedInPost(post)?.text);
        }
    }
    await client.close();
  }
});

test("XChat uses a populated fictional bundle and rejects real wire payloads", async () => {
  const { client, state } = createAppServices("manage-dm-conversations");
  const person = state.prospects.find(
    (person) => person.platform === "twitter"
  )!;
  const bundle = await client.action(api.x.getXChatDecryptBundle, {
    prospectId: person._id,
  });
  assert.equal(bundle.availability, "available");
  if (bundle.availability !== "available") throw new Error("Missing bundle");
  assert.ok(bundle.events.length >= 2);
  assert.equal(bundle.viewerUserId, "demo_viewer");
  await assert.rejects(
    client.action(api.x.submitXChatEncryptedMessage, {
      prospectId: person._id,
      conversationId: bundle.conversationId,
      clientRequestId: "test",
      messageId: "test",
      encodedMessageCreateEvent: "{}",
      encodedMessageEventSignature: "not-a-demo",
    }),
    /fictional demo/
  );
  await client.close();
});

test("a linked X profile supplies valid, unique timeline IDs even for LinkedIn-sourced evidence", async () => {
  const { client, state } = createAppServices("how-reacherx-enrichment-works");
  const person = state.prospects[0];
  const result = await client.action(
    api.socialapi.getHydratedTwitterTimelineFromSocialApi,
    { username: person.socialProfiles!.twitter!.username!, mode: "posts" }
  );
  assert.ok(result.tweets.length >= 3);
  for (const post of result.tweets) {
    assert.ok(post.id_str);
    assert.match(post.id_str, /^\d+$/);
  }
  assert.equal(
    new Set(result.tweets.map((post) => post.id_str)).size,
    result.tweets.length
  );
  await client.close();
});

test("recontacting a prospect preserves the first contact time", async () => {
  const { recordDemoMessage } = await import("./lifecycleHelpers");
  const { client, state } = createAppServices("find-candidates");
  const person = state.prospects[0];
  person.stageTimestamps = { ...person.stageTimestamps, contacted: 1000 };
  person.status = "new";
  recordDemoMessage(
    state.lifecycle,
    person,
    {
      id: "recontact",
      conversationId: `demo-conversation-${person._id}`,
      direction: "sent",
      text: "Following up on the role details",
      createdAt: new Date(2000).toISOString(),
    },
    2000
  );
  assert.equal(person.status, "contacted");
  assert.equal(person.stageTimestamps.contacted, 1000);
  assert.equal(person.updatedAt, 2000);
  await client.close();
});
