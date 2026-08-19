import { describe, expect, test } from "vitest";
import {
  getTwitterExactFallbackQueries,
  partitionTwitterProspectingQueries,
  resolveTwitterProspectingSearchMode,
  stripTwitterExactPhraseQuotes,
} from "./twitterProspectingSearchCore";

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
        { query: "looking for screen recorder", searchMode: "exact" },
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

  test("removes only a complete pair of exact phrase quotes", () => {
    expect(stripTwitterExactPhraseQuotes('"screen recorder mac"')).toBe(
      "screen recorder mac"
    );
    expect(stripTwitterExactPhraseQuotes('"screen recorder mac')).toBe(
      '"screen recorder mac'
    );
  });
});
