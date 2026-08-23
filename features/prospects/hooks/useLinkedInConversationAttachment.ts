"use client";

import * as React from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import { enrichLinkedInReplyTargetAttachments } from "../lib/linkedinConversationReplyTarget";
import type { RichConversationMessage } from "../ui/components/conversation-message/types";

export interface ResolvedLinkedInConversationAttachment {
  contentType: string;
  expiresAt: number;
  fileName?: string;
  size: number;
  url: string;
}

interface LinkedInConversationAttachmentIdentity {
  attachmentId: string;
  messageId: string;
  prospectId: string;
}

const resolvedAttachmentCache = new Map<
  string,
  ResolvedLinkedInConversationAttachment
>();
const pendingAttachmentRequests = new Map<
  string,
  Promise<ResolvedLinkedInConversationAttachment>
>();

function getCacheKey(args: LinkedInConversationAttachmentIdentity): string {
  return JSON.stringify([args.prospectId, args.messageId, args.attachmentId]);
}

export function getCachedLinkedInConversationAttachment(
  args: LinkedInConversationAttachmentIdentity
): ResolvedLinkedInConversationAttachment | null {
  const cacheKey = getCacheKey(args);
  const cached = resolvedAttachmentCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= getCurrentUTCTimestamp()) {
    resolvedAttachmentCache.delete(cacheKey);
    return null;
  }
  return cached;
}

export function clearCachedLinkedInConversationAttachment(
  args: LinkedInConversationAttachmentIdentity
): void {
  resolvedAttachmentCache.delete(getCacheKey(args));
}

function cacheResolvedLinkedInConversationAttachment(
  args: LinkedInConversationAttachmentIdentity,
  resolved: ResolvedLinkedInConversationAttachment
): void {
  resolvedAttachmentCache.set(getCacheKey(args), resolved);
}

export function enrichLinkedInReplyTargetFromAttachmentCache(args: {
  message: RichConversationMessage;
  prospectId: string;
}): RichConversationMessage {
  return enrichLinkedInReplyTargetAttachments({
    message: args.message,
    getResolvedAttachment: (attachment) => {
      if (!attachment.id) return null;
      return getCachedLinkedInConversationAttachment({
        prospectId: args.prospectId,
        messageId: args.message.id,
        attachmentId: attachment.id,
      });
    },
  });
}

export function useLinkedInConversationAttachment() {
  const getAttachment = useAction(
    api.linkedin.getLinkedInConversationAttachment
  );

  const resolveAttachment = React.useCallback(
    async (
      args: LinkedInConversationAttachmentIdentity
    ): Promise<ResolvedLinkedInConversationAttachment> => {
      const cached = getCachedLinkedInConversationAttachment(args);
      if (cached) return cached;

      const cacheKey = getCacheKey(args);
      const pending = pendingAttachmentRequests.get(cacheKey);
      if (pending) return pending;

      const request = getAttachment({
        prospectId: args.prospectId as Id<"prospects">,
        messageId: args.messageId,
        attachmentId: args.attachmentId,
      });
      pendingAttachmentRequests.set(cacheKey, request);

      try {
        const resolved = await request;
        cacheResolvedLinkedInConversationAttachment(args, resolved);
        return resolved;
      } finally {
        if (pendingAttachmentRequests.get(cacheKey) === request) {
          pendingAttachmentRequests.delete(cacheKey);
        }
      }
    },
    [getAttachment]
  );

  return { resolveAttachment };
}
