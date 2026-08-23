import { formatConversationFileSize } from "../../../lib/conversationMessagePresentation";
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/shared/ui/components/Attachment";
import { FileVisualIcon } from "@/shared/ui/components/FileVisualIcon";
import type { ConversationAttachment } from "./types";

interface ConversationFileAttachmentProps {
  attachment: ConversationAttachment;
}

export function ConversationFileAttachment({
  attachment,
}: ConversationFileAttachmentProps) {
  const label = attachment.fileName ?? attachment.type ?? "Attachment";
  const description = [
    attachment.mimeType?.split(";")[0],
    formatConversationFileSize(attachment.fileSize),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Attachment className="w-full max-w-full" state="done">
      <AttachmentMedia>
        <FileVisualIcon
          fileName={attachment.fileName}
          mimeType={attachment.mimeType}
          url={attachment.url ?? attachment.previewUrl}
        />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle title={label}>{label}</AttachmentTitle>
        {description ? (
          <AttachmentDescription>{description}</AttachmentDescription>
        ) : null}
      </AttachmentContent>
    </Attachment>
  );
}
