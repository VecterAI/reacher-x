export type TwitterPostRef = {
  platform: "twitter";
  postId: string;
  conversationId?: string;
  authorId?: string;
  authorHandle?: string;
  url?: string;
};

export type TwitterAuthorSummary = {
  id?: string;
  handle?: string;
  name?: string;
  avatarUrl?: string;
  profileUrl?: string;
};

export type TwitterMetricsSummary = {
  replies?: number;
  reposts?: number;
  likes?: number;
  quotes?: number;
  views?: number;
  bookmarks?: number;
};

export type TwitterMediaSummary = {
  type: "photo" | "video" | "animated_gif" | "link";
  url: string;
  previewUrl?: string;
  altText?: string;
  width?: number;
  height?: number;
};

export type TwitterPostSummary = {
  platform: "twitter";
  ref: TwitterPostRef;
  url: string;
  textPreview: string;
  createdAt?: number;
  author?: TwitterAuthorSummary;
  metrics?: TwitterMetricsSummary;
  media?: TwitterMediaSummary[];
  inReplyToPostId?: string;
  inReplyToHandle?: string;
  quotePostId?: string;
  lang?: string;
  source?: string;
};

export type TwitterViewerState = {
  postId: string;
  liked: boolean;
  retweeted: boolean;
  bookmarked: boolean;
  followingAuthor: boolean;
  commented: boolean;
  pendingAction?: string;
  /** `local` = Convex-persisted engagement after confirmed in-app X actions (or merged verify). */
  source: "provider" | "optimistic" | "none" | "local";
  resolution: "verified" | "optimistic" | "unknown" | "requires_connection";
  canAct: boolean;
  requiresConnection: boolean;
  connectedAccountId?: string;
  lastSyncedAt?: number;
};

export type TwitterInteractionOrigin =
  | "agent"
  | "manual_reacherx"
  | "external_x"
  | "unknown";

export type TwitterInteractionDiscoverySource =
  | "live_reconcile"
  | "socialapi_incremental"
  | "socialapi_webhook"
  | "outreach_task"
  | "action_request";

export type TwitterInteractionStatus =
  | "active"
  | "missing"
  | "deleted"
  | "unavailable";

export type TwitterInteractionDirection = "incoming" | "outgoing";

export type TwitterConversationParticipant = {
  id?: string;
  handle?: string;
  name?: string;
  avatarUrl?: string;
  isViewer?: boolean;
};

export type TwitterReplyInteraction = {
  id: string;
  sourcePostRef: TwitterPostRef;
  sourcePostSummary?: TwitterPostSummary;
  replyPostRef: TwitterPostRef;
  replyPostSummary?: TwitterPostSummary;
  threadId: string;
  repliedAt: number;
  origin: TwitterInteractionOrigin;
  discoveredVia: TwitterInteractionDiscoverySource;
  status?: TwitterInteractionStatus;
  direction?: TwitterInteractionDirection;
  discoveredAt?: number;
  lastSeenAt?: number;
  lastHydratedAt?: number;
  lastHydrationErrorMessage?: string;
  participants?: TwitterConversationParticipant[];
  updatedAt?: number;
};

export type TwitterActionResultSummary = {
  actionKey: string;
  toolSlug: string;
  toolVersion: string;
  completedAt: number;
  targetPostId?: string;
  targetUserId?: string;
  createdPostId?: string;
  postedTextPreview?: string;
};

export type TwitterActionErrorSummary = {
  classification: string;
  message: string;
  retryable: boolean;
  suggestion?: string;
  code?: number;
  completedAt: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asTimestampMs(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 10_000_000_000 ? value : value * 1000;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : undefined;
  }
  return undefined;
}

function truncateText(value: string, maxLength = 280): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

export function createEmptyTwitterViewerState(input: {
  postId: string;
  connectedAccountId?: string;
  requiresConnection?: boolean;
  pendingAction?: string;
  source?: TwitterViewerState["source"];
  resolution?: TwitterViewerState["resolution"];
  lastSyncedAt?: number;
}): TwitterViewerState {
  const requiresConnection = input.requiresConnection ?? false;

  return {
    postId: input.postId,
    liked: false,
    retweeted: false,
    bookmarked: false,
    followingAuthor: false,
    commented: false,
    pendingAction: input.pendingAction,
    source: input.source ?? (requiresConnection ? "none" : "provider"),
    resolution:
      input.resolution ??
      (input.source === "optimistic"
        ? "optimistic"
        : input.source === "local"
          ? "verified"
          : requiresConnection
            ? "requires_connection"
            : "verified"),
    canAct: !requiresConnection,
    requiresConnection,
    connectedAccountId: input.connectedAccountId,
    lastSyncedAt: input.lastSyncedAt,
  };
}

export function buildTwitterPostUrl(input: {
  postId: string;
  authorHandle?: string;
}): string {
  const handle = input.authorHandle?.replace(/^@/, "") || "i";
  return `https://x.com/${handle}/status/${input.postId}`;
}

export function getTwitterPostId(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const ref = isRecord(value.ref) ? value.ref : undefined;
  return (
    asString(ref?.postId) ??
    asString(value.postId) ??
    asString(value.id_str) ??
    asString(value.id)
  );
}

export function getTwitterConversationId(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const ref = isRecord(value.ref) ? value.ref : undefined;
  return (
    asString(ref?.conversationId) ??
    asString(value.conversationId) ??
    asString(value.conversation_id_str) ??
    getTwitterPostId(value)
  );
}

export function isTwitterPostSummary(
  value: unknown
): value is TwitterPostSummary {
  return (
    isRecord(value) &&
    value.platform === "twitter" &&
    isRecord(value.ref) &&
    typeof value.ref.postId === "string" &&
    typeof value.textPreview === "string"
  );
}

