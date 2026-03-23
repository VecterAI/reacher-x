export type SetupPanelStepId =
  | "use_case"
  | "input"
  | "connections"
  | "plan"
  | "preference";

export const SETUP_PANEL_STEP_TITLES: Record<SetupPanelStepId, string> = {
  use_case: "Who to reach?",
  input: "Your audience",
  connections: "Connect accounts",
  plan: "Plans",
  preference: "Preferences",
};

export function getSetupPanelStepTitle(stepId: string | undefined): string {
  if (!stepId) return "Workspace setup";
  return (
    SETUP_PANEL_STEP_TITLES[stepId as SetupPanelStepId] ?? "Workspace setup"
  );
}
