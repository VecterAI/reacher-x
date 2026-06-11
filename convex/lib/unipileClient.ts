"use node";

import { basename } from "node:path";
import {
  UnipileClient,
  UnipileError as SdkUnipileError,
} from "unipile-node-sdk";

const DEFAULT_HOSTED_AUTH_EXPIRY_MS = 1000 * 60 * 30;

export class UnipileError extends Error {
  status?: number;
  type?: string;
  detail?: string;
  retryable: boolean;
  classification: string;

  constructor(args: {
    message: string;
    status?: number;
    type?: string;
    detail?: string;
    retryable?: boolean;
    classification?: string;
  }) {
    super(args.message);
    this.name = "UnipileError";
    this.status = args.status;
    this.type = args.type;
    this.detail = args.detail;
    this.retryable = args.retryable ?? false;
    this.classification = args.classification ?? "unknown";
  }
}

export type UnipileFailure = {
  classification: string;
  message: string;
  retryable: boolean;
  status?: number;
  type?: string;
};

type UnipileRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: BodyInit | Record<string, unknown> | null;
  json?: unknown;
  headers?: Record<string, string>;
};

type UnipileProblemResponse = {
  title?: string;
  detail?: string;
  type?: string;
  status?: number;
};

export type LinkedInUnipileAccount = {
  id: string;
  type: "LINKEDIN";
  name?: string;
  created_at?: string;
  connection_params?: {
    im?: {
      id?: string;
      publicIdentifier?: string;
      username?: string;
      premiumContractId?: string | null;
      premiumFeatures?: string[];
      organizations?: Array<{
        name: string;
        messaging_enabled?: boolean;
        organization_urn?: string;
        mailbox_urn?: string;
      }>;
    };
  };
  sources?: Array<{
    id: string;
    status:
      | "OK"
      | "STOPPED"
      | "ERROR"
      | "CREDENTIALS"
      | "PERMISSIONS"
      | "CONNECTING";
  }>;
};

export type LinkedInOwnProfile = {
  provider: "LINKEDIN";
  provider_id: string;
  entity_urn?: string;
  object_urn?: string;
  first_name?: string;
  last_name?: string;
  profile_picture_url?: string | null;
  public_profile_url?: string;
  public_identifier?: string;
  headline?: string;
  location?: string;
  email?: string;
  premium?: boolean;
  open_profile?: boolean;
  occupation?: string;
  organizations?: Array<{
    id: string;
    mailbox_id: string;
    name: string;
  }>;
  recruiter?: Record<string, unknown> | null;
  sales_navigator?: Record<string, unknown> | null;
};

export type LinkedInUserProfile = {
  provider?: "LINKEDIN";
  provider_id: string;
  public_identifier?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  headline?: string;
  summary?: string;
  location?: string;
  websites?: string[];
  profile_picture_url?: string;
  profile_picture_url_large?: string;
  background_picture_url?: string;
  can_send_inmail?: boolean;
  is_open_profile?: boolean;
  is_premium?: boolean;
  is_influencer?: boolean;
  is_creator?: boolean;
  is_relationship?: boolean;
  invitation?: {
    type?: "SENT" | "RECEIVED";
    status?: "PENDING" | "IGNORED" | "WITHDRAWN";
  };
  follower_count?: number;
  connections_count?: number;
  public_profile_url?: string;
  network_distance?:
    | "FIRST_DEGREE"
    | "SECOND_DEGREE"
    | "THIRD_DEGREE"
    | "OUT_OF_NETWORK";
};

export type UnipileChat = {
  id: string;
  account_id: string;
  account_type: "LINKEDIN";
  provider_id?: string;
  attendee_provider_id?: string;
  name?: string | null;
  timestamp?: string | null;
  unread_count?: number;
  read_only?: number;
  disabledFeatures?: string[];
  subject?: string;
  organization_id?: string;
  mailbox_id?: string;
  content_type?: "inmail" | "sponsored" | "linkedin_offer";
  folder?: string[];
};

