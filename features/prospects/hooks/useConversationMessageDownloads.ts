"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  downloadConversationAttachment,
  getConversationAttachmentDownloadItems,
  type ConversationAttachmentDownloadItem,
} from "../lib/conversationAttachmentDownload";
import type {
  ConversationAttachment,
  ConversationMessagePlatform,
} from "../ui/components/conversation-message/types";
import { useLinkedInConversationAttachment } from "./useLinkedInConversationAttachment";

export interface ConversationMessageDownloadAction {
  id: string;
  isLoading: boolean;
  label: string;
  onDownload: () => void;
}

interface UseConversationMessageDownloadsArgs {
  attachments: ConversationAttachment[] | undefined;
  messageId: string;
  platform: ConversationMessagePlatform;
  prospectId?: string;
}

export function useConversationMessageDownloads({
  attachments,
  messageId,
  platform,
  prospectId,
}: UseConversationMessageDownloadsArgs): ConversationMessageDownloadAction[] {
  const { resolveAttachment } = useLinkedInConversationAttachment();
  const downloadItems = React.useMemo(
    () => getConversationAttachmentDownloadItems(attachments),
    [attachments]
  );
  const activeDownloadRef = React.useRef<string | null>(null);
  const [activeDownloadId, setActiveDownloadId] = React.useState<string | null>(
    null
  );

  const startDownload = React.useCallback(
    async (item: ConversationAttachmentDownloadItem) => {
      if (activeDownloadRef.current) return;
      activeDownloadRef.current = item.id;
      setActiveDownloadId(item.id);

      try {
        let sourceUrl = item.sourceUrl;
        let fileName = item.fileName;
        if (platform === "linkedin" && prospectId && item.attachment.id) {
          const resolved = await resolveAttachment({
            prospectId,
            messageId,
            attachmentId: item.attachment.id,
          });
          sourceUrl = resolved.url;
          fileName =
            item.attachment.fileName?.trim() ||
            resolved.fileName?.trim() ||
            fileName;
        }

        if (!sourceUrl) {
          throw new Error("Attachment URL is unavailable.");
        }
        await downloadConversationAttachment({ sourceUrl, fileName });
      } catch (error) {
        console.warn(
          "[ConversationMessageDownloads] Unable to download attachment",
          error instanceof Error ? error.message : String(error)
        );
        toast.error("Could not download attachment", {
          description: "The attachment may no longer be available. Try again.",
        });
      } finally {
        if (activeDownloadRef.current === item.id) {
          activeDownloadRef.current = null;
          setActiveDownloadId(null);
        }
      }
    },
    [messageId, platform, prospectId, resolveAttachment]
  );

  return React.useMemo(
    () =>
      downloadItems.map((item) => ({
        id: item.id,
        isLoading: activeDownloadId === item.id,
        label: item.label,
        onDownload: () => {
          void startDownload(item);
        },
      })),
    [activeDownloadId, downloadItems, startDownload]
  );
}
