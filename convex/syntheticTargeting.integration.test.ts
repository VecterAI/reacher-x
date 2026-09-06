/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";
import { buildLegacyWorkspaceTargetingSpec } from "./lib/targetingSpecCore";
import { internal } from "./_generated/api";
import { syntheticExamples } from "../test/syntheticProfiles";
import { getWorkspaceIcpRefreshFingerprint } from "./lib/workspaceIcpSignalsCore";
import { applyWorkspaceSettingsUpdateCore } from "./lib/workspaceSettingsCore";
import { deriveWorkspaceSystemStatus } from "./lib/workspaceSystem";
import { mapInternalIssueCodeToUserVisibleIssueState } from "./lib/onboardingNavigation";
import { buildDiscoveryBusinessContext } from "./lib/prospectingHelpers";
const modules = import.meta.glob("./**/*.ts");
const profile = {
  title: "Product designers",
  description: "Product designers at B2B software companies",
  painPoints: ["Complex workflows"],
  channels: ["X", "LinkedIn"],
  syntheticExamples,
  syntheticPosts: ["Simplifying a complex workflow today."],
  qualificationKeywords: ["product design"],
};
async function seed(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "synthetic-targeting",
      email: "synthetic@example.com",
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "Design recruiting",
      description: "Recruit product designers",
      improvedDescription: "Recruit product designers",
      useCaseKey: "recruiting",
      isDefault: true,
      icps: [profile],
      prospectingWorkflowStatus: "stopped",
      updatedAt: 1,
    });
    return (await ctx.db.get("workspaces", workspaceId))!;
  });
}

describe("synthetic targeting refresh fencing", () => {
  test("an older generation cannot overwrite a newer channel edit", async () => {
    const t = convexTest(schema, modules);
    const workspace = await seed(t);
    const fingerprint = getWorkspaceIcpRefreshFingerprint(workspace);
    await t.run((ctx) =>
      ctx.db.patch(workspace._id, {
        icps: [
          { ...profile, channels: ["LinkedIn"], syntheticExamples: undefined },
        ],
      })
    );
    const result = await t.mutation(
      internal.workspaces.updateWorkspaceIcpSignalsInternal,
      {
        workspaceId: workspace._id,
        expectedTargetingFingerprint: fingerprint,
        icps: [profile],
      }
    );
    expect(result).toEqual({ updated: false, mayRestart: false });
    expect(
      (await t.run((ctx) => ctx.db.get("workspaces", workspace._id)))?.icps?.[0]
        ?.syntheticExamples
    ).toBeUndefined();
  });
  test("incomplete examples cannot be published and a paused Agent is not restarted", async () => {
    const t = convexTest(schema, modules);
    const workspace = await seed(t);
    const fingerprint = getWorkspaceIcpRefreshFingerprint(workspace);
    await expect(
      t.mutation(internal.workspaces.updateWorkspaceIcpSignalsInternal, {
        workspaceId: workspace._id,
        expectedTargetingFingerprint: fingerprint,
        icps: [
          { ...profile, syntheticExamples: syntheticExamples.slice(0, 1) },
        ],
      })
    ).rejects.toThrow("one X/Twitter");
    await t.run((ctx) =>
      ctx.db.patch(workspace._id, { prospectingWorkflowStatus: "paused" })
    );
    const result = await t.mutation(
      internal.workspaces.updateWorkspaceIcpSignalsInternal,
      {
        workspaceId: workspace._id,
        expectedTargetingFingerprint: fingerprint,
        icps: [profile],
      }
    );
    expect(result).toMatchObject({ updated: true, mayRestart: false });
    expect(
      (
        await t.mutation(
          internal.workspaces.restartProspectingWorkflowForSetupCommitInternal,
          {
            workspaceId: workspace._id,
            expectedTargetingFingerprint: fingerprint,
          }
        )
      ).success
    ).toBe(false);
    expect(
      (await t.run((ctx) => ctx.db.get("workspaces", workspace._id)))
        ?.prospectingWorkflowStatus
    ).toBe("paused");
  });
  test("repeated edits preserve the intent to resume while invalidating examples", async () => {
    const t = convexTest(schema, modules);
    const workspace = await seed(t);
    await t.run((ctx) =>
      ctx.db.patch(workspace._id, {
        icpRefreshResumeRequested: true,
        prospectingWorkflowStatus: "stopped",
      })
    );
    await t.run(async (ctx) =>
      applyWorkspaceSettingsUpdateCore(ctx, {
        workspace: (await ctx.db.get("workspaces", workspace._id))!,
        updates: { description: "Recruit senior product designers" },
      })
    );
    const updated = (await t.run((ctx) =>
      ctx.db.get("workspaces", workspace._id)
    ))!;
    expect(updated.icpRefreshResumeRequested).toBe(true);
    expect(updated.icps?.[0]?.syntheticExamples).toBeUndefined();
    expect(updated.onboardingIssueStatusCode).toBe("icp_refresh_required");
    expect(getWorkspaceIcpRefreshFingerprint(updated)).not.toBe(
      getWorkspaceIcpRefreshFingerprint(workspace)
    );
    expect(
      (
        await t.mutation(
          internal.workspaces.restartProspectingWorkflowForSetupCommitInternal,
          {
            workspaceId: workspace._id,
            expectedTargetingFingerprint:
              getWorkspaceIcpRefreshFingerprint(workspace),
          }
        )
      ).success
    ).toBe(false);
  });
  test("deleting a persona refreshes targeting without regenerating the unchanged persona", async () => {
    const t = convexTest(schema, modules);
    const workspace = await seed(t);
    await t.run((ctx) =>
      ctx.db.patch(workspace._id, {
        icps: [profile, { ...profile, title: "Design leaders" }],
      })
    );
    await t.run(async (ctx) =>
      applyWorkspaceSettingsUpdateCore(ctx, {
        workspace: (await ctx.db.get("workspaces", workspace._id))!,
        updates: { icps: [profile] },
      })
    );
    const updated = (await t.run((ctx) =>
      ctx.db.get("workspaces", workspace._id)
    ))!;
    expect(updated.icps).toHaveLength(1);
    expect(updated.icps?.[0]?.syntheticExamples).toEqual(syntheticExamples);
    expect(updated.onboardingIssueStatusCode).toBe("icp_refresh_required");
    expect(updated.targetingSpec).toBeUndefined();
    expect(
      (
        await t.run((ctx) =>
          ctx.db.system.query("_scheduled_functions").collect()
        )
      ).some((job) => job.name.includes("refreshWorkspaceIcpSignalsInternal"))
    ).toBe(true);
  });
  test("publication returns the post-trigger fingerprint used for restart", async () => {
    const t = convexTest(schema, modules);
    const workspace = await seed(t);
    const before = getWorkspaceIcpRefreshFingerprint(workspace);
    const result = await t.mutation(
      internal.workspaces.updateWorkspaceIcpSignalsInternal,
      {
        workspaceId: workspace._id,
        expectedTargetingFingerprint: before,
        icps: [profile],
        targetingSpec: buildLegacyWorkspaceTargetingSpec({
          description: workspace.description,
          profiles: [profile],
        }),
      }
    );
    const published = (await t.run((ctx) =>
      ctx.db.get("workspaces", workspace._id)
    ))!;
    expect(result.updated).toBe(true);
    expect(result.publishedFingerprint).toBe(
      getWorkspaceIcpRefreshFingerprint(published)
    );
    expect(result.publishedFingerprint).not.toBe(before);
    expect(published.targetingSpec).toBeDefined();
  });

  test("a superseded refresh cannot delete current keyword queues", async () => {
    const t = convexTest(schema, modules);
    const workspace = await seed(t);
    const keyId = await t.mutation(internal.keywords.saveKeywordInternal, {
      workspaceId: workspace._id,
      type: "social_query",
      value: "design systems",
    });
    const before = getWorkspaceIcpRefreshFingerprint(workspace);
    await t.run((ctx) =>
      ctx.db.patch(workspace._id, { description: "Recruit design leaders" })
    );
    const deleted = await t.mutation(
      internal.keywords.deleteWorkspaceKeywordsBatchInternal,
      {
        workspaceId: workspace._id,
        limit: 250,
        expectedTargetingFingerprint: before,
      }
    );
    expect(deleted).toEqual({ deleted: 0, hasMore: false });
    expect(await t.run((ctx) => ctx.db.get("keywords", keyId))).not.toBeNull();
  });
});

