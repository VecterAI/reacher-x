import { XDK_PACKAGE_VERSION } from "./xdkConstants";

export type TwitterActionRiskLevel =
  | "read_safe"
  | "write_low_risk"
  | "write_medium_risk"
  | "write_high_risk";

export type TwitterActionApprovalMode =
  | "auto_execute"
  | "confirm_first"
  | "always_approval";

export type TwitterActionEntityType =
  | "post"
  | "user"
  | "dm"
  | "list"
  | "space"
  | "account"
  | "other";

export type TwitterActionUiArtifactType =
  | "post_action"
  | "profile_action"
  | "composer_action"
  | "message_action"
  | "generic_action";

export type SocialActionPlatform = "twitter" | "linkedin";
export type SocialActionProvider =
  | "composio_twitter"
  | "x_twitter_sdk"
  | "linkedin_unipile";

export type CuratedTwitterActionKey =
  | "like_post"
  | "unlike_post"
  | "bookmark_post"
  | "unbookmark_post"
  | "retweet_post"
  | "unretweet_post"
  | "follow_user"
  | "unfollow_user"
  | "reply_to_post"
  | "create_post"
  | "send_dm"
  | "send_dm_in_existing_conversation"
  | "linkedin_send_message"
  | "linkedin_send_message_existing_conversation"
  | "linkedin_invite_user"
  | "linkedin_react_to_post"
  | "linkedin_comment_on_post";

export interface TwitterActionCatalogEntry {
  actionKey: CuratedTwitterActionKey;
  platform: SocialActionPlatform;
  provider: SocialActionProvider;
  toolSlug: string;
  toolVersion: string;
  riskLevel: TwitterActionRiskLevel;
  approvalMode: TwitterActionApprovalMode;
  uiArtifactType: TwitterActionUiArtifactType;
  entityType: TwitterActionEntityType;
  requiresConnectedAccount: boolean;
  requiredScopes: string[];
}

