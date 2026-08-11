import { buildLinkedInPostUrl } from "../linkedin/comments";
import { buildTwitterPostUrl } from "../twitter/contracts";

export type MentionEntityKind =
  | "prospect"
  | "plan"
  | "task"
  | "attachment"
  | "post";

export type MentionAttachmentMediaKind = "image" | "gif" | "video" | "file";
export type MentionPostPlatform = "twitter" | "linkedin";

export interface MentionEntitySearchResult {
  id: string;
  entityId: string;
  kind: MentionEntityKind;
  label: string;
  mentionText: string;
  secondaryLabel: string;
  avatarUrl: string | null;
  verified: boolean;
  referenceText?: string;
  workspaceId?: string;
  prospectId?: string;
  handle?: string;
  planId?: string;
  taskId?: string;
  attachmentUrl?: string | null;
  attachmentMimeType?: string | null;
  attachmentSize?: number | null;
  attachmentMediaKind?: MentionAttachmentMediaKind | null;
  attachmentDisabled?: boolean;
  attachmentDisabledReason?: string | null;
  postId?: string;
  postUrl?: string | null;
  postPlatform?: MentionPostPlatform | null;
}

type MentionPostReferenceKind = "Post" | "Reply" | "Comment";

function coerceString(value: unknown, fallback = "") {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return fallback;
}

function coerceOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function looksLikeUrl(value: string | null | undefined) {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

function coerceKind(value: unknown): MentionEntityKind | null {
  switch (value) {
    case "prospect":
    case "plan":
    case "task":
    case "attachment":
    case "post":
      return value;
    default:
      return null;
  }
}

function inferPostPlatform(args: {
  id: string;
  postId?: string;
  postUrl?: string | null;
  postPlatform?: unknown;
}): MentionPostPlatform | null {
  const explicitPlatform = coerceOptionalString(args.postPlatform);
  if (explicitPlatform === "twitter" || explicitPlatform === "linkedin") {
    return explicitPlatform;
  }

  const normalizedId = args.id.toLowerCase();
  if (normalizedId.includes("post:twitter")) {
    return "twitter";
  }
  if (normalizedId.includes("post:linkedin")) {
    return "linkedin";
  }

  const normalizedPostUrl = coerceOptionalString(args.postUrl);
  if (normalizedPostUrl) {
    if (/(^https?:\/\/)?(www\.)?(x|twitter)\.com\//i.test(normalizedPostUrl)) {
      return "twitter";
    }
    if (/linkedin\.com\//i.test(normalizedPostUrl)) {
      return "linkedin";
    }
  }

  const normalizedPostId = coerceOptionalString(args.postId);
  if (normalizedPostId?.startsWith("urn:li:")) {
    return "linkedin";
  }

  return null;
}

function inferPostReferenceKind(args: {
  mentionText?: string;
  referenceText?: string;
  secondaryLabel?: string;
}): MentionPostReferenceKind {
  const candidates = [
    coerceOptionalString(args.mentionText),
    coerceOptionalString(args.referenceText),
    coerceOptionalString(args.secondaryLabel),
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (/^reply:/i.test(candidate) || /\breply\b/i.test(candidate)) {
      return "Reply";
    }

    if (/^comment:/i.test(candidate) || /\bcomment\b/i.test(candidate)) {
      return "Comment";
    }
  }

  return "Post";
}

function derivePostUrl(args: {
  postId?: string;
  postUrl?: string | null;
  postPlatform: MentionPostPlatform | null;
}) {
  const normalizedUrl = coerceOptionalString(args.postUrl) ?? null;
  if (normalizedUrl) {
    return normalizedUrl;
  }

  if (!args.postId || !args.postPlatform) {
    return null;
  }

  if (args.postPlatform === "twitter") {
    return buildTwitterPostUrl({
      postId: args.postId,
    });
  }

  return buildLinkedInPostUrl(args.postId) ?? null;
}

function buildPostReferenceText(args: {
  label: string;
  mentionText: string;
  postId?: string;
  postUrl?: string | null;
  postPlatform: MentionPostPlatform | null;
  prospectId?: string;
  entityId: string;
}) {
  const referenceKind = inferPostReferenceKind({
    mentionText: args.mentionText,
  });

  return `${referenceKind}: ${args.label} (${[
    args.postPlatform ? `platform: ${args.postPlatform}` : null,
    `postId: ${args.postId ?? args.entityId}`,
    args.postUrl ? `url: ${args.postUrl}` : null,
    args.prospectId ? `prospectId: ${args.prospectId}` : null,
  ]
    .filter(Boolean)
    .join("; ")})`;
}

export function normalizeMentionEntitySearchResult(
  value: MentionEntitySearchResult
): MentionEntitySearchResult | null {
  const kind = coerceKind(value.kind);
  const id = coerceString(value.id);
  const entityId = coerceString(value.entityId);

  if (!kind || !id || !entityId) {
    return null;
  }

  const label =
    coerceString(value.label) ||
    coerceString(value.mentionText) ||
    coerceString(value.referenceText) ||
    entityId;
  const rawReferenceText = coerceOptionalString(value.referenceText);
  const rawPostId = coerceOptionalString(value.postId);
  const entityIdAsPostUrl =
    kind === "post" && looksLikeUrl(entityId) ? entityId : null;
  const postId =
    kind === "post"
      ? (rawPostId ?? (entityIdAsPostUrl ? undefined : entityId))
      : undefined;
  const postPlatform =
    kind === "post"
      ? inferPostPlatform({
          id,
          postId,
          postUrl: value.postUrl ?? entityIdAsPostUrl,
          postPlatform: value.postPlatform,
        })
      : null;
  const postReferenceKind =
    kind === "post"
      ? inferPostReferenceKind({
          mentionText: coerceOptionalString(value.mentionText),
          referenceText: rawReferenceText,
          secondaryLabel: coerceOptionalString(value.secondaryLabel),
        })
      : "Post";
  const mentionText =
    kind === "post"
      ? coerceString(value.mentionText, `${postReferenceKind}: ${label}`)
      : coerceString(value.mentionText, label);
  const secondaryLabel =
    coerceString(value.secondaryLabel) ||
    (kind === "prospect"
      ? "Person"
      : kind === "plan"
        ? "Plan"
        : kind === "task"
          ? "Task"
          : kind === "post"
            ? "Post"
            : "Attachment");
  const postUrl =
    kind === "post"
      ? derivePostUrl({
          postId,
          postUrl: coerceOptionalString(value.postUrl) ?? entityIdAsPostUrl,
          postPlatform,
        })
      : null;
  const referenceText =
    kind === "post"
      ? buildPostReferenceText({
          label,
          mentionText,
          postId,
          postUrl,
          postPlatform,
          prospectId: coerceOptionalString(value.prospectId),
          entityId,
        })
      : rawReferenceText;

  return {
    id,
    entityId,
    kind,
    label,
    mentionText,
    secondaryLabel,
    avatarUrl: coerceOptionalString(value.avatarUrl) ?? null,
    verified: value.verified === true,
    referenceText,
    workspaceId: coerceOptionalString(value.workspaceId),
    prospectId: coerceOptionalString(value.prospectId),
    handle: coerceOptionalString(value.handle),
    planId: coerceOptionalString(value.planId),
    taskId: coerceOptionalString(value.taskId),
    attachmentUrl: coerceOptionalString(value.attachmentUrl) ?? null,
    attachmentMimeType: coerceOptionalString(value.attachmentMimeType) ?? null,
    attachmentSize:
      typeof value.attachmentSize === "number" &&
      Number.isFinite(value.attachmentSize) &&
      value.attachmentSize >= 0
        ? value.attachmentSize
        : null,
    attachmentMediaKind:
      (coerceOptionalString(value.attachmentMediaKind) as
        | MentionAttachmentMediaKind
        | undefined) ?? null,
    attachmentDisabled: value.attachmentDisabled === true,
    attachmentDisabledReason:
      coerceOptionalString(value.attachmentDisabledReason) ?? null,
    postId,
    postUrl,
    postPlatform,
  };
}

export function buildMentionEntityReferenceLine(
  entity: MentionEntitySearchResult
): string {
  switch (entity.kind) {
    case "prospect":
      if (entity.referenceText && entity.referenceText.trim().length > 0) {
        return entity.referenceText;
      }
      return `Prospect: ${entity.label} (prospectId: ${entity.prospectId ?? entity.entityId})`;
    case "plan":
      if (entity.referenceText && entity.referenceText.trim().length > 0) {
        return entity.referenceText;
      }
      return `Plan: ${entity.label} (planId: ${entity.planId ?? entity.entityId}${entity.prospectId ? `; prospectId: ${entity.prospectId}` : ""})`;
    case "task":
      if (entity.referenceText && entity.referenceText.trim().length > 0) {
        return entity.referenceText;
      }
      return `Task: ${entity.label} (taskId: ${entity.taskId ?? entity.entityId}${entity.planId ? `; planId: ${entity.planId}` : ""}${entity.prospectId ? `; prospectId: ${entity.prospectId}` : ""})`;
    case "post":
      return buildPostReferenceText({
        label: entity.label,
        mentionText: entity.mentionText,
        postId:
          coerceOptionalString(entity.postId) ??
          (looksLikeUrl(entity.entityId) ? undefined : entity.entityId),
        postUrl: derivePostUrl({
          postId:
            coerceOptionalString(entity.postId) ??
            (looksLikeUrl(entity.entityId) ? undefined : entity.entityId),
          postUrl:
            coerceOptionalString(entity.postUrl) ??
            (looksLikeUrl(entity.entityId) ? entity.entityId : null),
          postPlatform: inferPostPlatform({
            id: entity.id,
            postId: entity.postId,
            postUrl: entity.postUrl,
            postPlatform: entity.postPlatform,
          }),
        }),
        postPlatform: inferPostPlatform({
          id: entity.id,
          postId: entity.postId,
          postUrl: entity.postUrl,
          postPlatform: entity.postPlatform,
        }),
        prospectId: coerceOptionalString(entity.prospectId),
        entityId: entity.entityId,
      });
    case "attachment":
      if (entity.referenceText && entity.referenceText.trim().length > 0) {
        return entity.referenceText;
      }
      return `Attachment: ${entity.label}${entity.attachmentUrl ? ` (${entity.attachmentUrl})` : ""}`;
    default:
      return entity.label;
  }
}
