/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { promoteAgentMemory } from "./lib/agentMemoryCore";
import {
  buildWorkspaceMemoryContext,
  listCanonicalWorkspaceMemoryCandidates,
} from "./lib/workspaceMemoryCore";
import { buildLegacyWorkspaceTargetingSpec } from "./lib/targetingSpecCore";
import { getLearningTargetingFingerprint } from "./lib/learningTargetingHelpers";
import {
  recordMemoryWorkflowEventRecord,
  upsertQueryCandidateRecord,
  upsertQueryPerformanceRecord,
} from "./lib/memoryCore";
const modules = import.meta.glob("./**/*.ts");

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "learning-owner",
      email: "learning@example.test",
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "Hiring",
      description: "Find engineering managers actively hiring engineers",
      isDefault: true,
      updatedAt: 1,
    });
    const prospectId = await ctx.db.insert("prospects", {
      workspaceId,
      userId,
      platform: "twitter",
      origin: "workspace_discovery",
      externalId: "source",
      data: {},
      status: "new",
      qualificationStatus: "qualified",
      updatedAt: 1,
    });
    return { userId, workspaceId, prospectId };
  });
  return { t, ...ids };
}

describe("discovery and qualification learning delivery", () => {
  test("batch duplicates retain combined query metadata after retargeting", async () => {
    const { t, workspaceId } = await fixture();
    await t.run((ctx) =>
      ctx.db.patch(workspaceId, { targetingLearningResetAt: 2 })
    );
    await t.mutation(internal.keywords.saveKeywordsBatch, {
      workspaceId,
      keywords: [
        {
          type: "social_query",
          value: "hiring engineers",
          platformTargets: ["twitter"],
          discoveryStage: "strict",
          targetingCriterionIds: ["role"],
        },
        {
          type: "social_query",
          value: "hiring engineers",
          platformTargets: ["linkedin"],
          discoveryStage: "broad",
          targetingCriterionIds: ["intent"],
        },
      ],
    });
    const rows = await t.run((ctx) =>
      ctx.db
        .query("keywords")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .collect()
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      platformTargets: ["twitter", "linkedin"],
      discoveryStage: "strict",
      targetingCriterionIds: ["role", "intent"],
    });
  });

  test("a promoted lesson reaches discovery and a different prospect without widening operator scope", async () => {
    const { t, userId, workspaceId, prospectId } = await fixture();
    await t.run(async (ctx) => {
      await promoteAgentMemory(ctx.db, {
        userId: String(userId),
        workspaceId: String(workspaceId),
        source: "qualification",
        category: "qualification_win_pattern",
        namespace: "wins",
        title: "Direct hiring authority",
        summary:
          "Engineering managers who describe their own open roles provide stronger hiring evidence.",
        narrative:
          "Search for engineering managers describing their own open roles; reposts alone do not establish hiring authority.",
        confidence: 0.9,
        impactScore: 0.85,
        prospectId: String(prospectId),
      });
      await promoteAgentMemory(ctx.db, {
        userId: String(userId),
        workspaceId: String(workspaceId),
        source: "operator",
        category: "operator_instruction",
        namespace: "lessons",
        title: "Private person instruction",
        summary: "Use a short introduction for this person only.",
        instruction: "Use a short introduction for this person only.",
        confidence: 1,
        impactScore: 1,
        prospectId: String(prospectId),
      });
    });
    const discovery = await t.query(
      internal.memory.getDiscoveryGenerationContextInternal,
      { workspaceId }
    );
    expect(discovery.promotedDiscoveryMemories).toHaveLength(1);
    expect(discovery.promotedDiscoveryMemories[0].summary).toContain(
      "reposts alone"
    );
    const context = await t.run(async (ctx) =>
      buildWorkspaceMemoryContext({
        request: {
          userId: String(userId),
          workspaceId: String(workspaceId),
          prospectId: "another-person",
          surface: "qualification",
          query: "engineering manager hiring",
        },
        memories: await listCanonicalWorkspaceMemoryCandidates(ctx.db, {
          userId,
          workspaceId,
        }),
      })
    );
    expect(context.learnedMemories).toHaveLength(1);
    expect(context.learnedMemories[0].sourceProspectId).toBe(
      String(prospectId)
    );
    expect(context.operatorInstructions).toHaveLength(0);
    expect(context.prompt).toContain("advisory");
  });
  test("historical prospect-bound lessons are reusable without rewriting their source", async () => {
    const { t, userId, workspaceId, prospectId } = await fixture();
    await t.run(async (ctx) => {
      const saved = await promoteAgentMemory(ctx.db, {
        userId: String(userId),
        workspaceId: String(workspaceId),
        source: "qualification",
        category: "qualification_false_positive_pattern",
        namespace: "losses",
        title: "Reposts lack authority",
        summary:
          "A repost does not prove that its author controls the opening.",
        confidence: 0.9,
        prospectId: String(prospectId),
      });
      const id = ctx.db.normalizeId(
        "workspaceMemories",
        saved.canonicalMemoryId
      )!;
      await ctx.db.patch(id, {
        sourceProspectId: undefined,
        prospectId,
        targetingFingerprint: undefined,
      });
    });
    expect(
      (
        await t.query(internal.memory.getDiscoveryGenerationContextInternal, {
          workspaceId,
        })
      ).promotedDiscoveryMemories
    ).toHaveLength(1);
  });
  test("changed intent excludes old lessons and query scores while allowing the query to be tried anew", async () => {
    const { t, userId, workspaceId } = await fixture();
    await t.run(async (ctx) => {
      await promoteAgentMemory(ctx.db, {
        userId: String(userId),
        workspaceId: String(workspaceId),
        source: "qualification",
        category: "qualification_win_pattern",
        namespace: "wins",
        title: "Old hiring lesson",
        summary:
          "Engineering managers hiring engineers are relevant to this workspace.",
        confidence: 0.9,
      });
      const queryId = await ctx.db.insert("keywords", {
        workspaceId,
        type: "social_query",
        value: "engineering hiring",
        status: "active",
      });
      await upsertQueryCandidateRecord(ctx.db, {
        workspaceId,
        type: "social_query",
        rawValue: "engineering hiring",
        status: "retired",
      });
      await upsertQueryPerformanceRecord(ctx.db, {
        workspaceId,
        queryId,
        canonicalValue: "engineering hiring",
        canonicalHash: "hash",
        qualifiedCountDelta: 9,
        prospectsFoundDelta: 10,
      });
      await ctx.db.patch(workspaceId, {
        description: "Find individual job seekers",
        targetingLearningResetAt: 2,
      });
    });
    const context = await t.query(
      internal.memory.getDiscoveryGenerationContextInternal,
      { workspaceId }
    );
    expect(context.promotedDiscoveryMemories).toHaveLength(0);
    expect(context.topPerformers).toHaveLength(0);
    expect(context.retired).toHaveLength(0);
    const retry = await t.run((ctx) =>
      upsertQueryCandidateRecord(ctx.db, {
        workspaceId,
        type: "social_query",
        rawValue: "engineering hiring",
        status: "generated",
      })
    );
    expect(retry.status).toBe("generated");
  });
  test("intent fingerprint ignores regenerated search phrases but tracks requirements", async () => {
    const { t, workspaceId } = await fixture();
    const w = await t.run((ctx) => ctx.db.get(workspaceId));
    expect(w).not.toBeNull();
    expect(getLearningTargetingFingerprint({ ...w! })).toBe(
      getLearningTargetingFingerprint(w!)
    );
    expect(
      getLearningTargetingFingerprint({
        ...w!,
        description: "A different goal",
      })
    ).not.toBe(getLearningTargetingFingerprint(w!));
  });
});

