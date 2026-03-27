"use node";

import { randomUUID } from "node:crypto";
import { generateCodeChallenge, generateCodeVerifier } from "@xdevplatform/xdk";
import type { Id } from "../_generated/dataModel";
import { decryptXSecret, encryptXSecret } from "./xdkCrypto";
import {
  X_CORE_SCOPES,
  buildXClient,
  computeXTokenExpiry,
  createXOAuth2,
  getDefaultXRedirectUri,
  parseGrantedScopes,
} from "./xdkClient";
import {
  getXExecutionFailure,
  type XProviderContext,
} from "./xdkTwitterProvider";
import {
  getComposerLimitFromEffectiveLimit,
  inferPostLimitFromSubscriptionType,
} from "../../shared/lib/twitter/xPostTextLimit";

/** GET /2/users/me user.fields — https://docs.x.com/x-api/users/get-my-user */
const USER_ME_FIELDS = [
  "id",
  "name",
  "username",
  "profile_image_url",
  "verified",
  "verified_type",
  "subscription_type",
  "subscription",
] as const;

function parseXSubscriptionTypeForStored(
  raw: unknown
): "None" | "Basic" | "Premium" | "PremiumPlus" | undefined {
  if (
    raw === "None" ||
    raw === "Basic" ||
    raw === "Premium" ||
    raw === "PremiumPlus"
  ) {
    return raw;
  }
  return undefined;
}

type XStoreRefs = {
  getXAccountForUserInternal: unknown;
  upsertXAccountInternal: unknown;
  patchXAccountInternal: unknown;
  deleteXAccountInternal: unknown;
  createXAuthSessionInternal: unknown;
  getXAuthSessionByStateInternal: unknown;
  completeXAuthSessionInternal: unknown;
};

export type XAccountStatus =
  | "connected"
  | "expired"
  | "reconnect_required"
  | "disconnected";

export type XConnectionStatus = {
  isConnected: boolean;
  status: XAccountStatus;
  connectedAccountId?: string;
  xUserId?: string;
  screenName?: string;
  name?: string;
  profileImageUrl?: string;
  grantedScopes?: string[];
  missingScopes?: string[];
  expiresAt?: number;
  /** When the X account row was first stored (Convex `_creationTime`), ms since epoch. */
  connectedAt?: number;
  /** From GET /2/users/me `subscription_type` (cached on `xAccounts`). */
  xSubscriptionType?: "None" | "Basic" | "Premium" | "PremiumPlus";
  /** Precomputed for post/reply composer validation. */
  postComposerMaxLength?: number;
  postComposerCountMode?: "raw" | "x_post";
  /** True when X reports verified / non-`none` verified_type (blue, government, business). */
  verified?: boolean;
};

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

/** X API user objects may expose camelCase or snake_case for profile image. */
function pickProfileImageUrlFromMe(me: unknown): string | undefined {
  const m = me as Record<string, unknown> | null | undefined;
  return pickString(m?.profileImageUrl, m?.profile_image_url);
}

/** Legacy `verified` or X API v2 `verified_type` (blue, government, business, none). */
function pickVerifiedFromMe(me: unknown): boolean {
  const m = me as Record<string, unknown> | null | undefined;
  if (m?.verified === true) {
    return true;
  }
  const vt = m?.verified_type;
  if (typeof vt === "string" && vt.length > 0 && vt !== "none") {
    return true;
  }
  return false;
}

function getMissingScopes(grantedScopes: string[]): string[] {
  const granted = new Set(grantedScopes);
  return [...X_CORE_SCOPES].filter((scope) => !granted.has(scope));
}

function buildDisconnectedStatus(): XConnectionStatus {
  return {
    isConnected: false,
    status: "disconnected",
    missingScopes: [...X_CORE_SCOPES],
  };
}

