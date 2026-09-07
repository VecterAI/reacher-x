import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildAgentProspectProfileSnapshot } from "../convex/lib/prospectProfileContextCore";

test("agent profile snapshot includes the same stored website, socials, enrichment, and posts as the profile panel", () => {
  const snapshot = buildAgentProspectProfileSnapshot(
    {
      _id: "prospect_1",
      _creationTime: 100,
      workspaceId: "workspace_1",
      userId: "user_1",
      platform: "twitter",
      origin: "discovery",
      externalId: "external_1",
      data: {
        user: {
          screen_name: "lennyrachitsky",
          profile_image_url_https: "https://pbs.twimg.com/avatar.jpg",
          verified: true,
        },
      },
      status: "new",
      updatedAt: 200,
      displayName: "Lenny Rachitsky",
      title: "Product writer",
      briefIntro: "Writes about product and growth.",
      websiteUrl: "https://www.lennysnewsletter.com",
      websiteHref: "https://www.lennysnewsletter.com/",
      socialProfiles: {
        twitter: {
          username: "lennyrachitsky",
          url: "https://x.com/lennyrachitsky",
        },
      },
      qualificationStatus: "qualified",
      qualificationScore: 95,
      enrichmentStatus: "completed",
      painPoints: [
        {
          pain: "Scaling product education",
          solution: "Editorial automation",
          evidencePosts: [{ id: "post_1", text: "A relevant post" }],
        },
      ],
      evidencePosts: [{ id: "post_1", text: "A relevant post" }],
    } as never,
    {
      currentOutreachPlan: {
        status: "paused",
        strategy: {
          rationale: "Relevant plan",
          valueProposition: "A useful partnership",
          tone: "direct",
        },
        version: 1,
        createdAt: 150,
        updatedAt: 190,
        tasks: [
          {
            order: 1,
            type: "comment",
            description: "Engage with the launch post",
            status: "pending",
            mediaUrls: ["https://example.com/demo.mp4"],
            mediaDescriptions: ["Product demo"],
            mediaKinds: ["video"],
          },
        ],
      },
      interactionHistory: {
        items: [{ kind: "reply", text: "Thanks for sharing" }],
      },
      recentActivityLog: [
        {
          createdAt: 180,
          type: "plan_created",
          title: "Outreach plan created",
        },
      ],
    }
  );

  assert.equal(
    snapshot.profile.websiteHref,
    "https://www.lennysnewsletter.com/"
  );
  assert.equal(
    snapshot.identity.platformProfileUrl,
    "https://x.com/lennyrachitsky"
  );
  assert.equal(snapshot.identity.verified, true);
  assert.equal(snapshot.pipeline.qualificationScore, 95);
  assert.equal(snapshot.qualificationAndEnrichment.painPoints?.length, 1);
  assert.equal(snapshot.relevantActivity.evidencePosts.length, 1);
  assert.equal(snapshot.currentOutreachPlan?.tasks.length, 1);
  assert.deepEqual(snapshot.currentOutreachPlan?.tasks[0]?.mediaUrls, [
    "https://example.com/demo.mp4",
  ]);
  assert.deepEqual(snapshot.interactionHistory, {
    items: [{ kind: "reply", text: "Thanks for sharing" }],
  });
  assert.equal(snapshot.recentActivityLog.length, 1);
});

test("neither Main nor Setup Agent can bypass durable discovery workflows", () => {
  const source = readFileSync("convex/agents/index.ts", "utf8");
  const mainTools = source.match(
    /const mainAgentBaseTools = \{([\s\S]*?)\n\} as const;/
  )?.[1];
  const setupTools = source.match(
    /export const setupAgent = new Agent[\s\S]*?tools: \{([\s\S]*?)\n  \},/
  )?.[1];

  assert.ok(mainTools);
  assert.ok(setupTools);
  assert.doesNotMatch(mainTools, /searchProspects/);
  assert.doesNotMatch(setupTools, /searchProspects/);
  assert.match(setupTools, /approveSetupExamples/);
});

test("persisted progress artifacts do not render a live spinner", () => {
  const chatSource = readFileSync("features/agent/ui/AgentChat.tsx", "utf8");
  const artifactSource = readFileSync(
    "shared/ui/components/json-render/AgentArtifactRenderer.tsx",
    "utf8"
  );

  assert.doesNotMatch(
    chatSource,
    /case "running":\s*return <Loader2[^>]*animate-spin/
  );
  assert.doesNotMatch(
    artifactSource,
    /case "running":\s*return <Loader2[^>]*animate-spin/
  );
});
