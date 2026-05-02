import type { UnifiedPost } from "@/shared/lib/platforms/types";

export type LinkedInCommentSort = "MOST_RELEVANT" | "MOST_RECENT";

export interface LinkedInCommentAuthor {
  id?: string;
  name: string;
  headline?: string;
  profileUrl?: string;
  avatarUrl?: string;
  networkDistance?: "FIRST_DEGREE" | "SECOND_DEGREE" | "THIRD_DEGREE" | "OUT_OF_NETWORK";
  isViewer?: boolean;
}

export interface LinkedInPostComment {
  id: string;
  postId: string;
  threadId?: string;
  parentCommentId?: string;
  text: string;
  createdAt?: string;
  edited?: boolean;
  reactionCount: number;
  replyCount: number;
  viewerReacted?: string;
  author: LinkedInCommentAuthor;
  canReply: boolean;
  canReact: boolean;
  source: "unipile" | "linkdapi" | "preview" | "optimistic";
  permalink?: string;
}

export interface LinkedInCommentPage {
  items: LinkedInPostComment[];
  cursor: string | null;
  totalItems?: number | null;
  sort: LinkedInCommentSort;
  source: "unipile" | "linkdapi" | "preview";
}

export interface LinkedInPostThreadContext {
  resolvedPost: UnifiedPost;
  resolvedPostId: string;
  resolvedSocialId?: string;
  permissions: {
    canComment: boolean;
    canReact: boolean;
    canShare?: boolean;
  };
  eligibility: {
    enabled: boolean;
    reasonCode:
      | "eligible"
      | "missing_connection"
      | "missing_post_id"
      | "missing_social_id"
      | "feature_unavailable"
      | "subscription_required"
      | "action_required"
      | "restricted"
      | "comments_disabled"
      | "unknown";
    reasonLabel: string;
  };
  topLevelComments: LinkedInCommentPage;
  warning?: {
    code:
      | "rate_limited"
      | "provider_error"
      | "credentials_required"
      | "action_required"
      | "feature_not_subscribed"
      | "read_only_fallback";
    message: string;
  };
  source: "unipile" | "linkdapi" | "preview";
}

type LooseRecord = Record<string, unknown>;

function isRecord(value: unknown): value is LooseRecord {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function isLikelyLinkedInSocialPostId(value?: string) {
  return typeof value === "string" && /^\d+$/.test(value.trim());
}

export function normalizeLinkedInReadUrn(value?: string | null) {
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("urn:")) {
    return trimmed;
  }

  const segments = trimmed.split(":");
  const candidate = segments[segments.length - 1]?.trim();
  return candidate && candidate.length > 0 ? candidate : undefined;
}

export function extractLinkedInCanonicalPostIdFromUrl(url?: string | null) {
  const trimmed = getString(url);
  if (!trimmed) {
    return undefined;
  }

  const activityMatch = trimmed.match(/activity:(\d+)/i);
  if (activityMatch?.[1]) {
    return activityMatch[1];
  }

  const ugcMatch = trimmed.match(/ugcPost:(\d+)/i);
  if (ugcMatch?.[1]) {
    return `urn:li:ugcPost:${ugcMatch[1]}`;
  }

  const shareMatch = trimmed.match(/share:(\d+)/i);
  if (shareMatch?.[1]) {
    return `urn:li:share:${shareMatch[1]}`;
  }

  return undefined;
}

export function resolveLinkedInPostReference(args: {
  post?: UnifiedPost | null;
  postData?: unknown;
  explicitPostId?: string;
}) {
  const explicitPostId = getString(args.explicitPostId);
  const post = args.post ?? null;
  const candidate = isRecord(args.postData)
    ? args.postData
    : isRecord(post)
      ? (post as unknown as LooseRecord)
      : undefined;
  const raw = candidate && isRecord(candidate.raw) ? candidate.raw : undefined;

  const permalink =
    getString(post?.url) ||
    getString(candidate?.url) ||
    getString(candidate?.postURL) ||
    getString(raw?.postURL) ||
    getString(candidate?.permalink) ||
    getString(raw?.permalink);

  const socialId =
    getString(candidate?.socialId) ||
    getString(candidate?.social_id) ||
    getString(raw?.socialId) ||
    getString(raw?.social_id) ||
    (isLikelyLinkedInSocialPostId(explicitPostId) ? explicitPostId : undefined);

  const resolvedPostId =
    explicitPostId ||
    getString(post?.id) ||
    getString(candidate?.id) ||
    getString(candidate?.postID) ||
    getString(candidate?.urn) ||
    getString(raw?.id) ||
    getString(raw?.postID) ||
    getString(raw?.urn) ||
    socialId ||
    extractLinkedInCanonicalPostIdFromUrl(permalink);

  const readUrn =
    normalizeLinkedInReadUrn(
      getString(candidate?.urn) ||
        getString(raw?.urn) ||
        getString(candidate?.postID) ||
        getString(raw?.postID)
    ) ?? normalizeLinkedInReadUrn(resolvedPostId);

  return {
    resolvedPostId,
    socialId,
    readUrn,
    permalink,
  };
}
