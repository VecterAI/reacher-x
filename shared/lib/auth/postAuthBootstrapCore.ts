import { buildSetupHref } from "../urls/setupHref";

export type PostAuthUserProfile = {
  workosUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
};

export type PostAuthSetupBootstrapState = {
  activeSession: { threadId: string } | null;
  suggestedMode: "first_workspace" | "new_workspace" | "refine" | null;
  requiresFirstWorkspace: boolean;
};

export type PostAuthBootstrapResult = {
  setupHref: string | null;
  requiresFirstWorkspace: boolean;
  resumedExistingSession: boolean;
};

export type PostAuthBootstrapOperations = {
  upsertUser: (user: PostAuthUserProfile) => Promise<unknown>;
  getSetupBootstrapState: () => Promise<PostAuthSetupBootstrapState>;
  startFirstWorkspaceSetup: () => Promise<{ threadId: string }>;
};

/**
 * Provision the authenticated user and resolve whether first-workspace setup
 * still owns the post-auth destination.
 */
export async function resolvePostAuthSetupHref(
  user: PostAuthUserProfile,
  operations: PostAuthBootstrapOperations
): Promise<PostAuthBootstrapResult> {
  await operations.upsertUser(user);

  const bootstrapState = await operations.getSetupBootstrapState();
  if (bootstrapState.activeSession?.threadId) {
    return {
      setupHref: buildSetupHref(bootstrapState.activeSession.threadId),
      requiresFirstWorkspace: bootstrapState.requiresFirstWorkspace,
      resumedExistingSession: true,
    };
  }

  if (!bootstrapState.requiresFirstWorkspace) {
    return {
      setupHref: null,
      requiresFirstWorkspace: false,
      resumedExistingSession: false,
    };
  }

  const session = await operations.startFirstWorkspaceSetup();
  return {
    setupHref: buildSetupHref(session.threadId),
    requiresFirstWorkspace: true,
    resumedExistingSession: false,
  };
}

export function replaceRedirectLocation(
  response: Response,
  requestUrl: string,
  destination: string | null
): Response {
  if (
    !destination ||
    response.status < 300 ||
    response.status >= 400 ||
    !response.headers.has("location")
  ) {
    return response;
  }

  response.headers.set("location", new URL(destination, requestUrl).toString());
  return response;
}

export function applyPostAuthRedirect(
  response: Response,
  requestUrl: string,
  bootstrapResult: PostAuthBootstrapResult | null
): Response {
  if (!bootstrapResult) {
    return response;
  }

  if (bootstrapResult.requiresFirstWorkspace) {
    const requestedLocation = response.headers.get("location");
    const requestedUrl = requestedLocation
      ? new URL(requestedLocation, requestUrl)
      : null;
    const isExplicitNewWorkspaceDecision =
      requestedUrl?.pathname === "/agent/setup" &&
      requestedUrl.searchParams.get("action") === "newWorkspace";

    if (
      bootstrapResult.resumedExistingSession &&
      isExplicitNewWorkspaceDecision
    ) {
      return response;
    }

    return replaceRedirectLocation(
      response,
      requestUrl,
      bootstrapResult.setupHref
    );
  }

  const requestedLocation = response.headers.get("location");
  if (!requestedLocation) {
    return response;
  }

  const requestedUrl = new URL(requestedLocation, requestUrl);
  const isBareSetupDestination =
    requestedUrl.pathname === "/agent/setup" &&
    !requestedUrl.searchParams.has("threadId") &&
    requestedUrl.searchParams.get("action") !== "newWorkspace";

  return isBareSetupDestination
    ? replaceRedirectLocation(response, requestUrl, "/")
    : response;
}
