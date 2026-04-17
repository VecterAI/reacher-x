"use node";

import { v } from "convex/values";
import { action, internalAction } from "./lib/functionBuilders";
import { api, components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  createHostedAuthLink,
  createUnipileWebhook,
  deleteLinkedInAccount,
  getLinkedInFailure,
  getLinkedInOwnProfile,
  listLinkedInAccounts,
  listLinkedInChatMessages,
  listLinkedInChatsForAttendee,
  reactToLinkedInPost,
  commentOnLinkedInPost,
  sendLinkedInChatMessage,
  sendLinkedInInvitation,
  startLinkedInChat,
  type LinkedInOwnProfile,
  type LinkedInUnipileAccount,
  type UnipileChat,
  type UnipileMessage,
} from "./lib/unipileClient";
import { getTwitterActionCatalogEntry } from "./lib/twitterActionCatalog";
import type {
  LinkedInConversationAttachmentSummary,
  LinkedInConversationEligibility,
  LinkedInConversationMessage,
  LinkedInConversationPanelContext,
} from "../shared/lib/linkedin/conversation";
import { extractLinkedInUsername } from "../shared/lib/utils/url/socialProfiles";
import { logger } from "../shared/lib/logger";
import {
  buildStyleSourceKey,
  getNextStyleSourceVersion,
} from "./lib/styleSourceCore";
import { getDefaultWorkspaceForUser } from "./lib/accessHelpers";

const ACCOUNT_SYNC_STALE_MS = 60_000;
const LINKEDIN_WEBHOOK_PATH = "/unipile-webhook";
const LINKEDIN_DM_TEXT_MAX = 8_000;
type LinkedInPanelWarningCode = NonNullable<
  LinkedInConversationPanelContext["warning"]
>["code"];
const internalLinkedInStore = (internal as any).linkedinStore;
const internalLinkedInApi = (internal as any).linkedin;
const internalProspectsApi = (internal as any).prospects;

export type LinkedInConnectionStatus = {
  isConnected: boolean;
  status:
    | "connected"
    | "connecting"
    | "reconnect_required"
    | "action_required"
    | "restricted"
    | "disconnected";
  accountId?: string;
  providerId?: string;
  entityUrn?: string;
  username?: string;
  publicIdentifier?: string;
  displayName?: string;
  headline?: string;
  profileImageUrl?: string;
  publicProfileUrl?: string;
  missingScopes?: string[];
  premiumFeatures?: string[];
  connectedAt?: number;
};

type LinkedInThreadContext = {
  userId: Id<"users">;
  threadId: string;
  prospectId?: Id<"prospects">;
  workspaceId?: Id<"workspaces">;
  prospect?: any;
};

type SubmitLinkedInActionResult = {
  success: boolean;
  executed: boolean;
  pendingApproval: boolean;
  actionKey:
    | "linkedin_send_message"
    | "linkedin_send_message_existing_conversation"
    | "linkedin_invite_user"
    | "linkedin_react_to_post"
    | "linkedin_comment_on_post";
  actionRequestId?: string;
  prospectId?: string;
  title: string;
  message: string;
  approvalMode?: string;
  riskLevel?: string;
  targetTweetId?: string;
  sourcePostData?: unknown;
  sourceContext?: string;
  draftContent?: string;
  replacedExisting?: boolean;
  requiresReplacementConfirmation?: boolean;
  error?: string;
};

async function syncLinkedInAccountHealthNotification(
  ctx: any,
  args: { userId: Id<"users">; status: LinkedInConnectionStatus }
) {
  const defaultWorkspace = await getDefaultWorkspaceForUser(ctx, args.userId);
  const shouldNotify =
    args.status.status === "reconnect_required" ||
    args.status.status === "action_required" ||
    args.status.status === "restricted" ||
    args.status.status === "disconnected";

  await ctx.runMutation(internal.outreach.syncAccountHealthNotification, {
    userId: args.userId,
    workspaceId: defaultWorkspace?._id,
    platform: "linkedin",
    shouldNotify,
    title:
      args.status.status === "disconnected"
        ? "LinkedIn account disconnected"
        : args.status.status === "restricted"
          ? "LinkedIn account restricted"
          : args.status.status === "action_required"
            ? "LinkedIn account needs attention"
            : "Reconnect LinkedIn account",
    message:
      args.status.status === "disconnected"
        ? "Your LinkedIn account disconnected unexpectedly. Reconnect to restore messaging access."
        : args.status.status === "restricted"
          ? "This LinkedIn account is currently restricted. Reconnect or review the account status."
          : args.status.status === "action_required"
            ? "LinkedIn needs additional permissions or account action before messaging can continue."
            : "Reconnect LinkedIn to restore messaging access.",
  });
}