async function retarget(
  t: Awaited<ReturnType<typeof fixture>>["t"],
  workspaceId: Awaited<ReturnType<typeof fixture>>["workspaceId"]
) {
  return t.run(async (ctx) => {
    await ctx.db.patch(workspaceId, {
      description: "Find independent job seekers",
      targetingLearningResetAt: 2,
    });
    return getLearningTargetingFingerprint((await ctx.db.get(workspaceId))!);
  });
}

describe("targeting changes cannot reuse in-flight learning", () => {
  test("rejects a stale qualification write and query generation atomically", async () => {
    const { t, workspaceId, prospectId } = await fixture();
    const oldFingerprint = await t.run(async (ctx) =>
      getLearningTargetingFingerprint((await ctx.db.get(workspaceId))!)
    );
    await retarget(t, workspaceId);
    const before = await t.run((ctx) => ctx.db.get(prospectId));
    const saved = await t.mutation(
      internal.prospects.updateProspectQualification,
      {
        prospectId,
        expectedTargetingFingerprint: oldFingerprint,
        qualificationStatus: "disqualified",
        qualificationScore: 0,
      }
    );
    expect(saved.skipped).toBe(true);
    expect(await t.run((ctx) => ctx.db.get(prospectId))).toEqual(before);
    await expect(
      t.mutation(internal.workflows.prospecting.saveKeywordsInternal, {
        workspaceId,
        expectedTargetingFingerprint: oldFingerprint,
        seedKeywords: [],
        discoveredKeywords: [],
        socialQueries: ["old hiring intent"],
      })
    ).rejects.toThrow("targeting changed");
    expect(await t.run((ctx) => ctx.db.query("keywords").collect())).toEqual(
      []
    );
  });

  test("an old RAG entry stays excluded even after its prospect is requalified for the new audience", async () => {
    const { t, workspaceId, prospectId, userId } = await fixture();
    const oldFingerprint = await t.run(async (ctx) =>
      getLearningTargetingFingerprint((await ctx.db.get(workspaceId))!)
    );
    const fingerprint = await retarget(t, workspaceId);
    const other = await t.run(async (ctx) => {
      await ctx.db.patch(prospectId, {
        qualificationTargetingFingerprint: fingerprint,
      });
      const otherWorkspace = await ctx.db.insert("workspaces", {
        userId,
        name: "Other",
        description: "Other",
        isDefault: false,
        updatedAt: 2,
      });
      return ctx.db.insert("prospects", {
        userId,
        workspaceId: otherWorkspace,
        origin: "workspace_discovery",
        platform: "twitter",
        externalId: "foreign",
        data: {},
        status: "new",
        qualificationStatus: "qualified",
        qualificationTargetingFingerprint: fingerprint,
        updatedAt: 2,
      });
    });
    const allowed = await t.query(
      internal.memory.filterCurrentLearningEntriesInternal,
      {
        workspaceId,
        namespace: "verified_wins",
        entries: [
          {
            entryId: "old-index",
            sourceId: String(prospectId),
            targetingFingerprint: oldFingerprint,
          },
          { entryId: "legacy-index", sourceId: String(prospectId) },
          {
            entryId: "current-index",
            sourceId: String(prospectId),
            targetingFingerprint: fingerprint,
          },
          {
            entryId: "foreign-index",
            sourceId: String(other),
            targetingFingerprint: fingerprint,
          },
        ],
      }
    );
    expect(allowed).toEqual(["current-index"]);
    await t.run((ctx) =>
      ctx.db.patch(prospectId, { qualificationStatus: "disqualified" })
    );
    expect(
      await t.query(internal.memory.filterCurrentLearningEntriesInternal, {
        workspaceId,
        namespace: "verified_wins",
        entries: [
          {
            entryId: "current-index",
            sourceId: String(prospectId),
            targetingFingerprint: fingerprint,
          },
        ],
      })
    ).toEqual([]);
  });

  test("obsolete executable queries stop being selected; explicit regeneration clears their old search state", async () => {
    const { t, workspaceId } = await fixture();
    const id = await t.mutation(internal.keywords.saveKeywordInternal, {
      workspaceId,
      type: "social_query",
      value: "engineering hiring",
      discoveryStage: "strict",
      targetingCriterionIds: ["old-role"],
    });
    await t.run((ctx) =>
      ctx.db.patch(id, {
        lastSearchedTwitterAt: 10,
        twitterLastSeenPostId: "old-cursor",
        twitterResultsCount: 100,
      })
    );
    await retarget(t, workspaceId);
    expect(
      await t.query(internal.keywords.getPrioritizedTwitterQueries, {
        workspaceId,
      })
    ).toEqual([]);
    await t.mutation(internal.keywords.saveKeywordsBatch, {
      workspaceId,
      keywords: [
        {
          type: "social_query",
          value: "engineering hiring",
          discoveryStage: "balanced",
          targetingCriterionIds: ["new-intent"],
        },
      ],
    });
    const row = await t.run((ctx) => ctx.db.get(id));
    expect(row).toMatchObject({
      discoveryStage: "balanced",
      targetingCriterionIds: ["new-intent"],
    });
    expect(row?.twitterLastSeenPostId).toBeUndefined();
    expect(row?.lastSearchedTwitterAt).toBeUndefined();
    expect(
      (
        await t.query(internal.keywords.getPrioritizedTwitterQueries, {
          workspaceId,
        })
      ).map((item) => item.id)
    ).toEqual([id]);
  });

  test("an evaluator plan started before retargeting cannot promote lessons or update performance", async () => {
    const { t, workspaceId, prospectId } = await fixture();
    const ids = await t.run(async (ctx) => {
      const eventId = await ctx.db.insert("memoryWorkflowEvents", {
        workspaceId,
        prospectId,
        targetingFingerprint: getLearningTargetingFingerprint(
          (await ctx.db.get(workspaceId))!
        ),
        eventType: "qualification_completed",
        sourceType: "prospect",
        sourceId: String(prospectId),
        eventKey: "stale-event",
        status: "processing",
        occurredAt: 1,
      });
      const runId = await ctx.db.insert("memoryEvaluatorRuns", {
        workspaceId,
        eventId,
        eventKey: "stale-event",
        eventType: "qualification_completed",
        sourceType: "prospect",
        sourceId: String(prospectId),
        status: "running",
        promotedMemoryCount: 0,
        suggestedMemoryCount: 0,
        queryPerformanceUpdateCount: 0,
        updatedAt: 1,
      });
      return { eventId, runId };
    });
    await retarget(t, workspaceId);
    const result = await t.mutation(
      internal.evaluator.applyMemoryEvaluationPlanInternal,
      {
        ...ids,
        workspaceId,
        promptVersion: "regression-test",
        drafts: [
          {
            source: "qualification",
            category: "qualification_win_pattern",
            title: "Stale hiring rule",
            summary: "Hiring managers are the audience",
            confidence: 1,
            impactScore: 1,
            signals: [],
            evidence: [],
            relatedQueries: [],
            narrative: "Old target",
          },
        ],
        queryPerformanceUpdates: [],
        retrievalStats: {
          relevantMemories: 0,
          semanticMatches: 0,
          matchedQueries: 0,
        },
      }
    );
    expect(result.skipped).toBe(true);
    expect(
      await t.run((ctx) => ctx.db.query("workspaceMemories").collect())
    ).toEqual([]);
  });
});

