import { describe, expect, test } from "vitest";
import {
  attributeNewTwitterProspectsToQueries,
  buildTwitterProspectingProviderQuery,
  getNewestTwitterPostId,
  getNextTwitterSearchCursor,
  getTwitterProspectingPageLimit,
  limitTwitterProspectingPostsForPersistence,
  getTwitterExactFallbackQueries,
  mergeTwitterProspectingSearchResults,
  partitionTwitterProspectingQueries,
  resolveTwitterProspectingSearchMode,
  stripTwitterExactPhraseQuotes,
} from "./twitterProspectingSearchCore";

describe("Twitter prospecting page limits", () => {
  test("keeps setup previews bounded while real workflows use configured pagination", () => {
    expect(
      getTwitterProspectingPageLimit({
        processingMode: "preview",
        configuredPagesPerQuery: 3,
      })
    ).toBe(1);
    expect(
      getTwitterProspectingPageLimit({
        processingMode: "normal",
        configuredPagesPerQuery: 3,
      })
    ).toBe(3);
    expect(getTwitterProspectingPageLimit({ configuredPagesPerQuery: 0 })).toBe(
      1
    );
  });

  test("caps persisted preview posts without truncating real workflow results", () => {
    const posts = Array.from({ length: 25 }, (_, index) => index);
    expect(
      limitTwitterProspectingPostsForPersistence({
        posts,
        processingMode: "preview",
        previewLimit: 20,
      })
    ).toEqual(posts.slice(0, 20));
    expect(
      limitTwitterProspectingPostsForPersistence({
        posts,
        processingMode: "normal",
        previewLimit: 20,
      })
    ).toBe(posts);
  });
});

describe("Twitter prospecting provider queries", () => {
  test("applies a freshness boundary to raw and exact searches", () => {
    expect(
      buildTwitterProspectingProviderQuery({
        query: "screen recorder mac",
        searchMode: "raw",
        sinceTimestampSeconds: 1_700_000_000,
      })
    ).toBe("screen recorder mac since_time:1700000000");
    expect(
      buildTwitterProspectingProviderQuery({
        query: "looking for screen recorder",
        searchMode: "exact",
        sinceTimestampSeconds: 1_700_000_000,
      })
    ).toBe('"looking for screen recorder" since_time:1700000000');
  });

  test("uses a valid checkpoint on later searches", () => {
    expect(
      buildTwitterProspectingProviderQuery({
        query: "screen recorder mac",
        searchMode: "raw",
        sinceTimestampSeconds: 1_700_000_000,
        sinceId: " 1900000000000000001 ",
      })
    ).toBe("screen recorder mac since_id:1900000000000000001");
  });

  test("preserves explicit provider boundaries and ignores malformed checkpoints", () => {
    expect(
      buildTwitterProspectingProviderQuery({
        query: "screen recorder since_time:1600000000",
        searchMode: "raw",
        sinceTimestampSeconds: 1_700_000_000,
        sinceId: "not-a-post-id",
      })
    ).toBe("screen recorder since_time:1600000000");
    expect(
      buildTwitterProspectingProviderQuery({
        query: "screen recorder",
        searchMode: "raw",
        sinceTimestampSeconds: 1_700_000_000.9,
        sinceId: "not-a-post-id",
      })
    ).toBe("screen recorder since_time:1700000000");
  });

  test("selects the newest numeric post id without unsafe number conversion", () => {
    expect(
      getNewestTwitterPostId([
        { id_str: "999999999999999999" },
        { id_str: "1900000000000000001" },
        { id_str: "1900000000000000000" },
        { id_str: "invalid" },
      ])
    ).toBe("1900000000000000001");
  });

  test("continues only when SocialAPI returns a new cursor with posts", () => {
    expect(
      getNextTwitterSearchCursor({
        hasMore: true,
        nextCursor: " next-page ",
        pagePostCount: 20,
        seenCursors: new Set(),
      })
    ).toBe("next-page");
    expect(
      getNextTwitterSearchCursor({
        hasMore: true,
        nextCursor: "repeated",
        pagePostCount: 20,
        seenCursors: new Set(["repeated"]),
      })
    ).toBeUndefined();
    expect(
      getNextTwitterSearchCursor({
        hasMore: true,
        nextCursor: "empty-page",
        pagePostCount: 0,
        seenCursors: new Set(),
      })
    ).toBeUndefined();
  });

  test("attributes each newly-created person once per matching query", () => {
    expect(
      attributeNewTwitterProspectsToQueries({
        createdTwitterUserIds: ["user-1", "user-2"],
        matches: [
          { twitterUserId: "user-1", queries: ["query a", "query b"] },
          { twitterUserId: "user-1", queries: ["query a"] },
          { twitterUserId: "user-2", queries: ["query a"] },
          { twitterUserId: "existing-user", queries: ["query a"] },
        ],
      })
    ).toEqual({ "query a": 2, "query b": 1 });
  });
});

