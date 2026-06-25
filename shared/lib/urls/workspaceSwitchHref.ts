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
  return shouldExitAgentOnWorkspaceSwitch(pathname) ? "/" : null;
}
