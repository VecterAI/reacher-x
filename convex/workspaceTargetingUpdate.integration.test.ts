/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { getLearningTargetingFingerprint } from "./lib/learningTargetingHelpers";
import { getWorkspaceIcpRefreshFingerprint } from "./lib/workspaceIcpSignalsCore";
import { WORKSPACE_REPORTING_AGGREGATE_VERSION } from "./lib/workspaceReportingAggregate";
import { qualifyProspectCore } from "./lib/qualificationCore";
import { buildLegacyWorkspaceTargetingSpec } from "./lib/targetingSpecCore";

const modules = import.meta.glob("./**/*.ts");

async function registerPolar(t: ReturnType<typeof convexTest>) {
  const polarTestPath = ["@convex-dev/polar", "test"].join("/");
  const polarTest = (await import(polarTestPath)) as {
    default: { register: (instance: typeof t) => void };
  };
  polarTest.default.register(t);
}

function generatedProfile(title: string) {
  return {
    title,
    description: `${title} description`,
    painPoints: [`${title} pain`],
    channels: ["LinkedIn"],
    provenance: "ai_generated" as const,
    syntheticPosts: [`A realistic post from ${title}.`],
    qualificationKeywords: [`${title} keyword`],
  };
}

function manualProfile(title: string) {
  return {
    ...generatedProfile(title),
    provenance: "manual" as const,
  };
}

async function seedWorkspace(t: ReturnType<typeof convexTest>, suffix: string) {
  return await t.run(async (ctx) => {
    const workosUserId = `targeting-update-${suffix}`;
    const userId = await ctx.db.insert("users", {
      workosUserId,
      email: `${suffix}@example.com`,
    });
    await ctx.db.insert("userPlans", {
      userId,
      tier: "pro",
      prospectsLimit: 500,
      workspacesLimit: 5,
      currentProspectsCount: 0,
      updatedAt: 1,
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "Targeting workspace",
      rawUserDescription: "Find technical founders who are hiring.",
      seedDescription: "Find technical founders who are hiring.",
      description: "Find technical founders who are hiring.",
      improvedDescription: "Find technical founders who are hiring.",
      icps: [
        generatedProfile("Technical founders"),
        generatedProfile("Hiring leaders"),
        manualProfile("Hand-picked operators"),
      ],
      useCaseKey: "general_outreach",
      sourceUrl: "https://existing.example.com",
      isDefault: true,
      entitlementSlot: 1,
      updatedAt: 1,
    });
    return { userId, workosUserId, workspaceId };
  });
}

describe("workspace targeting persistence", () => {
  test("marks edited generated profiles as manual", async () => {
    const t = convexTest(schema, modules);
    const { workosUserId, workspaceId } = await seedWorkspace(t, "manual-edit");
    const authenticated = t.withIdentity({ subject: workosUserId });

    await authenticated.mutation(api.workspaces.updateWorkspaceSettings, {
      workspaceId,
      icps: [
        {
          ...generatedProfile("Technical founders"),
          description: "A description written by the user.",
        },
        generatedProfile("Hiring leaders"),
        manualProfile("Hand-picked operators"),
      ],
    });

    const workspace = await t.run((ctx) => ctx.db.get(workspaceId));
    expect(workspace?.icps?.[0]).toMatchObject({
      title: "Technical founders",
      description: "A description written by the user.",
      provenance: "manual",
    });
    expect(workspace?.icps?.[0]?.syntheticPosts).toBeUndefined();
    expect(workspace?.icps?.[1]).toMatchObject({
      title: "Hiring leaders",
      provenance: "ai_generated",
    });
    expect(workspace?.icps?.[2]).toMatchObject({
      title: "Hand-picked operators",
      provenance: "manual",
    });
  });

  test("stores regenerated targeting without creating rollback state", async () => {
    const t = convexTest(schema, modules);
    const { userId, workspaceId } = await seedWorkspace(t, "regenerated");
    const profiles = [
      generatedProfile("Community doctors"),
      generatedProfile("Telehealth doctors"),
      manualProfile("Local clinic owners"),
    ];

    await t.mutation(
      internal.workspaces.applyRegeneratedWorkspaceTargetingInternal,
      {
        workspaceId,
        userId,
        name: "Updated targeting workspace",
        rawUserDescription:
          "Find doctors who publicly offer free consultations to new patients.",
        improvedDescription:
          "Find doctors who publicly offer free consultations for new patients.",
        icps: profiles,
        targetingSpec: buildLegacyWorkspaceTargetingSpec({
          description:
            "Find doctors who publicly offer free consultations for new patients.",
          profiles,
        }),
        useCaseKey: "general_outreach",
      }
    );

    const workspace = await t.run((ctx) => ctx.db.get(workspaceId));
    expect(workspace).toMatchObject({
      rawUserDescription:
        "Find doctors who publicly offer free consultations to new patients.",
      seedDescription:
        "Find doctors who publicly offer free consultations to new patients.",
      description:
        "Find doctors who publicly offer free consultations for new patients.",
      improvedDescription:
        "Find doctors who publicly offer free consultations for new patients.",
      descriptionSource: "manual",
      useCaseKey: "general_outreach",
      name: "Updated targeting workspace",
      sourceUrl: "https://existing.example.com",
      icps: profiles,
    });
    expect(workspace?.refineRollbackSnapshot).toBeUndefined();
  });
});

