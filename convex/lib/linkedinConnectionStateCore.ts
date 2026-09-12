import type { Doc } from "../_generated/dataModel";

export function toConnectionStatus(account: Doc<"linkedinAccounts"> | null) {
  if (!account) {
    return {
      isConnected: false,
      status: "disconnected" as const,
    };
  }

  return {
    isConnected: account.status === "connected",
    status: account.status,
    accountId: account.accountId,
    providerId: account.providerId,
    entityUrn: account.entityUrn,
    username: account.username,
    publicIdentifier: account.publicIdentifier,
    displayName: account.displayName,
    headline: account.headline,
    profileImageUrl: account.profileImageUrl,
    publicProfileUrl: account.publicProfileUrl,
    premiumFeatures: account.premiumFeatures ?? [],
    connectedAt:
      typeof account._creationTime === "number"
        ? account._creationTime
        : undefined,
  };
}
