/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { KEYWORD_POST_SEARCH_PURPOSE } from "./lib/benchmarkLinkdApiCap";

const modules = import.meta.glob("./**/*.ts");

async function seed(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "benchmark-linkdapi-cap",
      email: "benchmark-linkdapi-cap@example.test",
    });
    const workspace = (name: string, workflowId: string, startedAt: number) =>
      ctx.db.insert("workspaces", {
        userId,
        name,
        description: "Synthetic workspace",
        isDefault: false,
        updatedAt: Date.now(),
        prospectingWorkflowStatus: "running",
        prospectingWorkflowId: workflowId,
        prospectingWorkflowStartedAt: startedAt,
      });
    return {
      benchmark: await workspace("Benchmark run-1_14_on", "wf-1", 2_000),
      ordinary: await workspace("Sales team", "wf-sales", 3_000),
    };
  });
}

// The keyword post search's reservation, the only one the cap counts.
const reserve = (t: ReturnType<typeof convexTest>) =>
  t.mutation(internal.linkdapiBudget.reserveLinkdApiBudgetSlotInternal, {
    consumer: "linkedin.searchUserPosts",
    purpose: KEYWORD_POST_SEARCH_PURPOSE,
  });

// Any other LinkdAPI call: discovery, profile and company reads, qualification.
const reserveOther = (t: ReturnType<typeof convexTest>) =>
  t.mutation(internal.linkdapiBudget.reserveLinkdApiBudgetSlotInternal, {
    consumer: "linkedin.getProfile",
  });

