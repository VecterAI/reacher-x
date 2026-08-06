/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";

const modules = import.meta.glob("./**/*.ts");

const savedProfiles = [
  {
    title: "Senior frontend engineers",
    description: "Experienced product engineers focused on React applications.",
    painPoints: ["Limited growth", "Legacy frontend stacks"],
    channels: ["X", "LinkedIn"],
    syntheticPosts: ["I want to work on a modern frontend stack."],
    qualificationKeywords: ["React", "TypeScript"],
  },
  {
    title: "Staff product engineers",
    description: "Technical leaders who still build user-facing products.",
    painPoints: ["Low technical ownership"],
    channels: ["LinkedIn"],
    syntheticPosts: ["Technical leadership should stay close to the product."],
    qualificationKeywords: ["Staff engineer", "Product engineering"],
  },
  {
    title: "Founding engineers",
    description: "Early-stage engineers comfortable with product ambiguity.",
    painPoints: ["Slow decision making"],
    channels: ["X"],
    syntheticPosts: ["I enjoy taking products from zero to one."],
    qualificationKeywords: ["Founding engineer", "Zero to one"],
  },
];

async function seedRecruitingWorkspace(t: ReturnType<typeof convexTest>) {
  const now = getCurrentUTCTimestamp();
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "workos-workspace-profile-changes",
      email: "workspace-profile-changes@example.com",
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "Engineering recruiting",
      description: "Recruit product engineers for an early-stage company.",
      useCaseKey: "recruiting",
      icps: savedProfiles,
      isDefault: true,
      updatedAt: now,
    });
    return { userId, workspaceId };
  });
}

function profilesWithNewCandidate(description: string) {
  return [
    ...savedProfiles,
    {
      title: "Developer-experience engineers",
      description,
      painPoints: ["Internal tooling receives too little attention"],
      channels: ["X", "LinkedIn"],
    },
  ];
}

