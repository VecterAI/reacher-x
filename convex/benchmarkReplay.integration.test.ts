/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { QualificationCoreParams } from "./lib/qualificationCore";
import schema from "./schema";
import { promoteAgentMemory } from "./lib/agentMemoryCore";

// No model is called: the production qualification function is replaced by a
// stub that records the inputs it receives.
const qualifyCalls = vi.hoisted(() => [] as QualificationCoreParams[]);
vi.mock("./lib/qualificationCore", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("./lib/qualificationCore")>();
  return {
    ...original,
    qualifyProspectCore: async (params: QualificationCoreParams) => {
      qualifyCalls.push(params);
      return { qualified: true, score: 82, reasoning: "Synthetic reasoning." };
    },
  };
});

const modules = import.meta.glob("./**/*.ts");
const KIND = "reacherx-benchmark-qualification-replay";

const frozenInput = {
  platform: "twitter",
  evidencePosts: [{ id: "post-1", text: "Synthetic post" }],
  discoveryQueries: ["synthetic query"],
  totalKeywords: 1,
  profileData: { screen_name: "synthetic" },
  targetingSpec: {},
  workspaceMemoryPolicy: "Operator: Europe only. Lesson: prefer managers.",
  relevantMemories: ["prefer managers"],
  similarQualifiedCases: ["a similar win"],
  similarDisqualifiedCases: ["a similar loss"],
  now: 1_700_000_000_000,
};

async function storeDataset(t: ReturnType<typeof convexTest>, value: unknown) {
  return await t.run(
    async (ctx) => await ctx.storage.store(new Blob([JSON.stringify(value)]))
  );
}

afterEach(() => {
  qualifyCalls.length = 0;
  vi.unstubAllEnvs();
});

describe("qualification replay", () => {
  test("learning-off replay sends the operator-only policy and no learned context", async () => {
    const t = convexTest(schema, modules);
    const datasetId = await storeDataset(t, {
      kind: KIND,
      schemaVersion: 1,
      cases: [
        {
          caseId: "case-1",
          input: frozenInput,
          operatorOnlyMemoryPolicy: "Operator: Europe only.",
        },
      ],
    });
    const results = await t.action(
      internal.benchmarkReplay.replayQualification,
      { datasetId, replayId: "r1", caseIds: ["case-1"], learning: "off" }
    );
    expect(results).toMatchObject([
      { caseId: "case-1", status: "ok", qualified: true, score: 82 },
    ]);
    const [call] = qualifyCalls;
    expect(call.workspaceMemoryPolicy).toBe("Operator: Europe only.");
    expect(call.relevantMemories).toEqual([]);
    expect(call.similarQualifiedCases).toEqual([]);
    expect(call.similarDisqualifiedCases).toEqual([]);
    // The capture time is passed through, so "today" matches the original run.
    expect(call.now).toBe(frozenInput.now);
    expect(call.routing).toBe("onboarding");
    expect(call.telemetry?.userId).toBe("benchmark-replay:r1");
  });

  test("refuses a file that is not a benchmark dataset, and unknown cases before any call", async () => {
    const t = convexTest(schema, modules);
    const foreign = await storeDataset(t, {
      schemaVersion: 1,
      cases: [{ caseId: "case-1", input: frozenInput }],
    });
    await expect(
      t.action(internal.benchmarkReplay.replayQualification, {
        datasetId: foreign,
        replayId: "r1",
        caseIds: ["case-1"],
        learning: "on",
      })
    ).rejects.toThrow(/not a benchmark replay dataset/);
    const datasetId = await storeDataset(t, {
      kind: KIND,
      schemaVersion: 1,
      cases: [{ caseId: "case-1", input: frozenInput }],
    });
    await expect(
      t.action(internal.benchmarkReplay.replayQualification, {
        datasetId,
        replayId: "r1",
        caseIds: ["case-1", "case-2"],
        learning: "on",
      })
    ).rejects.toThrow(/Unknown replay case case-2/);
    expect(qualifyCalls).toHaveLength(0);
  });

  test("reports the stored dataset's size and digest and issues upload URLs", async () => {
    const t = convexTest(schema, modules);
    const datasetId = await storeDataset(t, { kind: KIND });
    const info = await t.query(internal.benchmarkReplay.replayDatasetInfo, {
      datasetId,
    });
    expect(info?.size).toBe(JSON.stringify({ kind: KIND }).length);
    expect(info?.sha256).toEqual(expect.any(String));
    expect(
      await t.mutation(internal.benchmarkReplay.createDatasetUploadUrl, {})
    ).toEqual(expect.any(String));
  });
});

