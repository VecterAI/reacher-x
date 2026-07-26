import assert from "node:assert/strict";
import test from "node:test";
import {
  prioritizeQueries,
  type QueryPrioritizationCandidate,
} from "../convex/lib/queryPrioritizationCore";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 30 * DAY_MS;

type Candidate = QueryPrioritizationCandidate<string>;

function candidate(id: string, overrides: Partial<Candidate> = {}): Candidate {
  return {
    id,
    value: id,
    createdAt: DAY_MS,
    lastSearchedAt: 20 * DAY_MS,
    performance: {
      impressions: 5,
      prospectsFound: 3,
      qualifiedCount: 1,
      convertedCount: 0,
      replyCount: 0,
      replyRate: 0,
      qualificationRate: 33,
    },
    ...overrides,
  };
}

test("uses a bounded 70/20/10 performance, learning, experiment mix", () => {
  const candidates = [
    ...Array.from({ length: 8 }, (_, index) =>
      candidate(`proven-${index}`, {
        performance: {
          impressions: 5,
          prospectsFound: index + 1,
          qualifiedCount: index + 1,
          convertedCount: 0,
          replyCount: 0,
          replyRate: 0,
          qualificationRate: 50,
        },
      })
    ),
    candidate("new-1", { lastSearchedAt: undefined }),
    candidate("new-2", { lastSearchedAt: undefined, createdAt: 2 * DAY_MS }),
    candidate("cold", {
      lastSearchedAt: 10 * DAY_MS,
      performance: {
        impressions: 5,
        prospectsFound: 0,
        qualifiedCount: 0,
        convertedCount: 0,
        replyCount: 0,
        replyRate: 0,
        qualificationRate: 0,
      },
    }),
  ];

  const result = prioritizeQueries({ candidates, limit: 10, now: NOW });

  assert.equal(result.length, 10);
  assert.deepEqual(
    result.slice(0, 7).map((item) => item.priority),
    Array(7).fill("proven")
  );
  assert.deepEqual(
    result.slice(7, 9).map((item) => item.priority),
    ["new", "new"]
  );
  assert.equal(result[9]?.priority, "cold");
});

test("ranks qualified outcomes above raw prospect volume", () => {
  const result = prioritizeQueries({
    limit: 2,
    now: NOW,
    candidates: [
      candidate("many-unqualified", {
        performance: {
          impressions: 10,
          prospectsFound: 20,
          qualifiedCount: 0,
          convertedCount: 0,
          replyCount: 0,
          replyRate: 0,
          qualificationRate: 0,
        },
      }),
      candidate("qualified", {
        performance: {
          impressions: 4,
          prospectsFound: 2,
          qualifiedCount: 2,
          convertedCount: 1,
          replyCount: 1,
          replyRate: 50,
          qualificationRate: 100,
        },
      }),
    ],
  });

  assert.equal(result[0]?.id, "qualified");
  assert.equal(result[0]?.priority, "proven");
  assert.equal(result[1]?.priority, "cold");
});

test("does not retry cold queries until the cooldown expires", () => {
  const result = prioritizeQueries({
    limit: 5,
    now: NOW,
    candidates: [
      candidate("recent-cold", {
        lastSearchedAt: NOW - DAY_MS,
        performance: {
          impressions: 5,
          prospectsFound: 0,
          qualifiedCount: 0,
          convertedCount: 0,
          replyCount: 0,
          replyRate: 0,
          qualificationRate: 0,
        },
      }),
      candidate("new", { lastSearchedAt: undefined }),
    ],
  });

  assert.deepEqual(
    result.map((item) => item.id),
    ["new"]
  );
});

test("fills unused category slots without exceeding the configured batch", () => {
  const result = prioritizeQueries({
    limit: 5,
    now: NOW,
    candidates: Array.from({ length: 12 }, (_, index) =>
      candidate(`winner-${index}`)
    ),
  });

  assert.equal(result.length, 5);
  assert.ok(result.every((item) => item.priority === "proven"));
});
