/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import workflowSchema from "../node_modules/@convex-dev/workflow/dist/component/schema.js";
import workpoolSchema from "../node_modules/@convex-dev/workpool/dist/component/schema.js";
import polarSchema from "../node_modules/@convex-dev/polar/dist/component/schema.js";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { X_CORE_SCOPES } from "./lib/xScopes";
import { getPlanReadiness } from "./lib/outreachReadinessCore";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { createOutreachPlan } from "./lib/outreachCore";

const modules = import.meta.glob("./**/*.ts");
const workflowModules = import.meta.glob(
  "../node_modules/@convex-dev/workflow/dist/component/**/*.js"
);
const workpoolModules = import.meta.glob(
  "../node_modules/@convex-dev/workpool/dist/component/**/*.js"
);
const polarModules = import.meta.glob(
  "../node_modules/@convex-dev/polar/dist/component/**/*.js"
);
const strategy = {
  rationale: "Start a useful conversation.",
  valueProposition: "Relevant help",
  tone: "peer",
};

async function setup(platform: "twitter" | "linkedin", connected = false) {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  t.registerComponent("workflow", workflowSchema, workflowModules);
  t.registerComponent("workflow/workpool", workpoolSchema, workpoolModules);
  t.registerComponent("polar", polarSchema, polarModules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "readiness-owner",
      email: "owner@example.com",
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "QA",
      description: "Readiness QA",
      isDefault: true,
      entitlementSlot: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("userPlans", {
      userId,
      tier: "hobby",
      prospectsLimit: 100,
      workspacesLimit: 1,
      currentProspectsCount: 100,
      updatedAt: 1,
    });
    const prospectId = await ctx.db.insert("prospects", {
      userId,
      workspaceId,
      platform,
      externalId: "existing-prospect",
      origin: "workspace_discovery",
      status: "new",
      qualificationStatus: "qualified",
      data: {},
      updatedAt: 1,
    });
    await ctx.db.patch(prospectId, { qualifiedAt: getCurrentUTCTimestamp() });
    for (let index = 1; index < 100; index++) {
      await ctx.db.insert("prospects", {
        userId,
        workspaceId,
        platform,
        externalId: `cap-${index}`,
        origin: "workspace_discovery",
        status: "new",
        qualificationStatus: "qualified",
        qualifiedAt: getCurrentUTCTimestamp(),
        data: {},
        updatedAt: 1,
      });
    }
    const planId = await ctx.db.insert("outreachPlans", {
      userId,
      workspaceId,
      prospectId,
      status: "draft",
      strategy,
      version: 1,
      updatedAt: 1,
    });
    const taskId = await ctx.db.insert("outreachTasks", {
      planId,
      order: 1,
      type: "react",
      targetTweetId: "post",
      description: "Like a relevant post",
      reactionType: "like",
      timing: { type: "immediate" },
      status: "pending",
    });
    const xAccountId =
      connected && platform === "twitter"
        ? await ctx.db.insert("xAccounts", {
            userId,
            xUserId: "qa-x",
            username: "qa",
            accessToken: "fixture-only",
            refreshToken: "fixture-only",
            tokenType: "bearer",
            expiresAt: Number.MAX_SAFE_INTEGER,
            grantedScopes: [...X_CORE_SCOPES],
            status: "connected",
            updatedAt: 1,
          })
        : undefined;
    const linkedinAccountId =
      connected && platform === "linkedin"
        ? await ctx.db.insert("linkedinAccounts", {
            userId,
            accountId: "qa-linkedin",
            status: "connected",
            updatedAt: 1,
          })
        : undefined;
    return {
      userId,
      workspaceId,
      prospectId,
      planId,
      taskId,
      xAccountId,
      linkedinAccountId,
    };
  });
  return { t, ...ids, owner: t.withIdentity({ subject: "readiness-owner" }) };
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