async function getCurrentUserId(ctx: any): Promise<Id<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const user = await ctx.runQuery(api.users.getUserByWorkosId, {
    workosUserId: identity.subject,
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user._id as Id<"users">;
}

function toMs(timestamp?: string | number | null) {
  if (typeof timestamp === "number") {
    return Number.isFinite(timestamp) ? timestamp : 0;
  }
  if (!timestamp) {
    return 0;
  }
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getLinkedInProspectPostId(post: unknown): string | undefined {
  if (!post || typeof post !== "object") {
    return undefined;
  }

  const record = post as Record<string, unknown>;
  if (typeof record.id === "string" && record.id.trim().length > 0) {
    return record.id.trim();
  }
  if (typeof record.urn === "string" && record.urn.trim().length > 0) {
    return record.urn.trim();
  }
  if (typeof record.postID === "string" && record.postID.trim().length > 0) {
    return record.postID.trim();
  }
  if (record.raw && typeof record.raw === "object") {
    return getLinkedInProspectPostId(record.raw);
  }
  return undefined;
}

function getLinkedInProspectLabel(prospect: {
  displayName?: unknown;
  screenName?: unknown;
  name?: unknown;
}): string | undefined {
  if (typeof prospect.displayName === "string" && prospect.displayName.trim()) {
    return prospect.displayName.trim();
  }
  if (typeof prospect.screenName === "string" && prospect.screenName.trim()) {
    return prospect.screenName.trim();
  }
  const legacyName = (prospect as { name?: unknown }).name;
  return typeof legacyName === "string" && legacyName.trim()
    ? legacyName.trim()
    : undefined;
}

function findSourceLinkedInPostInProspect(
  prospect: any | null,
  targetPostId?: string
) {
  if (!prospect) {
    return undefined;
  }

  const candidatePosts: unknown[] = [];
  if (prospect.data) {
    candidatePosts.push(prospect.data);
  }
  if (Array.isArray(prospect.evidencePosts)) {
    candidatePosts.push(...prospect.evidencePosts);
  }

  if (!targetPostId) {
    return candidatePosts[0];
  }

  return candidatePosts.find((post) => {
    return getLinkedInProspectPostId(post) === targetPostId;
  });
}

async function resolveLinkedInThreadContext(
  ctx: any,
  threadId: string
): Promise<LinkedInThreadContext> {
  const thread = await ctx.runQuery(components.agent.threads.getThread, {
    threadId,
  });
  const userId = thread?.userId as Id<"users"> | undefined;
  if (!userId) {
    throw new Error("User not found for thread");
  }

  const threadProspectContext = await ctx.runQuery(
    internal.prospectThreads.getThreadProspectContext,
    { threadId }
  );

  const prospectId = threadProspectContext?.prospectId;
  const workspaceId = threadProspectContext?.workspaceId;
  const prospect = prospectId
    ? await ctx.runQuery(internal.prospects.getProspectInternal, { prospectId })
    : null;

  return {
    userId,
    threadId,
    prospectId,
    workspaceId,
    prospect,
  };
}

function normalizeLinkedInStatus(args: {
  remoteAccount?: LinkedInUnipileAccount | null;
  failureClassification?: string;
}) {
  if (!args.remoteAccount) {
    return "disconnected" as const;
  }

  if (args.failureClassification === "reauth_required") {
    return "reconnect_required" as const;
  }
  if (args.failureClassification === "action_required") {
    return "action_required" as const;
  }
  if (args.failureClassification === "feature_not_subscribed") {
    return "restricted" as const;
  }

  const statuses = new Set(
    (args.remoteAccount.sources ?? []).map((source) => source.status)
  );
  if (statuses.has("CONNECTING")) {
    return "connecting" as const;
  }
  if (statuses.has("CREDENTIALS")) {
    return "reconnect_required" as const;
  }
  if (statuses.has("PERMISSIONS")) {
    return "action_required" as const;
  }
  if (statuses.has("ERROR") || statuses.has("STOPPED")) {
    return "restricted" as const;
  }
  return "connected" as const;
}

function toConnectionStatus(account: any | null): LinkedInConnectionStatus {
  if (!account) {
    return {
      isConnected: false,
      status: "disconnected",
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

async function selectRemoteAccountForUser(
  ctx: any,
  userId: Id<"users">,
  remoteAccounts: LinkedInUnipileAccount[],
  storedAccount: any | null
) {
  if (storedAccount?.accountId) {
    const existingRemote = remoteAccounts.find(
      (account) => account.id === storedAccount.accountId
    );
    if (existingRemote) {
      return existingRemote;
    }
  }

  const sorted = [...remoteAccounts].sort(
    (left, right) => toMs(right.created_at) - toMs(left.created_at)
  );

  for (const remoteAccount of sorted) {
    const claimed = await ctx.runQuery(
      internalLinkedInStore.getLinkedInAccountByAccountIdInternal,
      {
        accountId: remoteAccount.id,
      }
    );
    if (!claimed || claimed.userId === userId) {
      return remoteAccount;
    }
  }

  return sorted[0] ?? null;
}

function getLinkedInDisplayName(profile?: LinkedInOwnProfile | null) {
  const parts = [profile?.first_name, profile?.last_name]
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0
    )
    .map((value) => value.trim());
  return parts.length > 0 ? parts.join(" ") : undefined;
}

async function persistLinkedInAccountSnapshot(
  ctx: any,
  args: {
    userId: Id<"users">;
    remoteAccount: LinkedInUnipileAccount;
    ownProfile?: LinkedInOwnProfile | null;
    failureClassification?: string;
    failureMessage?: string;
  }
) {
  const existing = await ctx.runQuery(
    internalLinkedInStore.getLinkedInAccountForUserInternal,
    { userId: args.userId }
  );
  const status = normalizeLinkedInStatus(args);
  const profile = args.ownProfile;
  const now = Date.now();
  const sourceExternalUserId =
    profile?.provider_id ??
    args.remoteAccount.connection_params?.im?.id ??
    args.remoteAccount.id;
  const styleSourceKey = buildStyleSourceKey("linkedin", sourceExternalUserId);
  const styleSourceVersion = getNextStyleSourceVersion({
    previousAccount: existing,
    nextSourceKey: styleSourceKey,
    now,
  });
  const styleSourceSwitchedAt =
    existing?.styleSourceVersion === styleSourceVersion
      ? existing?.styleSourceSwitchedAt
      : now;
  const organizations = [
    ...(profile?.organizations ?? []).map((organization) => ({
      id: organization.id,
      name: organization.name,
      organizationId: organization.id,
      mailboxId: organization.mailbox_id,
      messagingEnabled: true,
    })),
    ...((args.remoteAccount.connection_params?.im?.organizations ?? []).map(
      (organization) => ({
        id: organization.organization_urn,
        name: organization.name,
        organizationId: organization.organization_urn,
        mailboxId: organization.mailbox_urn,
        messagingEnabled: organization.messaging_enabled,
      })
    ) ?? []),
  ];

  await ctx.runMutation(internalLinkedInStore.upsertLinkedInAccountInternal, {
    userId: args.userId,
    accountId: args.remoteAccount.id,
    styleSourceKey,
    styleSourceVersion,
    styleSourceSwitchedAt,
    status,
    publicIdentifier:
      profile?.public_identifier ??
      args.remoteAccount.connection_params?.im?.publicIdentifier,
    username:
      profile?.public_identifier ??
      args.remoteAccount.connection_params?.im?.username,
    providerId:
      profile?.provider_id ?? args.remoteAccount.connection_params?.im?.id,
    entityUrn: profile?.entity_urn,
    objectUrn: profile?.object_urn,
    displayName: getLinkedInDisplayName(profile) ?? args.remoteAccount.name,
    headline: profile?.headline,
    location: profile?.location,
    email: profile?.email,
    profileImageUrl: profile?.profile_picture_url ?? undefined,
    publicProfileUrl: profile?.public_profile_url,
    premium: profile?.premium,
    openProfile: profile?.open_profile,
    sourceStatuses: args.remoteAccount.sources?.map((source) => ({
      id: source.id,
      status: source.status,
    })),
    organizationMailboxes: organizations,
    premiumFeatures: args.remoteAccount.connection_params?.im?.premiumFeatures,
    recruiterState: profile?.recruiter ?? undefined,
    salesNavigatorState: profile?.sales_navigator ?? undefined,
    lastSyncedAt: now,
    lastSyncAttemptAt: now,
    lastSyncError: args.failureMessage,
    now,
  });
}

function getProspectLinkedInIdentity(prospect: any) {
  const socialLinkedIn =
    prospect?.socialProfiles?.linkedin &&
    typeof prospect.socialProfiles.linkedin === "object"
      ? (prospect.socialProfiles.linkedin as Record<string, unknown>)
      : null;
  const author =
    prospect?.data?.author && typeof prospect.data.author === "object"
      ? (prospect.data.author as Record<string, unknown>)
      : null;
  const profileUrl =
    (typeof socialLinkedIn?.url === "string" && socialLinkedIn.url) ||
    (typeof author?.url === "string" && author.url) ||
    undefined;
  const username =
    (typeof socialLinkedIn?.username === "string" && socialLinkedIn.username) ||
    (profileUrl ? extractLinkedInUsername(profileUrl) : undefined);
  const providerId =
    (typeof prospect?.linkedinUserUrn === "string" &&
      prospect.linkedinUserUrn) ||
    (typeof socialLinkedIn?.urn === "string" && socialLinkedIn.urn) ||
    (typeof author?.urn === "string" && author.urn) ||
    undefined;

  return {
    displayName:
      (typeof prospect?.displayName === "string" && prospect.displayName) ||
      (typeof author?.name === "string" && author.name) ||
      "LinkedIn user",
    title:
      (typeof prospect?.title === "string" && prospect.title) ||
      (typeof author?.headline === "string" && author.headline) ||
      undefined,
    avatarUrl:
      (typeof prospect?.avatarUrl === "string" && prospect.avatarUrl) ||
      (typeof author?.profilePictureURL === "string"
        ? author.profilePictureURL
        : undefined),
    profileUrl,
    username,
    providerId,
  };
}

function normalizeAttachment(
  attachment: Record<string, unknown>
): LinkedInConversationAttachmentSummary {
  return {
    type: typeof attachment.type === "string" ? attachment.type : "attachment",
    url: typeof attachment.url === "string" ? attachment.url : undefined,
    previewUrl: typeof attachment.url === "string" ? attachment.url : undefined,
    width:
      typeof attachment.size === "object" &&
      attachment.size &&
      typeof (attachment.size as Record<string, unknown>).width === "number"
        ? ((attachment.size as Record<string, unknown>).width as number)
        : undefined,
    height:
      typeof attachment.size === "object" &&
      attachment.size &&
      typeof (attachment.size as Record<string, unknown>).height === "number"
        ? ((attachment.size as Record<string, unknown>).height as number)
        : undefined,
  };
}

function normalizeMessage(
  message: UnipileMessage
): LinkedInConversationMessage {
  return {
    id: message.message_id || message.id,
    conversationId: message.chat_id,
    senderUserId: message.sender_id,
    senderAttendeeId: message.sender_attendee_id,
    text: message.text ?? "",
    createdAt: message.timestamp,
    direction: message.is_sender === 1 ? "sent" : "received",
    attachments: Array.isArray(message.attachments)
      ? message.attachments
          .filter(
            (attachment): attachment is Record<string, unknown> =>
              Boolean(attachment) && typeof attachment === "object"
          )
          .map(normalizeAttachment)
      : undefined,
    deliveredAt: message.delivered === 1 ? message.timestamp : undefined,
    messageType: message.message_type,
    isEvent: message.is_event === 1,
  };
}

function toStoredMessages(messages: LinkedInConversationMessage[]) {
  return messages.map((message) => ({
    messageId: message.id,
    providerMessageId: undefined,
    direction: message.direction,
    senderUserId: message.senderUserId,
    senderAttendeeId: message.senderAttendeeId,
    text: message.text,
    createdAt: message.createdAt,
    createdAtMs: toMs(message.createdAt),
    attachments: message.attachments,
    readAt: message.readAt ? toMs(message.readAt) : undefined,
    deliveredAt: message.deliveredAt ? toMs(message.deliveredAt) : undefined,
    messageType: message.messageType,
    isEvent: message.isEvent,
  }));
}

function toCachedMessages(snapshot: any): LinkedInConversationMessage[] {
  const messages = Array.isArray(snapshot?.messages) ? snapshot.messages : [];
  return messages.map((message: any) => ({
    id: message.messageId,
    conversationId: message.conversationId,
    senderUserId: message.senderUserId,
    senderAttendeeId: message.senderAttendeeId,
    text: message.text ?? "",
    createdAt: message.createdAt,
    direction: message.direction,
    attachments: message.attachments,
    readAt:
      typeof message.readAt === "number"
        ? new Date(message.readAt).toISOString()
        : undefined,
    deliveredAt:
      typeof message.deliveredAt === "number"
        ? new Date(message.deliveredAt).toISOString()
        : undefined,
    messageType: message.messageType,
    isEvent: message.isEvent,
  }));
}

function getWebhookString(
  value: unknown,
  ...keys: string[]
): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  for (const key of keys) {
    const candidate = (value as Record<string, unknown>)[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return undefined;
}

function getWebhookArray(value: unknown, key: string): unknown[] {
  if (!value || typeof value !== "object") {
    return [];
  }
  const candidate = (value as Record<string, unknown>)[key];
  return Array.isArray(candidate) ? candidate : [];
}

function getWebhookParticipantProviderId(
  payload: any,
  linkedAccount: any
): string | undefined {
  const sender = payload?.sender;
  const senderProviderId = getWebhookString(sender, "provider_id", "id");
  if (senderProviderId && senderProviderId !== linkedAccount.providerId) {
    return senderProviderId;
  }

  const attendees = getWebhookArray(payload, "attendees");
  for (const attendee of attendees) {
    const providerId = getWebhookString(attendee, "provider_id", "id");
    if (providerId && providerId !== linkedAccount.providerId) {
      return providerId;
    }
  }

  const attendeeProviderId = getWebhookString(
    payload,
    "attendee_provider_id",
    "attendee_id"
  );
  if (attendeeProviderId && attendeeProviderId !== linkedAccount.providerId) {
    return attendeeProviderId;
  }

  return undefined;
}

function getWebhookParticipantName(payload: any): string | undefined {
  const senderName = getWebhookString(payload?.sender, "name", "attendee_name");
  if (senderName) {
    return senderName;
  }

  const attendees = getWebhookArray(payload, "attendees");
  for (const attendee of attendees) {
    const name = getWebhookString(attendee, "name", "attendee_name");
    if (name) {
      return name;
    }
  }

  return getWebhookString(payload, "attendee_name");
}

function normalizeWebhookAttachments(
  payload: any
): LinkedInConversationAttachmentSummary[] | undefined {
  const attachments = getWebhookArray(payload, "attachments").filter(
    (attachment): attachment is Record<string, unknown> =>
      Boolean(attachment) && typeof attachment === "object"
  );

  if (attachments.length === 0) {
    return undefined;
  }

  return attachments.map(normalizeAttachment);
}

async function persistConversationSnapshot(
  ctx: any,
  args: {
    userId: Id<"users">;
    prospect: any;
    accountId: string;
    chat?: UnipileChat | null;
    prospectIdentity: ReturnType<typeof getProspectLinkedInIdentity>;
    eligibility: LinkedInConversationEligibility;
    messages: LinkedInConversationMessage[];
    warningCode?: LinkedInPanelWarningCode;
    warningMessage?: string;
  }
) {
  const chat = args.chat;
  const conversationId = chat?.id ?? args.eligibility.conversationId;
  if (!conversationId) {
    return;
  }

  await ctx.runMutation(
    internal.platformConversations.upsertConversationSnapshotInternal,
    {
      userId: args.userId,
      workspaceId: args.prospect.workspaceId,
      prospectId: args.prospect._id,
      platform: "linkedin",
      conversationId,
      accountId: args.accountId,
      sourceId: chat?.provider_id,
      participantUserId: undefined,
      participantAttendeeId: undefined,
      participantProviderId:
        chat?.attendee_provider_id ?? args.prospectIdentity.providerId,
      participantUsername: args.prospectIdentity.username,
      participantName: args.prospectIdentity.displayName,
      participantHeadline: args.prospectIdentity.title,
      participantAvatarUrl: args.prospectIdentity.avatarUrl,
      participantProfileUrl: args.prospectIdentity.profileUrl,
      participantVerified: undefined,
      eligibilityEnabled: args.eligibility.enabled,
      eligibilityReasonCode: args.eligibility.reasonCode,
      eligibilityReasonLabel: args.eligibility.reasonLabel,
      disabledFeatures: chat?.disabledFeatures,
      readOnly:
        typeof chat?.read_only === "number" ? chat.read_only !== 0 : undefined,
      contentType: chat?.content_type,
      lastSyncedAt: Date.now(),
      lastSyncAttemptAt: Date.now(),
      lastSyncSuccessAt: Date.now(),
      lastSyncErrorCode: args.warningCode,
      lastSyncErrorMessage: args.warningMessage,
      messages: toStoredMessages(args.messages),
    }
  );
}

function buildEligibility(args: {
  status: LinkedInConnectionStatus;
  providerId?: string;
  conversationId?: string;
}): LinkedInConversationEligibility {
  if (!args.status.isConnected) {
    return {
      enabled: false,
      reasonCode:
        args.status.status === "action_required"
          ? "action_required"
          : args.status.status === "reconnect_required"
            ? "missing_connection"
            : args.status.status === "restricted"
              ? "restricted"
              : "missing_connection",
      reasonLabel:
        args.status.status === "action_required"
          ? "Complete the LinkedIn account action required in Connected accounts."
          : args.status.status === "restricted"
            ? "This LinkedIn account is currently restricted."
            : "Connect LinkedIn to message this prospect.",
      conversationId: args.conversationId,
    };
  }

  if (!args.providerId) {
    return {
      enabled: false,
      reasonCode: "unknown",
      reasonLabel:
        "This LinkedIn prospect is missing a stable profile identifier.",
      conversationId: args.conversationId,
    };
  }

  return {
    enabled: true,
    reasonCode: "eligible",
    reasonLabel: "Message available on LinkedIn.",
    conversationId: args.conversationId,
  };
}

function buildBasePanelContext(args: {
  prospect: any;
  prospectIdentity: ReturnType<typeof getProspectLinkedInIdentity>;
  connectionStatus: LinkedInConnectionStatus;
  cachedSnapshot: any;
  draftText?: string;
  draftAttachments?: LinkedInConversationAttachmentSummary[];
  actionRequestId?: string;
}): LinkedInConversationPanelContext {
  return {
    platform: "linkedin",
    conversationId: args.cachedSnapshot?.conversation?.conversationId,
    accountId: args.cachedSnapshot?.conversation?.accountId,
    participantUserId: args.cachedSnapshot?.conversation?.participantUserId,
    participantAttendeeId:
      args.cachedSnapshot?.conversation?.participantAttendeeId,
    participantProviderId:
      args.cachedSnapshot?.conversation?.participantProviderId,
    participantUsername: args.cachedSnapshot?.conversation?.participantUsername,
    participantHeadline: args.cachedSnapshot?.conversation?.participantHeadline,
    prospect: {
      prospectId: String(args.prospect._id),
      displayName: args.prospectIdentity.displayName,
      title: args.prospectIdentity.title,
      avatarUrl: args.prospectIdentity.avatarUrl,
      profileUrl: args.prospectIdentity.profileUrl,
      username: args.prospectIdentity.username,
      urn: args.prospectIdentity.providerId,
    },
    eligibility:
      args.cachedSnapshot?.conversation?.eligibilityReasonCode &&
      typeof args.cachedSnapshot?.conversation?.eligibilityEnabled === "boolean"
        ? {
            enabled: args.cachedSnapshot.conversation.eligibilityEnabled,
            reasonCode: args.cachedSnapshot.conversation.eligibilityReasonCode,
            reasonLabel:
              args.cachedSnapshot.conversation.eligibilityReasonLabel ??
              "Messaging eligibility unavailable right now.",
            conversationId: args.cachedSnapshot.conversation.conversationId,
          }
        : buildEligibility({
            status: args.connectionStatus,
            providerId: args.prospectIdentity.providerId,
            conversationId: args.cachedSnapshot?.conversation?.conversationId,
          }),
    messages: toCachedMessages(args.cachedSnapshot),
    draftText: args.draftText,
    draftAttachments: args.draftAttachments,
    actionRequestId: args.actionRequestId,
    warning:
      args.cachedSnapshot?.conversation?.lastSyncErrorCode &&
      args.cachedSnapshot?.conversation?.lastSyncErrorMessage
        ? {
            code: args.cachedSnapshot.conversation.lastSyncErrorCode,
            message: args.cachedSnapshot.conversation.lastSyncErrorMessage,
          }
        : undefined,
  };
}

async function getOwnedLinkedInProspectForUser(
  ctx: any,
  userId: Id<"users">,
  prospectId: Id<"prospects">
): Promise<Doc<"prospects"> | null> {
  const prospect: Doc<"prospects"> | null = await ctx.runQuery(
    internal.prospects.getProspectInternal,
    {
      prospectId,
    }
  );
  if (
    !prospect ||
    prospect.userId !== userId ||
    prospect.platform !== "linkedin"
  ) {
    return null;
  }
  return prospect;
}

async function ensureUnipileWebhooks() {
  const requestUrl = `${process.env.CONVEX_SITE_URL?.trim()?.replace(/\/$/, "") ?? ""}${LINKEDIN_WEBHOOK_PATH}`;
  if (!requestUrl.startsWith("http")) {
    throw new Error(
      "CONVEX_SITE_URL is required to register Unipile webhooks."
    );
  }
  return requestUrl;
}

export const ensureUnipileWebhooksInternal = internalAction({
  args: {},
  handler: async (ctx) => {
    const requestUrl = await ensureUnipileWebhooks();
    const secret = process.env.UNIPILE_WEBHOOK_SECRET?.trim();

    const desired: Array<{
      source: "messaging" | "users" | "account_status";
      events: string[];
    }> = [
      {
        source: "messaging",
        events: [
          "message_received",
          "message_read",
          "message_reaction",
          "message_edited",
          "message_deleted",
          "message_delivered",
        ],
      },
      {
        source: "users",
        events: ["new_relation"],
      },
      {
        source: "account_status",
        events: [
          "creation_success",
          "creation_fail",
          "deleted",
          "reconnected",
          "sync_success",
          "stopped",
          "ok",
          "connecting",
          "error",
          "credentials",
          "permissions",
        ],
      },
    ];

    for (const config of desired) {
      const existing = await ctx.runQuery(
        internalLinkedInStore.getUnipileWebhookBySourceInternal,
        {
          source: config.source,
        }
      );
      if (existing) {
        continue;
      }
      const created = await createUnipileWebhook({
        source: config.source,
        events: config.events,
        requestUrl,
        secretHeader: secret,
      });
      await ctx.runMutation(
        internalLinkedInStore.upsertUnipileWebhookInternal,
        {
          source: config.source,
          webhookId: created.webhook_id,
          requestUrl,
          enabled: true,
          events: config.events as any,
          updatedAt: Date.now(),
        }
      );
    }

    return { success: true as const };
  },
});

async function syncLinkedInAccountForUser(
  ctx: any,
  userId: Id<"users">
): Promise<LinkedInConnectionStatus> {
  const storedAccount = await ctx.runQuery(
    internalLinkedInStore.getLinkedInAccountForUserInternal,
    { userId }
  );

  try {
    const remoteAccounts = await listLinkedInAccounts();
    const remoteAccount = await selectRemoteAccountForUser(
      ctx,
      userId,
      remoteAccounts,
      storedAccount
    );

    if (!remoteAccount) {
      if (storedAccount) {
        await ctx.runMutation(
          internalLinkedInStore.deleteLinkedInAccountInternal,
          {
            userId,
          }
        );
      }
      return {
        isConnected: false,
        status: "disconnected",
      };
    }

    let ownProfile: LinkedInOwnProfile | null = null;
    let failureClassification: string | undefined;
    let failureMessage: string | undefined;

    try {
      ownProfile = await getLinkedInOwnProfile(remoteAccount.id);
    } catch (error) {
      const failure = getLinkedInFailure(error);
      failureClassification = failure.classification;
      failureMessage = failure.message;
    }

    await persistLinkedInAccountSnapshot(ctx, {
      userId,
      remoteAccount,
      ownProfile,
      failureClassification,
      failureMessage,
    });

    const refreshed = await ctx.runQuery(
      internalLinkedInStore.getLinkedInAccountForUserInternal,
      { userId }
    );

    if (refreshed?.status === "connected") {
      await ctx.runAction(
        internalLinkedInApi.ensureUnipileWebhooksInternal,
        {}
      );
    }

    return toConnectionStatus(refreshed);
  } catch (error) {
    const failure = getLinkedInFailure(error);
    if (storedAccount) {
      await ctx.runMutation(
        internalLinkedInStore.patchLinkedInAccountInternal,
        {
          userId,
          patch: {
            status:
              failure.classification === "reauth_required"
                ? "reconnect_required"
                : failure.classification === "action_required"
                  ? "action_required"
                  : failure.classification === "feature_not_subscribed"
                    ? "restricted"
                    : storedAccount.status,
            lastSyncAttemptAt: Date.now(),
            lastSyncError: failure.message,
            updatedAt: Date.now(),
          },
        }
      );
      const refreshed = await ctx.runQuery(
        internalLinkedInStore.getLinkedInAccountForUserInternal,
        { userId }
      );
      return toConnectionStatus(refreshed);
    }

    logger.warn("Failed to sync LinkedIn account state", {
      userId,
      error: failure.message,
      classification: failure.classification,
    });
    return {
      isConnected: false,
      status: "disconnected",
    };
  }
}

async function getLinkedInConnectionStatusForUser(
  ctx: any,
  userId: Id<"users">,
  options?: { forceRefresh?: boolean }
) {
  const storedAccount = await ctx.runQuery(
    internalLinkedInStore.getLinkedInAccountForUserInternal,
    { userId }
  );

  if (
    storedAccount &&
    !options?.forceRefresh &&
    typeof storedAccount.lastSyncedAt === "number" &&
    Date.now() - storedAccount.lastSyncedAt < ACCOUNT_SYNC_STALE_MS
  ) {
    return toConnectionStatus(storedAccount);
  }

  return await syncLinkedInAccountForUser(ctx, userId);
}

async function scheduleLinkedInStyleBackfillIfNeeded(
  ctx: any,
  userId: Id<"users">,
  storedAccount?: {
    styleSourceKey?: string;
    styleSourceVersion?: number;
    providerId?: string;
  } | null
) {
  const account =
    storedAccount ??
    (await ctx.runQuery(
      internalLinkedInStore.getLinkedInAccountForUserInternal,
      {
        userId,
      }
    ));
  const sourceVersion =
    typeof account?.styleSourceVersion === "number"
      ? account.styleSourceVersion
      : null;
  const sourceExternalUserId = account?.providerId ?? null;

  if (!account || !sourceVersion || !sourceExternalUserId) {
    return { scheduled: false as const, reason: "missing_source" as const };
  }

  const workspaces = await ctx.runQuery(
    internal.workspaces.getUserWorkspacesInternal,
    {
      userId,
    }
  );
  if (workspaces.length === 0) {
    return { scheduled: false as const, reason: "no_workspaces" as const };
  }

  const existingProfiles = await Promise.all(
    workspaces.map((workspace: { _id: Id<"workspaces"> }) =>
      ctx.runQuery(internal.workspaceStyleProfiles.getWorkspaceStyleProfile, {
        workspaceId: workspace._id,
        platform: "linkedin",
      })
    )
  );

  const needsBackfill = existingProfiles.some((profile) => {
    if (!profile) {
      return true;
    }

    return !(
      profile.sourceVersion === sourceVersion &&
      profile.sourceExternalUserId === sourceExternalUserId &&
      (profile.status === "collecting" ||
        profile.status === "analyzing" ||
        profile.status === "ready")
    );
  });

  if (!needsBackfill) {
    return { scheduled: false as const, reason: "already_current" as const };
  }

  await ctx.runMutation(internal.styleAnalysis.updateUserWorkspaceStyleStatus, {
    userId,
    platform: "linkedin",
    status: "collecting",
    sourceKey: account.styleSourceKey,
    sourceVersion,
    sourceExternalUserId,
    lastError: undefined,
  });
  await ctx.scheduler.runAfter(
    0,
    internal.styleAnalysisActions.backfillLinkedInProfilePosts,
    { userId }
  );

  return { scheduled: true as const, reason: "scheduled" as const };
}

function buildDraftAttachments(
  mediaUrls?: string[]
): LinkedInConversationAttachmentSummary[] | undefined {
  if (!Array.isArray(mediaUrls) || mediaUrls.length === 0) {
    return undefined;
  }
  return mediaUrls
    .filter(
      (url): url is string => typeof url === "string" && url.trim().length > 0
    )
    .map((url) => ({
      type: "attachment",
      url,
      previewUrl: url,
    }));
}

function getLinkedInActionUnavailableMessage(status: LinkedInConnectionStatus) {
  switch (status.status) {
    case "action_required":
      return "Complete the LinkedIn account action required in Connected accounts.";
    case "reconnect_required":
      return "Reconnect LinkedIn in Connected accounts before using LinkedIn actions.";
    case "restricted":
      return "This LinkedIn account is currently restricted.";
    case "connecting":
      return "LinkedIn is still connecting. Try again in a moment.";
    default:
      return "Connect LinkedIn before using LinkedIn actions.";
  }
}

function getLinkedInActionTitle(args: {
  actionKey:
    | "linkedin_send_message"
    | "linkedin_send_message_existing_conversation"
    | "linkedin_invite_user"
    | "linkedin_react_to_post"
    | "linkedin_comment_on_post";
  targetLabel?: string;
}) {
  const suffix = args.targetLabel ? ` ${args.targetLabel}` : "";
  switch (args.actionKey) {
    case "linkedin_send_message":
    case "linkedin_send_message_existing_conversation":
      return args.targetLabel
        ? `Approve LinkedIn message to ${args.targetLabel}`
        : "Approve LinkedIn message";
    case "linkedin_invite_user":
      return args.targetLabel
        ? `Approve LinkedIn invite to ${args.targetLabel}`
        : "Approve LinkedIn invite";
    case "linkedin_react_to_post":
      return `Approve LinkedIn reaction${suffix}`;
    case "linkedin_comment_on_post":
      return `Approve LinkedIn comment${suffix}`;
  }
}

function buildLinkedInActionDescription(args: {
  actionKey:
    | "linkedin_send_message"
    | "linkedin_send_message_existing_conversation"
    | "linkedin_invite_user"
    | "linkedin_react_to_post"
    | "linkedin_comment_on_post";
  text?: string;
  context?: string;
}) {
  const trimmedText = args.text?.trim();
  if (
    args.actionKey === "linkedin_send_message" ||
    args.actionKey === "linkedin_send_message_existing_conversation" ||
    args.actionKey === "linkedin_invite_user" ||
    args.actionKey === "linkedin_comment_on_post"
  ) {
    return trimmedText || args.context;
  }

  return args.context;
}

function getLinkedInActionDraftValidationError(args: {
  actionKey:
    | "linkedin_send_message"
    | "linkedin_send_message_existing_conversation"
    | "linkedin_invite_user"
    | "linkedin_react_to_post"
    | "linkedin_comment_on_post";
  text?: string;
  mediaUrls?: string[];
}) {
  const trimmedText = args.text?.trim() ?? "";
  const mediaUrls = (args.mediaUrls ?? []).filter(
    (url): url is string => typeof url === "string" && url.trim().length > 0
  );

  if (
    args.actionKey === "linkedin_send_message" ||
    args.actionKey === "linkedin_send_message_existing_conversation"
  ) {
    if (!trimmedText && mediaUrls.length === 0) {
      return "LinkedIn message requires text or at least one attachment.";
    }
    if (trimmedText.length > LINKEDIN_DM_TEXT_MAX) {
      return `LinkedIn DM text exceeds limit (${trimmedText.length} characters, max ${LINKEDIN_DM_TEXT_MAX}).`;
    }
  }

  if (args.actionKey === "linkedin_comment_on_post" && !trimmedText) {
    return "Comment text is required";
  }

  return null;
}

async function getConnectedLinkedInAccountOrThrow(
  ctx: any,
  userId: Id<"users">
) {
  const status = await getLinkedInConnectionStatusForUser(ctx, userId);
  if (!status.isConnected) {
    throw new Error(getLinkedInActionUnavailableMessage(status));
  }

  const storedAccount = await ctx.runQuery(
    internalLinkedInStore.getLinkedInAccountForUserInternal,
    { userId }
  );
  if (!storedAccount?.accountId) {
    throw new Error("LinkedIn account not connected.");
  }

  return storedAccount;
}

async function sendLinkedInMessageForUser(
  ctx: any,
  args: {
    userId: Id<"users">;
    prospectId: Id<"prospects">;
    conversationId?: string;
    text: string;
    mediaUrls?: string[];
    actionRequestId?: Id<"agentActionRequests">;
  }
) {
  const prospect = await getOwnedLinkedInProspectForUser(
    ctx,
    args.userId,
    args.prospectId
  );
  if (!prospect) {
    throw new Error("Prospect not found.");
  }

  const panelContext = await resolveProspectLinkedInPanelContext(
    ctx,
    args.userId,
    args.prospectId
  );
  if (!panelContext) {
    throw new Error("Prospect not found.");
  }
  if (!panelContext.eligibility.enabled) {
    throw new Error(panelContext.eligibility.reasonLabel);
  }

  const storedAccount = await getConnectedLinkedInAccountOrThrow(
    ctx,
    args.userId
  );

  const trimmedText = args.text.trim();
  const mediaUrls = (args.mediaUrls ?? []).filter(
    (url): url is string => typeof url === "string" && url.trim().length > 0
  );
  if (!trimmedText && mediaUrls.length === 0) {
    throw new Error(
      "LinkedIn message requires text or at least one attachment."
    );
  }

  const prospectIdentity = getProspectLinkedInIdentity(prospect);
  const conversationId = args.conversationId ?? panelContext.conversationId;
  let result:
    | { chat_id?: string | null; message_id?: string | null }
    | { message_id?: string | null };
  let effectiveConversationId = conversationId;

  if (effectiveConversationId) {
    result = await sendLinkedInChatMessage({
      chatId: effectiveConversationId,
      accountId: storedAccount.accountId,
      text: trimmedText || undefined,
      mediaUrls,
    });
  } else {
    if (!prospectIdentity.providerId) {
      throw new Error(
        "This LinkedIn prospect is missing a provider id needed to start a new conversation."
      );
    }
    result = await startLinkedInChat({
      accountId: storedAccount.accountId,
      attendeeProviderId: prospectIdentity.providerId,
      text: trimmedText || undefined,
      mediaUrls,
    });
    effectiveConversationId =
      "chat_id" in result ? (result.chat_id ?? undefined) : undefined;
  }

  const createdMessageId =
    "message_id" in result ? (result.message_id ?? undefined) : undefined;
  const optimisticMessage =
    effectiveConversationId && createdMessageId
      ? {
          id: createdMessageId,
          conversationId: effectiveConversationId,
          text: trimmedText,
          createdAt: new Date().toISOString(),
          direction: "sent" as const,
          attachments: buildDraftAttachments(mediaUrls),
        }
      : null;
  const messages = optimisticMessage
    ? [...panelContext.messages, optimisticMessage]
    : panelContext.messages;

  await persistConversationSnapshot(ctx, {
    userId: args.userId,
    prospect,
    accountId: storedAccount.accountId,
    chat: effectiveConversationId
      ? ({
          id: effectiveConversationId,
          account_id: storedAccount.accountId,
          account_type: "LINKEDIN",
          attendee_provider_id: prospectIdentity.providerId,
        } as UnipileChat)
      : null,
    prospectIdentity,
    eligibility: buildEligibility({
      status: toConnectionStatus(storedAccount),
      providerId: prospectIdentity.providerId,
      conversationId: effectiveConversationId,
    }),
    messages,
  });

  if (args.actionRequestId) {
    const request = await ctx.runQuery(
      internal.socialActions.getActionRequestInternal,
      {
        actionRequestId: args.actionRequestId,
      }
    );
    if (request) {
      await ctx.runMutation(
        internal.socialActions.completeActionRequestInternal,
        {
          actionRequestId: args.actionRequestId,
          resultSummary: {
            actionKey: request.actionKey,
            toolSlug: request.toolSlug,
            toolVersion: request.toolVersion,
            completedAt: Date.now(),
            targetUserId: prospectIdentity.providerId,
            postedTextPreview: trimmedText || undefined,
          },
        }
      );

      await ctx.runMutation(
        internal.socialActions.createActionRequestNotificationInternal,
        {
          actionRequestId: args.actionRequestId,
          type: "social_action_completed",
          message: trimmedText || request.title,
        }
      );
    }
  }

  if (!args.actionRequestId) {
    await ctx.runMutation(internal.outreach.createOutreachSentNotification, {
      userId: args.userId,
      workspaceId: prospect.workspaceId,
      prospectId: args.prospectId,
      title: "Message sent on LinkedIn",
      message: trimmedText || "LinkedIn message sent.",
      notificationKey: `outreach-sent:linkedin:${args.prospectId}:${createdMessageId ?? Date.now()}`,
      targetHref: `/agent?prospectId=${encodeURIComponent(String(args.prospectId))}`,
      contextPlatform: "linkedin",
    });
  }

  await ctx.runMutation(
    internal.outreach.markProspectContactedFromSuccessfulOutreach,
    {
      prospectId: args.prospectId,
      workspaceId: prospect.workspaceId,
      description: "Sent a LinkedIn message.",
    }
  );

  return {
    success: true as const,
    conversationId: effectiveConversationId,
    messageId: createdMessageId,
  };
}

async function resolveProspectLinkedInPanelContext(
  ctx: any,
  userId: Id<"users">,
  prospectId: Id<"prospects">,
  options?: {
    draftText?: string;
    draftAttachments?: LinkedInConversationAttachmentSummary[];
    actionRequestId?: string;
  }
): Promise<LinkedInConversationPanelContext | null> {
  const prospect = await getOwnedLinkedInProspectForUser(
    ctx,
    userId,
    prospectId
  );
  if (!prospect) {
    return null;
  }

  const prospectIdentity = getProspectLinkedInIdentity(prospect);
  const connectionStatus = await getLinkedInConnectionStatusForUser(
    ctx,
    userId
  );
  const storedAccount = await ctx.runQuery(
    internalLinkedInStore.getLinkedInAccountForUserInternal,
    { userId }
  );
  const cachedSnapshot = await ctx.runQuery(
    internal.platformConversations.getConversationSnapshotInternal,
    {
      userId,
      platform: "linkedin",
      prospectId,
    }
  );

  const baseContext = buildBasePanelContext({
    prospect,
    prospectIdentity,
    connectionStatus,
    cachedSnapshot,
    draftText: options?.draftText,
    draftAttachments: options?.draftAttachments,
    actionRequestId: options?.actionRequestId,
  });

  if (!connectionStatus.isConnected || !storedAccount?.accountId) {
    return baseContext;
  }
  if (!prospectIdentity.providerId) {
    return baseContext;
  }

  try {
    const chats = await listLinkedInChatsForAttendee({
      attendeeId: prospectIdentity.providerId,
      accountId: storedAccount.accountId,
      limit: 10,
    });
    const chat = chats[0] ?? null;
    if (!chat) {
      return {
        ...baseContext,
        accountId: storedAccount.accountId,
        eligibility: buildEligibility({
          status: connectionStatus,
          providerId: prospectIdentity.providerId,
        }),
      };
    }

    const messages = (
      await listLinkedInChatMessages({
        chatId: chat.id,
        limit: 100,
      })
    )
      .map(normalizeMessage)
      .sort((left, right) => toMs(left.createdAt) - toMs(right.createdAt));

    const eligibility = buildEligibility({
      status: connectionStatus,
      providerId: prospectIdentity.providerId,
      conversationId: chat.id,
    });

    await persistConversationSnapshot(ctx, {
      userId,
      prospect,
      accountId: storedAccount.accountId,
      chat,
      prospectIdentity,
      eligibility,
      messages,
    });

    return {
      ...baseContext,
      conversationId: chat.id,
      accountId: storedAccount.accountId,
      participantProviderId:
        chat.attendee_provider_id ?? prospectIdentity.providerId,
      participantHeadline: prospectIdentity.title,
      eligibility,
      messages,
    };
  } catch (error) {
    const failure = getLinkedInFailure(error);
    return {
      ...baseContext,
      warning:
        failure.classification === "rate_limited" ||
        failure.classification === "feature_not_subscribed" ||
        failure.classification === "action_required" ||
        failure.classification === "reauth_required"
          ? {
              code:
                failure.classification === "rate_limited"
                  ? "rate_limited"
                  : failure.classification === "feature_not_subscribed"
                    ? "feature_not_subscribed"
                    : failure.classification === "action_required"
                      ? "action_required"
                      : "credentials_required",
              message: failure.message,
            }
          : undefined,
    };
  }
}

export const getLinkedInConnectionStatus = action({
  args: {},
  handler: async (ctx): Promise<LinkedInConnectionStatus> => {
    const userId = await getCurrentUserId(ctx);
    return await getLinkedInConnectionStatusForUser(ctx, userId);
  },
});

export const syncLinkedInConnection = action({
  args: {},
  handler: async (ctx): Promise<LinkedInConnectionStatus> => {
    const userId = await getCurrentUserId(ctx);
    const status = await syncLinkedInAccountForUser(ctx, userId);
    await syncLinkedInAccountHealthNotification(ctx, { userId, status });
    if (status.status === "connected") {
      await scheduleLinkedInStyleBackfillIfNeeded(ctx, userId);
    }
    return status;
  },
});

function appendStatusParam(url: string, status: "success" | "failure") {
  const target = new URL(url);
  target.searchParams.set("linkedin_status", status);
  return target.toString();
}

export const getLinkedInConnectLink = action({
  args: {
    callbackUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ redirectUrl: string }> => {
    const userId = await getCurrentUserId(ctx);
    const storedAccount = await ctx.runQuery(
      internalLinkedInStore.getLinkedInAccountForUserInternal,
      { userId }
    );

    const hosted = await createHostedAuthLink({
      type: storedAccount?.accountId ? "reconnect" : "create",
      reconnectAccountId: storedAccount?.accountId,
      successRedirectUrl: appendStatusParam(args.callbackUrl, "success"),
      failureRedirectUrl: appendStatusParam(args.callbackUrl, "failure"),
      notifyUrl: `${process.env.CONVEX_SITE_URL?.trim()?.replace(/\/$/, "") ?? ""}${LINKEDIN_WEBHOOK_PATH}`,
      name: `user:${userId}`,
    });

    return { redirectUrl: hosted.url };
  },
});

export const disconnectLinkedIn = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    const storedAccount = await ctx.runQuery(
      internalLinkedInStore.getLinkedInAccountForUserInternal,
      { userId }
    );

    if (storedAccount?.accountId) {
      try {
        await deleteLinkedInAccount(storedAccount.accountId);
      } catch (error) {
        const failure = getLinkedInFailure(error);
        if (failure.classification !== "target_not_found") {
          throw error;
        }
      }
    }

    await ctx.runMutation(internalLinkedInStore.deleteLinkedInAccountInternal, {
      userId,
    });
    if (
      typeof storedAccount?.styleSourceVersion === "number" &&
      typeof storedAccount.providerId === "string"
    ) {
      await ctx.runMutation(internal.styleAnalysis.resetStyleSourceData, {
        userId,
        platform: "linkedin",
        sourceVersion: storedAccount.styleSourceVersion,
        sourceExternalUserId: storedAccount.providerId,
      });
    }

    return { success: true as const };
  },
});

export const getProspectLinkedInMessageState = action({
  args: {
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const panelContext = await resolveProspectLinkedInPanelContext(
      ctx,
      userId,
      args.prospectId
    );
    if (!panelContext) {
      return null;
    }
    return {
      prospect: panelContext.prospect,
      conversationId: panelContext.conversationId,
      eligibility: panelContext.eligibility,
      messageCount: panelContext.messages.length,
      latestMessageAt:
        panelContext.messages.length > 0
          ? panelContext.messages[panelContext.messages.length - 1]?.createdAt
          : undefined,
    };
  },
});

export const getProspectLinkedInMessageStateInternal = internalAction({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, args) => {
    const panelContext = await resolveProspectLinkedInPanelContext(
      ctx,
      args.userId,
      args.prospectId
    );
    if (!panelContext) {
      return null;
    }
    return {
      prospect: panelContext.prospect,
      conversationId: panelContext.conversationId,
      eligibility: panelContext.eligibility,
      messageCount: panelContext.messages.length,
      latestMessageAt:
        panelContext.messages.length > 0
          ? panelContext.messages[panelContext.messages.length - 1]?.createdAt
          : undefined,
    };
  },
});

export const getLinkedInConversationPanelContext = action({
  args: {
    prospectId: v.id("prospects"),
    actionRequestId: v.optional(v.id("agentActionRequests")),
  },
  handler: async (
    ctx,
    args
  ): Promise<LinkedInConversationPanelContext | null> => {
    const userId = await getCurrentUserId(ctx);
    let draftText: string | undefined;
    let draftAttachments: LinkedInConversationAttachmentSummary[] | undefined;
    let actionRequestId: string | undefined;

    if (args.actionRequestId) {
      const request = await ctx.runQuery(
        internal.socialActions.getActionRequestInternal,
        {
          actionRequestId: args.actionRequestId,
        }
      );
      if (!request || request.userId !== userId) {
        return null;
      }
      draftText = request.draftContent;
      draftAttachments = buildDraftAttachments(
        Array.isArray((request.argumentsSnapshot as any)?.mediaUrls)
          ? ((request.argumentsSnapshot as any).mediaUrls as string[])
          : undefined
      );
      actionRequestId = String(request._id);
    }

    return await resolveProspectLinkedInPanelContext(
      ctx,
      userId,
      args.prospectId,
      {
        draftText,
        draftAttachments,
        actionRequestId,
      }
    );
  },
});

export const submitLinkedInActionForThread = internalAction({
  args: {
    threadId: v.string(),
    actionKey: v.union(
      v.literal("linkedin_send_message"),
      v.literal("linkedin_send_message_existing_conversation"),
      v.literal("linkedin_invite_user"),
      v.literal("linkedin_react_to_post"),
      v.literal("linkedin_comment_on_post")
    ),
    postId: v.optional(v.string()),
    text: v.optional(v.string()),
    mediaUrls: v.optional(v.array(v.string())),
    mediaDescriptions: v.optional(v.array(v.string())),
    mediaKinds: v.optional(
      v.array(v.union(v.literal("image"), v.literal("gif"), v.literal("video")))
    ),
    reactionType: v.optional(v.string()),
    targetLabel: v.optional(v.string()),
    context: v.optional(v.string()),
    replaceExistingPending: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<SubmitLinkedInActionResult> => {
    const threadContext = await resolveLinkedInThreadContext(
      ctx,
      args.threadId
    );
    if (!threadContext.prospectId || !threadContext.prospect) {
      return {
        success: false,
        executed: false,
        pendingApproval: false,
        actionKey: args.actionKey,
        title: "LinkedIn action unavailable",
        message: "LinkedIn actions require a prospect in the current thread.",
        error: "Missing prospect context for LinkedIn action.",
      };
    }

    const metadata = getTwitterActionCatalogEntry(args.actionKey);
    const prospect = threadContext.prospect;
    const targetLabel = args.targetLabel ?? getLinkedInProspectLabel(prospect);
    const draftContent = args.text?.trim() || undefined;
    const description = buildLinkedInActionDescription({
      actionKey: args.actionKey,
      text: draftContent,
      context: args.context,
    });
    const title = getLinkedInActionTitle({
      actionKey: args.actionKey,
      targetLabel,
    });
    const sourcePostData = findSourceLinkedInPostInProspect(
      prospect,
      args.postId
    );
    const validationError = getLinkedInActionDraftValidationError({
      actionKey: args.actionKey,
      text: draftContent,
      mediaUrls: args.mediaUrls,
    });
    if (validationError) {
      return {
        success: false,
        executed: false,
        pendingApproval: false,
        actionKey: args.actionKey,
        prospectId: String(threadContext.prospectId),
        title,
        message: validationError,
        approvalMode: metadata.approvalMode,
        riskLevel: metadata.riskLevel,
        targetTweetId: args.postId,
        sourcePostData,
        sourceContext: args.context,
        draftContent,
        error: validationError,
      };
    }

    let connectionError: string | undefined;
    try {
      await getConnectedLinkedInAccountOrThrow(ctx, threadContext.userId);
    } catch (error) {
      connectionError =
        error instanceof Error ? error.message : "LinkedIn is not connected.";
    }
    if (connectionError) {
      return {
        success: false,
        executed: false,
        pendingApproval: false,
        actionKey: args.actionKey,
        prospectId: String(threadContext.prospectId),
        title: "LinkedIn action unavailable",
        message: connectionError,
        approvalMode: metadata.approvalMode,
        riskLevel: metadata.riskLevel,
        targetTweetId: args.postId,
        sourcePostData,
        sourceContext: args.context,
        draftContent,
        error: connectionError,
      };
    }

    const panelContext = await resolveProspectLinkedInPanelContext(
      ctx,
      threadContext.userId,
      threadContext.prospectId
    );
    const prospectIdentity = getProspectLinkedInIdentity(prospect);

    if (
      (args.actionKey === "linkedin_send_message" ||
        args.actionKey === "linkedin_send_message_existing_conversation") &&
      !panelContext?.eligibility.enabled
    ) {
      const reason =
        panelContext?.eligibility.reasonLabel ??
        "LinkedIn messaging is unavailable right now.";
      return {
        success: false,
        executed: false,
        pendingApproval: false,
        actionKey: args.actionKey,
        prospectId: String(threadContext.prospectId),
        title: "LinkedIn message unavailable",
        message: reason,
        approvalMode: metadata.approvalMode,
        riskLevel: metadata.riskLevel,
        sourceContext: args.context,
        draftContent,
        error: reason,
      };
    }

    if (
      args.actionKey === "linkedin_send_message_existing_conversation" &&
      !panelContext?.conversationId
    ) {
      return {
        success: false,
        executed: false,
        pendingApproval: false,
        actionKey: args.actionKey,
        prospectId: String(threadContext.prospectId),
        title: "LinkedIn message unavailable",
        message:
          "No LinkedIn conversation exists yet. Open the LinkedIn DM panel to sync it first, or use a new-message action.",
        approvalMode: metadata.approvalMode,
        riskLevel: metadata.riskLevel,
        sourceContext: args.context,
        draftContent,
        error: "Missing LinkedIn conversation id.",
      };
    }

    if (
      args.actionKey === "linkedin_invite_user" &&
      !prospectIdentity.providerId
    ) {
      return {
        success: false,
        executed: false,
        pendingApproval: false,
        actionKey: args.actionKey,
        prospectId: String(threadContext.prospectId),
        title: "LinkedIn invite unavailable",
        message:
          "This prospect is missing the LinkedIn provider id needed to send an invitation.",
        approvalMode: metadata.approvalMode,
        riskLevel: metadata.riskLevel,
        sourceContext: args.context,
        draftContent,
        error: "Missing LinkedIn provider id for invite.",
      };
    }

    if (
      (args.actionKey === "linkedin_react_to_post" ||
        args.actionKey === "linkedin_comment_on_post") &&
      !args.postId
    ) {
      return {
        success: false,
        executed: false,
        pendingApproval: false,
        actionKey: args.actionKey,
        prospectId: String(threadContext.prospectId),
        title: "LinkedIn post unavailable",
        message: "A LinkedIn post id is required for this action.",
        approvalMode: metadata.approvalMode,
        riskLevel: metadata.riskLevel,
        sourceContext: args.context,
        draftContent,
        error: "Missing LinkedIn post id.",
      };
    }

    if (
      args.actionKey === "linkedin_send_message" ||
      args.actionKey === "linkedin_send_message_existing_conversation"
    ) {
      const existingPendingRequest = await ctx.runQuery(
        internal.socialActions.getPendingDmActionRequestForScope,
        {
          threadId: threadContext.threadId,
          prospectId: threadContext.prospectId,
        }
      );

      if (
        existingPendingRequest &&
        (!args.replaceExistingPending ||
          existingPendingRequest.actionKey !== args.actionKey ||
          existingPendingRequest.draftContent !== draftContent)
      ) {
        if (!args.replaceExistingPending) {
          return {
            success: true,
            executed: false,
            pendingApproval: true,
            actionKey:
              existingPendingRequest.actionKey as SubmitLinkedInActionResult["actionKey"],
            actionRequestId: String(existingPendingRequest._id),
            prospectId: String(threadContext.prospectId),
            title: existingPendingRequest.title,
            message:
              "A pending LinkedIn DM draft already exists for this person. Ask the user whether they want to replace it before updating the draft.",
            approvalMode: metadata.approvalMode,
            riskLevel: metadata.riskLevel,
            sourceContext: args.context,
            draftContent:
              existingPendingRequest.draftContent || draftContent || undefined,
            requiresReplacementConfirmation: true,
          };
        }

        await ctx.runMutation(
          internal.socialActions.updatePendingActionRequestInternal,
          {
            actionRequestId: existingPendingRequest._id,
            actionKey: args.actionKey,
            title,
            description,
            argumentsSnapshot: {
              conversationId: panelContext?.conversationId,
              postId: args.postId,
              text: draftContent,
              mediaUrls: args.mediaUrls ?? [],
              mediaDescriptions: args.mediaDescriptions ?? [],
              mediaKinds: args.mediaKinds ?? [],
              targetLabel,
              context: args.context,
            },
            sourcePostData,
            sourcePostId: args.postId,
            draftContent,
            notificationMessage:
              draftContent ||
              ((args.mediaUrls?.length ?? 0) > 0
                ? "Approval required for LinkedIn message with media."
                : "Approval required before sending this LinkedIn message."),
          }
        );

        return {
          success: true,
          executed: false,
          pendingApproval: true,
          actionKey: args.actionKey,
          actionRequestId: String(existingPendingRequest._id),
          prospectId: String(threadContext.prospectId),
          title,
          message:
            "Pending LinkedIn DM draft updated. It is ready for review and approval.",
          approvalMode: metadata.approvalMode,
          riskLevel: metadata.riskLevel,
          sourceContext: args.context,
          draftContent,
          replacedExisting: true,
        };
      }
    }

    const requestId = await ctx.runMutation(
      internal.socialActions.createActionRequestInternal,
      {
        userId: threadContext.userId,
        threadId: threadContext.threadId,
        prospectId: threadContext.prospectId,
        workspaceId: threadContext.workspaceId,
        provider: metadata.provider,
        actionKey: args.actionKey,
        title,
        description,
        toolSlug: metadata.toolSlug,
        toolVersion: metadata.toolVersion,
        riskLevel: metadata.riskLevel,
        approvalMode: metadata.approvalMode,
        uiArtifactType: metadata.uiArtifactType,
        entityType: metadata.entityType,
        requiresConnectedAccount: metadata.requiresConnectedAccount,
        status: "pending_approval",
        argumentsSnapshot: {
          conversationId: panelContext?.conversationId,
          postId: args.postId,
          reactionType: args.reactionType,
          text: draftContent,
          mediaUrls: args.mediaUrls ?? [],
          mediaDescriptions: args.mediaDescriptions ?? [],
          mediaKinds: args.mediaKinds ?? [],
          targetLabel,
          context: args.context,
        },
        sourcePostData,
        sourcePostId: args.postId,
        draftContent,
      }
    );

    await ctx.runMutation(
      internal.socialActions.createActionRequestNotificationInternal,
      {
        actionRequestId: requestId,
        type: "social_action_request",
        message:
          draftContent ||
          (args.actionKey === "linkedin_comment_on_post"
            ? "Approval required before posting this LinkedIn comment."
            : args.actionKey === "linkedin_react_to_post"
              ? "Approval required before reacting on LinkedIn."
              : args.actionKey === "linkedin_invite_user"
                ? "Approval required before sending this LinkedIn invitation."
                : (args.mediaUrls?.length ?? 0) > 0
                  ? "Approval required for LinkedIn message with media."
                  : "Approval required before sending this LinkedIn message."),
      }
    );

    return {
      success: true,
      executed: false,
      pendingApproval: true,
      actionKey: args.actionKey,
      actionRequestId: String(requestId),
      prospectId: String(threadContext.prospectId),
      title,
      message:
        args.actionKey === "linkedin_react_to_post"
          ? "LinkedIn reaction is ready for approval."
          : args.actionKey === "linkedin_comment_on_post"
            ? "LinkedIn comment draft is ready for review."
            : args.actionKey === "linkedin_invite_user"
              ? "LinkedIn invitation is ready for review."
              : "LinkedIn message draft is ready for review.",
      approvalMode: metadata.approvalMode,
      riskLevel: metadata.riskLevel,
      targetTweetId: args.postId,
      sourcePostData,
      sourceContext: args.context,
      draftContent,
    };
  },
});

export const createLinkedInPostActionRequest = action({
  args: {
    prospectId: v.id("prospects"),
    actionKey: v.union(
      v.literal("linkedin_react_to_post"),
      v.literal("linkedin_comment_on_post")
    ),
    postId: v.string(),
    postData: v.any(),
    reactionType: v.optional(v.string()),
    text: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: true; actionRequestId: string; title: string }> => {
    const userId = await getCurrentUserId(ctx);
    const prospect: Doc<"prospects"> | null =
      await getOwnedLinkedInProspectForUser(ctx, userId, args.prospectId);
    if (!prospect) {
      throw new Error("Prospect not found.");
    }

    await getConnectedLinkedInAccountOrThrow(ctx, userId);

    const metadata = getTwitterActionCatalogEntry(args.actionKey);
    const draftContent = args.text?.trim() || undefined;
    const title = getLinkedInActionTitle({
      actionKey: args.actionKey,
      targetLabel: getLinkedInProspectLabel(prospect),
    });
    const requestId: Id<"agentActionRequests"> = await ctx.runMutation(
      internal.socialActions.createActionRequestInternal,
      {
        userId,
        prospectId: prospect._id,
        workspaceId: prospect.workspaceId,
        provider: metadata.provider,
        actionKey: args.actionKey,
        title,
        description: draftContent,
        toolSlug: metadata.toolSlug,
        toolVersion: metadata.toolVersion,
        riskLevel: metadata.riskLevel,
        approvalMode: metadata.approvalMode,
        uiArtifactType: metadata.uiArtifactType,
        entityType: metadata.entityType,
        requiresConnectedAccount: metadata.requiresConnectedAccount,
        status: "pending_approval",
        argumentsSnapshot: {
          postId: args.postId,
          reactionType: args.reactionType,
          text: draftContent,
          mediaUrls: [],
          mediaDescriptions: [],
          mediaKinds: [],
          targetLabel: getLinkedInProspectLabel(prospect),
        },
        sourcePostData: args.postData,
        sourcePostId: args.postId,
        draftContent,
      }
    );

    await ctx.runMutation(
      internal.socialActions.createActionRequestNotificationInternal,
      {
        actionRequestId: requestId,
        type: "social_action_request",
        message:
          draftContent ||
          (args.actionKey === "linkedin_comment_on_post"
            ? "Approval required before posting this LinkedIn comment."
            : "Approval required before reacting on LinkedIn."),
      }
    );

    return {
      success: true as const,
      actionRequestId: String(requestId),
      title,
    };
  },
});

export const sendLinkedInMessage = action({
  args: {
    prospectId: v.id("prospects"),
    conversationId: v.optional(v.string()),
    text: v.string(),
    mediaUrls: v.optional(v.array(v.string())),
    actionRequestId: v.optional(v.id("agentActionRequests")),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    return await sendLinkedInMessageForUser(ctx, {
      userId,
      prospectId: args.prospectId,
      conversationId: args.conversationId,
      text: args.text,
      mediaUrls: args.mediaUrls,
      actionRequestId: args.actionRequestId,
    });
  },
});

export const sendLinkedInMessageInternal = internalAction({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    conversationId: v.optional(v.string()),
    text: v.string(),
    mediaUrls: v.optional(v.array(v.string())),
    actionRequestId: v.optional(v.id("agentActionRequests")),
  },
  handler: async (ctx, args) => {
    return await sendLinkedInMessageForUser(ctx, args);
  },
});

export const reactToLinkedInPostInternal = internalAction({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    postId: v.string(),
    reactionType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const prospect = await getOwnedLinkedInProspectForUser(
      ctx,
      args.userId,
      args.prospectId
    );
    if (!prospect) {
      throw new Error("Prospect not found.");
    }

    const storedAccount = await getConnectedLinkedInAccountOrThrow(
      ctx,
      args.userId
    );
    await reactToLinkedInPost({
      accountId: storedAccount.accountId,
      postId: args.postId,
      reactionType: args.reactionType,
    });

    return {
      success: true as const,
      targetUserId: prospect.linkedinUserUrn,
    };
  },
});

