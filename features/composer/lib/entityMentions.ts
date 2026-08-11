import type { MentionEntitySearchResult } from "@/shared/lib/mentions/mentionEntities";
import { inferAttachmentMediaKind as inferSharedAttachmentMediaKind } from "@/shared/lib/utils/media/inferAttachmentMediaKind";
import type {
  ComposerEntityMentionsConfig,
  ComposerInitialMediaUpload,
  ComposerMediaKind,
} from "../types";

function normalizeHandle(value: string | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().replace(/^@/, "");
  return trimmed.length > 0 ? trimmed : null;
}

function extractHandleFromSecondaryLabel(value: string | undefined) {
  if (!value) {
    return null;
  }

  const match = /@([A-Za-z0-9._-]+)/.exec(value);
  return normalizeHandle(match?.[1]);
}

function prefixMention(value: string) {
  return value.startsWith("@") ? value : `@${value}`;
}

function inferAttachmentMediaKind(
  entity: MentionEntitySearchResult
): ComposerMediaKind | null {
  if (entity.attachmentMediaKind) {
    return entity.attachmentMediaKind;
  }

  return inferSharedAttachmentMediaKind({
    mimeType: entity.attachmentMimeType,
    url: entity.attachmentUrl,
  });
}

export function buildComposerMentionInsertionText(args: {
  entity: MentionEntitySearchResult;
  config?: ComposerEntityMentionsConfig;
}) {
  const { entity, config } = args;

  switch (entity.kind) {
    case "attachment":
      return null;
    case "post":
      return entity.postUrl?.trim() ? `${entity.postUrl.trim()} ` : null;
    case "prospect": {
      const preferredHandle =
        normalizeHandle(entity.handle) ??
        extractHandleFromSecondaryLabel(entity.secondaryLabel);
      const rawValue =
        config?.personTextMode === "handle" && preferredHandle
          ? preferredHandle
          : entity.label.trim() || entity.mentionText.trim();
      if (!rawValue) {
        return null;
      }
      return `${prefixMention(rawValue)} `;
    }
    default: {
      const rawValue = entity.mentionText.trim() || entity.label.trim();
      if (!rawValue) {
        return null;
      }
      return `${prefixMention(rawValue)} `;
    }
  }
}

export function buildInitialMediaUploadFromMentionEntity(
  entity: MentionEntitySearchResult
): ComposerInitialMediaUpload | null {
  if (entity.kind !== "attachment" || !entity.attachmentUrl) {
    return null;
  }

  const mediaKind = inferAttachmentMediaKind(entity);
  if (!mediaKind) {
    return null;
  }

  return {
    id: `mention-attachment:${entity.entityId}`,
    url: entity.attachmentUrl,
    serverUrl: entity.attachmentUrl,
    uploadId: entity.entityId,
    type:
      mediaKind === "video" ? "video" : mediaKind === "file" ? "file" : "image",
    mediaKind,
    fileName: entity.label,
    mimeType: entity.attachmentMimeType ?? undefined,
    size: entity.attachmentSize ?? undefined,
    description: undefined,
  };
}
