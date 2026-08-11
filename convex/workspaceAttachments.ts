import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery, query } from "./lib/functionBuilders";
import { requireOwnedWorkspace, requireUser } from "./lib/accessHelpers";
import {
  assertOutreachMediaCapability,
  resolveOwnedOutreachMedia,
} from "./lib/mediaCapabilityCore";
import {
  getWorkspaceAttachmentCompatibilityMatrix,
  getWorkspaceAttachmentKind,
  MAX_AGENT_WORKSPACE_ATTACHMENT_RESULTS,
  MAX_WORKSPACE_ATTACHMENT_RESULTS,
  type WorkspaceAttachmentKind,
} from "./lib/workspaceAttachmentCore";
import {
  resolvedOutreachMediaValidator,
  workspaceAttachmentCountBreakdownValidator,
  workspaceAttachmentDestinationValidator,
  workspaceAttachmentKindValidator,
  workspaceAttachmentRecordValidator,
} from "./validators";
import { normalizeMemoryText } from "./lib/memoryHelpers";

type AttachmentRecord = {
  uploadId: Id<"mediaUploads">;
  fileName: string;
  displayName: string;
  mimeType: string;
  mediaKind: WorkspaceAttachmentKind;
  size: number;
  tags: string[];
  uploadedAt: number;
  mediaUrl: string;
  compatibility: ReturnType<typeof getWorkspaceAttachmentCompatibilityMatrix>;
};

async function toAttachmentRecord(
  ctx: Pick<QueryCtx, "storage">,
  upload: Doc<"mediaUploads">
): Promise<AttachmentRecord | null> {
  const mediaUrl = await ctx.storage.getUrl(upload.storageId);
  if (!mediaUrl) return null;
  return {
    uploadId: upload._id,
    fileName: upload.fileName,
    displayName: upload.displayName?.trim() || upload.fileName,
    mimeType: upload.mimeType,
    mediaKind: getWorkspaceAttachmentKind(upload),
    size: upload.size,
    tags: upload.tags ?? [],
    uploadedAt: upload.uploadedAt,
    mediaUrl,
    compatibility: getWorkspaceAttachmentCompatibilityMatrix(upload),
  };
}

async function loadAttachmentRecords(
  ctx: Pick<QueryCtx, "storage">,
  uploads: Doc<"mediaUploads">[],
  mediaKind?: WorkspaceAttachmentKind
): Promise<AttachmentRecord[]> {
  const filtered = mediaKind
    ? uploads.filter(
        (upload) => getWorkspaceAttachmentKind(upload) === mediaKind
      )
    : uploads;
  return (
    await Promise.all(filtered.map((upload) => toAttachmentRecord(ctx, upload)))
  ).filter((record): record is AttachmentRecord => record !== null);
}

async function getCounts(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">
): Promise<{
  total: number;
  images: number;
  gifs: number;
  videos: number;
  files: number;
}> {
  const stats = await ctx.db
    .query("workspaceAttachmentStats")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .unique();
  return stats
    ? {
        total: stats.total,
        images: stats.images,
        gifs: stats.gifs,
        videos: stats.videos,
        files: stats.files,
      }
    : { total: 0, images: 0, gifs: 0, videos: 0, files: 0 };
}

export const getWorkspaceAttachmentCount = query({
  args: { workspaceId: v.id("workspaces") },
  returns: workspaceAttachmentCountBreakdownValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOwnedWorkspace(ctx, args.workspaceId, { user });
    return await getCounts(ctx, args.workspaceId);
  },
});

export const getCountForAgentInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
  },
  returns: workspaceAttachmentCountBreakdownValidator,
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.userId !== args.userId) {
      throw new Error("Workspace attachment ownership validation failed.");
    }
    return await getCounts(ctx, args.workspaceId);
  },
});

