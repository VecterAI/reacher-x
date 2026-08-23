"use client";

import * as React from "react";
import { inferFileVisualKind } from "@/shared/lib/utils/media/inferFileVisualKind";
import { FileVisualIcon } from "@/shared/ui/components/FileVisualIcon";
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@/shared/ui/components/Attachment";
import VideoPlayer from "@/features/landing/ui/components/VideoPlayer";

export interface InlineAttachmentPreviewItem {
  attachmentRef: string;
  fileName: string;
  displayName: string;
  mimeType: string;
  mediaKind: "image" | "gif" | "video" | "file";
  size: number;
  uploadedAt: number;
  mediaUrl: string;
}

function InlineAttachmentCard({
  attachment,
}: {
  attachment: InlineAttachmentPreviewItem;
}) {
  const visualKind = inferFileVisualKind({
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    url: attachment.mediaUrl,
  });
  const showsImage = visualKind === "image";

  return (
    <div className="max-w-md space-y-2">
      {showsImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={attachment.mediaUrl}
          alt={attachment.displayName}
          loading="lazy"
          decoding="async"
          className="border-border bg-muted/30 max-h-96 w-auto max-w-full rounded-xl border object-contain"
        />
      ) : null}
      {visualKind === "video" ? (
        <div className="border-border bg-muted/30 aspect-video max-h-96 w-full overflow-hidden rounded-xl border">
          <VideoPlayer
            mp4Url={attachment.mediaUrl}
            ariaLabel={attachment.displayName}
          />
        </div>
      ) : null}

      <Attachment
        state="done"
        size="sm"
        orientation="horizontal"
        className="border-border bg-card text-card-foreground max-w-sm min-w-0 overflow-hidden rounded-xl shadow-none"
      >
        <AttachmentMedia
          variant={showsImage ? "image" : "icon"}
          className="bg-muted text-foreground rounded-lg"
        >
          {showsImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={attachment.mediaUrl} alt="" loading="lazy" />
          ) : (
            <FileVisualIcon
              fileName={attachment.fileName}
              mimeType={attachment.mimeType}
              url={attachment.mediaUrl}
            />
          )}
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle title={attachment.displayName}>
            {attachment.displayName}
          </AttachmentTitle>
          <AttachmentDescription>Workspace attachment</AttachmentDescription>
        </AttachmentContent>
        <AttachmentTrigger asChild>
          <a
            href={attachment.mediaUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${attachment.displayName}`}
          />
        </AttachmentTrigger>
      </Attachment>
    </div>
  );
}

export function InlineAttachmentPreview({
  attachments,
}: {
  attachments: InlineAttachmentPreviewItem[];
}) {
  return (
    <div className="space-y-3">
      {attachments.map((attachment) => (
        <InlineAttachmentCard
          key={attachment.attachmentRef}
          attachment={attachment}
        />
      ))}
    </div>
  );
}