export type UnipileMessage = {
  id: string;
  message_id: string;
  account_id: string;
  chat_id: string;
  provider_id?: string;
  sender_id?: string;
  sender_attendee_id?: string;
  text?: string | null;
  timestamp: string;
  is_sender?: number;
  seen?: number;
  delivered?: number;
  edited?: number;
  deleted?: number;
  is_event?: number;
  event_type?: number;
  message_type?:
    | "MESSAGE"
    | "INVITATION"
    | "INMAIL"
    | "INMAIL_DECLINE"
    | "INMAIL_REPLY"
    | "INMAIL_ACCEPT";
  attachments?: Array<Record<string, unknown>>;
  quoted?: {
    message_id?: string;
  } | null;
};

export type LinkedInUnipilePost = {
  provider?: "LINKEDIN";
  id: string;
  social_id?: string;
  share_url?: string;
  text?: string;
  date?: string;
  parsed_datetime?: string;
  reaction_counter?: number;
  comment_counter?: number;
  repost_counter?: number;
  impressions_counter?: number;
  user_reacted?: string;
  author?: {
    public_identifier?: string | null;
    id?: string | null;
    name?: string | null;
    is_company?: boolean;
    headline?: string;
    profile_picture_url?: string;
  };
  permissions?: {
    can_react?: boolean;
    can_share?: boolean;
    can_post_comments?: boolean;
  };
  attachments?: Array<Record<string, unknown>>;
};

export type LinkedInUnipileComment = {
  object?: "Comment";
  id: string;
  post_id: string;
  post_urn?: string;
  thread_id?: string;
  author?: string | null;
  author_details?: {
    id?: string | null;
    headline?: string | null;
    profile_url?: string | null;
    profile_picture_url?: string | null;
    network_distance?:
      | "FIRST_DEGREE"
      | "SECOND_DEGREE"
      | "THIRD_DEGREE"
      | "OUT_OF_NETWORK"
      | null;
  };
  date?: string;
  text?: string;
  picture_url?: string;
  reaction_counter?: number;
  reply_counter?: number;
  impressions_counter?: number;
  user_reacted?: string;
};

export type LinkedInUnipileCommentList = {
  object?: "CommentList";
  items: LinkedInUnipileComment[];
  cursor: string | null;
  total_items?: number | null;
  paging?: {
    start?: number | null;
    page_count?: number;
    total_count?: number | null;
  };
};

let cachedClient: UnipileClient | null = null;

function getEnvValue(...keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return null;
}

function stripApiSuffix(pathname: string) {
  return pathname.replace(/\/api(?:\/v\d+)?\/?$/i, "").replace(/\/+$/, "");
}

function normalizeBaseUrl(raw: string): string {
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withProtocol);
  url.pathname = stripApiSuffix(url.pathname);
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
}

export function getUnipileBaseUrl(): string {
  const raw = getEnvValue("UNIPILE_BASE_URL", "UNIPILE_API_URL", "UNIPILE_DSN");
  if (!raw) {
    throw new Error(
      "Missing Unipile configuration. Set UNIPILE_BASE_URL (or UNIPILE_API_URL / UNIPILE_DSN)."
    );
  }
  return normalizeBaseUrl(raw);
}

export function getUnipileHostedApiUrl(): string {
  return getUnipileBaseUrl();
}

function getUnipileApiKey(): string {
  const apiKey = getEnvValue("UNIPILE_API_KEY");
  if (!apiKey) {
    throw new Error("Missing UNIPILE_API_KEY.");
  }
  return apiKey;
}

function getUnipileClient() {
  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = new UnipileClient(getUnipileBaseUrl(), getUnipileApiKey(), {
    apiVersion: "v1",
    validateRequestPayload: false,
  });
  return cachedClient;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseProblemBody(value: unknown): UnipileProblemResponse | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  return {
    title: typeof value.title === "string" ? value.title : undefined,
    detail: typeof value.detail === "string" ? value.detail : undefined,
    type: typeof value.type === "string" ? value.type : undefined,
    status: typeof value.status === "number" ? value.status : undefined,
  };
}

function getRetryableFlag(status?: number, type?: string) {
  if (status === 429 || status === 503 || status === 504) {
    return true;
  }
  return (
    type === "errors/request_timeout" ||
    type === "errors/network_down" ||
    type === "errors/provider_error" ||
    type === "errors/service_unavailable"
  );
}