function toConnectionStatus(account: any): XConnectionStatus {
  const missingScopes = getMissingScopes(account.grantedScopes ?? []);
  const status: XAccountStatus =
    missingScopes.length > 0 ? "reconnect_required" : account.status;

  const effectiveLimit = inferPostLimitFromSubscriptionType(
    account.xSubscriptionType
  );
  const composer = getComposerLimitFromEffectiveLimit(effectiveLimit);

  return {
    isConnected: status === "connected",
    status,
    connectedAccountId: String(account._id),
    xUserId: account.xUserId,
    screenName: account.username,
    name: account.displayName,
    profileImageUrl: account.profileImageUrl,
    grantedScopes: account.grantedScopes ?? [],
    missingScopes,
    expiresAt: account.expiresAt,
    connectedAt:
      typeof account._creationTime === "number"
        ? account._creationTime
        : undefined,
    xSubscriptionType: account.xSubscriptionType,
    postComposerMaxLength: composer.maxLength,
    postComposerCountMode: composer.characterCountMode,
    verified: account.xVerified === true,
  };
}

async function readStoredAccount(
  ctx: any,
  store: XStoreRefs,
  userId: Id<"users">
) {
  return await ctx.runQuery(store.getXAccountForUserInternal, { userId });
}

async function persistAccount(
  ctx: any,
  store: XStoreRefs,
  args: {
    userId: Id<"users">;
    xUserId: string;
    username: string;
    displayName?: string;
    profileImageUrl?: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt: number;
    grantedScopes: string[];
    tokenType: string;
    status: Exclude<XAccountStatus, "disconnected">;
    lastVerifiedAt?: number;
    lastRefreshAttemptAt?: number;
    lastRefreshError?: string;
    xSubscriptionType?: "None" | "Basic" | "Premium" | "PremiumPlus";
    xSubscriptionUpdatedAt?: number;
    xVerified?: boolean;
    activitySubscriptionStatus?:
      | "unknown"
      | "healthy"
      | "degraded"
      | "pending_retry";
    activitySubscriptionsEnsuredAt?: number;
    activitySubscriptionsLastAttemptAt?: number;
    activitySubscriptionsNextRetryAt?: number;
    activitySubscriptionsLastError?: string;
    activitySubscriptionsLastAuthMode?: "app" | "user";
  }
) {
  const now = Date.now();
  await ctx.runMutation(store.upsertXAccountInternal, {
    ...args,
    accessToken: encryptXSecret(args.accessToken),
    refreshToken: args.refreshToken
      ? encryptXSecret(args.refreshToken)
      : undefined,
    now,
  });
}

async function patchAccount(
  ctx: any,
  store: XStoreRefs,
  userId: Id<"users">,
  patch: Record<string, unknown>
) {
  await ctx.runMutation(store.patchXAccountInternal, {
    userId,
    patch: {
      ...patch,
      updatedAt: Date.now(),
    },
  });
}

export async function beginXAuthorizationForUser(
  ctx: any,
  store: XStoreRefs,
  args: {
    userId: Id<"users">;
    redirectUri?: string;
  }
): Promise<{ redirectUrl: string }> {
  const redirectUri = args.redirectUri ?? getDefaultXRedirectUri();
  const oauth2 = createXOAuth2({ redirectUri, scope: X_CORE_SCOPES });
  const state = randomUUID();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  await oauth2.setPkceParameters(codeVerifier, codeChallenge);

  const redirectUrl = await oauth2.getAuthorizationUrl(state);
  const now = Date.now();
  await ctx.runMutation(store.createXAuthSessionInternal, {
    userId: args.userId,
    state,
    redirectUri,
    codeVerifier: encryptXSecret(codeVerifier),
    expiresAt: now + 15 * 60 * 1000,
  });

  return { redirectUrl };
}