describe("discovery configuration and synthetic boundaries", () => {
  afterEach(() => vi.unstubAllEnvs());
  test("configuration check exposes no keys and requires both discovery services", async () => {
    const t = convexTest(schema, modules);
    for (const [twitter, linkedin, configured] of [
      ["", "", false],
      ["key", "", false],
      ["", "key", false],
      [" ", "key", false],
      ["key", "key", true],
    ] as const) {
      vi.stubEnv("SOCIALAPI_API_KEY", twitter);
      vi.stubEnv("LINKDAPI_API_KEY", linkedin);
      expect(
        await t.query(
          internal.workflows.prospecting.getDiscoveryConfigurationInternal,
          {}
        )
      ).toEqual({ configured });
    }
  });
  test("missing configuration is actionable attention, never automatic recovery", async () => {
    const t = convexTest(schema, modules);
    const workspace = await seed(t);
    const status = deriveWorkspaceSystemStatus({
      ...workspace,
      onboardingIssueStatusCode: "search_configuration_missing",
    });
    expect(status.mode).toBe("attention");
    expect(status.actionKind).toBe("retry");
    expect(status.dialogDescription).toContain("Contact support");
    expect(status.dialogDescription).not.toContain("automatically");
    expect(
      mapInternalIssueCodeToUserVisibleIssueState(
        "search_configuration_missing"
      ).message
    ).toBe(status.dialogDescription);
  });
  test("discovery business context does not copy fictional bios into search instructions", async () => {
    const t = convexTest(schema, modules);
    const workspace = await seed(t);
    const context = buildDiscoveryBusinessContext(workspace);
    expect(context).toBe(workspace.description);
    for (const example of profile.syntheticExamples) {
      expect(context).not.toContain(example.bio);
      expect(context).not.toContain(example.displayName);
    }
  });
});
