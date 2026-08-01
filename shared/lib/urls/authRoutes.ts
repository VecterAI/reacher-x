const DEFAULT_AUTH_RETURN_TO = "/";
const AUTH_RETURN_TO_BASE_URL = "https://reacherx.invalid";

export type AuthRouteHref =
  | "/login"
  | "/signup"
  | "/logout"
  | `/login?${string}`
  | `/signup?${string}`
  | `/logout?${string}`;

export const SETUP_AUTH_RETURN_TO = "/agent/setup";
export const NEW_WORKSPACE_SETUP_AUTH_RETURN_TO =
  "/agent/setup?action=newWorkspace";
export const LOGIN_HREF: AuthRouteHref = "/login";
export const SETUP_SIGN_UP_HREF: AuthRouteHref = "/signup";
export const LOGOUT_HREF: AuthRouteHref = "/logout";

export function resolveAuthReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_AUTH_RETURN_TO;
  }

  try {
    const resolved = new URL(value, AUTH_RETURN_TO_BASE_URL);
    if (resolved.origin !== AUTH_RETURN_TO_BASE_URL) {
      return DEFAULT_AUTH_RETURN_TO;
    }

    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return DEFAULT_AUTH_RETURN_TO;
  }
}

export function buildLoginHref(returnTo: string): AuthRouteHref {
  const params = new URLSearchParams({ returnTo });
  return `/login?${params.toString()}`;
}
