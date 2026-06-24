import type { Doc } from "../_generated/dataModel";
import {
  getComposerLimitFromEffectiveLimit,
  inferPostLimitFromSubscriptionType,
} from "../../shared/lib/twitter/xPostTextLimit";
import { X_CORE_SCOPES } from "./xScopes";

export type XAccountStatus =
  | "connected"
  | "expired"
  | "reconnect_required"
  | "disconnected";

export type ConnectionStyleSyncIssue = {
  key: string;
  lastError?: string;
};

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
  connectedAt?: number;
  xSubscriptionType?: "None" | "Basic" | "Premium" | "PremiumPlus";
  postComposerMaxLength?: number;
  postComposerCountMode?: "raw" | "x_post";
  verified?: boolean;
  styleSyncIssue?: ConnectionStyleSyncIssue;
};

export function getMissingXScopes(grantedScopes: string[]): string[] {
  const granted = new Set(grantedScopes);
  return [...X_CORE_SCOPES].filter((scope) => !granted.has(scope));
}

export function buildDisconnectedXConnectionStatus(): XConnectionStatus {
  return {
    isConnected: false,
    status: "disconnected",
    missingScopes: [...X_CORE_SCOPES],
  };
}

export function toStoredXConnectionStatus(
  account: Doc<"xAccounts"> | null | undefined
): XConnectionStatus {
  if (!account) {
    return buildDisconnectedXConnectionStatus();
  }

  const missingScopes = getMissingXScopes(account.grantedScopes ?? []);
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

export function isStoredXConnectionReadyForSetup(
  status: Pick<XConnectionStatus, "isConnected" | "status" | "missingScopes">
): boolean {
  return (
    status.isConnected &&
    status.status === "connected" &&
    (status.missingScopes?.length ?? 0) === 0
  );
}