for (const platform of ["twitter", "linkedin"] as const) {
  describe(`${platform} account readiness`, () => {
    test("blocks UI and agent approval without approving or scheduling anything", async () => {
      const { t, owner, planId } = await setup(platform);
      await expect(
        owner.mutation(api.outreach.approvePlan, { planId })
      ).rejects.toThrow("account_required");
      await expect(
        t.mutation(internal.outreach.approvePlanMutation, { planId })
      ).rejects.toThrow("account_required");
      expect(await t.run((ctx) => ctx.db.get(planId))).toMatchObject({
        status: "draft",
      });
      const view = await owner.query(api.outreach.getPlanById, { planId });
      expect(view?.readiness.missingPlatforms).toEqual([platform]);
    });
    test("starts existing-prospect outreach at the 100/100 cap and does not start twice", async () => {
      const { t, owner, planId, workspaceId } = await setup(platform, true);
      expect(
        await t.query(
          internal.workflows.prospecting.checkProspectLimitInternal,
          { workspaceId }
        )
      ).toMatchObject({ limitReached: true, currentCount: 100, limit: 100 });
      await owner.mutation(api.outreach.approvePlan, { planId });
      const first = await t.mutation(
        internal.workflows.outreach.startOutreachWorkflow,
        { planId }
      );
      const second = await t.mutation(
        internal.workflows.outreach.startOutreachWorkflow,
        { planId }
      );
      expect(first.workflowId).not.toBe("");
      expect(second.workflowId).toBe(first.workflowId);
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const execution = await t.run(async (ctx) => ({
        plan: await ctx.db.get("outreachPlans", planId),
        task: await ctx.db
          .query("outreachTasks")
          .withIndex("by_plan_order", (q) => q.eq("planId", planId))
          .first(),
      }));
      expect(execution.plan?.status).toBe("executing");
      expect(execution.task?.approvalEventId).toEqual(expect.any(String));
      expect(execution.task?.resultData).toBeUndefined();
      expect(await t.run((ctx) => ctx.db.get(planId))).toMatchObject({
        workflowId: first.workflowId,
      });
    }, 30_000);
    test("blocks startup if the account disconnects after approval", async () => {
      const { t, owner, planId, xAccountId, linkedinAccountId } = await setup(
        platform,
        true
      );
      await owner.mutation(api.outreach.approvePlan, { planId });
      await t.run((ctx) => ctx.db.delete((xAccountId ?? linkedinAccountId)!));
      expect(
        await t.mutation(internal.workflows.outreach.startOutreachWorkflow, {
          planId,
        })
      ).toEqual({ workflowId: "" });
      expect(await t.run((ctx) => ctx.db.get(planId))).toMatchObject({
        status: "blocked_auth",
      });
    });
    test("keeps autonomous plans as drafts until their account is connected", async () => {
      const {
        t,
        userId,
        workspaceId,
        prospectId,
        planId: oldPlanId,
      } = await setup(platform);
      const planId = await t.run(async (ctx) => {
        await ctx.db.patch(oldPlanId, { status: "abandoned" });
        await ctx.db.insert("workspaceAgentSettings", {
          userId,
          workspaceId,
          autonomyMode: "autonomous",
          updatedAt: 1,
        });
        return createOutreachPlan(ctx, {
          userId,
          workspaceId,
          prospectId,
          strategy,
          tasks: [
            {
              type: "dm",
              description: "Introduce yourself",
              content: "Hi",
              timing: { type: "immediate" },
            },
          ],
        });
      });
      expect(await t.run((ctx) => ctx.db.get(planId))).toMatchObject({
        status: "draft",
      });
    });
    test("does not require an account for wait-only or completed work", async () => {
      const { t, planId, taskId } = await setup(platform);
      for (const patch of [
        { type: "wait" as const },
        { type: "ask_human" as const },
        { type: "react" as const, status: "completed" as const },
        { status: "skipped" as const },
        { status: "pending" as const, supersededAt: 1 },
      ]) {
        await t.run(async (ctx) => {
          await ctx.db.patch(taskId, patch);
          expect(
            (await getPlanReadiness(ctx, (await ctx.db.get(planId))!))
              .missingPlatforms
          ).toEqual([]);
        });
      }
    });
  });
}

test("X/Twitter missing permissions require reconnecting", async () => {
  const { t, owner, planId, xAccountId } = await setup("twitter", true);
  await t.run((ctx) =>
    ctx.db.patch(xAccountId!, { grantedScopes: ["users.read"] })
  );
  await expect(
    owner.mutation(api.outreach.approvePlan, { planId })
  ).rejects.toThrow("account_required");
});

for (const status of [
  "connecting",
  "reconnect_required",
  "action_required",
  "restricted",
  "disconnected",
] as const) {
  test(`LinkedIn ${status} cannot approve`, async () => {
    const { t, owner, planId, linkedinAccountId } = await setup(
      "linkedin",
      true
    );
    await t.run((ctx) => ctx.db.patch(linkedinAccountId!, { status }));
    await expect(
      owner.mutation(api.outreach.approvePlan, { planId })
    ).rejects.toThrow("account_required");
  });
}

test("another user cannot approve the plan or read the connection snapshot", async () => {
  const { t, planId } = await setup("linkedin", true);
  await t.run((ctx) =>
    ctx.db.insert("users", {
      workosUserId: "other",
      email: "other@example.com",
    })
  );
  const other = t.withIdentity({ subject: "other" });
  await expect(
    other.mutation(api.outreach.approvePlan, { planId })
  ).rejects.toThrow();
  expect(
    await other.query(api.connectedAccounts.getConnectionSnapshot, {
      platform: "linkedin",
    })
  ).toMatchObject({ isConnected: false });
  await expect(
    t.query(api.connectedAccounts.getConnectionSnapshot, {
      platform: "linkedin",
    })
  ).rejects.toThrow();
});

test("enrichment stays paused at the cap before enqueueing", async () => {
  const { t, prospectId, workspaceId } = await setup("linkedin", true);
  expect(
    await t.action(internal.workflows.enrichment.startEnrichment, {
      prospectId,
      workspaceId,
    })
  ).toEqual({ workId: "" });
  expect(
    await t.action(internal.workflows.enrichment.runEnrichmentWorkflow, {
      prospectId,
      workspaceId,
    })
  ).toEqual({ workflowId: "" });
  expect(await t.run((ctx) => ctx.db.get(prospectId))).not.toHaveProperty(
    "enrichmentWorkflowId"
  );
});

test("failed capacity cancellation preserves the enrichment workflow claim", async () => {
  const { t, prospectId, workspaceId } = await setup("linkedin", true);
  await t.run((ctx) =>
    ctx.db.patch(prospectId, {
      enrichmentStatus: "pending",
      enrichmentWorkflowId: "pending:queued-enrichment",
    })
  );
  await t.action(internal.workspaces.reconcileWorkspaceCapacityStateInternal, {
    workspaceId,
  });
  expect(await t.run((ctx) => ctx.db.get(prospectId))).toMatchObject({
    enrichmentWorkflowId: "pending:queued-enrichment",
  });
});

test("old approved plans without a workflow can be started without approving again", async () => {
  const { t, owner, planId } = await setup("linkedin", true);
  await t.run((ctx) => ctx.db.patch(planId, { status: "approved" }));
  await owner.mutation(api.outreach.approvePlan, { planId });
  const started = await t.run((ctx) => ctx.db.get(planId));
  expect(started?.workflowId).toEqual(expect.any(String));
  await owner.mutation(api.outreach.approvePlan, { planId });
  expect((await t.run((ctx) => ctx.db.get(planId)))?.workflowId).toBe(
    started?.workflowId
  );
});
