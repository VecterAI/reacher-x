import assert from "node:assert/strict";
import test from "node:test";
import type { StructuredCall } from "../../core/calls/llm";
import type { BenchmarkTask } from "../../core/types";
import {
  translateTask,
  unexpressedFields,
  usedFields,
  validateFilterSet,
  type FilterSet,
} from "../../people-search/setup/filters";

// Synthetic task and criteria; the real ones are frozen separately.
const task: BenchmarkTask = {
  id: "6",
  prompt: "Synthetic: developers in Germany who posted about React recently.",
  entityType: "individual",
  referenceDate: "2026-11-14T00:00:00Z",
  definitionNotes: [],
  criteria: [
    { id: "role", requirement: "Works as a developer", required: true },
    { id: "location", requirement: "Based in Germany", required: true },
    {
      id: "signal",
      requirement: "Posted about React in 90 days",
      required: true,
    },
  ],
};

const filters: FilterSet = {
  entityType: "individual",
  keywords: ["React"],
  person: {
    titles: ["Developer"],
    seniorities: [],
    locations: ["Germany"],
    minYearsExperience: null,
  },
  company: {
    locations: [],
    industries: [],
    employeeRange: null,
    fundingStages: [],
    technologies: [],
  },
  signals: {
    withinDays: 90,
    postedAbout: ["React"],
    mentions: [],
    joinedNewEmployer: false,
    fundingAnnounced: false,
    hiringFor: [],
  },
  coverage: [
    { criterionId: "role", fields: ["person.titles"] },
    { criterionId: "location", fields: ["person.locations"] },
    {
      criterionId: "signal",
      fields: ["signals.postedAbout", "signals.withinDays"],
    },
  ],
};

test("a translation must cover every criterion with a filled field", () => {
  assert.deepEqual(validateFilterSet(task, filters), filters);
  assert.throws(
    () =>
      validateFilterSet(task, {
        ...filters,
        coverage: filters.coverage.slice(0, 2),
      }),
    /exactly once/
  );
  assert.throws(
    () =>
      validateFilterSet(task, {
        ...filters,
        coverage: [
          ...filters.coverage.slice(0, 2),
          { criterionId: "signal", fields: ["signals.hiringFor"] },
        ],
      }),
    /empty or unknown/
  );
  assert.throws(
    () => validateFilterSet(task, { ...filters, entityType: "organization" }),
    /entity type/
  );
  assert.throws(() =>
    validateFilterSet(task, {
      ...filters,
      company: { ...filters.company, employeeRange: { min: 500, max: 50 } },
    })
  );
});

test("a static-filter tool records the signal it cannot express", () => {
  assert.deepEqual(usedFields(filters), [
    "keywords",
    "person.titles",
    "person.locations",
    "signals.withinDays",
    "signals.postedAbout",
  ]);
  assert.deepEqual(
    unexpressedFields(filters, [
      "keywords",
      "person.titles",
      "person.locations",
    ]),
    ["signals.withinDays", "signals.postedAbout"]
  );
});

test("the shared translation records the model that served it", async () => {
  const call = (async () => ({
    output: filters,
    modelObserved: "synthetic/model-1",
    costUsd: 0.0004,
  })) as unknown as StructuredCall;
  const translation = await translateTask(task, "synthetic/model", call);
  assert.equal(translation.modelObserved, "synthetic/model-1");
  assert.deepEqual(translation.filters, filters);
});
