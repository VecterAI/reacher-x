import { MediaUnavailablePlaceholder } from "@/shared/ui/components/MediaUnavailablePlaceholder";
import { MediaRetryButton } from "@/shared/ui/components/MediaRetryButton";
import { getMediaAspectRatio } from "@/shared/lib/platforms/mediaPresentation";

interface ConversationUnavailableAttachmentProps {
  kind?: "audio" | "image" | "video" | "file";
  platform: "linkedin" | "twitter";
  label?: string;
  width?: number;
  height?: number;
  className?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function ConversationUnavailableAttachment({
  kind = "file",
  label,
  width,
  height,
  className,
  onRetry,
  isRetrying,
}: ConversationUnavailableAttachmentProps) {
  const mediaLabel = label || (kind === "file" ? "Attachment" : kind);
  const title =
    kind === "file" && label
      ? `${label} unavailable`
      : `${kind === "file" ? "Attachment" : kind[0].toUpperCase() + kind.slice(1)} unavailable`;
  const aspectRatio =
    kind === "image" || kind === "video"
      ? getMediaAspectRatio({ width, height })
      : undefined;

  return (
    <MediaUnavailablePlaceholder
      kind={kind}
      title={title}
      aspectRatio={aspectRatio}
      className={className}
      action={
        onRetry ? (
          <MediaRetryButton
            label={mediaLabel}
            isRetrying={isRetrying}
            onRetry={onRetry}
          />
        ) : undefined
      }
    />
  );
}
