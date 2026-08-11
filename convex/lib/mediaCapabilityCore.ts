import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { inferAttachmentMediaKind } from "../../shared/lib/utils/media/inferAttachmentMediaKind";
import { LINKEDIN_MESSAGE_DOCUMENT_MIME_TYPES } from "../../shared/lib/utils/media/linkedinMessageAttachmentTypes";

export type OutreachMediaKind = "image" | "gif" | "video" | "file";
export type OutreachMediaPlatform = "twitter" | "linkedin";
export type OutreachMediaSurface = "comment" | "dm";

export const MEDIA_CAPABILITY_ERROR_PREFIX = "MEDIA_CAPABILITY:";

const MAX_RESOLVABLE_UPLOADS = 100;
const FIVE_MEGABYTES = 5 * 1024 * 1024;
const FIFTEEN_MEGABYTES = 15 * 1024 * 1024;
const TWENTY_MEGABYTES = 20 * 1024 * 1024;
const FIVE_HUNDRED_TWELVE_MEGABYTES = 512 * 1024 * 1024;

const X_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const X_VIDEO_MIME_TYPES = new Set(["video/mp4", "video/quicktime"]);
const LINKEDIN_COMMENT_MIME_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);
const LINKEDIN_MESSAGE_MIME_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/bmp",
  "video/mp4",
  ...LINKEDIN_MESSAGE_DOCUMENT_MIME_TYPES,
]);

export interface ResolvedOutreachMedia {
  uploadId: Id<"mediaUploads">;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  kind: OutreachMediaKind;
}

function mediaCapabilityError(message: string): Error {
  return new Error(`${MEDIA_CAPABILITY_ERROR_PREFIX}${message}`);
}

export function getMediaCapabilityErrorMessage(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  const prefixIndex = message.indexOf(MEDIA_CAPABILITY_ERROR_PREFIX);
  if (prefixIndex < 0) return null;
  return message.slice(prefixIndex + MEDIA_CAPABILITY_ERROR_PREFIX.length);
}

function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function assertMimeType(
  media: ResolvedOutreachMedia,
  allowedMimeTypes: ReadonlySet<string>,
  destination: string
): void {
  if (!allowedMimeTypes.has(media.mimeType.toLowerCase())) {
    throw mediaCapabilityError(
      `${media.fileName} cannot be attached to ${destination} because its file type (${media.mimeType}) is not supported.`
    );
  }
}

function assertSize(
  media: ResolvedOutreachMedia,
  maxBytes: number,
  destination: string
): void {
  if (media.size > maxBytes) {
    throw mediaCapabilityError(
      `${media.fileName} is ${formatMegabytes(media.size)}; ${destination} allows up to ${formatMegabytes(maxBytes)} for this file type.`
    );
  }
}

/**
 * Validates the media combination and upload limits for one outreach task.
 * Unknown combinations fail closed so execution never silently drops a file.
 */
export function assertOutreachMediaCapability(args: {
  platform: OutreachMediaPlatform;
  surface: OutreachMediaSurface;
  media: ResolvedOutreachMedia[];
}): void {
  const { platform, surface, media } = args;
  if (media.length === 0) return;

  if (platform === "linkedin" && surface === "comment") {
    if (media.length > 1) {
      throw mediaCapabilityError(
        "LinkedIn comments support at most one photo or GIF attachment."
      );
    }
    const attachment = media[0];
    if (attachment.kind === "video") {
      throw mediaCapabilityError(
        "LinkedIn comments do not support video attachments. Use a photo or GIF, send the video in a LinkedIn DM, or post the comment without media."
      );
    }
    assertMimeType(
      attachment,
      LINKEDIN_COMMENT_MIME_TYPES,
      "a LinkedIn comment"
    );
    assertSize(attachment, FIVE_MEGABYTES, "a LinkedIn comment");
    return;
  }

  if (platform === "linkedin" && surface === "dm") {
    if (media.length > 4) {
      throw mediaCapabilityError(
        "LinkedIn messages support at most four attachments in this application."
      );
    }
    const totalBytes = media.reduce(
      (total, attachment) => total + attachment.size,
      0
    );
    if (totalBytes > TWENTY_MEGABYTES) {
      throw mediaCapabilityError(
        `LinkedIn messages allow up to ${formatMegabytes(TWENTY_MEGABYTES)} total across all attachments.`
      );
    }
    for (const attachment of media) {
      assertMimeType(
        attachment,
        LINKEDIN_MESSAGE_MIME_TYPES,
        "a LinkedIn message"
      );
      assertSize(attachment, FIFTEEN_MEGABYTES, "a LinkedIn message");
    }
    return;
  }

  const files = media.filter((attachment) => attachment.kind === "file");
  if (files.length > 0) {
    throw mediaCapabilityError(
      `${files[0].fileName} cannot be attached to X/Twitter. Use it in a supported LinkedIn DM or choose an image, GIF, or video.`
    );
  }

  const images = media.filter((attachment) => attachment.kind === "image");
  const gifs = media.filter((attachment) => attachment.kind === "gif");
  const videos = media.filter((attachment) => attachment.kind === "video");
  const destination =
    surface === "dm" ? "an X/Twitter DM" : "an X/Twitter reply";

  if (surface === "dm" && media.length > 1) {
    throw mediaCapabilityError(
      "X/Twitter DMs support at most one media attachment."
    );
  }
  if (surface === "comment" && images.length > 4) {
    throw mediaCapabilityError("X/Twitter replies support up to four images.");
  }
  if (gifs.length > 1 || videos.length > 1 || gifs.length + videos.length > 1) {
    throw mediaCapabilityError(
      "X/Twitter supports one GIF or one video per reply/message."
    );
  }
  if ((gifs.length > 0 || videos.length > 0) && images.length > 0) {
    throw mediaCapabilityError(
      "X/Twitter cannot mix images with a GIF or video in the same reply/message."
    );
  }

  for (const attachment of media) {
    if (attachment.kind === "image") {
      assertMimeType(attachment, X_IMAGE_MIME_TYPES, destination);
      assertSize(attachment, FIVE_MEGABYTES, destination);
    } else if (attachment.kind === "gif") {
      assertMimeType(attachment, new Set(["image/gif"]), destination);
      assertSize(attachment, FIFTEEN_MEGABYTES, destination);
    } else {
      assertMimeType(attachment, X_VIDEO_MIME_TYPES, destination);
      assertSize(attachment, FIVE_HUNDRED_TWELVE_MEGABYTES, destination);
    }
  }
}

