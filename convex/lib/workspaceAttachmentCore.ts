import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { inferAttachmentMediaKind } from "../../shared/lib/utils/media/inferAttachmentMediaKind";
import { normalizeMediaMimeType } from "../../shared/lib/utils/media/linkedinMessageAttachmentTypes";
import {
  assertOutreachMediaCapability,
  getMediaCapabilityErrorMessage,
  type OutreachMediaPlatform,
  type OutreachMediaSurface,
  type ResolvedOutreachMedia,
} from "./mediaCapabilityCore";

export const MAX_WORKSPACE_ATTACHMENT_RESULTS = 20;
export const MAX_AGENT_WORKSPACE_ATTACHMENT_RESULTS = 8;
export const MAX_ATTACHMENT_FILE_NAME_LENGTH = 255;
export const MAX_ATTACHMENT_TAG_COUNT = 20;
export const MAX_ATTACHMENT_TAG_LENGTH = 80;

export type WorkspaceAttachmentKind = "image" | "gif" | "video" | "file";

export type WorkspaceAttachmentDestination = {
  platform: OutreachMediaPlatform;
  surface: OutreachMediaSurface;
};

export type WorkspaceAttachmentCompatibility = {
  compatible: boolean;
  reason: string | null;
};

export type WorkspaceAttachmentCountBreakdown = {
  total: number;
  images: number;
  gifs: number;
  videos: number;
  files: number;
};

type WorkspaceAttachmentMetadata = Pick<
  Doc<"mediaUploads">,
  "fileName" | "displayName" | "mimeType" | "size"
> & { _id?: Id<"mediaUploads"> };

export function sanitizeWorkspaceAttachmentFileName(fileName: string): string {
  const sanitized = fileName.trim();
  if (!sanitized) {
    throw new Error("Attachment file name is required.");
  }
  if (sanitized.length > MAX_ATTACHMENT_FILE_NAME_LENGTH) {
    throw new Error(
      `Attachment file names must be ${MAX_ATTACHMENT_FILE_NAME_LENGTH} characters or fewer.`
    );
  }
  return sanitized;
}

export function sanitizeWorkspaceAttachmentTags(
  tags: string[] | undefined
): string[] | undefined {
  if (!tags) return undefined;
  const sanitized = [
    ...new Set(
      tags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => tag.slice(0, MAX_ATTACHMENT_TAG_LENGTH))
    ),
  ].slice(0, MAX_ATTACHMENT_TAG_COUNT);
  return sanitized.length > 0 ? sanitized : undefined;
}

export function getWorkspaceAttachmentKind(args: {
  mimeType: string;
  fileName: string;
}): WorkspaceAttachmentKind {
  return (
    inferAttachmentMediaKind({
      mimeType: args.mimeType,
      url: args.fileName,
    }) ?? "file"
  );
}

