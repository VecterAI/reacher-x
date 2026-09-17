import assert from "node:assert/strict";
import test from "node:test";
import type { Doc } from "../convex/_generated/dataModel";
import { createDefaultProspectListFilters } from "../features/prospects/lib/prospectListFilters";
import { filterAndSortDemoProspects } from "../features/landing/ui/components/use-case-demo/pages/prospectListShared";
import {
  USE_CASE_DEMO_DATASETS,
  USE_CASE_DEMO_REFERENCE_TIME,
} from "../features/landing/ui/components/use-case-demo/useCaseDemoData";

const base = Object.values(USE_CASE_DEMO_DATASETS)[0].prospects[0];
const rows = [
  {
    ...base,
    _id: "a",
    qualificationScore: 90,
    _creationTime: 1000,
    platform: "twitter",
    prospectType: "individual",
    displayName: "Ada Rivera",
  },
  {
    ...base,
    _id: "b",
    qualificationScore: 60,
    _creationTime: 3000,
    platform: "linkedin",
    prospectType: "organization",
    displayName: "Bright Studio",
  },
  {
    ...base,
    _id: "c",
    qualificationScore: 80,
    _creationTime: 2000,
    platform: "twitter",
    prospectType: "individual",
    displayName: "Chris Lin",
  },
] as Doc<"prospects">[];
const defaults = createDefaultProspectListFilters([0, 100]);

test("all six demo sort choices match expected list order without mutating fixtures", () => {
  const expected = {
    best_fit_first: ["a", "c", "b"],
    lowest_fit_first: ["b", "c", "a"],
    newest_first: ["b", "c", "a"],
    oldest_first: ["a", "c", "b"],
    individuals_first: ["a", "c", "b"],
    organizations_first: ["b", "a", "c"],
  } as const;
  const before = structuredClone(rows);
  for (const sort of Object.keys(expected) as (keyof typeof expected)[]) {
    assert.deepEqual(
      filterAndSortDemoProspects(rows, "", defaults, sort).map((p) => p._id),
      expected[sort]
    );
  }
  assert.deepEqual(rows, before);
});

test("search, score, platform and person-type filters combine", () => {
  assert.deepEqual(
    filterAndSortDemoProspects(
      rows,
      "  ADA RIVERA  ",
      {
        ...defaults,
        fitScoreRange: [80, 95],
        platform: "twitter",
        prospectType: "individual",
      },
      "best_fit_first"
    ).map((p) => p._id),
    ["a"]
  );
  assert.equal(
    filterAndSortDemoProspects(
      rows,
      "Ada Rivera",
      { ...defaults, platform: "linkedin" },
      "best_fit_first"
    ).length,
    0
  );
  assert.deepEqual(
    filterAndSortDemoProspects(
      rows,
      "",
      { ...defaults, prospectType: "organization" },
      "best_fit_first"
    ).map((p) => p._id),
    ["b"]
  );
});

test("custom dates include the final selected day and exclude the next day", () => {
  const from = new Date(2026, 7, 1);
  const to = new Date(2026, 7, 2);
  const dated = rows.map((p, i) => ({
    ...p,
    _creationTime: new Date(2026, 7, i + 1, 23, 59).getTime(),
  }));
  assert.deepEqual(
    filterAndSortDemoProspects(
      dated,
      "",
      { ...defaults, datePreset: "custom", customDateRange: { from, to } },
      "oldest_first"
    ).map((p) => p._id),
    ["a", "b"]
  );
});

test("relative date presets use the fixture clock", () => {
  const now = new Date(USE_CASE_DEMO_REFERENCE_TIME);
  const dated = rows.map((p, index) => ({
    ...p,
    _creationTime: USE_CASE_DEMO_REFERENCE_TIME - 1 - index * 2 * 86400000,
  }));
  assert.deepEqual(
    filterAndSortDemoProspects(
      dated,
      "",
      { ...defaults, datePreset: "1d" },
      "newest_first",
      now
    ).map((p) => p._id),
    ["a"]
  );
  assert.equal(
    filterAndSortDemoProspects(
      dated,
      "",
      { ...defaults, datePreset: "7d" },
      "newest_first",
      now
    ).length,
    3
  );
});