/** Resolve selected attachment URLs back to owned upload metadata. */
export async function resolveOwnedOutreachMedia(
  ctx: MutationCtx | QueryCtx,
  args: {
    userId: Id<"users">;
    workspaceId: Id<"workspaces">;
    mediaUrls: string[];
    mediaUploadIds?: Id<"mediaUploads">[];
  }
): Promise<ResolvedOutreachMedia[]> {
  if (args.mediaUploadIds?.length) {
    if (args.mediaUploadIds.length !== args.mediaUrls.length) {
      throw mediaCapabilityError(
        "The selected attachment metadata is incomplete. Re-select the files and try again."
      );
    }

    return await Promise.all(
      args.mediaUploadIds.map(async (uploadId) => {
        const upload = await ctx.db.get(uploadId);
        if (
          !upload ||
          upload.userId !== args.userId ||
          upload.workspaceId !== args.workspaceId
        ) {
          throw mediaCapabilityError(
            "The selected attachment could not be verified in this workspace. Re-select or upload the file and try again."
          );
        }
        const url = await ctx.storage.getUrl(upload.storageId);
        const kind =
          inferAttachmentMediaKind({
            mimeType: upload.mimeType,
            url: upload.fileName,
          }) ??
          (LINKEDIN_MESSAGE_DOCUMENT_MIME_TYPES.has(
            upload.mimeType.toLowerCase()
          )
            ? "file"
            : null);
        if (!url || !kind) {
          throw mediaCapabilityError(
            `${upload.displayName?.trim() || upload.fileName} is no longer available or is not a supported attachment.`
          );
        }
        return {
          uploadId,
          url,
          fileName: upload.displayName?.trim() || upload.fileName,
          mimeType: upload.mimeType.trim().toLowerCase(),
          size: upload.size,
          kind,
        };
      })
    );
  }

  if (args.mediaUrls.length === 0) return [];

  const uploads = await ctx.db
    .query("mediaUploads")
    .withIndex("by_workspace_and_user_and_uploaded_at", (q) =>
      q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
    )
    .order("desc")
    .take(MAX_RESOLVABLE_UPLOADS);
  const byUrl = new Map<string, ResolvedOutreachMedia>();

  await Promise.all(
    uploads.map(async (upload) => {
      const url = await ctx.storage.getUrl(upload.storageId);
      const kind =
        inferAttachmentMediaKind({
          mimeType: upload.mimeType,
          url: upload.fileName,
        }) ??
        (LINKEDIN_MESSAGE_DOCUMENT_MIME_TYPES.has(upload.mimeType.toLowerCase())
          ? "file"
          : null);
      if (!url || !kind) return;
      byUrl.set(url, {
        uploadId: upload._id,
        url,
        fileName: upload.displayName?.trim() || upload.fileName,
        mimeType: upload.mimeType.trim().toLowerCase(),
        size: upload.size,
        kind,
      });
    })
  );

  return args.mediaUrls.map((url) => {
    const resolved = byUrl.get(url);
    if (!resolved) {
      throw mediaCapabilityError(
        "The selected attachment could not be verified in this workspace. Re-select or upload the file and try again."
      );
    }
    return resolved;
  });
}

export function withAttachmentNames(
  description: string,
  media: ResolvedOutreachMedia[]
): string {
  const withoutOldAttachmentLine = description.replace(
    /\nAttachments?: [^\n]*$/,
    ""
  );
  if (media.length === 0) return withoutOldAttachmentLine;
  const label = media.length === 1 ? "Attachment" : "Attachments";
  return `${withoutOldAttachmentLine}\n${label}: ${media.map((item) => item.fileName).join(", ")}`;
}
