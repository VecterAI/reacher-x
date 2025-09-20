"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

/**
 * Process media after direct upload to Convex storage
 * This action is called after the client uploads the file directly to Convex storage
 * and provides the storage ID. This bypasses the 5MB argument size limit.
 */
export const processUploadedMedia = action({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    size: v.number(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    uploadId: string | null;
    mediaUrl: string | null;
    mediaId: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get the media URL from storage
    const mediaUrl = await ctx.storage.getUrl(args.storageId);

    // Store metadata
    const uploadId = await ctx.runMutation(
      api.mediaUploadMutations.storeMediaMetadata,
      {
        mediaId: args.storageId,
        fileName: args.fileName,
        mimeType: args.mimeType,
        size: args.size,
      }
    );

    return {
      uploadId,
      mediaUrl,
      mediaId: args.storageId,
    };
  },
});
