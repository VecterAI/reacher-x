import { v } from "convex/values";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { internalMutation, mutation, query } from "./lib/functionBuilders";
import { requireOwnedWorkspace, requireUser } from "./lib/accessHelpers";
import {
  buildWorkspaceAttachmentSearchText,
  getWorkspaceAttachmentKind,
  isSupportedWorkspaceAttachment,
  sanitizeWorkspaceAttachmentFileName,
  sanitizeWorkspaceAttachmentTags,
  updateWorkspaceAttachmentStats,
} from "./lib/workspaceAttachmentCore";

/** Generate a one-use Convex upload URL for an authenticated workspace owner. */
export const generateUploadUrl = mutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOwnedWorkspace(ctx, args.workspaceId, { user });
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Finalize one direct upload using authoritative `_storage` metadata.
 * This stays internal so clients cannot create forged attachment rows.
 */
export const storeMediaMetadataInternal = internalMutation({
  args: {
    mediaId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    size: v.number(),
    workspaceId: v.id("workspaces"),
    displayName: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  returns: v.union(
    v.object({
      success: v.literal(true),
      uploadId: v.id("mediaUploads"),
      fileName: v.string(),
      displayName: v.string(),
      mimeType: v.string(),
      size: v.number(),
    }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOwnedWorkspace(ctx, args.workspaceId, { user });

    const storageMetadata = await ctx.db.system.get("_storage", args.mediaId);
    if (!storageMetadata) {
      throw new Error("The uploaded attachment is no longer available.");
    }

    let fileName: string;
    let displayName: string;
    let mimeType: string;
    let size: number;
    let tags: string[] | undefined;
    try {
      fileName = sanitizeWorkspaceAttachmentFileName(args.fileName);
      displayName = args.displayName?.trim().slice(0, 255) || fileName;
      mimeType = (
        storageMetadata.contentType?.trim() || args.mimeType.trim()
      ).toLowerCase();
      size = storageMetadata.size;
      tags = sanitizeWorkspaceAttachmentTags(args.tags);
      if (
        !isSupportedWorkspaceAttachment({
          fileName,
          displayName,
          mimeType,
          size,
        })
      ) {
        throw new Error(
          `${displayName} is not compatible with any supported X/Twitter or LinkedIn attachment destination.`
        );
      }
    } catch (error) {
      // Return instead of throwing so the storage deletion commits with this
      // mutation. The calling action converts the failure back into an error.
      await ctx.storage.delete(args.mediaId);
      return {
        success: false as const,
        error:
          error instanceof Error
            ? error.message
            : "The uploaded attachment is not supported.",
      };
    }

    const now = getCurrentUTCTimestamp();
    const kind = getWorkspaceAttachmentKind({ fileName, mimeType });
    const uploadId = await ctx.db.insert("mediaUploads", {
      storageId: args.mediaId,
      userId: user._id,
      workspaceId: args.workspaceId,
      fileName,
      displayName,
      mimeType,
      size,
      tags,
      sha256: storageMetadata.sha256,
      searchText: buildWorkspaceAttachmentSearchText({
        fileName,
        displayName,
        mimeType,
        tags,
      }),
      statsRecordedAt: now,
      uploadedAt: now,
    });
    await updateWorkspaceAttachmentStats(ctx, {
      workspaceId: args.workspaceId,
      kind,
      delta: 1,
    });

    return {
      success: true as const,
      uploadId,
      fileName,
      displayName,
      mimeType,
      size,
    };
  },
});

/** List the current workspace's recent attachments, newest first. */
export const listMediaLibrary = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOwnedWorkspace(ctx, args.workspaceId, { user });

    const limit = Math.min(Math.max(Math.floor(args.limit ?? 30), 1), 100);
    const uploads = await ctx.db
      .query("mediaUploads")
      .withIndex("by_workspace_and_user_and_uploaded_at", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", user._id)
      )
      .order("desc")
      .take(limit);

    return await Promise.all(
      uploads.map(async (upload) => ({
        uploadId: upload._id,
        fileName: upload.fileName,
        displayName: upload.displayName ?? upload.fileName,
        mimeType: upload.mimeType,
        size: upload.size,
        tags: upload.tags ?? [],
        uploadedAt: upload.uploadedAt,
        mediaUrl: await ctx.storage.getUrl(upload.storageId),
      }))
    );
  },
});

/** Resolve a fresh URL only after validating user and workspace ownership. */
export const getMediaUrl = query({
  args: { uploadId: v.id("mediaUploads") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const upload = await ctx.db.get(args.uploadId);
    if (!upload || !upload.workspaceId) {
      return null;
    }
    await requireOwnedWorkspace(ctx, upload.workspaceId, { user });
    if (upload.userId !== user._id) {
      return null;
    }
    return await ctx.storage.getUrl(upload.storageId);
  },
});

export const deleteMedia = mutation({
  args: { uploadId: v.id("mediaUploads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const upload = await ctx.db.get(args.uploadId);
    if (!upload) return null;
    if (!upload.workspaceId || upload.userId !== user._id) {
      throw new Error("Not authorized to delete this attachment.");
    }
    await requireOwnedWorkspace(ctx, upload.workspaceId, { user });

    await ctx.storage.delete(upload.storageId);
    await ctx.db.delete(args.uploadId);
    if (upload.statsRecordedAt !== undefined) {
      await updateWorkspaceAttachmentStats(ctx, {
        workspaceId: upload.workspaceId,
        kind: getWorkspaceAttachmentKind(upload),
        delta: -1,
      });
    }
    return null;
  },
});
