export const SETUP_ROUTE = "/agent/setup";
export const SETUP_PREVIEW_ROUTE = "/agent/setup/preview";

const SETUP_AUTH_QUERY_KEYS = [
  "code",
  "state",
  "error",
  "error_description",
  "linkedin_status",
] as const;

function searchParamsRecord(queryString: string): Record<string, string> {
  const params = new URLSearchParams(queryString);
  const out: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    out[key] = value;
  }
  return out;
}

export function areSearchParamsEquivalent(
  left: string,
  right: string
): boolean {
  if (left === right) {
    return true;
  }
  const leftParams = searchParamsRecord(left);
  const rightParams = searchParamsRecord(right);
  const keys = new Set([
    ...Object.keys(leftParams),
    ...Object.keys(rightParams),
  ]);
  for (const key of keys) {
    if (leftParams[key] !== rightParams[key]) {
      return false;
    }
  }
  return true;
}

export function hasSetupAuthResultParams(queryString: string): boolean {
  const params = new URLSearchParams(queryString);
  return SETUP_AUTH_QUERY_KEYS.some((key) => params.has(key));
}

export type OnboardingNavigationAction =
  | { kind: "none" }
  | { kind: "replace"; href: string };

export function resolveOnboardingNavigationAction(args: {
  activeContextType: "workspace" | "setup_session" | null;
  currentQueryString: string;
  isDevelopmentSetupPreview: boolean;
  locked: boolean;
  pathname: string;
  targetLockedUrl: string;
}): OnboardingNavigationAction {
  const isNewWorkspaceDecisionRoute =
    args.pathname === SETUP_ROUTE &&
    new URLSearchParams(args.currentQueryString).get("action") ===
      "newWorkspace";

  if (args.isDevelopmentSetupPreview) {
    return { kind: "none" };
  }

  if (
    args.pathname === SETUP_ROUTE &&
    hasSetupAuthResultParams(args.currentQueryString)
  ) {
    return { kind: "none" };
  }

  if (args.locked && args.pathname !== SETUP_ROUTE) {
    return { kind: "replace", href: args.targetLockedUrl };
  }

  const targetLockedQuery = args.targetLockedUrl.includes("?")
    ? args.targetLockedUrl.split("?")[1]
    : "";
  const shellWantsBareSetup =
    args.targetLockedUrl === SETUP_ROUTE ||
    args.targetLockedUrl === `${SETUP_ROUTE}?`;

  if (
    args.locked &&
    args.pathname === SETUP_ROUTE &&
    !isNewWorkspaceDecisionRoute &&
    !areSearchParamsEquivalent(args.currentQueryString, targetLockedQuery)
  ) {
    if (
      shellWantsBareSetup &&
      args.activeContextType !== "setup_session" &&
      new URLSearchParams(args.currentQueryString).has("threadId")
    ) {
      return { kind: "none" };
    }
    return { kind: "replace", href: args.targetLockedUrl };
  }

  if (
    !args.locked &&
    args.pathname === SETUP_ROUTE &&
    !isNewWorkspaceDecisionRoute
  ) {
    return { kind: "replace", href: "/" };
  }

  return { kind: "none" };
}
