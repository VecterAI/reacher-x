import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { LocalClient } from "./LocalClient";
import type { MentionEntitySearchResult } from "@/shared/lib/mentions/mentionEntities";
import { inferAttachmentMediaKind } from "@/shared/lib/utils/media/inferAttachmentMediaKind";
import { isDemoUploadMimeType } from "./uploadHelpers";

/** Keep manual uploads in the demo's temporary store and local workspace data. */
export function registerMediaServices(client: LocalClient) {
  const attachments: MentionEntitySearchResult[] = [];
  client.register(
    api.mediaUploadMutations.generateUploadUrl,
    () => "/api/upload"
  );
  client.register(api.mediaUpload.processUploadedMedia, async (args) => {
    const url = `/api/upload?id=${encodeURIComponent(args.storageId)}`;
    const response = await fetch(url);
    if (!response.ok)
      throw new Error("Demo attachment expired. Attach the file again.");
    const mimeType = response.headers.get("content-type") ?? "";
    const size = Number(response.headers.get("content-length"));
    // Validate the stored file instead of accepting metadata from the caller.
    if (!isDemoUploadMimeType(mimeType) || !Number.isFinite(size) || size <= 0)
      throw new Error("Invalid demo attachment");
    await response.body?.cancel();
    const kind = inferAttachmentMediaKind({ mimeType }) ?? "file";
    const mediaUrl = `${url}&kind=${kind}`;
    const uploadId = args.storageId as string as Id<"mediaUploads">;
    const existing = attachments.find(
      (attachment) => attachment.entityId === uploadId
    );
    if (existing && existing.workspaceId !== args.workspaceId)
      throw new Error("Demo attachment belongs to another workspace");
    if (!existing) {
      attachments.push({
        id: `attachment:${uploadId}`,
        entityId: uploadId,
        kind: "attachment",
        label: args.displayName ?? args.fileName,
        mentionText: `Attachment: ${args.fileName}`,
        secondaryLabel: "Workspace attachment",
        avatarUrl: null,
        verified: false,
        workspaceId: args.workspaceId,
        attachmentUrl: mediaUrl,
        attachmentMimeType: mimeType,
        attachmentSize: size,
        attachmentMediaKind: kind,
      });
      client.notify();
    }
    return {
      uploadId,
      mediaId: args.storageId,
      mediaUrl,
      mimeType,
      size,
      fileName: args.fileName,
      displayName: args.displayName ?? args.fileName,
    };
  });
  return attachments;
}