export async function completeXAuthorizationForUser(
  ctx: any,
  store: XStoreRefs,
  args: {
    userId: Id<"users">;
    code: string;
    state: string;
  }
): Promise<XConnectionStatus> {
  const session = await ctx.runQuery(store.getXAuthSessionByStateInternal, {
    state: args.state,
  });
  if (!session || session.userId !== args.userId) {
    throw new Error(
      "X authorization session was not found or no longer valid."
    );
  }
  if (session.completedAt) {
    throw new Error("This X authorization session has already been used.");
  }
  if (session.expiresAt <= Date.now()) {
    throw new Error("This X authorization session has expired. Start again.");
  }

  const codeVerifier = decryptXSecret(session.codeVerifier);
  const oauth2 = createXOAuth2({
    redirectUri: session.redirectUri,
    scope: X_CORE_SCOPES,
  });
  await oauth2.setPkceParameters(codeVerifier);

  const token = await oauth2.exchangeCode(args.code, codeVerifier);
  const client = buildXClient(token.access_token);
  const meResponse = await client.users.getMe({
    userFields: [...USER_ME_FIELDS],
  });
  const me = meResponse.data;
  const grantedScopes = parseGrantedScopes(token);
  const missingScopes = getMissingScopes(grantedScopes);
  const now = Date.now();
  const subType = parseXSubscriptionTypeForStored(
    (me as { subscriptionType?: unknown })?.subscriptionType
  );

  await persistAccount(ctx, store, {
    userId: args.userId,
    xUserId: String(me?.id ?? ""),
    username: pickString(me?.username) ?? "",
    displayName: pickString(me?.name),
    profileImageUrl: pickProfileImageUrlFromMe(me),
    xVerified: pickVerifiedFromMe(me),
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: computeXTokenExpiry(token.expires_in),
    grantedScopes,
    tokenType: token.token_type,
    status: missingScopes.length > 0 ? "reconnect_required" : "connected",
    lastVerifiedAt: now,
    lastRefreshAttemptAt: now,
    lastRefreshError:
      missingScopes.length > 0
        ? `Missing required scopes: ${missingScopes.join(", ")}`
        : undefined,
    xSubscriptionType: subType,
    xSubscriptionUpdatedAt: subType !== undefined ? now : undefined,
  });

  await ctx.runMutation(store.completeXAuthSessionInternal, {
    sessionId: session._id,
    completedAt: now,
  });

  const account = await readStoredAccount(ctx, store, args.userId);
  return account ? toConnectionStatus(account) : buildDisconnectedStatus();
}

async function refreshXAccount(
  ctx: any,
  store: XStoreRefs,
  userId: Id<"users">,
  account: any
) {
  const refreshToken = account.refreshToken
    ? decryptXSecret(account.refreshToken)
    : undefined;

  if (!refreshToken) {
    await patchAccount(ctx, store, userId, {
      status: "reconnect_required",
      lastRefreshAttemptAt: Date.now(),
      lastRefreshError: "Refresh token is missing.",
    });
    throw new Error("Reconnect required: refresh token is missing.");
  }

  const oauth2 = createXOAuth2({
    redirectUri: getDefaultXRedirectUri(),
    scope: X_CORE_SCOPES,
  });
  oauth2.setToken(
    {
      access_token: decryptXSecret(account.accessToken),
      refresh_token: refreshToken,
      expires_in: Math.max(
        0,
        Math.floor((account.expiresAt - Date.now()) / 1000)
      ),
      scope: (account.grantedScopes ?? []).join(" "),
      token_type: account.tokenType,
    },
    account.expiresAt
  );

  const refreshAttemptAt = Date.now();

  try {
    const refreshedToken = await oauth2.refreshToken(refreshToken);
    const client = buildXClient(refreshedToken.access_token);
    const meResponse = await client.users.getMe({
      userFields: [...USER_ME_FIELDS],
    });
    const me = meResponse.data;
    const grantedScopes = parseGrantedScopes(refreshedToken);
    const missingScopes = getMissingScopes(grantedScopes);
    const meSub = parseXSubscriptionTypeForStored(
      (me as { subscriptionType?: unknown })?.subscriptionType
    );
    const xSubscriptionType =
      meSub !== undefined ? meSub : account.xSubscriptionType;
    const xSubscriptionUpdatedAt =
      meSub !== undefined
        ? Date.now()
        : (account.xSubscriptionUpdatedAt as number | undefined);

    await persistAccount(ctx, store, {
      userId,
      xUserId: String(me?.id ?? account.xUserId),
      username: pickString(me?.username, account.username) ?? account.username,
      displayName: pickString(me?.name, account.displayName),
      profileImageUrl: pickProfileImageUrlFromMe(me) ?? account.profileImageUrl,
      xVerified: pickVerifiedFromMe(me),
      accessToken: refreshedToken.access_token,
      refreshToken: refreshedToken.refresh_token ?? refreshToken,
      expiresAt: computeXTokenExpiry(refreshedToken.expires_in),
      grantedScopes,
      tokenType: refreshedToken.token_type,
      status: missingScopes.length > 0 ? "reconnect_required" : "connected",
      lastVerifiedAt: Date.now(),
      lastRefreshAttemptAt: refreshAttemptAt,
      lastRefreshError:
        missingScopes.length > 0
          ? `Missing required scopes: ${missingScopes.join(", ")}`
          : undefined,
      xSubscriptionType,
      xSubscriptionUpdatedAt,
    });
  } catch (error) {
    const failure = getXExecutionFailure(error);
    await patchAccount(ctx, store, userId, {
      status: "reconnect_required",
      lastRefreshAttemptAt: refreshAttemptAt,
      lastRefreshError: failure.message,
    });
    throw error;
  }

  return await readStoredAccount(ctx, store, userId);
}