function classifyProblem(status?: number, type?: string) {
  switch (type) {
    case "errors/expired_credentials":
      return "reauth_required";
    case "errors/disconnected_account":
      return "disconnected_account";
    case "errors/disconnected_feature":
      return "feature_unavailable";
    case "errors/feature_not_subscribed":
      return "feature_not_subscribed";
    case "errors/subscription_required":
      return "subscription_required";
    case "errors/action_required":
      return "action_required";
    case "errors/multiple_sessions":
      return "multiple_sessions";
    case "errors/too_many_requests":
      return "rate_limited";
    case "errors/comments_disabled":
      return "comments_disabled";
    case "errors/unsupported_media_type":
      return "unsupported_media_type";
    case "errors/no_connection_with_recipient":
      return "not_connected";
    case "errors/already_connected":
      return "already_connected";
    case "errors/already_invited_recently":
      return "already_invited_recently";
    case "errors/user_unreachable":
      return "user_unreachable";
    default:
      break;
  }

  if (status === 401) return "reauth_required";
  if (status === 403) return "forbidden";
  if (status === 404) return "target_not_found";
  if (status === 415) return "unsupported_media_type";
  if (status === 422) return "unprocessable";
  if (status === 429) return "rate_limited";
  if (status === 503 || status === 504) return "service_unavailable";
  return "unknown";
}

function toUnipileError(error: unknown): UnipileError {
  if (error instanceof UnipileError) {
    return error;
  }

  const body = isObjectRecord(error) ? parseProblemBody(error.body) : null;
  const message =
    body?.detail ??
    body?.title ??
    (error instanceof Error ? error.message : String(error));

  return new UnipileError({
    message,
    status: body?.status,
    type: body?.type,
    detail: body?.detail,
    retryable: getRetryableFlag(body?.status, body?.type),
    classification: classifyProblem(body?.status, body?.type),
  });
}

async function withUnipileErrorHandling<T>(callback: () => Promise<T>) {
  try {
    return await callback();
  } catch (error) {
    if (error instanceof SdkUnipileError || error instanceof UnipileError) {
      throw toUnipileError(error);
    }
    throw toUnipileError(error);
  }
}

function pathToSegments(path: string) {
  return path
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/api\/v\d+\//i, "")
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean);
}

function toParameters(
  query?: Record<string, string | number | boolean | undefined | null>
) {
  const parameters: Record<string, string> = {};
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    parameters[key] = String(value);
  }
  return parameters;
}

function toLinkedInSectionsParameter(sections?: string[]) {
  return sections?.find((section) => section.trim().length > 0)?.trim();
}

export function getUnipileFailure(error: unknown): UnipileFailure {
  const normalized = toUnipileError(error);
  return {
    classification: normalized.classification,
    message: normalized.message,
    retryable: normalized.retryable,
    status: normalized.status,
    type: normalized.type,
  };
}

export const getLinkedInFailure = getUnipileFailure;

export async function requestUnipile<T>(
  path: string,
  options: UnipileRequestOptions = {}
): Promise<T> {
  return await withUnipileErrorHandling(async () => {
    const headers =
      options.json !== undefined
        ? {
            "Content-Type": "application/json",
            ...options.headers,
          }
        : options.headers;

    const body =
      options.json !== undefined
        ? (options.json as Record<string, unknown>)
        : options.body;

    return (await getUnipileClient().request.send({
      path: pathToSegments(path),
      method: options.method ?? "GET",
      parameters: toParameters(options.query),
      body: (body ?? undefined) as any,
      headers,
    })) as T;
  });
}

function guessFilename(url: string, contentType?: string | null) {
  try {
    const parsed = new URL(url);
    const base = basename(parsed.pathname);
    if (base && !base.includes(".")) {
      if (contentType?.includes("image/")) {
        return `${base}.jpg`;
      }
      if (contentType?.includes("video/")) {
        return `${base}.mp4`;
      }
    }
    if (base) {
      return base;
    }
  } catch {
    // fall through
  }

  if (contentType?.includes("image/")) return "attachment.jpg";
  if (contentType?.includes("video/")) return "attachment.mp4";
  if (contentType?.includes("audio/")) return "attachment.m4a";
  return "attachment.bin";
}

