/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { createEmptyWorkspaceStatsRecord } from "./lib/readModelHelpers";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("onboarding progress", () => {
  test("returns the represented X/Twitter and LinkedIn prospect counts", async () => {
    const t = convexTest(schema, modules);
    const workosUserId = "onboarding-progress-platforms";
    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId,
        email: "onboarding-progress-platforms@example.com",
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Onboarding progress platform regression",
        description: "Verifies represented platform counts",
        isDefault: true,
        entitlementSlot: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("workspaceStats", {
        ...createEmptyWorkspaceStatsRecord({ workspaceId, userId }),
        totalProspectsCount: 60,
        twitterProspectsCount: 37,
        linkedInProspectsCount: 23,
      });

      return { workspaceId };
    });

    const progress = await t
      .withIdentity({ subject: workosUserId })
      .query(api.prospects.getOnboardingProgress, {
        workspaceId: seeded.workspaceId,
      });

    expect(progress).toMatchObject({
      found: 60,
      twitterProspectsCount: 37,
      linkedInProspectsCount: 23,
    });
  });
});
