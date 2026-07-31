/**
 * Demo use case labels
 * Per-use-case terminology for the landing demo, mirroring the real label
 * system in shared/lib/workspaceUseCases.ts. Four of the five demo use
 * cases map directly onto real use case definitions, so their labels are
 * the real ones (entities, converts, stage labels, analytics).
 * "Job seekers" has no real counterpart use case, so its entry mirrors the
 * real definition shape with recruiting-style stages.
 */
import {
  getWorkspaceUseCase,
  type WorkspaceUseCaseKey,
} from "@/shared/lib/workspaceUseCases";
import type { UseCaseDemoKey } from "./useCaseDemoData";

export interface DemoUseCaseLabels {
  displayName: string;
  entitySingular: string;
  entityPlural: string;
  profileLabelPlural: string;
  stageLabels: Record<
    "new" | "contacted" | "in_progress" | "converted" | "archived",
    string
  >;
  pageLabels: {
    entities: string;
    converts: string;
    archives: "Archives";
    analytics: string;
  };
  discoveryVerb: "finding" | "sourcing";
}

const REAL_USE_CASE_BY_DEMO_KEY: Partial<
  Record<UseCaseDemoKey, WorkspaceUseCaseKey>
> = {
  customers: "customer_prospecting",
  investors: "investor_outreach",
  candidates: "recruiting",
  creators: "creator_outreach",
};

// No real "job seekers" use case exists; this mirrors the real definition
// shape (shared/lib/workspaceUseCases.ts) with recruiting-style stages.
const JOB_SEEKERS_LABELS: DemoUseCaseLabels = {
  displayName: "Job Seeker Outreach",
  entitySingular: "Job seeker",
  entityPlural: "Job seekers",
  profileLabelPlural: "Ideal job seeker profiles",
  stageLabels: {
    new: "New",
    contacted: "Contacted",
    in_progress: "Interviewing",
    converted: "Hired",
    archived: "Archived",
  },
  pageLabels: {
    entities: "Job seekers",
    converts: "Hires",
    archives: "Archives",
    analytics: "Analytics",
  },
  discoveryVerb: "sourcing",
};

export function getDemoUseCaseLabels(key: UseCaseDemoKey): DemoUseCaseLabels {
  const realKey = REAL_USE_CASE_BY_DEMO_KEY[key];
  if (!realKey) {
    return JOB_SEEKERS_LABELS;
  }

  const useCase = getWorkspaceUseCase(realKey);
  return {
    displayName: useCase.displayName,
    entitySingular: useCase.entitySingular,
    entityPlural: useCase.entityPlural,
    profileLabelPlural: useCase.profileLabelPlural,
    stageLabels: useCase.stageLabels,
    pageLabels: useCase.pageLabels,
    discoveryVerb: realKey === "recruiting" ? "sourcing" : "finding",
  };
}