export async function getXConnectionStatusForUser(
  ctx: any,
  store: XStoreRefs,
  userId: Id<"users">
): Promise<XConnectionStatus> {
  let account = await readStoredAccount(ctx, store, userId);
  if (!account) {
    return buildDisconnectedStatus();
  }

  const missingScopes = getMissingScopes(account.grantedScopes ?? []);
  if (missingScopes.length > 0 && account.status !== "reconnect_required") {
    await patchAccount(ctx, store, userId, {
      status: "reconnect_required",
      lastRefreshError: `Missing required scopes: ${missingScopes.join(", ")}`,
    });
    account = await readStoredAccount(ctx, store, userId);
  }

  if (!account) {
    return buildDisconnectedStatus();
  }

  if (
    account.status !== "reconnect_required" &&
    account.expiresAt <= Date.now() + 60_000
  ) {
    try {
      account = await refreshXAccount(ctx, store, userId, account);
    } catch {
      account = await readStoredAccount(ctx, store, userId);
    }
  }

  if (!account) {
    return buildDisconnectedStatus();
  }

  if (
    account.status === "connected" &&
    account.expiresAt <= Date.now() &&
    account.status !== "reconnect_required"
  ) {
    await patchAccount(ctx, store, userId, {
      status: "expired",
    });
    account = await readStoredAccount(ctx, store, userId);
  }

  return account ? toConnectionStatus(account) : buildDisconnectedStatus();
}

export async function disconnectXForUser(
  ctx: any,
  store: XStoreRefs,
  userId: Id<"users">
) {
  await ctx.runMutation(store.deleteXAccountInternal, { userId });
}

export async function getXProviderContextForUser(
  ctx: any,
  store: XStoreRefs,
  args: {
    userId: Id<"users">;
    requiredScopes?: string[];
  }
): Promise<XProviderContext> {
  let account = await readStoredAccount(ctx, store, args.userId);
  if (!account) {
    throw new Error(
      "No X account is connected. Connect X in Settings -> Connected accounts."
    );
  }

  const missingScopes = (args.requiredScopes ?? []).filter(
    (scope) => !(account.grantedScopes ?? []).includes(scope)
  );
  if (missingScopes.length > 0) {
    await patchAccount(ctx, store, args.userId, {
      status: "reconnect_required",
      lastRefreshError: `Missing required scopes: ${missingScopes.join(", ")}`,
    });
    throw new Error(
      `Reconnect required: missing scopes ${missingScopes.join(", ")}.`
    );
  }

  if (
    account.status === "reconnect_required" ||
    account.expiresAt <= Date.now() + 60_000
  ) {
    account = await refreshXAccount(ctx, store, args.userId, account);
  }

  if (!account || account.status !== "connected") {
    throw new Error("Reconnect required: the stored X account is not active.");
  }

  return {
    client: buildXClient(decryptXSecret(account.accessToken)),
    xUserId: account.xUserId,
    username: account.username,
    connectedAccountId: String(account._id),
  };
}
