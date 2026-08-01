import {
  NEW_WORKSPACE_SETUP_AUTH_RETURN_TO,
  SETUP_AUTH_RETURN_TO,
} from "../../../shared/lib/urls/authRoutes";
import { buildSetupHref } from "../../../shared/lib/urls/setupHref";

export function resolveAuthenticatedLandingSetupHref(
  requiresFirstWorkspace: boolean,
  activeSetupThreadId?: string | null
): string {
  if (activeSetupThreadId) {
    return buildSetupHref(activeSetupThreadId);
  }

  return requiresFirstWorkspace
    ? SETUP_AUTH_RETURN_TO
    : NEW_WORKSPACE_SETUP_AUTH_RETURN_TO;
}

export function isLandingWorkspaceCapacityBlocked({
  isAuthenticated,
  requiresFirstWorkspace,
  hasActiveNewWorkspaceDraft,
  workspaceCreationAllowed,
}: {
  isAuthenticated: boolean;
  requiresFirstWorkspace: boolean;
  hasActiveNewWorkspaceDraft: boolean;
  workspaceCreationAllowed: boolean | undefined;
}): boolean {
  return Boolean(
    isAuthenticated &&
    !requiresFirstWorkspace &&
    !hasActiveNewWorkspaceDraft &&
    workspaceCreationAllowed === false
  );
}
