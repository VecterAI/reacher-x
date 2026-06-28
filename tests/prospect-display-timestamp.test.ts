import assert from "node:assert/strict";
import test from "node:test";
import { getProspectDisplayTimestamp } from "../features/prospects/lib/getProspectDisplayTimestamp.ts";

test("new prospects prefer readyAt, then qualifiedAt, then createdAt", () => {
  assert.equal(
    getProspectDisplayTimestamp({
      status: "new",
      createdAt: 1_000,
      qualifiedAt: 2_000,
      readyAt: 3_000,
    }),
    3_000
  );

  assert.equal(
    getProspectDisplayTimestamp({
      status: "new",
      createdAt: 1_000,
      qualifiedAt: 2_000,
    }),
    2_000
  );
});

test("active downstream stages prefer their stage timestamp", () => {
  assert.equal(
    getProspectDisplayTimestamp({
      status: "contacted",
      createdAt: 1_000,
      qualifiedAt: 2_000,
      readyAt: 3_000,
      stageTimestamps: {
        contacted: 4_000,
      },
    }),
    4_000
  );
});

test("active downstream stages fall back to readyAt, then qualifiedAt, then createdAt", () => {
  assert.equal(
    getProspectDisplayTimestamp({
      status: "in_progress",
      createdAt: 1_000,
      readyAt: 3_000,
    }),
    3_000
  );

  assert.equal(
    getProspectDisplayTimestamp({
      status: "converted",
      prospectCreatedAt: 1_000,
      qualifiedAt: 2_000,
    }),
    2_000
  );
});

test("archived prospects ignore updated lifecycle touches and keep milestone-based age", () => {
  assert.equal(
    getProspectDisplayTimestamp({
      status: "archived",
      pipelineStage: "converted",
      createdAt: 1_000,
      readyAt: 3_000,
      stageTimestamps: {
        converted: 9_000,
      },
    }),
    3_000
  );
});
