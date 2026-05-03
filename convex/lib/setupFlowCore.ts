import type { Doc } from "../_generated/dataModel";

export type SetupVisibleStepId =
  | "use_case"
  | "input"
  | "connections"
  | "plan"
  | "preference";

export type SetupVisibleStep = {
  id: SetupVisibleStepId;
  label: string;
  stepNumber: number;
};

type SetupStatus = Doc<"workspaceSetupSessions">["status"];
export type SetupPostProvisioningStatus =
  | "awaiting_connections"
  | "awaiting_plan"
  | "awaiting_preferences";
export type SetupInputPhase =
  | "collecting_input"
  | "generating_icps"
  | "awaiting_icp_approval"
  | "provisioning_preview_workspace"
  | "discovering_preview_prospects"
  | "awaiting_preview_approval"
  | null;

const STEP_LABELS: Record<SetupVisibleStepId, string> = {
  use_case: "Use case",
  input: "Audience",
  connections: "Connections",
  plan: "Plan",
  preference: "Preferences",
};

const ORDERED_STEP_IDS: SetupVisibleStepId[] = [
  "use_case",
  "input",
  "connections",
  "plan",
  "preference",
];

export function getSetupStatusStepId(status: SetupStatus): SetupVisibleStepId {
  switch (status) {
    case "draft":
      return "use_case";
    case "awaiting_input":
    case "generating_profiles":
    case "awaiting_icp_confirmation":
    case "provisioning_preview_workspace":
    case "discovering_preview_prospects":
    case "awaiting_preview_confirmation":
    case "failed":
    case "discarded":
      return "input";
    case "awaiting_connections":
      return "connections";
    case "awaiting_plan":
      return "plan";
    case "awaiting_preferences":
    case "ready":
      return "preference";
    default:
      return "input";
  }
}

export function buildVisibleSetupSteps(args: {
  requiresConnections: boolean;
  requiresPlan: boolean;
}): SetupVisibleStep[] {
  const ids = ORDERED_STEP_IDS.filter((stepId) => {
    if (stepId === "connections") {
      return args.requiresConnections;
    }
    if (stepId === "plan") {
      return args.requiresPlan;
    }
    return true;
  });

  return ids.map((id, index) => ({
    id,
    label: STEP_LABELS[id],
    stepNumber: index + 1,
  }));
}

function resolveVisibleCurrentStepId(args: {
  status: SetupStatus;
  visibleSteps: SetupVisibleStep[];
}): SetupVisibleStepId {
  const desiredStepId = getSetupStatusStepId(args.status);
  if (args.visibleSteps.some((step) => step.id === desiredStepId)) {
    return desiredStepId;
  }

  const desiredIndex = ORDERED_STEP_IDS.indexOf(desiredStepId);
  const fallback =
    args.visibleSteps.find(
      (step) => ORDERED_STEP_IDS.indexOf(step.id) > desiredIndex
    ) ?? args.visibleSteps[args.visibleSteps.length - 1];

  return fallback?.id ?? "input";
}

export function getNextSetupStatusAfterProvisioning(args: {
  requiresConnections: boolean;
  requiresPlan: boolean;
}): SetupPostProvisioningStatus {
  if (args.requiresConnections) {
    return "awaiting_connections";
  }
  if (args.requiresPlan) {
    return "awaiting_plan";
  }
  return "awaiting_preferences";
}

export function getNextSetupStatusAfterConnections(args: {
  requiresPlan: boolean;
}): Exclude<SetupPostProvisioningStatus, "awaiting_connections"> {
  return args.requiresPlan ? "awaiting_plan" : "awaiting_preferences";
}

export function getSetupInputPhase(
  status: SetupStatus
): SetupInputPhase | null {
  switch (status) {
    case "awaiting_input":
    case "failed":
      return "collecting_input";
    case "generating_profiles":
      return "generating_icps";
    case "awaiting_icp_confirmation":
      return "awaiting_icp_approval";
    case "provisioning_preview_workspace":
      return "provisioning_preview_workspace";
    case "discovering_preview_prospects":
      return "discovering_preview_prospects";
    case "awaiting_preview_confirmation":
      return "awaiting_preview_approval";
    default:
      return null;
  }
}

export function buildSetupFlowState(args: {
  status: SetupStatus;
  requiresConnections: boolean;
  requiresPlan: boolean;
}): {
  currentStepId: SetupVisibleStepId;
  currentStepNumber: number;
  totalSteps: number;
  visibleSteps: SetupVisibleStep[];
  inputPhase: SetupInputPhase | null;
  composerLocked: boolean;
  requiresConnections: boolean;
  requiresPlan: boolean;
} {
  const visibleSteps = buildVisibleSetupSteps({
    requiresConnections: args.requiresConnections,
    requiresPlan: args.requiresPlan,
  });
  const currentStepId = resolveVisibleCurrentStepId({
    status: args.status,
    visibleSteps,
  });
  const currentStepNumber =
    visibleSteps.find((step) => step.id === currentStepId)?.stepNumber ?? 1;

  return {
    currentStepId,
    currentStepNumber,
    totalSteps: visibleSteps.length,
    visibleSteps,
    inputPhase: getSetupInputPhase(args.status),
    composerLocked: args.status !== "ready" && args.status !== "discarded",
    requiresConnections: args.requiresConnections,
    requiresPlan: args.requiresPlan,
  };
}
