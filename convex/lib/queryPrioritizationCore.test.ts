import { describe, expect, test } from "vitest";
import { prioritizeQueries } from "./queryPrioritizationCore";

const emptyPerformance = {
  impressions: 0,
  prospectsFound: 0,
  qualifiedCount: 0,
  convertedCount: 0,
  replyCount: 0,
  replyRate: 0,
  qualificationRate: 0,
};

describe("query prioritization", () => {
  test("keeps an unproven query in learning for three searches", () => {
    const [result] = prioritizeQueries({
      candidates: [
        {
          id: "query",
          value: "screen recorder",
          createdAt: 1,
          lastSearchedAt: 2,
          performance: {
            ...emptyPerformance,
            impressions: 2,
            prospectsFound: 12,
          },
        },
      ],
      limit: 1,
      now: 3,
      retireAfterUnqualifiedSearches: 3,
    });

    expect(result.priority).toBe("learning");
  });

  test("cools a query after three searches without downstream quality", () => {
    const result = prioritizeQueries({
      candidates: [
        {
          id: "query",
          value: "screen recorder",
          createdAt: 1,
          lastSearchedAt: 2,
          performance: {
            ...emptyPerformance,
            impressions: 3,
            prospectsFound: 40,
          },
        },
      ],
      limit: 1,
      now: 3,
      retireAfterUnqualifiedSearches: 3,
    });

    expect(result).toEqual([]);
  });

  test("keeps queries with qualified prospects proven", () => {
    const [result] = prioritizeQueries({
      candidates: [
        {
          id: "query",
          value: "screen recorder",
          createdAt: 1,
          lastSearchedAt: 2,
          performance: {
            ...emptyPerformance,
            impressions: 10,
            prospectsFound: 4,
            qualifiedCount: 1,
          },
        },
      ],
      limit: 1,
      now: 3,
      retireAfterUnqualifiedSearches: 3,
    });

    expect(result.priority).toBe("proven");
  });

  test("preserves the existing generic policy when the Twitter rule is omitted", () => {
    const [result] = prioritizeQueries({
      candidates: [
        {
          id: "linkedin-query",
          value: "screen recorder founder",
          createdAt: 1,
          lastSearchedAt: 2,
          performance: {
            ...emptyPerformance,
            impressions: 3,
            prospectsFound: 12,
          },
        },
      ],
      limit: 1,
      now: 3,
    });

    expect(result.priority).toBe("proven");
  });
});
