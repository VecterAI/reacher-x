/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { promoteAgentMemory } from "./lib/agentMemoryCore";
import { upsertQueryPerformanceRecord } from "./lib/memoryCore";
import { parseLearningOffWorkspaceIds } from "./lib/benchmarkLearningControl";

const modules = import.meta.glob("./**/*.ts");

// Two identical workspaces with a learned lesson, an operator instruction and
// a scored query, so only the benchmark switch differs between them.
async function fixture() {
  const t = convexTest(schema, modules);
  const workspaceIds = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "benchmark-owner",
      email: "benchmark@example.test",
    });
    const ids = [];
    for (const name of ["Learning on", "Learning off"]) {
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name,
        description: "Find engineering managers actively hiring engineers",
        isDefault: false,
        updatedAt: 1,
      });
      await promoteAgentMemory(ctx.db, {
        userId: String(userId),
        workspaceId: String(workspaceId),
        source: "qualification",
        category: "qualification_win_pattern",
        namespace: "wins",
        title: "Direct hiring authority",
        summary: "Managers describing their own open roles are stronger.",
        confidence: 0.9,
        impactScore: 0.85,
      });
      await promoteAgentMemory(ctx.db, {
        userId: String(userId),
        workspaceId: String(workspaceId),
        source: "operator",
        category: "operator_instruction",
        namespace: "lessons",
        title: "Region",
        summary: "Only include people based in Europe.",
        instruction: "Only include people based in Europe.",
        confidence: 1,
        impactScore: 1,
      });
      const queryId = await ctx.db.insert("keywords", {
        workspaceId,
        type: "social_query",
        value: "engineering hiring",
        status: "active",
      });
      await upsertQueryPerformanceRecord(ctx.db, {
        workspaceId,
        queryId,
        canonicalValue: "engineering hiring",
        canonicalHash: "hash",
        qualifiedCountDelta: 4,
        prospectsFoundDelta: 10,
      });
      ids.push(workspaceId);
    }
    return ids;
  });
  return { t, learningOn: workspaceIds[0], learningOff: workspaceIds[1] };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("benchmark learning switch", () => {
  test("parses a comma-separated workspace list", () => {
    expect([...parseLearningOffWorkspaceIds(" a, ,b ")]).toEqual(["a", "b"]);
    expect(parseLearningOffWorkspaceIds(undefined).size).toBe(0);
  });

  test("withholds learned discovery context only in named workspaces", async () => {
    const { t, learningOn, learningOff } = await fixture();
    vi.stubEnv("BENCHMARK_LEARNING_OFF_WORKSPACE_IDS", String(learningOff));

    const [on, off] = await Promise.all(
      [learningOn, learningOff].map((workspaceId) =>
        t.query(internal.memory.getDiscoveryGenerationContextInternal, {
          workspaceId,
        })
      )
    );

    expect(on.promotedDiscoveryMemories).toHaveLength(1);
    expect(on.topPerformers).toHaveLength(1);
    expect(off.promotedDiscoveryMemories).toHaveLength(0);
    expect(off.topPerformers).toHaveLength(0);
    expect(off.recentWinningProspects).toHaveLength(0);
    // Operator instructions are not learning and stay in both groups.
    expect(off.operatorInstructions).toEqual(on.operatorInstructions);
    expect(off.operatorInstructions.join(" ")).toContain("Europe");
  });
});