const CATALOG: Record<CuratedTwitterActionKey, TwitterActionCatalogEntry> = {
  like_post: {
    actionKey: "like_post",
    platform: "twitter",
    provider: "x_twitter_sdk",
    toolSlug: "xdk.like_post",
    toolVersion: XDK_PACKAGE_VERSION,
    riskLevel: "write_low_risk",
    approvalMode: "auto_execute",
    uiArtifactType: "post_action",
    entityType: "post",
    requiresConnectedAccount: true,
    requiredScopes: ["tweet.read", "users.read", "like.write"],
  },
  unlike_post: {
    actionKey: "unlike_post",
    platform: "twitter",
    provider: "x_twitter_sdk",
    toolSlug: "xdk.unlike_post",
    toolVersion: XDK_PACKAGE_VERSION,
    riskLevel: "write_low_risk",
    approvalMode: "auto_execute",
    uiArtifactType: "post_action",
    entityType: "post",
    requiresConnectedAccount: true,
    requiredScopes: ["tweet.read", "users.read", "like.write"],
  },
  bookmark_post: {
    actionKey: "bookmark_post",
    platform: "twitter",
    provider: "x_twitter_sdk",
    toolSlug: "xdk.bookmark_post",
    toolVersion: XDK_PACKAGE_VERSION,
    riskLevel: "write_low_risk",
    approvalMode: "auto_execute",
    uiArtifactType: "post_action",
    entityType: "post",
    requiresConnectedAccount: true,
    requiredScopes: ["tweet.read", "users.read", "bookmark.write"],
  },
  unbookmark_post: {
    actionKey: "unbookmark_post",
    platform: "twitter",
    provider: "x_twitter_sdk",
    toolSlug: "xdk.unbookmark_post",
    toolVersion: XDK_PACKAGE_VERSION,
    riskLevel: "write_low_risk",
    approvalMode: "auto_execute",
    uiArtifactType: "post_action",
    entityType: "post",
    requiresConnectedAccount: true,
    requiredScopes: ["tweet.read", "users.read", "bookmark.write"],
  },
  retweet_post: {
    actionKey: "retweet_post",
    platform: "twitter",
    provider: "x_twitter_sdk",
    toolSlug: "xdk.retweet_post",
    toolVersion: XDK_PACKAGE_VERSION,
    riskLevel: "write_medium_risk",
    approvalMode: "confirm_first",
    uiArtifactType: "post_action",
    entityType: "post",
    requiresConnectedAccount: true,
    requiredScopes: ["tweet.read", "users.read", "tweet.write"],
  },
  unretweet_post: {
    actionKey: "unretweet_post",
    platform: "twitter",
    provider: "x_twitter_sdk",
    toolSlug: "xdk.unretweet_post",
    toolVersion: XDK_PACKAGE_VERSION,
    riskLevel: "write_medium_risk",
    approvalMode: "confirm_first",
    uiArtifactType: "post_action",
    entityType: "post",
    requiresConnectedAccount: true,
    requiredScopes: ["tweet.read", "users.read", "tweet.write"],
  },
  follow_user: {
    actionKey: "follow_user",
    platform: "twitter",
    provider: "x_twitter_sdk",
    toolSlug: "xdk.follow_user",
    toolVersion: XDK_PACKAGE_VERSION,
    riskLevel: "write_medium_risk",
    approvalMode: "confirm_first",
    uiArtifactType: "profile_action",
    entityType: "user",
    requiresConnectedAccount: true,
    requiredScopes: ["tweet.read", "users.read", "follows.write"],
  },
  unfollow_user: {
    actionKey: "unfollow_user",
    platform: "twitter",
    provider: "x_twitter_sdk",
    toolSlug: "xdk.unfollow_user",
    toolVersion: XDK_PACKAGE_VERSION,
    riskLevel: "write_medium_risk",
    approvalMode: "confirm_first",
    uiArtifactType: "profile_action",
    entityType: "user",
    requiresConnectedAccount: true,
    requiredScopes: ["tweet.read", "users.read", "follows.write"],
  },
  reply_to_post: {
    actionKey: "reply_to_post",
    platform: "twitter",
    provider: "x_twitter_sdk",
    toolSlug: "xdk.reply_to_post",
    toolVersion: XDK_PACKAGE_VERSION,
    riskLevel: "write_high_risk",
    approvalMode: "always_approval",
    uiArtifactType: "composer_action",
    entityType: "post",
    requiresConnectedAccount: true,
    requiredScopes: ["tweet.read", "users.read", "tweet.write", "media.write"],
  },
  create_post: {
    actionKey: "create_post",
    platform: "twitter",
    provider: "x_twitter_sdk",
    toolSlug: "xdk.create_post",
    toolVersion: XDK_PACKAGE_VERSION,
    riskLevel: "write_high_risk",
    approvalMode: "always_approval",
    uiArtifactType: "composer_action",
    entityType: "post",
    requiresConnectedAccount: true,
    requiredScopes: ["tweet.read", "users.read", "tweet.write", "media.write"],
  },
  send_dm: {
    actionKey: "send_dm",
    platform: "twitter",
    provider: "x_twitter_sdk",
    toolSlug: "xdk.send_dm",
    toolVersion: XDK_PACKAGE_VERSION,
    riskLevel: "write_high_risk",
    approvalMode: "always_approval",
    uiArtifactType: "message_action",
    entityType: "dm",
    requiresConnectedAccount: true,
    requiredScopes: ["tweet.read", "users.read", "dm.write"],
  },
  send_dm_in_existing_conversation: {
    actionKey: "send_dm_in_existing_conversation",
    platform: "twitter",
    provider: "x_twitter_sdk",
    toolSlug: "xdk.send_dm_in_existing_conversation",
    toolVersion: XDK_PACKAGE_VERSION,
    riskLevel: "write_high_risk",
    approvalMode: "confirm_first",
    uiArtifactType: "message_action",
    entityType: "dm",
    requiresConnectedAccount: true,
    requiredScopes: ["tweet.read", "users.read", "dm.write"],
  },
  linkedin_send_message: {
    actionKey: "linkedin_send_message",
    platform: "linkedin",
    provider: "linkedin_unipile",
    toolSlug: "linkedin.send_message",
    toolVersion: "unipile-node-sdk",
    riskLevel: "write_high_risk",
    approvalMode: "always_approval",
    uiArtifactType: "message_action",
    entityType: "dm",
    requiresConnectedAccount: true,
    requiredScopes: [],
  },
  linkedin_send_message_existing_conversation: {
    actionKey: "linkedin_send_message_existing_conversation",
    platform: "linkedin",
    provider: "linkedin_unipile",
    toolSlug: "linkedin.send_message_existing_conversation",
    toolVersion: "unipile-node-sdk",
    riskLevel: "write_high_risk",
    approvalMode: "confirm_first",
    uiArtifactType: "message_action",
    entityType: "dm",
    requiresConnectedAccount: true,
    requiredScopes: [],
  },
  linkedin_invite_user: {
    actionKey: "linkedin_invite_user",
    platform: "linkedin",
    provider: "linkedin_unipile",
    toolSlug: "linkedin.invite_user",
    toolVersion: "unipile-node-sdk",
    riskLevel: "write_high_risk",
    approvalMode: "always_approval",
    uiArtifactType: "profile_action",
    entityType: "user",
    requiresConnectedAccount: true,
    requiredScopes: [],
  },
  linkedin_react_to_post: {
    actionKey: "linkedin_react_to_post",
    platform: "linkedin",
    provider: "linkedin_unipile",
    toolSlug: "linkedin.react_to_post",
    toolVersion: "unipile-node-sdk",
    riskLevel: "write_medium_risk",
    approvalMode: "confirm_first",
    uiArtifactType: "post_action",
    entityType: "post",
    requiresConnectedAccount: true,
    requiredScopes: [],
  },
  linkedin_comment_on_post: {
    actionKey: "linkedin_comment_on_post",
    platform: "linkedin",
    provider: "linkedin_unipile",
    toolSlug: "linkedin.comment_on_post",
    toolVersion: "unipile-node-sdk",
    riskLevel: "write_high_risk",
    approvalMode: "always_approval",
    uiArtifactType: "composer_action",
    entityType: "post",
    requiresConnectedAccount: true,
    requiredScopes: [],
  },
};

export function getTwitterActionCatalogEntry(
  actionKey: CuratedTwitterActionKey
): TwitterActionCatalogEntry {
  return CATALOG[actionKey];
}

export function isLinkedInActionKey(
  actionKey: string
): actionKey is Extract<CuratedTwitterActionKey, `linkedin_${string}`> {
  return actionKey.startsWith("linkedin_");
}

export function isSocialDmActionKey(actionKey: string): boolean {
  return (
    actionKey === "send_dm" ||
    actionKey === "send_dm_in_existing_conversation" ||
    actionKey === "linkedin_send_message" ||
    actionKey === "linkedin_send_message_existing_conversation"
  );
}

export function isSocialTextActionKey(actionKey: string): boolean {
  return (
    actionKey === "reply_to_post" ||
    actionKey === "create_post" ||
    actionKey === "send_dm" ||
    actionKey === "send_dm_in_existing_conversation" ||
    actionKey === "linkedin_send_message" ||
    actionKey === "linkedin_send_message_existing_conversation" ||
    actionKey === "linkedin_comment_on_post" ||
    actionKey === "linkedin_invite_user"
  );
}
