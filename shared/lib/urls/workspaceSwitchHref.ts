import { isWorkspaceEntityRouteSlug } from "../workspaceRoutes";

const AGENT_ROUTE_PREFIX = "/agent";

export function shouldExitAgentOnWorkspaceSwitch(
  pathname: string | null | undefined
): boolean {
  if (!pathname) {
    return false;
  }

  return (
    pathname === AGENT_ROUTE_PREFIX ||
    pathname.startsWith(`${AGENT_ROUTE_PREFIX}/`)
  );
}

export function getWorkspaceSwitchHref(
  pathname: string | null | undefined
): string | null {
  const segments = pathname?.split("/").filter(Boolean) ?? [];
  const isProspectDetail =
    segments.length === 2 && isWorkspaceEntityRouteSlug(segments[0]);
  // A person URL belongs to the old workspace. Do not relabel that person's
  // profile using the new workspace's pipeline while retaining their ID.
  return shouldExitAgentOnWorkspaceSwitch(pathname) || isProspectDetail
    ? "/"
    : null;
}