describe("twitter prospecting search mode", () => {
  test("keeps a short coherent LLM-selected phrase exact", () => {
    expect(
      resolveTwitterProspectingSearchMode({
        query: "looking for screen recorder",
        requestedMode: "exact",
      })
    ).toBe("exact");
  });

  test("defaults legacy and LLM-omitted modes to raw", () => {
    expect(
      resolveTwitterProspectingSearchMode({
        query: "screen recorder mac",
      })
    ).toBe("raw");
  });

  test.each([
    "need an integrated screen recorder for",
    "this exact phrase has far too many words",
    "screen recorder OR loom alternative",
    "screen recorder since_time:123",
    'looking for "screen recorder"',
    '"looking for screen recorder',
  ])("demotes unsafe exact phrase %s to raw", (query) => {
    expect(
      resolveTwitterProspectingSearchMode({
        query,
        requestedMode: "exact",
      })
    ).toBe("raw");
  });

  test("partitions validated query plans by provider mode", () => {
    expect(
      partitionTwitterProspectingQueries([
        { query: '"looking for screen recorder"', searchMode: "exact" },
        { query: "screen recorder mac", searchMode: "raw" },
      ])
    ).toEqual({
      exact: ["looking for screen recorder"],
      raw: ["screen recorder mac"],
    });
  });

  test("falls back only after successful exact searches return zero", () => {
    expect(
      getTwitterExactFallbackQueries([
        {
          query: '"looking for screen recorder"',
          postsFound: 0,
          success: true,
        },
        { query: '"video export is slow"', postsFound: 2, success: true },
        {
          query: '"provider request failed"',
          postsFound: 0,
          success: false,
        },
      ])
    ).toEqual(["looking for screen recorder"]);
  });

  test("deduplicates overlapping search posts before they are saved", () => {
    const exactPost = { id_str: "post-1", source: "exact" };
    const rawPost = { id_str: "post-1", source: "raw" };
    const uniquePost = { id_str: "post-2", source: "fallback" };

    expect(
      mergeTwitterProspectingSearchResults([
        {
          queryStats: [
            {
              query: "looking for screen recorder",
              postsFound: 1,
              success: true,
            },
          ],
          posts: [exactPost],
          matchedQueriesByPostId: {
            "post-1": ["looking for screen recorder"],
          },
        },
        {
          queryStats: [
            {
              query: "screen recorder mac",
              postsFound: 2,
              success: true,
            },
          ],
          posts: [rawPost, uniquePost],
          matchedQueriesByPostId: {
            "post-1": ["screen recorder mac"],
            "post-2": ["screen recorder mac"],
          },
        },
      ])
    ).toEqual({
      queryStats: [
        {
          query: "looking for screen recorder",
          postsFound: 1,
          success: true,
        },
        {
          query: "screen recorder mac",
          postsFound: 2,
          success: true,
        },
      ],
      posts: [exactPost, uniquePost],
      matchedQueriesByPostId: {
        "post-1": ["looking for screen recorder", "screen recorder mac"],
        "post-2": ["screen recorder mac"],
      },
    });
  });

  test("removes only a complete pair of exact phrase quotes", () => {
    expect(stripTwitterExactPhraseQuotes('"screen recorder mac"')).toBe(
      "screen recorder mac"
    );
    expect(stripTwitterExactPhraseQuotes('"screen recorder mac')).toBe(
      '"screen recorder mac'
    );
  });
});