async function seedCapture(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "benchmark-replay",
      email: "benchmark-replay@example.test",
    });
    const workspace = (name: string) =>
      ctx.db.insert("workspaces", {
        userId,
        name,
        description: "Find engineering managers actively hiring engineers",
        isDefault: false,
        updatedAt: 1,
        icps: [],
      });
    const benchmark = await workspace("Benchmark run-1_6_on");
    const ordinary = await workspace("Sales team");
    for (const [source, category, summary] of [
      ["operator", "operator_instruction", "Only include people in Europe."],
      [
        "qualification",
        "qualification_win_pattern",
        "Managers describing open roles are stronger.",
      ],
    ] as const)
      await promoteAgentMemory(ctx.db, {
        userId: String(userId),
        workspaceId: String(benchmark),
        source,
        category,
        namespace: source === "operator" ? "lessons" : "wins",
        title: summary,
        summary,
        ...(source === "operator" ? { instruction: summary } : {}),
        confidence: 1,
        impactScore: 1,
      });
    const prospect = (
      workspaceId: Id<"workspaces">,
      fields: Record<string, unknown>
    ) =>
      ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: `synthetic-${Math.random()}`,
        status: "new",
        updatedAt: 1,
        // No title, intro, query or post text: the memory lookup needs no embeddings.
        data: { user: { screen_name: "synthetic" } },
        evidencePosts: [
          {
            id: "post-1",
            externalUrls: ["https://one.example/a", " https://two.example/b"],
          },
          {
            id: "post-2",
            externalUrls: ["https://one.example/a", "https://three.example/c"],
          },
        ],
        ...fields,
      });
    return {
      benchmark,
      ordinary,
      decided: await prospect(benchmark, {
        qualificationStatus: "disqualified",
        qualificationScore: 41,
        disqualifiedAt: 1_700_000_000_000,
      }),
      pending: await prospect(benchmark, { qualificationStatus: "pending" }),
      elsewhere: await prospect(ordinary, {
        qualificationStatus: "qualified",
        qualifiedAt: 1,
      }),
    };
  });
}

describe("replay capture", () => {
  test("rebuilds the qualification inputs of a decided benchmark prospect", async () => {
    const t = convexTest(schema, modules);
    const ids = await seedCapture(t);
    const [captured] = await t.action(
      internal.benchmarkReplay.captureQualificationInputs,
      { workspaceId: ids.benchmark, prospectIds: [ids.decided], learning: "on" }
    );
    if (captured.learning !== "on") throw new Error("Expected the full pass");
    expect(captured.decision).toEqual({ qualified: false, score: 41 });
    expect(captured.input.now).toBe(1_700_000_000_000);
    expect(captured.input.profileData).toEqual({ screen_name: "synthetic" });
    expect(captured.input.evidencePosts).toHaveLength(2);
    // At most two linked pages, each with the posts that link to it.
    expect(captured.linkedPages).toEqual([
      { url: "https://one.example/a", sourcePostIds: ["post-1", "post-2"] },
      { url: "https://two.example/b", sourcePostIds: ["post-1"] },
    ]);
    expect(captured.input.workspaceMemoryPolicy).toContain("Europe");
    expect(captured.input.workspaceMemoryPolicy).toContain("open roles");

    vi.stubEnv("BENCHMARK_LEARNING_OFF_WORKSPACE_IDS", String(ids.benchmark));
    const [off] = await t.action(
      internal.benchmarkReplay.captureQualificationInputs,
      {
        workspaceId: ids.benchmark,
        prospectIds: [ids.decided],
        learning: "off",
      }
    );
    if (off.learning !== "off") throw new Error("Expected the policy pass");
    expect(off.operatorOnlyMemoryPolicy).toContain("Europe");
    expect(off.operatorOnlyMemoryPolicy).not.toContain("open roles");
  });

  test("refuses other workspaces, undecided prospects and a mismatched learning switch", async () => {
    const t = convexTest(schema, modules);
    const ids = await seedCapture(t);
    const capture = (
      workspaceId: Id<"workspaces">,
      prospectId: Id<"prospects">,
      learning: "on" | "off" = "on"
    ) =>
      t.action(internal.benchmarkReplay.captureQualificationInputs, {
        workspaceId,
        prospectIds: [prospectId],
        learning,
      });
    await expect(capture(ids.ordinary, ids.elsewhere)).rejects.toThrow(
      /Only benchmark workspaces/
    );
    await expect(capture(ids.benchmark, ids.elsewhere)).rejects.toThrow(
      /not in this workspace/
    );
    await expect(capture(ids.benchmark, ids.pending)).rejects.toThrow(
      /no qualification decision/
    );
    await expect(capture(ids.benchmark, ids.decided, "off")).rejects.toThrow(
      /learning switch does not match/
    );
  });
});
