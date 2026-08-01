import type { WorkspaceUseCaseStageKey } from "@/shared/lib/workspaceUseCases";
import type { WorkspaceSystemMode } from "@/shared/lib/workspaceSystem";

export type ProspectPipelineEmptyStage = Extract<
  WorkspaceUseCaseStageKey,
  "new" | "contacted" | "in_progress" | "converted"
>;

export interface ProspectEmptyStateCopy {
  title: string;
  description: string;
}

interface ProspectPipelineEmptyStateCopyArgs {
  entityPlural: string;
  stageLabels: Record<WorkspaceUseCaseStageKey, string>;
  stage: ProspectPipelineEmptyStage;
}

interface ProspectSuccessEmptyStateCopyArgs {
  entityPlural: string;
  successLabel: string;
  stageLabels: Record<WorkspaceUseCaseStageKey, string>;
}

interface ProspectWaitingStateCopyArgs {
  entityPlural: string;
}

interface ProspectWaitingStateCopy {
  message: string;
}

const PREVIOUS_STAGE_BY_STAGE: Partial<
  Record<ProspectPipelineEmptyStage, WorkspaceUseCaseStageKey>
> = {
  contacted: "new",
  in_progress: "contacted",
  converted: "in_progress",
};

function lower(value: string) {
  return value.toLowerCase();
}

export function getProspectPipelineEmptyStateCopy({
  entityPlural,
  stageLabels,
  stage,
}: ProspectPipelineEmptyStateCopyArgs): ProspectEmptyStateCopy {
  const entityPluralLower = lower(entityPlural);
  const stageLabel = stageLabels[stage];
  const previousStage = PREVIOUS_STAGE_BY_STAGE[stage];

  if (!previousStage) {
    return {
      title: `Nothing in ${stageLabel} right now`,
      description: `The agent adds ${entityPluralLower} here as it discovers and qualifies matches for this workspace. If you expected results, check filters or let the agent finish processing.`,
    };
  }

  const previousStageLabel = stageLabels[previousStage];

  return {
    title: `Nothing in ${stageLabel} right now`,
    description: `${entityPlural} appear here when the agent moves them from ${previousStageLabel} to ${stageLabel}, or when you manually mark one as ${stageLabel}. If you expected results, check filters or the ${previousStageLabel} tab.`,
  };
}

export function getProspectSuccessEmptyStateCopy({
  entityPlural,
  successLabel,
  stageLabels,
}: ProspectSuccessEmptyStateCopyArgs): ProspectEmptyStateCopy {
  const successLabelLower = lower(successLabel);
  const convertedLabel = stageLabels.converted;
  const inProgressLabel = stageLabels.in_progress;

  return {
    title: `No ${successLabelLower} yet`,
    description: `${entityPlural} appear here when the agent marks them as ${convertedLabel}, or when you manually mark one as ${convertedLabel}. If you expected results, check filters or the ${inProgressLabel} stage.`,
  };
}

export function getProspectWaitingStateCopy({
  entityPlural,
}: ProspectWaitingStateCopyArgs): ProspectWaitingStateCopy {
  return {
    message: `Agent is preparing your ${lower(entityPlural)}. They will appear here in 5 to 30 minutes.`,
  };
}

export function shouldShowProspectWaitingState(args: {
  actionableReadyCount: number;
  systemMode: WorkspaceSystemMode;
}): boolean {
  return args.actionableReadyCount === 0 && args.systemMode === "running";
}