export const commentOnLinkedInPostInternal = internalAction({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    postId: v.string(),
    text: v.string(),
    mediaUrls: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const prospect = await getOwnedLinkedInProspectForUser(
      ctx,
      args.userId,
      args.prospectId
    );
    if (!prospect) {
      throw new Error("Prospect not found.");
    }

    const storedAccount = await getConnectedLinkedInAccountOrThrow(
      ctx,
      args.userId
    );
    const result = await commentOnLinkedInPost({
      accountId: storedAccount.accountId,
      postId: args.postId,
      text: args.text,
      mediaUrls: args.mediaUrls,
    });

    return {
      success: true as const,
      targetUserId: prospect.linkedinUserUrn,
      postedTextPreview: args.text.trim() || undefined,
      commentId:
        typeof (result as { comment_id?: unknown })?.comment_id === "string"
          ? ((result as { comment_id?: string }).comment_id ?? undefined)
          : undefined,
    };
  },
});

export const sendLinkedInInvitationInternal = internalAction({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const prospect = await getOwnedLinkedInProspectForUser(
      ctx,
      args.userId,
      args.prospectId
    );
    if (!prospect) {
      throw new Error("Prospect not found.");
    }

    const prospectIdentity = getProspectLinkedInIdentity(prospect);
    if (!prospectIdentity.providerId) {
      throw new Error(
        "This LinkedIn prospect is missing a provider id needed for invitations."
      );
    }

    const storedAccount = await getConnectedLinkedInAccountOrThrow(
      ctx,
      args.userId
    );
    await sendLinkedInInvitation({
      accountId: storedAccount.accountId,
      providerId: prospectIdentity.providerId,
      email: prospect.email,
      message: args.message,
    });

    return {
      success: true as const,
      targetUserId: prospectIdentity.providerId,
      postedTextPreview: args.message?.trim() || undefined,
    };
  },
});