async function loadRemoteAttachment(url: string): Promise<[string, Buffer]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch attachment: ${response.status}`);
  }

  const contentType =
    response.headers.get("content-type") ?? "application/octet-stream";
  const filename = guessFilename(url, contentType);
  const buffer = Buffer.from(await response.arrayBuffer());
  return [filename, buffer];
}

async function loadRemoteAttachments(urls?: string[]) {
  const attachments: Array<[string, Buffer]> = [];
  for (const url of urls ?? []) {
    if (typeof url !== "string" || url.trim().length === 0) {
      continue;
    }
    attachments.push(await loadRemoteAttachment(url));
  }
  return attachments;
}

export async function appendRemoteFile(
  formData: FormData,
  field: string,
  url: string
) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch attachment: ${response.status}`);
  }

  const contentType =
    response.headers.get("content-type") ?? "application/octet-stream";
  const buffer = await response.arrayBuffer();
  const blob = new Blob([buffer], { type: contentType });
  formData.append(field, blob, guessFilename(url, contentType));
}

export async function createHostedAuthLink(args: {
  type: "create" | "reconnect";
  reconnectAccountId?: string;
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
  notifyUrl?: string;
  name?: string;
}) {
  const expiresOn = new Date(
    Date.now() + DEFAULT_HOSTED_AUTH_EXPIRY_MS
  ).toISOString();

  return await withUnipileErrorHandling(async () => {
    if (args.type === "create") {
      return await getUnipileClient().account.createHostedAuthLink({
        type: "create",
        providers: ["LINKEDIN"],
        api_url: getUnipileHostedApiUrl(),
        expiresOn,
        name: args.name,
        success_redirect_url: args.successRedirectUrl,
        failure_redirect_url: args.failureRedirectUrl,
        notify_url: args.notifyUrl,
      });
    }

    return await getUnipileClient().account.createHostedAuthLink({
      type: "reconnect",
      reconnect_account: args.reconnectAccountId ?? "",
      api_url: getUnipileHostedApiUrl(),
      expiresOn,
      name: args.name,
      success_redirect_url: args.successRedirectUrl,
      failure_redirect_url: args.failureRedirectUrl,
      notify_url: args.notifyUrl,
    });
  });
}

export async function listLinkedInAccounts(): Promise<
  LinkedInUnipileAccount[]
> {
  return await withUnipileErrorHandling(async () => {
    const payload = await getUnipileClient().account.getAll({ limit: 100 });
    return payload.items.filter(
      (account) => account.type === "LINKEDIN"
    ) as unknown as LinkedInUnipileAccount[];
  });
}

export async function getLinkedInAccount(accountId: string) {
  return await withUnipileErrorHandling(async () => {
    return (await getUnipileClient().account.getOne(
      accountId
    )) as LinkedInUnipileAccount;
  });
}

export async function deleteLinkedInAccount(accountId: string) {
  return await withUnipileErrorHandling(async () => {
    return await getUnipileClient().account.delete(accountId);
  });
}

export async function syncLinkedInAccount(accountId: string) {
  return await withUnipileErrorHandling(async () => {
    return await getUnipileClient().account.resyncLinkedinAccount({
      account_id: accountId,
    });
  });
}

export async function getLinkedInOwnProfile(accountId: string) {
  return await withUnipileErrorHandling(async () => {
    return (await getUnipileClient().users.getOwnProfile(
      accountId
    )) as LinkedInOwnProfile;
  });
}

export async function listLinkedInChats(args: {
  accountId: string;
  limit?: number;
}): Promise<UnipileChat[]> {
  return await withUnipileErrorHandling(async () => {
    const payload = await getUnipileClient().messaging.getAllChats({
      account_type: "LINKEDIN",
      account_id: args.accountId,
      limit: args.limit ?? 100,
    });
    return payload.items as UnipileChat[];
  });
}

export async function listLinkedInChatsForAttendee(args: {
  attendeeId: string;
  accountId: string;
  limit?: number;
}): Promise<UnipileChat[]> {
  return await withUnipileErrorHandling(async () => {
    const payload = await getUnipileClient().messaging.getAllChatsFromAttendee({
      attendee_id: args.attendeeId,
      account_id: args.accountId,
      limit: args.limit ?? 50,
    });
    return payload.items as UnipileChat[];
  });
}

