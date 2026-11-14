import assert from "node:assert/strict";
import test from "node:test";
import type { ExportedProspect } from "../../core/convex";
import {
  sampleRejected,
  selectReacherXTopK,
} from "../../people-search/reacherx";

// Synthetic prospects; not benchmark data.
const prospect = (
  id: string,
  overrides: Partial<ExportedProspect>
): ExportedProspect => ({
  id,
  createdAt: Number(id.replace(/\D/g, "")),
  platform: "linkedin",
  prospectType: "organization",
  displayName: id,
  title: null,
  company: null,
  location: null,
  briefIntro: null,
  websiteUrl: null,
  socialProfiles: null,
  matchReason: null,
  matchedKeywords: [],
  qualificationStatus: "qualified",
  qualificationScore: 80,
  qualificationReasoning: null,
  qualifiedAt: null,
  disqualifiedAt: null,
  qualificationSources: [],
  evidencePosts: [],
  ...overrides,
});

test("ReacherX's top results are qualified entities of the task's type, best fit first", () => {
  const top = selectReacherXTopK(
    [
      prospect("p1", { qualificationScore: 75 }),
      prospect("p2", { qualificationScore: 95, prospectType: "individual" }),
      prospect("p3", { qualificationScore: 90 }),
      prospect("p4", {
        qualificationScore: 99,
        qualificationStatus: "disqualified",
      }),
      prospect("p5", { qualificationScore: 85, prospectType: "unknown" }),
    ],
    "organization"
  );
  assert.deepEqual(
    top.map((item) => item.id),
    ["p3", "p1"]
  );
});

test("rejected samples are capped per cycle and reproducible", () => {
  const rejected = Array.from({ length: 8 }, (_, index) =>
    prospect(`r${index}`, { qualificationStatus: "disqualified" })
  );
  const cycleOf = (item: ExportedProspect) => (item.createdAt < 4 ? 1 : 2);
  const sample = sampleRejected(rejected, cycleOf, 7);
  assert.deepEqual(sample, sampleRejected(rejected, cycleOf, 7));
  assert.equal(sample.filter((item) => item.cycle === 1).length, 3);
  assert.equal(sample.filter((item) => item.cycle === 2).length, 3);
});
