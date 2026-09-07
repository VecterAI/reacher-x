/** Active workflow copy shared by the global status dialog and onboarding progress. */
export function getRunningWorkspaceStatusCopy({
  discoveryVerb,
  entityPlural,
  useCaseName,
}: {
  discoveryVerb: string;
  entityPlural: string;
  useCaseName: string;
}) {
  return {
    tooltip: "△ Agent is active",
    title: `△ Agent is actively ${discoveryVerb} and qualifying ${entityPlural.toLowerCase()}.`,
    meta: `${useCaseName} pipeline`,
  };
}

export function getRecoveringWorkspaceStatusCopy({
  entityPlural,
  useCaseName,
}: {
  entityPlural: string;
  useCaseName: string;
}) {
  return {
    tooltip: "△ Agent is still running and retrying automatically",
    title: `△ Agent is still running and retrying automatically while it works on ${entityPlural.toLowerCase()}.`,
    meta: `${useCaseName} recovering`,
  };
}

export const DISCOVERY_CONFIGURATION_MESSAGE =
  "Search is unavailable because a discovery service is not configured. Contact support to restore search, then retry.";
