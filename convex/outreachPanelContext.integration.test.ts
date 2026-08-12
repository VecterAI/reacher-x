/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function seedDmPanelContexts(
  t: ReturnType<typeof convexTest>,
  platform: "twitter" | "linkedin"
) {
  return await t.run(async (ctx) => {
    const workosUserId = `panel-context-${platform}`;
    const userId = await ctx.db.insert("users", {
      workosUserId,
      email: `${platform}@example.com`,
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: `${platform} panel workspace`,
      description: "DM panel regression workspace",
      isDefault: true,
      entitlementSlot: 1,
      updatedAt: 1,
    });
    const prospectId = await ctx.db.insert("prospects", {
      workspaceId,
      userId,
      platform,
      origin: "workspace_discovery",
      externalId: `${platform}-panel-prospect`,
      data: {},
      status: "contacted",
      qualificationStatus: "qualified",
      displayName: `${platform} panel prospect`,
      updatedAt: 1,
    });
    const planId = await ctx.db.insert("outreachPlans", {
      prospectId,
      workspaceId,
      userId,
      status: "executing",
      strategy: {
        rationale: "Test task panel state.",
        valueProposition: "Regression coverage.",
        tone: "peer",
      },
      version: 1,
      updatedAt: 1,
    });
    const draft = {
      content: `${platform} pending DM text`,
      mediaUrls: [`https://cdn.example.com/${platform}-pending.png`],
      mediaDescriptions: [`${platform} pending caption`],
      mediaKinds: ["image" as const],
    };
    const pendingTaskId = await ctx.db.insert("outreachTasks", {
      planId,
      order: 1,
      type: "dm",
      description: "Pending DM",
      ...draft,
      status: "pending",
      timing: { type: "immediate" },
      approvalContext: { platform, panelMode: "approval" },
    });
    const completedTaskId = await ctx.db.insert("outreachTasks", {
      planId,
      order: 2,
      type: "dm",
      description: "Completed DM",
      ...draft,
      status: "completed",
      timing: { type: "immediate" },
      executedAt: 2,
      approvalContext: { platform, panelMode: "posted" },
      resultData: {
        conversationId: `${platform}-conversation`,
        messageId: `${platform}-message`,
        postedAt: 2,
        postedText: draft.content,
        postedMediaUrls: draft.mediaUrls,
        postedMediaDescriptions: draft.mediaDescriptions,
        postedMediaKinds: draft.mediaKinds,
      },
    });

    return { completedTaskId, draft, pendingTaskId, prospectId, workosUserId };
  });
}

describe("outreach DM panel context", () => {
  for (const platform of ["twitter", "linkedin"] as const) {
    test(`${platform} exposes payload for approval but not after send`, async () => {
      const t = convexTest(schema, modules);
      const seeded = await seedDmPanelContexts(t, platform);
      const authenticated = t.withIdentity({ subject: seeded.workosUserId });

      const pending = await authenticated.query(
        api.outreach.getAgentPanelContext,
        {
          prospectId: seeded.prospectId,
          taskId: seeded.pendingTaskId,
        }
      );
      const completed = await authenticated.query(
        api.outreach.getAgentPanelContext,
        {
          prospectId: seeded.prospectId,
          taskId: seeded.completedTaskId,
        }
      );

      expect(pending).toMatchObject({
        kind: "dm",
        mode: "approval",
        platform,
        draft: seeded.draft,
        posted: null,
      });
      expect(completed).toMatchObject({
        kind: "dm",
        mode: "posted",
        platform,
        draft: null,
        posted: {
          conversationId: `${platform}-conversation`,
          messageId: `${platform}-message`,
          text: seeded.draft.content,
          mediaUrls: seeded.draft.mediaUrls,
          mediaDescriptions: seeded.draft.mediaDescriptions,
          mediaKinds: seeded.draft.mediaKinds,
        },
      });
    });
  }

  test("completed comment panels retain their existing draft context", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedDmPanelContexts(t, "twitter");
    const commentTaskId = await t.run(async (ctx) => {
      const dmTask = await ctx.db.get(seeded.pendingTaskId);
      if (!dmTask) throw new Error("Seeded task not found");
      return await ctx.db.insert("outreachTasks", {
        planId: dmTask.planId,
        order: 3,
        type: "comment",
        description: "Completed reply",
        content: "Previously posted reply",
        status: "completed",
        timing: { type: "immediate" },
        targetTweetId: "source-post",
        executedAt: 2,
        approvalContext: { platform: "twitter", panelMode: "posted" },
        resultData: {
          postedTweetId: "posted-reply",
          postedText: "Previously posted reply",
          postedAt: 2,
        },
      });
    });

    const context = await t
      .withIdentity({ subject: seeded.workosUserId })
      .query(api.outreach.getAgentPanelContext, {
        prospectId: seeded.prospectId,
        taskId: commentTaskId,
      });

    expect(context?.draft).toEqual({
      content: "Previously posted reply",
      mediaUrls: [],
      mediaDescriptions: [],
      mediaKinds: [],
    });
  });
});