export async function listLinkedInChatMessages(args: {
  chatId: string;
  limit?: number;
}): Promise<UnipileMessage[]> {
  return await withUnipileErrorHandling(async () => {
    const payload = await getUnipileClient().messaging.getAllMessagesFromChat({
      chat_id: args.chatId,
      limit: args.limit ?? 100,
    });
    return payload.items as unknown as UnipileMessage[];
  });
}

export async function startLinkedInChat(args: {
  accountId: string;
  attendeeProviderId: string;
  text?: string;
  mediaUrls?: string[];
}) {
  return await withUnipileErrorHandling(async () => {
    const attachments = await loadRemoteAttachments(args.mediaUrls);

    if (!args.text?.trim() && attachments.length === 0) {
      throw new Error(
        "LinkedIn chat requires text or at least one attachment."
      );
    }

    return await getUnipileClient().messaging.startNewChat({
      account_id: args.accountId,
      attendees_ids: [args.attendeeProviderId],
      text: args.text?.trim() ?? "",
      ...(attachments.length > 0 ? { attachments } : {}),
    });
  });
}

export async function sendLinkedInChatMessage(args: {
  chatId: string;
  accountId: string;
  text?: string;
  quoteId?: string;
  mediaUrls?: string[];
}) {
  const attachments = await loadRemoteAttachments(args.mediaUrls);

  if (args.quoteId?.trim()) {
    const formData = new FormData();
    formData.set("account_id", args.accountId);
    if (args.text?.trim()) {
      formData.set("text", args.text.trim());
    }
    formData.set("quote_id", args.quoteId.trim());
    for (const mediaUrl of args.mediaUrls ?? []) {
      await appendRemoteFile(formData, "attachments", mediaUrl);
    }

    return await requestUnipile<{ message_id?: string | null }>(
      `/api/v1/chats/${encodeURIComponent(args.chatId)}/messages`,
      {
        method: "POST",
        body: formData,
      }
    );
  }

  return await withUnipileErrorHandling(async () => {
    if (!args.text?.trim() && attachments.length === 0) {
      throw new Error(
        "LinkedIn message requires text or at least one attachment."
      );
    }

    return await getUnipileClient().messaging.sendMessage(
      {
        chat_id: args.chatId,
        text: args.text?.trim() ?? "",
        ...(attachments.length > 0 ? { attachments } : {}),
      },
      {
        extra_params: {
          account_id: args.accountId,
        },
      }
    );
  });
}

export async function sendLinkedInInvitation(args: {
  accountId: string;
  providerId: string;
  email?: string;
  message?: string;
}) {
  return await withUnipileErrorHandling(async () => {
    return await getUnipileClient().users.sendInvitation(
      {
        account_id: args.accountId,
        provider_id: args.providerId,
        ...(args.message?.trim() ? { message: args.message.trim() } : {}),
      },
      args.email?.trim()
        ? {
            extra_params: {
              user_email: args.email.trim(),
            },
          }
        : undefined
    );
  });
}

export async function getLinkedInPost(args: {
  accountId: string;
  postId: string;
}) {
  return await requestUnipile<LinkedInUnipilePost>(
    `/api/v1/posts/${encodeURIComponent(args.postId)}`,
    {
      method: "GET",
      query: {
        account_id: args.accountId,
      },
    }
  );
}

export async function getLinkedInUserProfile(args: {
  accountId: string;
  identifier: string;
  linkedinApi?: "recruiter" | "sales_navigator";
  sections?: string[];
}) {
  return await requestUnipile<LinkedInUserProfile>(
    `/api/v1/users/${encodeURIComponent(args.identifier)}`,
    {
      method: "GET",
      query: {
        account_id: args.accountId,
        linkedin_api: args.linkedinApi,
        linkedin_sections: toLinkedInSectionsParameter(args.sections),
      },
    }
  );
}

