/** Shared workspace terminology for every landing demo surface. */
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

const REAL_USE_CASE_BY_DEMO_KEY: Record<UseCaseDemoKey, WorkspaceUseCaseKey> = {
  customers: "customer_prospecting",
  investors: "investor_outreach",
  candidates: "recruiting",
  creators: "creator_outreach",
  job_seekers: "recruiting",
};

export function getDemoUseCaseLabels(key: UseCaseDemoKey): DemoUseCaseLabels {
  const realKey = REAL_USE_CASE_BY_DEMO_KEY[key];
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

export function getDemoWorkspaceUseCaseKey(
  key: UseCaseDemoKey
): WorkspaceUseCaseKey {
  return REAL_USE_CASE_BY_DEMO_KEY[key];
}