export const handleUnipileWebhookPayloadInternal = internalAction({
  args: {
    payload: v.any(),
  },
  handler: async (ctx, { payload }) => {
    const event =
      typeof payload?.event === "string"
        ? payload.event
        : typeof payload?.type === "string"
          ? payload.type
          : typeof payload?.name === "string"
            ? payload.name
            : undefined;
    const accountId =
      typeof payload?.account_id === "string" ? payload.account_id : undefined;

    if (!accountId) {
      return { processed: false as const };
    }

    const linkedAccount = await ctx.runQuery(
      internalLinkedInStore.getLinkedInAccountByAccountIdInternal,
      { accountId }
    );
    if (!linkedAccount) {
      return { processed: false as const };
    }

    if (
      event === "creation_success" ||
      event === "reconnected" ||
      event === "sync_success" ||
      event === "ok" ||
      event === "connecting" ||
      event === "error" ||
      event === "credentials" ||
      event === "permissions" ||
      event === "deleted"
    ) {
      const status = await syncLinkedInAccountForUser(
        ctx,
        linkedAccount.userId
      );
      await syncLinkedInAccountHealthNotification(ctx, {
        userId: linkedAccount.userId,
        status,
      });
      if (
        status.status === "connected" &&
        (event === "creation_success" ||
          event === "reconnected" ||
          event === "sync_success" ||
          event === "ok")
      ) {
        await scheduleLinkedInStyleBackfillIfNeeded(ctx, linkedAccount.userId);
      }
      return { processed: true as const };
    }

    const participantProviderId = getWebhookParticipantProviderId(
      payload,
      linkedAccount
    );
    if (event === "new_relation") {
      const prospect = participantProviderId
        ? await ctx.runQuery(
            internalProspectsApi.getProspectByLinkedInUserUrnInternal,
            {
              userId: linkedAccount.userId,
              linkedinUserUrn: participantProviderId,
            }
          )
        : null;

      if (prospect) {
        await ctx.runMutation(internal.outreach.onProspectLinkedInResponse, {
          prospectId: prospect._id,
          responseType: "invite",
          responseMessageId:
            getWebhookString(payload, "provider_id", "relationship_id") ??
            `${accountId}:new_relation:${Date.now()}`,
        });
      }

      return { processed: true as const };
    }

    const conversationId =
      typeof payload?.chat_id === "string"
        ? payload.chat_id
        : getWebhookString(payload, "conversation_id");
    if (!conversationId) {
      return { processed: false as const };
    }

    if (event === "message_read") {
      const readAtMs = toMs(
        getWebhookString(payload, "timestamp", "read_at") ??
          new Date().toISOString()
      );
      await ctx.runMutation(
        internal.platformConversations.markConversationMessagesReadInternal,
        {
          userId: linkedAccount.userId,
          conversationId,
          readAt: readAtMs || Date.now(),
        }
      );
      return { processed: true as const };
    }

    if (
      event !== "message_received" &&
      event !== "message_reaction" &&
      event !== "message_edited" &&
      event !== "message_deleted" &&
      event !== "message_delivered" &&
      event !== "new_relation"
    ) {
      return { processed: false as const };
    }

    const existingSnapshot = await ctx.runQuery(
      internal.platformConversations.getConversationSnapshotInternal,
      {
        userId: linkedAccount.userId,
        platform: "linkedin",
        conversationId,
      }
    );
    const prospect =
      existingSnapshot?.conversation?.prospectId || !participantProviderId
        ? existingSnapshot?.conversation?.prospectId
          ? await ctx.runQuery(internal.prospects.getProspectInternal, {
              prospectId: existingSnapshot.conversation.prospectId,
            })
          : null
        : await ctx.runQuery(
            internalProspectsApi.getProspectByLinkedInUserUrnInternal,
            {
              userId: linkedAccount.userId,
              linkedinUserUrn: participantProviderId,
            }
          );

    const messageId =
      typeof payload?.message_id === "string"
        ? payload.message_id
        : (existingSnapshot?.conversation?.latestMessageId ??
          `${conversationId}:${event}:${getWebhookString(payload, "timestamp") ?? Date.now()}`);
    const timestamp =
      getWebhookString(payload, "timestamp") ?? new Date().toISOString();
    const attachments = normalizeWebhookAttachments(payload);
    const senderProviderId = getWebhookString(
      payload?.sender,
      "provider_id",
      "id"
    );
    const direction =
      senderProviderId && senderProviderId === linkedAccount.providerId
        ? "sent"
        : "received";

    await ctx.runMutation(
      internal.platformConversations.upsertConversationSnapshotInternal,
      {
        userId: linkedAccount.userId,
        workspaceId:
          prospect?.workspaceId ?? existingSnapshot?.conversation?.workspaceId,
        prospectId: prospect?._id ?? existingSnapshot?.conversation?.prospectId,
        platform: "linkedin",
        conversationId,
        accountId: accountId,
        sourceId:
          getWebhookString(payload, "chat_provider_id") ??
          existingSnapshot?.conversation?.sourceId,
        participantUserId: existingSnapshot?.conversation?.participantUserId,
        participantAttendeeId:
          getWebhookString(payload, "attendee_id") ??
          existingSnapshot?.conversation?.participantAttendeeId,
        participantProviderId:
          participantProviderId ??
          existingSnapshot?.conversation?.participantProviderId,
        participantUsername:
          existingSnapshot?.conversation?.participantUsername,
        participantName:
          getWebhookParticipantName(payload) ??
          existingSnapshot?.conversation?.participantName,
        participantHeadline:
          existingSnapshot?.conversation?.participantHeadline,
        participantAvatarUrl:
          getWebhookString(payload?.sender, "picture_url") ??
          existingSnapshot?.conversation?.participantAvatarUrl,
        participantProfileUrl:
          getWebhookString(payload?.sender, "profile_url") ??
          existingSnapshot?.conversation?.participantProfileUrl,
        participantVerified:
          existingSnapshot?.conversation?.participantVerified,
        eligibilityEnabled:
          existingSnapshot?.conversation?.eligibilityEnabled ?? true,
        eligibilityReasonCode:
          existingSnapshot?.conversation?.eligibilityReasonCode ?? "eligible",
        eligibilityReasonLabel:
          existingSnapshot?.conversation?.eligibilityReasonLabel ??
          "Message available on LinkedIn.",
        disabledFeatures: existingSnapshot?.conversation?.disabledFeatures,
        readOnly: existingSnapshot?.conversation?.readOnly,
        contentType:
          existingSnapshot?.conversation?.contentType ??
          getWebhookString(payload, "content_type"),
        lastSyncedAt: Date.now(),
        lastSyncAttemptAt: existingSnapshot?.conversation?.lastSyncAttemptAt,
        lastSyncSuccessAt: Date.now(),
        lastSyncErrorCode: existingSnapshot?.conversation?.lastSyncErrorCode,
        lastSyncErrorMessage:
          existingSnapshot?.conversation?.lastSyncErrorMessage,
        messages: [
          {
            messageId,
            providerMessageId: getWebhookString(payload, "provider_id"),
            direction,
            senderUserId: senderProviderId,
            senderAttendeeId: getWebhookString(
              payload?.sender,
              "attendee_id",
              "id"
            ),
            text:
              getWebhookString(payload, "message", "text") ??
              (event === "message_deleted"
                ? "Message deleted"
                : existingSnapshot?.messages?.find(
                    (message: any) => message.messageId === messageId
                  )?.text),
            createdAt: timestamp,
            createdAtMs: toMs(timestamp) || Date.now(),
            attachments,
            deliveredAt:
              event === "message_delivered"
                ? toMs(timestamp) || Date.now()
                : undefined,
            readAt:
              event === "message_read"
                ? toMs(timestamp) || Date.now()
                : undefined,
            messageType: existingSnapshot?.messages?.find(
              (message: any) => message.messageId === messageId
            )?.messageType,
            isEvent:
              event !== "message_received" ||
              Boolean(
                existingSnapshot?.messages?.find(
                  (message: any) => message.messageId === messageId
                )?.isEvent
              ),
            sourceEventType: event as any,
          },
        ],
      }
    );

    if (
      event === "message_received" &&
      direction === "received" &&
      prospect?._id
    ) {
      await ctx.runMutation(internal.outreach.onProspectLinkedInResponse, {
        prospectId: prospect._id,
        responseType: "dm",
        responseMessageId: messageId,
        responseText: getWebhookString(payload, "message", "text") ?? undefined,
        responseData: payload,
        conversationId,
      });
    }

    return { processed: true as const };
  },
});