export function getTwitterPostRef(value: unknown): TwitterPostRef | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const postId = getTwitterPostId(value);
  if (!postId) {
    return undefined;
  }

  if (isTwitterPostSummary(value)) {
    return value.ref;
  }

  const author = isRecord(value.user)
    ? value.user
    : isRecord(value.author)
      ? value.author
      : undefined;
  const authorHandle =
    asString(author?.screen_name) ??
    asString(author?.handle) ??
    asString(value.authorHandle);

  return {
    platform: "twitter",
    postId,
    conversationId: getTwitterConversationId(value),
    authorId:
      asString(author?.id_str) ??
      asString(author?.id) ??
      asString(value.authorId),
    authorHandle,
    url: asString(value.url) ?? buildTwitterPostUrl({ postId, authorHandle }),
  };
}

export function summarizeTwitterPost(
  value: unknown
): TwitterPostSummary | undefined {
  if (isTwitterPostSummary(value)) {
    return value;
  }
  if (!isRecord(value)) {
    return undefined;
  }

  const ref = getTwitterPostRef(value);
  if (!ref) {
    return undefined;
  }

  const author = isRecord(value.user)
    ? value.user
    : isRecord(value.author)
      ? value.author
      : undefined;
  const entities = isRecord(value.entities) ? value.entities : undefined;
  const media = Array.isArray(entities?.media)
    ? entities.media
        .filter(isRecord)
        .map((item): TwitterMediaSummary | null => {
          const type = asString(item.type);
          const url = asString(item.media_url_https) ?? asString(item.url);
          if (!type || !url) {
            return null;
          }
          return {
            type:
              type === "video" || type === "animated_gif"
                ? type
                : type === "link"
                  ? "link"
                  : "photo",
            url,
            previewUrl:
              asString(item.display_url) ?? asString(item.expanded_url),
            altText: asString(item.ext_alt_text),
            width: asNumber(
              isRecord(item.original_info)
                ? item.original_info.width
                : undefined
            ),
            height: asNumber(
              isRecord(item.original_info)
                ? item.original_info.height
                : undefined
            ),
          };
        })
        .filter((item): item is TwitterMediaSummary => item !== null)
    : undefined;

  const text =
    asString(value.full_text) ??
    asString(value.text) ??
    asString(value.textPreview) ??
    "";

  return {
    platform: "twitter",
    ref,
    url:
      asString(value.url) ??
      buildTwitterPostUrl({
        postId: ref.postId,
        authorHandle: ref.authorHandle,
      }),
    textPreview: truncateText(text),
    createdAt:
      asTimestampMs(value.createdAt) ??
      asTimestampMs(value.tweet_created_at) ??
      asTimestampMs(value.created_at),
    author: author
      ? {
          id: asString(author.id_str) ?? asString(author.id),
          handle:
            asString(author.screen_name) ??
            asString(author.handle) ??
            ref.authorHandle,
          name: asString(author.name),
          avatarUrl:
            asString(author.profile_image_url_https) ??
            asString(author.avatarUrl),
          profileUrl:
            asString(author.profileUrl) ??
            (asString(author.screen_name)
              ? `https://x.com/${asString(author.screen_name)}`
              : undefined),
        }
      : ref.authorHandle
        ? {
            handle: ref.authorHandle,
          }
        : undefined,
    metrics: {
      replies: asNumber(value.reply_count),
      reposts: asNumber(value.retweet_count),
      likes: asNumber(value.favorite_count),
      quotes: asNumber(value.quote_count),
      views: asNumber(value.views_count),
      bookmarks: asNumber(value.bookmark_count),
    },
    media: media && media.length > 0 ? media : undefined,
    inReplyToPostId:
      asString(value.in_reply_to_status_id_str) ??
      asString(value.inReplyToPostId),
    inReplyToHandle:
      asString(value.in_reply_to_screen_name) ??
      asString(value.inReplyToHandle),
    quotePostId:
      asString(value.quoted_status_id_str) ?? asString(value.quotePostId),
    lang: asString(value.lang),
    source: asString(value.source),
  };
}

export function getTwitterSummaryText(value: unknown): string {
  return summarizeTwitterPost(value)?.textPreview ?? "";
}

export function getTwitterSummaryAuthorHandle(
  value: unknown
): string | undefined {
  return summarizeTwitterPost(value)?.author?.handle;
}

export function getTwitterSummaryAuthorName(
  value: unknown
): string | undefined {
  return summarizeTwitterPost(value)?.author?.name;
}

export function getTwitterSummaryAuthorAvatar(
  value: unknown
): string | undefined {
  return summarizeTwitterPost(value)?.author?.avatarUrl;
}

export function summarizeTwitterActionResult(input: {
  actionKey: string;
  toolSlug: string;
  toolVersion: string;
  completedAt: number;
  targetPostId?: string;
  targetUserId?: string;
  createdPostId?: string;
  postedText?: string;
}): TwitterActionResultSummary {
  return {
    actionKey: input.actionKey,
    toolSlug: input.toolSlug,
    toolVersion: input.toolVersion,
    completedAt: input.completedAt,
    targetPostId: input.targetPostId,
    targetUserId: input.targetUserId,
    createdPostId: input.createdPostId,
    postedTextPreview: input.postedText
      ? truncateText(input.postedText, 160)
      : undefined,
  };
}

export function summarizeTwitterActionError(input: {
  classification: string;
  message: string;
  retryable: boolean;
  completedAt: number;
  suggestion?: string;
  code?: number;
}): TwitterActionErrorSummary {
  return {
    classification: input.classification,
    message: input.message,
    retryable: input.retryable,
    suggestion: input.suggestion,
    code: input.code,
    completedAt: input.completedAt,
  };
}
