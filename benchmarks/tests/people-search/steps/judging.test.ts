import assert from "node:assert/strict";
import test from "node:test";
import type { ExportedProspect } from "../../../core/execution/convex";
import type { BenchmarkTask } from "../../../core/types";
import { reacherxTargets } from "../../../people-search/steps/judging";
import type { WorkspaceOutcome } from "../../../people-search/steps/workspaces";

// Synthetic prospects; not benchmark data.
const prospect = (
  id: string,
  createdAt: number,
  overrides: Partial<ExportedProspect>
): ExportedProspect => ({
  id,
  createdAt,
  platform: "twitter",
  prospectType: null,
  displayName: id,
  title: null,
  company: null,
  location: null,
  briefIntro: null,
  websiteUrl: null,
  socialProfiles: null,
  matchReason: null,
  matchedKeywords: [],
  qualificationStatus: "disqualified",
  qualificationScore: 10,
  qualificationReasoning: null,
  qualifiedAt: null,
  disqualifiedAt: null,
  qualificationSources: [],
  evidencePosts: [],
  ...overrides,
});

const task = (entityType: "individual" | "organization"): BenchmarkTask => ({
  id: "p99",
  prompt: "Synthetic prompt",
  entityType,
  referenceDate: "2026-11-16T00:00:00Z",
  criteria: [],
  definitionNotes: [],
});

// Only the fields reacherxTargets reads.
const outcome = (prospects: ExportedProspect[]) =>
  ({
    taskId: "p99",
    learning: "on",
    record: {
      submittedAt: 0,
      cycles: [
        { cycle: 1, startedAt: 0 },
        { cycle: 2, startedAt: 100 },
      ],
      prospects,
    },
  }) as unknown as WorkspaceOutcome;

const prospects = [
  // Cycle 1: four untyped rejected, one typed rejected, one qualified person.
  ...["a1", "a2", "a3", "a4"].map((id, index) =>
    prospect(id, 10 + index, {})
  ),
  prospect("a5", 20, { prospectType: "unknown" }),
  prospect("a6", 30, { prospectType: "individual" }),
  prospect("a7", 40, {
    prospectType: "individual",
    qualificationStatus: "qualified",
    qualificationScore: 90,
  }),
  // Cycle 2: one untyped rejected without a name, one rejected organization.
  prospect("b1", 110, { displayName: " " }),
  prospect("b2", 120, { prospectType: "organization" }),
];

test("on a people prompt, untyped rejected prospects are sampled and judged as people", () => {
  const targets = reacherxTargets(
    outcome(prospects),
    task("individual"),
    "pilot",
    7
  );
  const rejected = targets.filter((target) => target.kind === "rejected");
  // Three per cycle at most; cycle 2 has none that can be judged.
  assert.equal(rejected.length, 3);
  assert.ok(rejected.every((target) => target.cycle === 1));
  assert.ok(
    rejected.every(
      (target) => target.candidate.entity.prospectType === "individual"
    )
  );
  assert.deepEqual(
    rejected.map((target) => target.unitId),
    ["j-reacherx-p99-on-c1-x1", "j-reacherx-p99-on-c1-x2", "j-reacherx-p99-on-c1-x3"]
  );
  // The top results are unchanged: only the qualified, typed person.
  assert.deepEqual(
    targets
      .filter((target) => target.kind === "top")
      .map((target) => target.candidate.sourceId),
    ["a7"]
  );
});

test("on a company prompt, untyped rejected prospects stay out", () => {
  const rejected = reacherxTargets(
    outcome(prospects),
    task("organization"),
    "main",
    7
  ).filter((target) => target.kind === "rejected");
  assert.deepEqual(
    rejected.map((target) => target.candidate.sourceId),
    ["b2"]
  );
});