export async function listLinkedInPostComments(args: {
  accountId: string;
  postId: string;
  cursor?: string;
  limit?: number;
  sortBy?: "MOST_RECENT" | "MOST_RELEVANT";
  commentId?: string;
}) {
  return await requestUnipile<LinkedInUnipileCommentList>(
    `/api/v1/posts/${encodeURIComponent(args.postId)}/comments`,
    {
      method: "GET",
      query: {
        account_id: args.accountId,
        cursor: args.cursor,
        limit: args.limit,
        sort_by: args.sortBy,
        comment_id: args.commentId,
      },
    }
  );
}

const LINKEDIN_REACTION_TYPE_MAP: Record<string, string> = {
  like: "like",
  celebrate: "celebrate",
  praise: "celebrate",
  support: "support",
  appreciation: "support",
  love: "love",
  empathy: "love",
  insightful: "insightful",
  interest: "insightful",
  funny: "funny",
};

export function normalizeLinkedInReactionType(
  reactionType?: string
): string | undefined {
  if (typeof reactionType !== "string") {
    return undefined;
  }

  const normalized = reactionType.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  return LINKEDIN_REACTION_TYPE_MAP[normalized] ?? "like";
}

export async function reactToLinkedInPost(args: {
  accountId: string;
  postId: string;
  commentId?: string;
  reactionType?: string;
  asOrganization?: string;
}) {
  return await withUnipileErrorHandling(async () => {
    const reactionType = normalizeLinkedInReactionType(args.reactionType);
    return await getUnipileClient().users.sendPostReaction(
      {
        account_id: args.accountId,
        post_id: args.postId,
        ...(reactionType ? { reaction_type: reactionType as any } : {}),
      },
      args.commentId || args.asOrganization
        ? {
            extra_params: {
              ...(args.commentId ? { comment_id: args.commentId } : {}),
              ...(args.asOrganization
                ? { as_organization: args.asOrganization }
                : {}),
            },
          }
        : undefined
    );
  });
}

export async function commentOnLinkedInPost(args: {
  accountId: string;
  postId: string;
  text: string;
  commentId?: string;
  asOrganization?: string;
  mediaUrls?: string[];
}) {
  const trimmedText = args.text.trim();
  if (!trimmedText) {
    throw new Error("LinkedIn comment text is required.");
  }

  if (
    (args.mediaUrls?.length ?? 0) > 0 ||
    args.commentId ||
    args.asOrganization
  ) {
    const formData = new FormData();
    formData.set("account_id", args.accountId);
    formData.set("text", trimmedText);
    if (args.commentId?.trim()) {
      formData.set("comment_id", args.commentId.trim());
    }
    if (args.asOrganization?.trim()) {
      formData.set("as_organization", args.asOrganization.trim());
    }
    for (const mediaUrl of (args.mediaUrls ?? []).slice(0, 1)) {
      await appendRemoteFile(formData, "attachments", mediaUrl);
    }

    return await requestUnipile<{ comment_id?: string }>(
      `/api/v1/posts/${encodeURIComponent(args.postId)}/comments`,
      {
        method: "POST",
        body: formData,
      }
    );
  }

  return await withUnipileErrorHandling(async () => {
    return await getUnipileClient().users.sendPostComment({
      account_id: args.accountId,
      post_id: args.postId,
      text: trimmedText,
    });
  });
}

export async function createUnipileWebhook(args: {
  source: "messaging" | "users" | "account_status";
  events: string[];
  requestUrl: string;
  secretHeader?: string;
}) {
  if (args.source === "users") {
    return await requestUnipile<{ webhook_id: string }>("/api/v1/webhooks", {
      method: "POST",
      json: {
        request_url: args.requestUrl,
        format: "json",
        source: args.source,
        events: args.events,
        enabled: true,
        headers: args.secretHeader
          ? [{ key: "x-reacherx-webhook-secret", value: args.secretHeader }]
          : undefined,
      },
    });
  }

  return await withUnipileErrorHandling(async () => {
    return await getUnipileClient().webhook.create(
      {
        request_url: args.requestUrl,
        format: "json",
        source: args.source as "messaging" | "account_status",
        events: args.events as any,
        enabled: true,
        headers: args.secretHeader
          ? [{ key: "x-reacherx-webhook-secret", value: args.secretHeader }]
          : undefined,
      },
      undefined
    );
  });
}