export const searchForAgentInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    query: v.optional(v.string()),
    mediaKind: v.optional(workspaceAttachmentKindValidator),
    selection: v.optional(
      v.union(v.literal("best_match"), v.literal("latest"), v.literal("oldest"))
    ),
    limit: v.optional(v.number()),
  },
  returns: v.array(workspaceAttachmentRecordValidator),
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.userId !== args.userId) {
      return [];
    }
    const limit = Math.min(
      Math.max(Math.floor(args.limit ?? 5), 1),
      MAX_AGENT_WORKSPACE_ATTACHMENT_RESULTS
    );
    const normalizedQuery = args.query?.trim() ?? "";
    const candidateLimit = Math.min(
      MAX_WORKSPACE_ATTACHMENT_RESULTS,
      Math.max(limit * 4, limit)
    );
    let uploads: Doc<"mediaUploads">[];
    if (normalizedQuery) {
      uploads = await ctx.db
        .query("mediaUploads")
        .withSearchIndex("search_workspace_attachments", (q) =>
          q
            .search("searchText", normalizedQuery)
            .eq("workspaceId", args.workspaceId)
            .eq("userId", args.userId)
        )
        .take(candidateLimit);
    } else {
      uploads = await ctx.db
        .query("mediaUploads")
        .withIndex("by_workspace_and_user_and_uploaded_at", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
        )
        .order(args.selection === "oldest" ? "asc" : "desc")
        .take(candidateLimit);
    }

    const records = await loadAttachmentRecords(ctx, uploads, args.mediaKind);
    if (args.selection === "latest" || args.selection === "oldest") {
      records.sort((left, right) =>
        args.selection === "oldest"
          ? left.uploadedAt - right.uploadedAt
          : right.uploadedAt - left.uploadedAt
      );
    }
    return records.slice(0, limit);
  },
});

export const getByIdsForAgentInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    uploadIds: v.array(v.id("mediaUploads")),
  },
  returns: v.array(workspaceAttachmentRecordValidator),
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.userId !== args.userId) return [];
    const uniqueIds = [...new Set(args.uploadIds)].slice(
      0,
      MAX_AGENT_WORKSPACE_ATTACHMENT_RESULTS
    );
    const uploads = (
      await Promise.all(uniqueIds.map((uploadId) => ctx.db.get(uploadId)))
    ).filter((upload): upload is Doc<"mediaUploads"> =>
      Boolean(
        upload &&
        upload.userId === args.userId &&
        upload.workspaceId === args.workspaceId
      )
    );
    return await loadAttachmentRecords(ctx, uploads);
  },
});

export const getMemoryAttachmentIdsForAgentInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    memoryKey: v.string(),
  },
  returns: v.array(v.id("mediaUploads")),
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.userId !== args.userId) return [];
    const topicKey = normalizeMemoryText(args.memoryKey);
    if (!topicKey) return [];
    const memory = await ctx.db
      .query("workspaceMemories")
      .withIndex("by_workspace_and_topic_key_and_status", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("topicKey", topicKey)
          .eq("status", "active")
      )
      .first();
    if (!memory || memory.userId !== args.userId) return [];
    return memory.attachmentUploadIds ?? [];
  },
});

/**
 * Stage server-selected records in the current message context so every
 * downstream Agent tool resolves the same opaque attachment_n references.
 */
export const stageForAgentToolInternal = internalMutation({
  args: {
    threadId: v.string(),
    messageId: v.string(),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    uploadIds: v.array(v.id("mediaUploads")),
  },
  returns: v.array(v.id("mediaUploads")),
  handler: async (ctx, args) => {
    const context = await ctx.db
      .query("agentMessageContexts")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .order("desc")
      .first();
    if (
      !context ||
      context.threadId !== args.threadId ||
      context.userId !== args.userId ||
      context.workspaceId !== args.workspaceId
    ) {
      throw new Error("The current Agent message context is unavailable.");
    }

    const existingIds = new Set(
      context.attachments
        .map((attachment) => attachment.uploadId)
        .filter((uploadId): uploadId is string => Boolean(uploadId))
    );
    const nextAttachments = [...context.attachments];
    const staged: Id<"mediaUploads">[] = [];
    for (const uploadId of new Set(args.uploadIds)) {
      if (existingIds.has(String(uploadId))) {
        staged.push(uploadId);
        continue;
      }
      const upload = await ctx.db.get(uploadId);
      if (
        !upload ||
        upload.userId !== args.userId ||
        upload.workspaceId !== args.workspaceId
      ) {
        continue;
      }
      nextAttachments.push({
        uploadId: String(upload._id),
        fileName: upload.displayName?.trim() || upload.fileName,
        mediaUrl: null,
      });
      existingIds.add(String(uploadId));
      staged.push(uploadId);
      if (staged.length >= 4) break;
    }
    await ctx.db.patch("agentMessageContexts", context._id, {
      attachments: nextAttachments,
    });
    return staged;
  },
});

/** Canonical ownership and destination validation used before staging/sending. */
export const resolveAndValidateOutreachMediaInternal = internalQuery({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    destination: workspaceAttachmentDestinationValidator,
    mediaUrls: v.array(v.string()),
    mediaUploadIds: v.optional(v.array(v.id("mediaUploads"))),
  },
  returns: v.array(resolvedOutreachMediaValidator),
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.userId !== args.userId) {
      throw new Error("Workspace attachment ownership validation failed.");
    }
    const media = await resolveOwnedOutreachMedia(ctx, args);
    assertOutreachMediaCapability({ ...args.destination, media });
    return media;
  },
});
