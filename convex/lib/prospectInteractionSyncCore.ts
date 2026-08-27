import { extractLinkedInUsername } from "../../shared/lib/utils/url/socialProfiles";
import type {
  LinkedInUnipileComment,
  LinkedInUnipilePost,
} from "./unipileClient";

export type StoredLinkedInInteractionCandidateMetadata = {
  interactionType: "comment_posted" | "comment_reply_posted";
  direction: "outgoing";
};

export function getStoredLinkedInInteractionCandidateMetadata(interaction: {
  interactionType?: string;
  direction?: "incoming" | "outgoing";
}): StoredLinkedInInteractionCandidateMetadata | null {
  if (interaction.direction === "incoming") {
    return null;
  }

  return {
    interactionType:
      interaction.interactionType === "comment_reply_posted"
        ? "comment_reply_posted"
        : "comment_posted",
    direction: "outgoing",
  };
}

export function getLinkedInPostIdentifiers(
  post: LinkedInUnipilePost
): string[] {
  return [post.id, post.social_id].filter(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0
  );
}

export function normalizeLinkedInActorIdentifier(
  value?: string | null
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed
    .replace(/^urn:li:(?:fsd_profile|member):/i, "")
    .replace(/^https?:\/\/(?:www\.)?linkedin\.com\/in\//i, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

export function getLinkedInCommentAuthorIdentifiers(
  comment: LinkedInUnipileComment
): string[] {
  const profileUrl = comment.author_details?.profile_url;
  return [
    comment.author_details?.id,
    profileUrl ? extractLinkedInUsername(profileUrl) : undefined,
  ]
    .map(normalizeLinkedInActorIdentifier)
    .filter((value): value is string => Boolean(value));
}

export function buildTwitterInteractionSearchQueries(args: {
  viewerHandle: string;
  prospectHandle: string;
  sinceTimeOperator: string;
}) {
  return {
    outgoing: `from:${args.viewerHandle} to:${args.prospectHandle} filter:replies ${args.sinceTimeOperator}`,
    incoming: `from:${args.prospectHandle} to:${args.viewerHandle} filter:replies ${args.sinceTimeOperator}`,
  };
}

function normalizeTwitterIdentifier(value?: string | null) {
  return value?.trim().replace(/^@/, "").toLowerCase() || undefined;
}

export function isReciprocalTwitterReply(args: {
  tweet: unknown;
  viewerHandle: string;
  viewerUserId?: string;
  prospectHandle: string;
  prospectUserId?: string;
}) {
  if (!args.tweet || typeof args.tweet !== "object") {
    return false;
  }

  const tweet = args.tweet as Record<string, unknown>;
  const user =
    tweet.user && typeof tweet.user === "object"
      ? (tweet.user as Record<string, unknown>)
      : undefined;
  const authorHandle = normalizeTwitterIdentifier(
    typeof user?.screen_name === "string" ? user.screen_name : undefined
  );
  const authorUserId =
    typeof user?.id_str === "string" ? user.id_str.trim() : undefined;
  const targetHandle = normalizeTwitterIdentifier(
    typeof tweet.in_reply_to_screen_name === "string"
      ? tweet.in_reply_to_screen_name
      : undefined
  );
  const targetUserId =
    typeof tweet.in_reply_to_user_id_str === "string"
      ? tweet.in_reply_to_user_id_str.trim()
      : undefined;
  const parentPostId =
    typeof tweet.in_reply_to_status_id_str === "string"
      ? tweet.in_reply_to_status_id_str.trim()
      : undefined;

  if (!parentPostId) {
    return false;
  }

  const viewerHandle = normalizeTwitterIdentifier(args.viewerHandle);
  const prospectHandle = normalizeTwitterIdentifier(args.prospectHandle);
  const isViewer =
    authorHandle === viewerHandle ||
    Boolean(args.viewerUserId && authorUserId === args.viewerUserId);
  const isProspect =
    authorHandle === prospectHandle ||
    Boolean(args.prospectUserId && authorUserId === args.prospectUserId);
  const targetsViewer =
    targetHandle === viewerHandle ||
    Boolean(args.viewerUserId && targetUserId === args.viewerUserId);
  const targetsProspect =
    targetHandle === prospectHandle ||
    Boolean(args.prospectUserId && targetUserId === args.prospectUserId);

  return (isViewer && targetsProspect) || (isProspect && targetsViewer);
}