describe("workspace ideal-profile proposals", () => {
  test("refines one workspace-wide proposal across threads and applies it after explicit approval", async () => {
    const t = convexTest(schema, modules);
    const { userId, workspaceId } = await seedRecruitingWorkspace(t);

    const first = await t.mutation(
      internal.workspaceProfileChanges.upsertPendingInternal,
      {
        userId,
        workspaceId,
        threadId: "thread-main",
        proposedIcps: profilesWithNewCandidate(
          "Engineers who improve tools used by other developers."
        ),
      }
    );
    const refined = await t.mutation(
      internal.workspaceProfileChanges.upsertPendingInternal,
      {
        userId,
        workspaceId,
        threadId: "thread-prospect",
        proposedIcps: profilesWithNewCandidate(
          "Engineers who build products and tooling for other developers."
        ),
      }
    );

    expect(refined.requestId).toBe(first.requestId);
    expect(refined.revision).toBe(2);

    const inspection = await t.query(
      internal.workspaces.getWorkspaceInspectionInternal,
      { workspaceId }
    );
    expect(inspection?.pendingIdealProfileProposal).toMatchObject({
      requestId: first.requestId,
      revision: 2,
      addedTitles: ["Developer-experience engineers"],
    });
    expect(inspection?.pendingIdealProfileProposal?.profiles).toHaveLength(4);

    const authenticated = t.withIdentity({
      subject: "workos-workspace-profile-changes",
    });
    const proposal = await authenticated.query(
      api.workspaceProfileChanges.getWorkspaceProfileChange,
      { requestId: refined.requestId }
    );
    expect(proposal).toMatchObject({
      profileLabelPlural: "Ideal candidate profiles",
      revision: 2,
      status: "pending_approval",
      addedTitles: ["Developer-experience engineers"],
    });

    const result = await authenticated.mutation(
      api.workspaceProfileChanges.approveWorkspaceProfileChange,
      { requestId: refined.requestId }
    );
    expect(result.outcome).toBe("applied");

    const state = await t.run(async (ctx) => {
      const workspace = await ctx.db.get("workspaces", workspaceId);
      const requests = await ctx.db
        .query("workspaceProfileChangeRequests")
        .withIndex("by_workspace_id_and_status", (q) =>
          q.eq("workspaceId", workspaceId).eq("status", "applied")
        )
        .collect();
      return { requests, workspace };
    });
    expect(state.workspace?.icps).toHaveLength(4);
    expect(state.workspace?.icps?.[3]?.description).toBe(
      "Engineers who build products and tooling for other developers."
    );
    expect(state.requests).toHaveLength(1);
  });

  test("invalidates hidden signals when an approved profile title changes", async () => {
    const t = convexTest(schema, modules);
    const { userId, workspaceId } = await seedRecruitingWorkspace(t);
    const proposedIcps = savedProfiles.map((profile, index) =>
      index === 0
        ? { ...profile, title: "Principal frontend engineers" }
        : profile
    );
    const proposal = await t.mutation(
      internal.workspaceProfileChanges.upsertPendingInternal,
      {
        userId,
        workspaceId,
        threadId: "thread-title-change",
        proposedIcps,
      }
    );
    const authenticated = t.withIdentity({
      subject: "workos-workspace-profile-changes",
    });

    const result = await authenticated.mutation(
      api.workspaceProfileChanges.approveWorkspaceProfileChange,
      { requestId: proposal.requestId }
    );

    expect(result).toMatchObject({
      outcome: "applied",
      regenerationScheduledCount: 1,
    });
    const workspace = await t.run((ctx) =>
      ctx.db.get("workspaces", workspaceId)
    );
    expect(workspace?.icps?.[0]?.title).toBe("Principal frontend engineers");
    expect(workspace?.icps?.[0]?.syntheticPosts).toBeUndefined();
    expect(workspace?.icps?.[0]?.qualificationKeywords).toBeUndefined();
    expect(workspace).toMatchObject({
      onboardingIssueStatusCode: "icp_refresh_required",
      onboardingIssueSource: "system",
    });
  });

  test("invalidates every profile signal when workspace targeting context changes", async () => {
    const t = convexTest(schema, modules);
    const { workspaceId } = await seedRecruitingWorkspace(t);
    const authenticated = t.withIdentity({
      subject: "workos-workspace-profile-changes",
    });

    const result = await authenticated.mutation(
      api.workspaces.updateWorkspaceSettings,
      {
        workspaceId,
        improvedDescription:
          "Recruit senior product engineers for a developer-tools company.",
      }
    );

    expect(result.regenerationScheduledCount).toBe(savedProfiles.length);
    const workspace = await t.run((ctx) =>
      ctx.db.get("workspaces", workspaceId)
    );
    expect(workspace?.icps).toHaveLength(savedProfiles.length);
    for (const profile of workspace?.icps ?? []) {
      expect(profile.syntheticPosts).toBeUndefined();
      expect(profile.qualificationKeywords).toBeUndefined();
    }
    expect(workspace?.onboardingIssueStatusCode).toBe("icp_refresh_required");
  });

  test("marks a proposal stale instead of overwriting newer workspace edits", async () => {
    const t = convexTest(schema, modules);
    const { userId, workspaceId } = await seedRecruitingWorkspace(t);
    const proposal = await t.mutation(
      internal.workspaceProfileChanges.upsertPendingInternal,
      {
        userId,
        workspaceId,
        threadId: "thread-main",
        proposedIcps: profilesWithNewCandidate(
          "Engineers who improve developer tooling."
        ),
      }
    );

    await t.run(async (ctx) => {
      const workspace = await ctx.db.get("workspaces", workspaceId);
      await ctx.db.patch("workspaces", workspaceId, {
        description: "A newer manually saved workspace description.",
        updatedAt: (workspace?.updatedAt ?? 0) + 1,
      });
    });

    const result = await t.mutation(
      internal.workspaceProfileChanges.approvePendingForWorkspaceInternal,
      { userId, workspaceId }
    );
    expect(result.outcome).toBe("stale");

    const state = await t.run(async (ctx) => ({
      request: await ctx.db.get(
        "workspaceProfileChangeRequests",
        proposal.requestId
      ),
      workspace: await ctx.db.get("workspaces", workspaceId),
    }));
    expect(state.request?.status).toBe("stale");
    expect(state.workspace?.icps).toHaveLength(3);
    expect(state.workspace?.description).toBe(
      "A newer manually saved workspace description."
    );
  });

  test("rejection leaves the saved workspace unchanged", async () => {
    const t = convexTest(schema, modules);
    const { userId, workspaceId } = await seedRecruitingWorkspace(t);
    const proposal = await t.mutation(
      internal.workspaceProfileChanges.upsertPendingInternal,
      {
        userId,
        workspaceId,
        threadId: "thread-main",
        proposedIcps: profilesWithNewCandidate(
          "Engineers who improve developer tooling."
        ),
      }
    );

    const result = await t.mutation(
      internal.workspaceProfileChanges.rejectPendingForWorkspaceInternal,
      { userId, workspaceId }
    );
    expect(result).toMatchObject({
      outcome: "rejected",
      requestId: proposal.requestId,
    });

    const workspace = await t.run((ctx) =>
      ctx.db.get("workspaces", workspaceId)
    );
    expect(workspace?.icps).toHaveLength(3);
  });

  test("applies the human-edited profiles submitted from the review panel", async () => {
    const t = convexTest(schema, modules);
    const { userId, workspaceId } = await seedRecruitingWorkspace(t);
    const proposal = await t.mutation(
      internal.workspaceProfileChanges.upsertPendingInternal,
      {
        userId,
        workspaceId,
        threadId: "thread-main",
        proposedIcps: profilesWithNewCandidate(
          "Engineers who improve developer tooling."
        ),
      }
    );
    const editedProfiles = profilesWithNewCandidate(
      "Engineers who own developer tooling and platform experience."
    ).map((profile, index) =>
      index === 3
        ? {
            ...profile,
            painPoints: [
              ...profile.painPoints,
              "Developer workflows are fragmented",
            ],
            channels: ["LinkedIn"],
          }
        : profile
    );

    const authenticated = t.withIdentity({
      subject: "workos-workspace-profile-changes",
    });
    const result = await authenticated.mutation(
      api.workspaceProfileChanges.approveWorkspaceProfileChange,
      {
        requestId: proposal.requestId,
        expectedRevision: proposal.revision,
        proposedIcps: editedProfiles,
      }
    );

    expect(result.outcome).toBe("applied");
    const state = await t.run(async (ctx) => ({
      request: await ctx.db.get(
        "workspaceProfileChangeRequests",
        proposal.requestId
      ),
      workspace: await ctx.db.get("workspaces", workspaceId),
    }));
    expect(state.workspace?.icps?.[3]).toMatchObject({
      description:
        "Engineers who own developer tooling and platform experience.",
      painPoints: [
        "Internal tooling receives too little attention",
        "Developer workflows are fragmented",
      ],
      channels: ["LinkedIn"],
    });
    expect(state.request).toMatchObject({
      status: "applied",
      proposedIcps: state.workspace?.icps,
    });
  });

  test("does not let an older open review panel overwrite a newer revision", async () => {
    const t = convexTest(schema, modules);
    const { userId, workspaceId } = await seedRecruitingWorkspace(t);
    const first = await t.mutation(
      internal.workspaceProfileChanges.upsertPendingInternal,
      {
        userId,
        workspaceId,
        threadId: "thread-main",
        proposedIcps: profilesWithNewCandidate(
          "Engineers who improve developer tooling."
        ),
      }
    );
    await t.mutation(internal.workspaceProfileChanges.upsertPendingInternal, {
      userId,
      workspaceId,
      threadId: "thread-prospect",
      proposedIcps: profilesWithNewCandidate(
        "Engineers who improve developer platforms."
      ),
    });

    const authenticated = t.withIdentity({
      subject: "workos-workspace-profile-changes",
    });
    const result = await authenticated.mutation(
      api.workspaceProfileChanges.approveWorkspaceProfileChange,
      {
        requestId: first.requestId,
        expectedRevision: 1,
        proposedIcps: profilesWithNewCandidate(
          "An outdated panel edit that must not be applied."
        ),
      }
    );

    expect(result.outcome).toBe("superseded");
    const state = await t.run(async (ctx) => ({
      request: await ctx.db.get(
        "workspaceProfileChangeRequests",
        first.requestId
      ),
      workspace: await ctx.db.get("workspaces", workspaceId),
    }));
    expect(state.workspace?.icps).toEqual(savedProfiles);
    expect(state.request).toMatchObject({
      status: "pending_approval",
      revision: 2,
    });
  });

  test("rejects unsupported discovery channels", async () => {
    const t = convexTest(schema, modules);
    const { userId, workspaceId } = await seedRecruitingWorkspace(t);

    await expect(
      t.mutation(internal.workspaceProfileChanges.upsertPendingInternal, {
        userId,
        workspaceId,
        threadId: "thread-main",
        proposedIcps: [
          { ...savedProfiles[0], channels: ["LinkedIn", "GitHub"] },
          ...savedProfiles.slice(1),
        ],
      })
    ).rejects.toThrow("Ideal profile channels must use X/Twitter or LinkedIn.");
  });
});
