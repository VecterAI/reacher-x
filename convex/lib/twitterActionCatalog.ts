"use node";

import { XDK_PACKAGE_VERSION } from "./xdkClient";

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
  | "send_dm_in_existing_conversation";

export interface TwitterActionCatalogEntry {
  actionKey: CuratedTwitterActionKey;
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
    toolSlug: "xdk.reply_to_post",
    toolVersion: XDK_PACKAGE_VERSION,
    riskLevel: "write_high_risk",
    approvalMode: "always_approval",
    uiArtifactType: "composer_action",
    entityType: "post",
    requiresConnectedAccount: true,
    requiredScopes: ["tweet.read", "users.read", "tweet.write"],
  },
  create_post: {
    actionKey: "create_post",
    toolSlug: "xdk.create_post",
    toolVersion: XDK_PACKAGE_VERSION,
    riskLevel: "write_high_risk",
    approvalMode: "always_approval",
    uiArtifactType: "composer_action",
    entityType: "post",
    requiresConnectedAccount: true,
    requiredScopes: ["tweet.read", "users.read", "tweet.write"],
  },
  send_dm: {
    actionKey: "send_dm",
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
    toolSlug: "xdk.send_dm_in_existing_conversation",
    toolVersion: XDK_PACKAGE_VERSION,
    riskLevel: "write_high_risk",
    approvalMode: "confirm_first",
    uiArtifactType: "message_action",
    entityType: "dm",
    requiresConnectedAccount: true,
    requiredScopes: ["tweet.read", "users.read", "dm.write"],
  },
};

export function getTwitterActionCatalogEntry(
  actionKey: CuratedTwitterActionKey
): TwitterActionCatalogEntry {
  return CATALOG[actionKey];
}
