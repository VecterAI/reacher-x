/// <reference types="vite/client" />

import { DirectAggregate } from "@convex-dev/aggregate";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { components } from "../_generated/api";
import schema from "../schema";
import {
  computeQualifiedProspectUsageForWorkspaceWindow,
  readQualifiedProspectUsageForWorkspaceWindow,
  type QualifiedUsageWindow,
} from "./planQualifiedUsageCore";
import { getWorkspaceReportingMetricSums } from "./workspaceReportingAggregate";

const modules = import.meta.glob("../**/*.ts");

const window: QualifiedUsageWindow = {
  cycleStart: 1_000,
  cycleEnd: 1_999,
};

async function seedWorkspace(options: { ready: boolean }) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: `qualified-usage-${options.ready ? "ready" : "fallback"}`,
      email: `qualified-usage-${options.ready ? "ready" : "fallback"}@example.test`,
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "Qualified usage",
      description: "Qualified usage test workspace",
      isDefault: true,
      updatedAt: 1_000,
    });

    if (options.ready) {
      await ctx.db.insert("workspaceReportingRollouts", {
        workspaceId,
        userId,
        status: "verified",
        aggregateVersion: 1,
        revision: 1,
        stage: "verifyAgentOpsStripes",
        batchSize: 10,
        backfilledCount: 5,
        verifiedSourceCount: 5,
        expectedAnalyticsSums: [],
        expectedAgentOpsSums: [],
        expectedQualifiedUsageCount: 2,
        aggregateQualifiedUsageCount: 2,
        startedAt: 1_000,
        verifiedAt: 2_000,
        updatedAt: 2_000,
      });
    }

    const aggregate = new DirectAggregate(
      components.workspaceReportingAggregate
    );
    const prospects = [
      {
        origin: "workspace_discovery" as const,
        status: "qualified" as const,
        qualifiedAt: 1_000,
      },
      {
        origin: "workspace_discovery" as const,
        status: "qualified" as const,
        qualifiedAt: 1_999,
      },
      {
        origin: "workspace_discovery" as const,
        status: "qualified" as const,
        qualifiedAt: 2_000,
      },
      {
        origin: "setup_preview" as const,
        status: "qualified" as const,
        qualifiedAt: 1_500,
      },
      {
        origin: "workspace_discovery" as const,
        status: "disqualified" as const,
        qualifiedAt: undefined,
      },
    ];

    for (const [index, prospect] of prospects.entries()) {
      const prospectId = await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: prospect.origin,
        externalId: `qualified-usage-${index}`,
        data: {},
        status: "new",
        qualificationStatus: prospect.status,
        updatedAt: prospect.qualifiedAt ?? 1_000,
        ...(prospect.qualifiedAt === undefined
          ? {}
          : { qualifiedAt: prospect.qualifiedAt }),
      });

      if (
        prospect.origin !== "setup_preview" &&
        prospect.status === "qualified" &&
        prospect.qualifiedAt !== undefined
      ) {
        await aggregate.insert(ctx, {
          namespace: [1, workspaceId, "usage"],
          key: ["qualifiedProspectsCount", prospect.qualifiedAt],
          id: String(prospectId),
          sumValue: 1,
        });
      }
    }

    return { workspaceId };
  });

  return { t, ...ids };
}

describe("qualified prospect usage", () => {
  test("the verified aggregate matches the legacy qualified-prospect count", async () => {
    const { t, workspaceId } = await seedWorkspace({ ready: true });

    const comparison = await t.run(async (ctx) => {
      const legacy = await readQualifiedProspectUsageForWorkspaceWindow(
        ctx,
        workspaceId,
        window
      );
      const [aggregate = 0] = await getWorkspaceReportingMetricSums(ctx, {
        workspaceId,
        dataset: "usage",
        queries: [
          {
            metric: "qualifiedProspectsCount",
            startMs: window.cycleStart,
            endMs: window.cycleEnd + 1,
          },
        ],
      });
      const productionPath =
        await computeQualifiedProspectUsageForWorkspaceWindow(
          ctx,
          workspaceId,
          window
        );

      return { legacy, aggregate, productionPath };
    });

    expect(comparison.legacy).toEqual({
      used: 2,
      timestamps: [1_000, 1_999],
    });
    expect(comparison.aggregate).toBe(comparison.legacy.used);
    expect(comparison.productionPath).toBe(comparison.legacy.used);
  });

  test("falls back to the legacy scan before aggregate verification", async () => {
    const { t, workspaceId } = await seedWorkspace({ ready: false });

    const comparison = await t.run(async (ctx) => {
      const legacy = await readQualifiedProspectUsageForWorkspaceWindow(
        ctx,
        workspaceId,
        window
      );
      const productionPath =
        await computeQualifiedProspectUsageForWorkspaceWindow(
          ctx,
          workspaceId,
          window
        );
      return { legacy, productionPath };
    });

    expect(comparison.productionPath).toBe(comparison.legacy.used);
  });
});