describe("future-only rollout for an existing workspace", () => {
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  test("refreshes searches and qualifies only new discoveries without rewriting existing prospects or reporting rollout", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await registerPolar(t);
    const { userId, workspaceId } = await seedWorkspace(t, "future-only");
    const oldIds = await t.run(async (ctx) => {
      await ctx.db.patch(workspaceId, { prospectingWorkflowStatus: "paused" });
      return Promise.all(
        [
          {
            status: "new" as const,
            qualificationStatus: "qualified" as const,
            qualificationScore: 91,
          },
          {
            status: "new" as const,
            qualificationStatus: "disqualified" as const,
            qualificationScore: 14,
          },
          {
            status: "contacted" as const,
            qualificationStatus: "qualified" as const,
            qualificationScore: 88,
          },
          {
            status: "archived" as const,
            qualificationStatus: "disqualified" as const,
            qualificationScore: 5,
          },
        ].map((state, i) =>
          ctx.db.insert("prospects", {
            userId,
            workspaceId,
            platform: "twitter",
            origin: "workspace_discovery",
            externalId: `old-${i}`,
            data: {},
            ...state,
            matchReason: "Original saved decision",
            updatedAt: 1,
          })
        )
      );
    });
    const before = await t.run((ctx) =>
      Promise.all(oldIds.map((id) => ctx.db.get(id)))
    );
    const oldWorkspace = (await t.run((ctx) => ctx.db.get(workspaceId)))!;
    await t.mutation(internal.keywords.saveKeywordInternal, {
      workspaceId,
      type: "social_query",
      value: "old narrow query",
    });
    const reportingBefore = await t.run((ctx) =>
      ctx.db
        .query("workspaceReportingRollouts")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .collect()
    );
    const profiles = [
      generatedProfile("Founders hiring"),
      generatedProfile("Engineering managers"),
      generatedProfile("Hiring leaders"),
    ];
    const description =
      "Find founders and decision makers actively hiring software engineers. US and remote are preferred, not required.";
    const targetingSpec = buildLegacyWorkspaceTargetingSpec({
      description,
      profiles,
    });
    await t.mutation(
      internal.workspaces.applyRegeneratedWorkspaceTargetingInternal,
      {
        workspaceId,
        userId,
        expectedTargetingFingerprint:
          getWorkspaceIcpRefreshFingerprint(oldWorkspace),
        name: oldWorkspace.name,
        rawUserDescription: description,
        improvedDescription: description,
        icps: profiles,
        targetingSpec,
        useCaseKey: "customer_prospecting",
      }
    );
    await t.mutation(internal.keywords.deleteWorkspaceKeywordsBatchInternal, {
      workspaceId,
      limit: 25,
    });
    await t.mutation(internal.keywords.saveKeywordsBatch, {
      workspaceId,
      keywords: [
        {
          type: "social_query",
          value: "we are hiring engineers",
          discoveryStage: "balanced",
          platformTargets: ["twitter"],
        },
      ],
    });
    expect(
      await t.run((ctx) => Promise.all(oldIds.map((id) => ctx.db.get(id))))
    ).toEqual(before);
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("workspaceReportingRollouts")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
          .collect()
      )
    ).toEqual(reportingBefore);
    expect(WORKSPACE_REPORTING_AGGREGATE_VERSION).toBe(1);
    for (const prospectId of oldIds)
      expect(
        await t.action(internal.workflows.qualification.startQualification, {
          workspaceId,
          prospectId,
        })
      ).toEqual({ workId: "" });
    const saved = await t.mutation(internal.prospects.createProspectsBatch, {
      userId,
      workspaceId,
      prospects: [
        {
          platform: "twitter",
          externalId: "new-person",
          data: {},
          matchedKeywords: ["we are hiring engineers"],
        },
      ],
    });
    const newId = saved.prospectIds[0];
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    const qualificationStarts = scheduled.filter((job) =>
      job.name.includes("qualification:startQualification")
    );
    expect(qualificationStarts).toHaveLength(1);
    expect(qualificationStarts[0].args).toEqual([
      { workspaceId, prospectId: newId },
    ]);
    const result = await qualifyProspectCore({
      platform: "twitter",
      evidencePosts: [],
      discoveryQueries: ["we are hiring engineers"],
      totalKeywords: 1,
      profileData: {},
      targetingSpec,
    });
    expect(result.status).toBe("disqualified");
    const current = (await t.run((ctx) => ctx.db.get(workspaceId)))!;
    await t.mutation(internal.prospects.updateProspectQualification, {
      prospectId: newId,
      expectedTargetingFingerprint: getLearningTargetingFingerprint(current),
      qualificationStatus: result.status,
      qualificationScore: result.score,
    });
    expect(
      (await t.run((ctx) => ctx.db.get(newId)))
        ?.qualificationTargetingFingerprint
    ).toBe(getLearningTargetingFingerprint(current));
    expect(
      await t.run((ctx) => Promise.all(oldIds.map((id) => ctx.db.get(id))))
    ).toEqual(before);
    await t.run(async (ctx) => {
      for (const job of await ctx.db.system
        .query("_scheduled_functions")
        .collect())
        if (job.state.kind === "pending") await ctx.scheduler.cancel(job._id);
    });
  });
});
