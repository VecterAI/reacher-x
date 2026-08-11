import { v } from "convex/values";
import { internalQuery } from "./lib/functionBuilders";
import { agentAttachmentToolReferenceValidator } from "./validators";
import type { Doc, Id } from "./_generated/dataModel";
import { getWorkspaceAttachmentKind } from "./lib/workspaceAttachmentCore";
import {
  AGENT_ATTACHMENT_CONTEXT_WINDOW,
  getAgentAttachmentReference,
  MAX_AGENT_ATTACHMENT_REFERENCES,
  type AgentAttachmentToolReference,
} from "./lib/agentAttachmentReferenceCore";

type AttachmentCandidate = {
  context: Doc<"agentMessageContexts">;
  uploadId: string | null;
  fileName: string;
  mediaKind?: "image" | "gif" | "video" | "file" | null;
};

function getContextAttachmentCandidates(
  context: Doc<"agentMessageContexts">
): AttachmentCandidate[] {
  return [
    ...context.attachments.map((attachment) => ({
      context,
      uploadId: attachment.uploadId ?? null,
      fileName: attachment.fileName,
    })),
    ...context.taggedEntities.flatMap((entity) =>
      entity.kind === "attachment"
        ? [
            {
              context,
              uploadId: entity.entityId || null,
              fileName: entity.label,
              mediaKind: entity.attachmentMediaKind,
            },
          ]
        : []
    ),
  ];
}

export const listAvailableForAgentTool = internalQuery({
  args: {
    threadId: v.string(),
    messageId: v.string(),
    userId: v.id("users"),
  },
  returns: v.array(agentAttachmentToolReferenceValidator),
  handler: async (ctx, args): Promise<AgentAttachmentToolReference[]> => {
    const currentContext = await ctx.db
      .query("agentMessageContexts")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .order("desc")
      .first();
    if (
      !currentContext ||
      currentContext.threadId !== args.threadId ||
      currentContext.userId !== args.userId ||
      !currentContext.workspaceId
    ) {
      return [];
    }

    const recentContexts = await ctx.db
      .query("agentMessageContexts")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .take(AGENT_ATTACHMENT_CONTEXT_WINDOW);
    const eligibleContexts = recentContexts.filter(
      (context) =>
        context.userId === args.userId &&
        context.createdAt <= currentContext.createdAt &&
        context.workspaceId === currentContext.workspaceId &&
        context.prospectId === currentContext.prospectId
    );
    const orderedContexts = [
      currentContext,
      ...eligibleContexts.filter(
        (context) => context._id !== currentContext._id
      ),
    ];
    const candidates = orderedContexts.flatMap(getContextAttachmentCandidates);
    const references: AgentAttachmentToolReference[] = [];
    const seenUploadIds = new Set<Id<"mediaUploads">>();

    for (const candidate of candidates) {
      if (!candidate.uploadId) {
        continue;
      }
      const uploadId = ctx.db.normalizeId("mediaUploads", candidate.uploadId);
      if (!uploadId || seenUploadIds.has(uploadId)) {
        continue;
      }

      const upload = await ctx.db.get("mediaUploads", uploadId);
      if (
        !upload ||
        upload.userId !== args.userId ||
        upload.workspaceId !== currentContext.workspaceId
      ) {
        continue;
      }

      const url = await ctx.storage.getUrl(upload.storageId);
      const mediaKind =
        candidate.mediaKind ?? getWorkspaceAttachmentKind(upload);
      if (!url || !mediaKind) {
        continue;
      }

      seenUploadIds.add(uploadId);
      references.push({
        reference: getAgentAttachmentReference(references.length),
        uploadId,
        url,
        fileName: upload.displayName?.trim() || upload.fileName,
        mediaKind,
        selectedInCurrentMessage: candidate.context._id === currentContext._id,
      });
      if (references.length === MAX_AGENT_ATTACHMENT_REFERENCES) {
        break;
      }
    }

    return references;
  },
});
