import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Generate an upload URL for direct file upload to Convex storage
 * This bypasses the 5MB argument size limit for large files
 */
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const storeMediaMetadata = mutation({
  args: {
    mediaId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("mediaUploads", {
      storageId: args.mediaId,
      fileName: args.fileName,
      mimeType: args.mimeType,
      size: args.size,
      uploadedAt: Date.now(),
    });
  },
});

export const getMediaUrl = query({
  args: { mediaId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.mediaId);
  },
});

export const deleteMedia = mutation({
  args: { uploadId: v.id("mediaUploads") },
  handler: async (ctx, args) => {
    const upload = await ctx.db.get(args.uploadId);
    if (!upload) return;

    // Delete from storage
    await ctx.storage.delete(upload.storageId);

    // Delete metadata
    await ctx.db.delete(args.uploadId);
  },
});
