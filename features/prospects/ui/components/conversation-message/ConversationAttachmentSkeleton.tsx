import { getMediaAspectRatio } from "@/shared/lib/platforms/mediaPresentation";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import type { ConversationAttachment } from "./types";

interface ConversationAttachmentSkeletonProps {
  attachment: ConversationAttachment;
  kind: "image" | "video" | "audio" | "file";
}

export function ConversationAttachmentSkeleton({
  attachment,
  kind,
}: ConversationAttachmentSkeletonProps) {
  if (kind === "audio" || kind === "file") {
    return (
      <div
        role="status"
        aria-label="Loading attachment"
        className="border-border bg-card flex min-h-14 w-full items-center gap-3 rounded-2xl border p-2.5"
      >
        <Skeleton className="size-10 shrink-0 rounded-lg" />
        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label={`Loading ${kind}`}
      className="border-border bg-muted/30 relative w-full overflow-hidden rounded-md border"
      style={{ aspectRatio: getMediaAspectRatio(attachment) }}
    >
      <Skeleton className="absolute inset-0 size-full rounded-none" />
    </div>
  );
}