const status = (t: ReturnType<typeof convexTest>) =>
  t.query(internal.benchmarkPeopleSearch.keywordPostSearchLimitStatus, {});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("benchmark keyword post-search cap", () => {
  test("unset, every call is reserved and nothing is counted", async () => {
    const t = convexTest(schema, modules);
    await seed(t);
    for (let call = 0; call < 3; call++)
      expect((await reserve(t)).benchmarkCapRefused).toBeNull();
    const state = await t.run((ctx) =>
      ctx.db.query("linkdapiBudgetState").first()
    );
    expect(state?.benchmarkCycleKey).toBeUndefined();
    expect((await status(t)).limit).toBeNull();
  });

  test("refuses keyword post-search calls past the cap for the benchmark workspace's cycle", async () => {
    vi.stubEnv("BENCHMARK_KEYWORD_POST_SEARCH_LIMIT", "2");
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const results = [];
    for (let call = 0; call < 4; call++)
      results.push((await reserve(t)).benchmarkCapRefused);
    expect(results).toEqual([null, null, 2, 2]);
    expect(await status(t)).toEqual({
      limit: 2,
      source: "benchmark",
      error: null,
      cycle: {
        workspaceId: ids.benchmark,
        workflowId: "wf-1",
        calls: 2,
        refused: 2,
      },
    });
  });

  test("never counts or refuses any other LinkdAPI call", async () => {
    vi.stubEnv("BENCHMARK_KEYWORD_POST_SEARCH_LIMIT", "1");
    const t = convexTest(schema, modules);
    await seed(t);
    expect((await reserve(t)).benchmarkCapRefused).toBeNull();
    expect((await reserve(t)).benchmarkCapRefused).toBe(1);
    for (let call = 0; call < 3; call++)
      expect((await reserveOther(t)).benchmarkCapRefused).toBeNull();
    expect((await status(t)).cycle).toMatchObject({ calls: 1, refused: 1 });
  });

  test("a new cycle starts a new count", async () => {
    vi.stubEnv("BENCHMARK_KEYWORD_POST_SEARCH_LIMIT", "1");
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    expect((await reserve(t)).benchmarkCapRefused).toBeNull();
    expect((await reserve(t)).benchmarkCapRefused).toBe(1);
    await t.run((ctx) =>
      ctx.db.patch(ids.benchmark, {
        prospectingWorkflowId: "wf-2",
        prospectingWorkflowStartedAt: 5_000,
      })
    );
    expect((await reserve(t)).benchmarkCapRefused).toBeNull();
    expect((await status(t)).cycle).toMatchObject({
      workflowId: "wf-2",
      calls: 1,
      refused: 0,
    });
  });

  test("never counts or refuses without a benchmark workspace", async () => {
    vi.stubEnv("BENCHMARK_KEYWORD_POST_SEARCH_LIMIT", "1");
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    await t.run((ctx) => ctx.db.delete(ids.benchmark as Id<"workspaces">));
    for (let call = 0; call < 3; call++)
      expect((await reserve(t)).benchmarkCapRefused).toBeNull();
    expect((await status(t)).cycle).toBeNull();
  });

  test("an invalid value reports an error and never refuses", async () => {
    vi.stubEnv("BENCHMARK_KEYWORD_POST_SEARCH_LIMIT", "lots");
    const t = convexTest(schema, modules);
    await seed(t);
    for (let call = 0; call < 3; call++)
      expect((await reserve(t)).benchmarkCapRefused).toBeNull();
    const reported = await status(t);
    expect(reported.limit).toBeNull();
    expect(reported.error).not.toBeNull();
  });

  test("the kill switch refuses every LinkdAPI call while a benchmark workspace is stopped, and nothing when unset", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    expect((await reserveOther(t)).benchmarkHalted).toBeNull();
    vi.stubEnv("BENCHMARK_HALTED_WORKSPACE_ID", ids.benchmark);
    vi.stubEnv("BENCHMARK_KEYWORD_POST_SEARCH_LIMIT", "5");
    const before = await t.run((ctx) =>
      ctx.db.query("linkdapiBudgetState").first()
    );
    for (const call of [reserve, reserveOther]) {
      const reservation = await call(t);
      expect(reservation.benchmarkHalted).toBe(ids.benchmark);
      expect(reservation.waitMs).toBe(0);
    }
    // Refused before any reservation or count is written.
    expect(
      await t.run((ctx) => ctx.db.query("linkdapiBudgetState").first())
    ).toEqual(before);
    vi.stubEnv("BENCHMARK_HALTED_WORKSPACE_ID", "  ");
    expect((await reserveOther(t)).benchmarkHalted).toBeNull();
  });

  test("a call refused by the kill switch never reaches LinkedIn", async () => {
    vi.stubEnv("BENCHMARK_HALTED_WORKSPACE_ID", "stopped-workspace");
    vi.stubEnv("LINKDAPI_API_KEY", "test-key");
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ success: true, data: { posts: [], hasMore: false } })
        )
    );
    vi.stubGlobal("fetch", fetchMock);
    const t = convexTest(schema, modules);
    await seed(t);
    const result = await t.action(
      internal.integrations.linkedin.searchUserPosts.searchUserPostsCore,
      {
        urn: "ACoAABYrFkMBC7rsx_EOLFLBZrG7-N-IDnL2aCQ",
        keywords: ["ARR"],
        maxPosts: 10,
      }
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.error).toMatch(/Benchmark stop in force/);
  }, 20_000);

  test("a refused keyword search stops and returns what it found; other searches are not capped", async () => {
    vi.stubEnv("BENCHMARK_KEYWORD_POST_SEARCH_LIMIT", "1");
    vi.stubEnv("LINKDAPI_API_KEY", "test-key");
    // No request spacing; the search still staggers keywords by 500ms.
    vi.stubEnv("LINKDAPI_REQUESTS_PER_MINUTE", "10000");
    vi.stubEnv("LINKDAPI_TARGET_REQUESTS_PER_MINUTE", "10000");
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ success: true, data: { posts: [], hasMore: false } })
        )
    );
    vi.stubGlobal("fetch", fetchMock);
    const t = convexTest(schema, modules);
    await seed(t);
    const search = (purpose?: typeof KEYWORD_POST_SEARCH_PURPOSE) =>
      t.action(
        internal.integrations.linkedin.searchUserPosts.searchUserPostsCore,
        {
          urn: "ACoAABYrFkMBC7rsx_EOLFLBZrG7-N-IDnL2aCQ",
          keywords: ["MRR", "ARR", "revenue"],
          maxPosts: 10,
          ...(purpose ? { purpose } : {}),
        }
      );

    // One call allowed (the first keyword's past-month search); its
    // full-history fallback is refused and no later keyword is tried.
    const capped = await search(KEYWORD_POST_SEARCH_PURPOSE);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(capped.posts).toEqual([]);
    expect(capped.error).toMatch(/Benchmark keyword post search cap reached/);
    expect((await status(t)).cycle).toMatchObject({ calls: 1, refused: 1 });

    // The same search without the purpose, as qualification makes it.
    fetchMock.mockClear();
    const uncapped = await search();
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(uncapped.error).toBeUndefined();
    expect((await status(t)).cycle).toMatchObject({ calls: 1, refused: 1 });
  }, 20_000);

  test("a refusal mid-pagination keeps the pages already fetched", async () => {
    vi.stubEnv("BENCHMARK_KEYWORD_POST_SEARCH_LIMIT", "1");
    vi.stubEnv("LINKDAPI_API_KEY", "test-key");
    vi.stubEnv("LINKDAPI_REQUESTS_PER_MINUTE", "10000");
    vi.stubEnv("LINKDAPI_TARGET_REQUESTS_PER_MINUTE", "10000");
    const posts = Array.from({ length: 10 }, (_, index) => ({
      postID: `p${index}`,
      text: `Post ${index} about ARR`,
    }));
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ success: true, data: { posts, hasMore: true } })
        )
    );
    vi.stubGlobal("fetch", fetchMock);
    const t = convexTest(schema, modules);
    await seed(t);
    const result = await t.action(
      internal.integrations.linkedin.searchUserPosts.searchUserPostsCore,
      {
        urn: "ACoAABYrFkMBC7rsx_EOLFLBZrG7-N-IDnL2aCQ",
        keywords: ["MRR", "ARR"],
        maxPosts: 20,
        purpose: KEYWORD_POST_SEARCH_PURPOSE,
      }
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.posts).toHaveLength(10);
    expect(result.matchedKeywords).toEqual(["MRR"]);
    expect((await status(t)).cycle).toMatchObject({ calls: 1, refused: 1 });
  }, 20_000);
});