export function buildWorkspaceAttachmentSearchText(args: {
  fileName: string;
  displayName?: string;
  mimeType: string;
  tags?: string[];
}): string {
  return [
    args.displayName?.trim(),
    args.fileName.trim(),
    args.mimeType.trim().toLowerCase(),
    ...(args.tags ?? []),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

function getDestinationLabel(
  destination: WorkspaceAttachmentDestination
): string {
  if (destination.platform === "linkedin") {
    return destination.surface === "dm"
      ? "a LinkedIn DM"
      : "a LinkedIn comment";
  }
  return destination.surface === "dm"
    ? "an X/Twitter DM"
    : "an X/Twitter reply";
}

export function getWorkspaceAttachmentCompatibility(args: {
  attachment: WorkspaceAttachmentMetadata;
  url?: string;
  destination: WorkspaceAttachmentDestination;
}): WorkspaceAttachmentCompatibility {
  const kind = getWorkspaceAttachmentKind(args.attachment);
  const media: ResolvedOutreachMedia = {
    // The capability validator never reads the ID; pending uploads do not have
    // a mediaUploads row yet.
    uploadId: args.attachment._id ?? ("pending" as Id<"mediaUploads">),
    url: args.url ?? "",
    fileName:
      args.attachment.displayName?.trim() || args.attachment.fileName.trim(),
    mimeType: normalizeMediaMimeType(args.attachment.mimeType),
    size: args.attachment.size,
    kind,
  };

  try {
    assertOutreachMediaCapability({
      ...args.destination,
      media: [media],
    });
    return { compatible: true, reason: null };
  } catch (error) {
    return {
      compatible: false,
      reason:
        getMediaCapabilityErrorMessage(error) ??
        `${media.fileName} cannot be attached to ${getDestinationLabel(args.destination)}.`,
    };
  }
}

export function getWorkspaceAttachmentCompatibilityMatrix(
  attachment: WorkspaceAttachmentMetadata
) {
  return {
    twitterReply: getWorkspaceAttachmentCompatibility({
      attachment,
      destination: { platform: "twitter", surface: "comment" },
    }),
    twitterDm: getWorkspaceAttachmentCompatibility({
      attachment,
      destination: { platform: "twitter", surface: "dm" },
    }),
    linkedInComment: getWorkspaceAttachmentCompatibility({
      attachment,
      destination: { platform: "linkedin", surface: "comment" },
    }),
    linkedInDm: getWorkspaceAttachmentCompatibility({
      attachment,
      destination: { platform: "linkedin", surface: "dm" },
    }),
  };
}

export function isSupportedWorkspaceAttachment(
  attachment: WorkspaceAttachmentMetadata
): boolean {
  return Object.values(
    getWorkspaceAttachmentCompatibilityMatrix(attachment)
  ).some((compatibility) => compatibility.compatible);
}

export function buildWorkspaceAttachmentCountSummary(
  counts: WorkspaceAttachmentCountBreakdown
): string {
  if (counts.total === 0) {
    return "This workspace has no attachments.";
  }

  const details = [
    counts.images > 0
      ? `${counts.images} ${counts.images === 1 ? "image" : "images"}`
      : null,
    counts.gifs > 0
      ? `${counts.gifs} ${counts.gifs === 1 ? "GIF" : "GIFs"}`
      : null,
    counts.videos > 0
      ? `${counts.videos} ${counts.videos === 1 ? "video" : "videos"}`
      : null,
    counts.files > 0
      ? `${counts.files} ${counts.files === 1 ? "file" : "files"}`
      : null,
  ].filter((value): value is string => Boolean(value));

  return `This workspace has ${counts.total} ${counts.total === 1 ? "attachment" : "attachments"}: ${details.join(", ")}.`;
}

export async function updateWorkspaceAttachmentStats(
  ctx: Pick<MutationCtx, "db">,
  args: {
    workspaceId: Doc<"workspaces">["_id"];
    kind: WorkspaceAttachmentKind;
    delta: 1 | -1;
  }
): Promise<void> {
  const existing = await ctx.db
    .query("workspaceAttachmentStats")
    .withIndex("by_workspace", (query) =>
      query.eq("workspaceId", args.workspaceId)
    )
    .unique();
  const now = getCurrentUTCTimestamp();
  const current: WorkspaceAttachmentCountBreakdown = existing
    ? {
        total: existing.total,
        images: existing.images,
        gifs: existing.gifs,
        videos: existing.videos,
        files: existing.files,
      }
    : { total: 0, images: 0, gifs: 0, videos: 0, files: 0 };
  const next = {
    ...current,
    total: Math.max(0, current.total + args.delta),
    images:
      args.kind === "image"
        ? Math.max(0, current.images + args.delta)
        : current.images,
    gifs:
      args.kind === "gif"
        ? Math.max(0, current.gifs + args.delta)
        : current.gifs,
    videos:
      args.kind === "video"
        ? Math.max(0, current.videos + args.delta)
        : current.videos,
    files:
      args.kind === "file"
        ? Math.max(0, current.files + args.delta)
        : current.files,
  };

  if (existing) {
    await ctx.db.patch("workspaceAttachmentStats", existing._id, {
      ...next,
      updatedAt: now,
    });
    return;
  }

  if (args.delta > 0) {
    await ctx.db.insert("workspaceAttachmentStats", {
      workspaceId: args.workspaceId,
      ...next,
      updatedAt: now,
    });
  }
}
