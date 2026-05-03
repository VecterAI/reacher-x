import type { XDmAttachmentSummary } from "@/shared/lib/twitter/dm";
import { cn } from "@/shared/lib/utils";

interface XDmAttachmentGalleryProps {
  attachments: XDmAttachmentSummary[];
  className?: string;
}

function getRenderableAttachmentUrl(attachment: XDmAttachmentSummary) {
  return attachment.previewUrl ?? attachment.url;
}

export function XDmAttachmentGallery({
  attachments,
  className,
}: XDmAttachmentGalleryProps) {
  const renderableAttachments = attachments.filter((attachment) =>
    Boolean(getRenderableAttachmentUrl(attachment))
  );

  if (renderableAttachments.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "grid w-full max-w-[78%] gap-2",
        renderableAttachments.length > 1 ? "grid-cols-2" : "grid-cols-1",
        className
      )}
    >
      {renderableAttachments.map((attachment, index) => {
        const attachmentUrl = getRenderableAttachmentUrl(attachment);
        if (!attachmentUrl) {
          return null;
        }

        return (
          <div
            key={
              attachment.mediaKey ?? attachmentUrl ?? `dm-attachment-${index}`
            }
            className="bg-muted/30 border-border overflow-hidden rounded-2xl border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachmentUrl}
              alt={attachment.altText ?? "DM attachment"}
              className="block h-auto w-full object-cover"
            />
          </div>
        );
      })}
    </div>
  );
}
