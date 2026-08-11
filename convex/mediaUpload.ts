"use node";

import { v } from "convex/values";
import { action } from "./lib/functionBuilders";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

type ProcessedMediaUpload = {
  uploadId: Id<"mediaUploads">;
  mediaUrl: string | null;
  mediaId: Id<"_storage">;
  fileName: string;
  displayName: string;
  mimeType: string;
  size: number;
};

type FinalizedMediaUpload =
  | ({ success: true } & Omit<ProcessedMediaUpload, "mediaUrl" | "mediaId">)
  | { success: false; error: string };

/** Finalize a direct upload and return its canonical workspace attachment. */
export const processUploadedMedia = action({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    size: v.number(),
    workspaceId: v.id("workspaces"),
    displayName: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  returns: v.object({
    uploadId: v.id("mediaUploads"),
    mediaUrl: v.union(v.string(), v.null()),
    mediaId: v.id("_storage"),
    fileName: v.string(),
    displayName: v.string(),
    mimeType: v.string(),
    size: v.number(),
  }),
  handler: async (ctx, args): Promise<ProcessedMediaUpload> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const finalized: FinalizedMediaUpload = await ctx.runMutation(
      internal.mediaUploadMutations.storeMediaMetadataInternal,
      {
        mediaId: args.storageId,
        fileName: args.fileName,
        mimeType: args.mimeType,
        size: args.size,
        workspaceId: args.workspaceId,
        displayName: args.displayName,
        tags: args.tags,
      }
    );
    if (!finalized.success) {
      throw new Error(finalized.error);
    }

    return {
      uploadId: finalized.uploadId,
      fileName: finalized.fileName,
      displayName: finalized.displayName,
      mimeType: finalized.mimeType,
      size: finalized.size,
      mediaUrl: await ctx.storage.getUrl(args.storageId),
      mediaId: args.storageId,
    };
  },
});
