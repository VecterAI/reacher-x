/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

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
      currentWorkspacesCount: 1,
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
