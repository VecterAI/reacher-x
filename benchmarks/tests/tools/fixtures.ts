import type { Transport } from "../../core/calls/http";
import type { StepCall } from "../../core/calls/llm";
import type { FilterSet } from "../../people-search/filters";
import type { SearchContext } from "../../people-search/tools/types";

/** An empty synthetic filter set for adapter tests. */
export const emptyFilters = (
  entityType: FilterSet["entityType"]
): FilterSet => ({
  entityType,
  keywords: [],
  person: {
    titles: [],
    seniorities: [],
    locations: [],
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
    withinDays: null,
    postedAbout: [],
    mentions: [],
    joinedNewEmployer: false,
    fundingAnnounced: false,
    hiringFor: [],
  },
  coverage: [{ criterionId: "role", fields: ["keywords"] }],
});

const noModel: StepCall = async (step) => {
  throw new Error(`Unexpected model call "${step}".`);
};

export function fixtureContext(
  transport: Transport,
  topK: 5 | 10,
  secrets: Record<string, string>,
  filters: FilterSet = emptyFilters("individual"),
  call: StepCall = noModel
): SearchContext {
  return {
    transport,
    model: { id: "synthetic/model", call },
    topK,
    secrets,
    filters,
    submittedAt: "2026-11-14T00:00:00Z",
  };
}
