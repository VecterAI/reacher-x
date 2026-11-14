import assert from "node:assert/strict";
import test from "node:test";
import type { ExportedProspect } from "../../core/execution/convex";
import {
  sampleRejected,
  selectReacherXTopK,
  toCandidate,
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

test("an exported organization becomes a typed company with its domain and verified sources", () => {
  const candidate = toCandidate(
    prospect("p7", {
      websiteUrl: "https://www.example.com/about",
      socialProfiles: {
        linkedin: {
          username: "example",
          url: "https://linkedin.com/company/example",
        },
      },
      qualificationScore: 91,
      qualificationReasoning: "private model reasoning",
      qualificationSources: [
        {
          sourceUrl: "https://linkedin.com/posts/1",
          text: "We opened our new office.",
          publishedAt: "2026-10-01T09:00:00.000Z",
          verifiedAt: Date.UTC(2026, 10, 2),
        },
        { sourceUrl: "javascript:alert(1)", text: "dropped", verifiedAt: 0 },
      ],
    }),
    1
  );
  assert.deepEqual(candidate?.entity, {
    prospectType: "organization",
    name: "p7",
    profileUrl: "https://linkedin.com/company/example",
    location: null,
    description: null,
    domain: "example.com",
    industry: null,
    employeeCount: null,
    evidence: [
      {
        id: "reacherx-1",
        url: "https://linkedin.com/posts/1",
        text: "We opened our new office.",
        publishedAt: "2026-10-01T09:00:00.000Z",
        retrievedAt: "2026-11-02T00:00:00.000Z",
      },
    ],
  });
  assert.equal(candidate?.sourceId, "p7");
  assert.ok(!JSON.stringify(candidate).includes("private model reasoning"));
});

test("a prospect of unknown type or without a name is not graded", () => {
  assert.equal(
    toCandidate(prospect("p8", { prospectType: "unknown" }), 1),
    null
  );
  assert.equal(toCandidate(prospect("p9", { displayName: " " }), 1), null);
  const person = toCandidate(
    prospect("p10", {
      prospectType: "individual",
      title: "Engineer",
      company: "Example",
      socialProfiles: {
        twitter: { username: "p10", url: "https://x.com/p10" },
      },
    }),
    2
  );
  assert.equal(person?.entity.prospectType, "individual");
  assert.equal(person?.entity.profileUrl, "https://x.com/p10");
});
