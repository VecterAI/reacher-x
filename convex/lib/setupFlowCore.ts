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

/** Lean chat-first finish statuses after preview approval / connections / plan. */
export type SetupPostProvisioningStatus =
  | "awaiting_connections"
  | "awaiting_plan"
  | "ready";

export type SetupInputPhase =
  | "collecting_input"
  | "generating_icps"
  | "awaiting_icp_approval"
  | "provisioning_preview_workspace"
  | "discovering_preview_prospects"
  | "preview_search_in_progress"
  | "awaiting_preview_approval"
  | null;

const STEP_LABELS: Record<SetupVisibleStepId, string> = {
  use_case: "Use case",
  input: "Audience",
  connections: "Connections",
  plan: "Plan",
  preference: "Preferences",
};

/**
 * Lean chat-first visible steps.
 * Use-case is auto-detected; preferences are dropped (fit 70–100 on finish).
 * `use_case` / `preference` remain in the type for older session UI fallbacks.
 */
const ORDERED_STEP_IDS: SetupVisibleStepId[] = ["input", "plan"];

/** Statuses where the setup chat composer stays unlocked. */
const COMPOSER_UNLOCKED_STATUSES = new Set<SetupStatus>([
  "draft",
  "awaiting_input",
  "awaiting_icp_confirmation",
  "ready",
  "failed",
  "discarded",
]);

export function getSetupStatusStepId(status: SetupStatus): SetupVisibleStepId {
  switch (status) {
    case "draft":
    case "awaiting_input":
    case "generating_profiles":
    case "awaiting_icp_confirmation":
    case "provisioning_preview_workspace":
    case "discovering_preview_prospects":
    case "preview_search_in_progress":
    case "awaiting_preview_confirmation":
    case "failed":
    case "discarded":
      return "input";
    case "awaiting_connections":
      return "plan";
    case "awaiting_plan":
      return "plan";
    case "awaiting_preferences":
      // Legacy sessions: map to last lean step until they finish.
      return "plan";
    case "ready":
      return "plan";
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
  if (args.requiresPlan) {
    return "awaiting_plan";
  }
  return "ready";
}

export function getNextSetupStatusAfterConnections(args: {
  requiresPlan: boolean;
}): Exclude<SetupPostProvisioningStatus, "awaiting_connections"> {
  return args.requiresPlan ? "awaiting_plan" : "ready";
}

/** Compatibility for callers holding the retired connection-step fields. */
export function requiresSetupConnectionsStep(_args: {
  status: SetupStatus;
  googleConnected: boolean;
  xConnected: boolean;
}): boolean {
  return false;
}

export function getVisibleSetupStatus(args: {
  status: SetupStatus;
  requiresConnections: boolean;
  connectionsCompletedAt?: number | null;
}): SetupStatus {
  return args.status === "awaiting_connections" ? "awaiting_plan" : args.status;
}

export function getSetupInputPhase(
  status: SetupStatus
): SetupInputPhase | null {
  switch (status) {
    case "draft":
    case "awaiting_input":
      return "collecting_input";
    case "failed":
      return null;
    case "generating_profiles":
      return "generating_icps";
    case "awaiting_icp_confirmation":
      return "awaiting_icp_approval";
    case "provisioning_preview_workspace":
      return "provisioning_preview_workspace";
    case "discovering_preview_prospects":
      return "discovering_preview_prospects";
    case "preview_search_in_progress":
      return "preview_search_in_progress";
    case "awaiting_preview_confirmation":
      return "awaiting_preview_approval";
    default:
      return null;
  }
}

export function isSetupComposerLocked(status: SetupStatus): boolean {
  return !COMPOSER_UNLOCKED_STATUSES.has(status);
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
    requiresConnections: false,
    // A grant can satisfy payment while this persisted step still needs the
    // user's final Continue. Keep that action visible until setup is ready.
    requiresPlan:
      args.requiresPlan ||
      args.status === "awaiting_connections" ||
      args.status === "awaiting_plan" ||
      args.status === "awaiting_preferences",
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
    composerLocked: isSetupComposerLocked(args.status),
    requiresConnections: false,
    requiresPlan: args.requiresPlan,
  };
}
