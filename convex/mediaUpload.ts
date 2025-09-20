"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Media upload schema
export const uploadMedia = action({
  args: {
    file: v.any(), // ArrayBuffer from frontend
    fileName: v.string(),
    mimeType: v.string(),
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

    // Convert ArrayBuffer to Buffer
    const buffer = Buffer.from(args.file);

    // Convert Buffer to Blob for Convex storage
    const blob = new Blob([buffer], { type: args.mimeType });

    // Store the media temporarily and get a URL
    const mediaId = await ctx.storage.store(blob);

    // Create a temporary URL for the media
    const mediaUrl = await ctx.storage.getUrl(mediaId);

    // Store metadata
    const uploadId = await ctx.runMutation(
      api.mediaUploadMutations.storeMediaMetadata,
      {
        mediaId,
        fileName: args.fileName,
        mimeType: args.mimeType,
        size: buffer.length,
      }
    );

    return {
      uploadId,
      mediaUrl,
      mediaId,
    };
  },
});