test("feedback arriving after retargeting retains its original qualification provenance", async () => {
  const { t, workspaceId, prospectId } = await fixture();
  const oldFingerprint = await t.run(async (ctx) => {
    const fingerprint = getLearningTargetingFingerprint(
      (await ctx.db.get(workspaceId))!
    );
    await ctx.db.patch(prospectId, {
      qualificationTargetingFingerprint: fingerprint,
    });
    return fingerprint;
  });
  await retarget(t, workspaceId);
  const event = await t.run(async (ctx) => {
    const saved = await recordMemoryWorkflowEventRecord(ctx.db, {
      workspaceId,
      prospectId,
      eventType: "enrichment_completed",
      sourceType: "prospect",
      sourceId: String(prospectId),
    });
    return ctx.db.get(saved.eventId);
  });
  expect(event?.targetingFingerprint).toBe(oldFingerprint);
});

test("legacy workspace fingerprints agree with the normalized workflow view", async () => {
  const { t, workspaceId } = await fixture();
  const raw = await t.run((ctx) => ctx.db.get(workspaceId));
  const resolved = await t.query(internal.workspaces.getById, { workspaceId });
  expect(raw?.useCaseKey).toBeUndefined();
  expect(resolved?.useCaseKey).toBeDefined();
  expect(getLearningTargetingFingerprint(raw!)).toBe(
    getLearningTargetingFingerprint(resolved!)
  );
});

test("regenerating search hints does not discard lessons for an unchanged audience", async () => {
  const { t, workspaceId } = await fixture();
  const workspace = (await t.run((ctx) => ctx.db.get(workspaceId)))!;
  const targetingSpec = buildLegacyWorkspaceTargetingSpec({
    description: workspace.description,
    profiles: [],
  });
  const before = getLearningTargetingFingerprint({
    ...workspace,
    targetingSpec,
  });
  expect(
    getLearningTargetingFingerprint({
      ...workspace,
      targetingSpec: {
        ...targetingSpec,
        searchHints: {
          ...targetingSpec.searchHints,
          activityPhrases: ["a different searchable phrase"],
        },
      },
    })
  ).toBe(before);
});
