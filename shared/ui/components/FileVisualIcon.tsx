import { inferFileVisualKind } from "@/shared/lib/utils/media/inferFileVisualKind";
import { cn } from "@/shared/lib/utils";
import {
  AudioFileIcon,
  CodeIcon,
  DraftIcon,
  FolderZipIcon,
  ImageIcon,
  PictureAsPdfIcon,
  TableIcon,
  TransitionSlideIcon,
  VideoLibraryIcon,
} from "@/shared/ui/components/icons";

interface FileVisualIconProps {
  fileName?: string | null;
  mimeType?: string | null;
  url?: string | null;
  className?: string;
}

export function FileVisualIcon({
  fileName,
  mimeType,
  url,
  className,
}: FileVisualIconProps) {
  const iconClassName = cn("size-4 fill-current", className);
  const visualKind = inferFileVisualKind({ fileName, mimeType, url });

  switch (visualKind) {
    case "archive":
      return <FolderZipIcon className={iconClassName} aria-hidden="true" />;
    case "audio":
      return <AudioFileIcon className={iconClassName} aria-hidden="true" />;
    case "code":
      return <CodeIcon className={iconClassName} aria-hidden="true" />;
    case "image":
      return <ImageIcon className={iconClassName} aria-hidden="true" />;
    case "pdf":
      return <PictureAsPdfIcon className={iconClassName} aria-hidden="true" />;
    case "presentation":
      return (
        <TransitionSlideIcon className={iconClassName} aria-hidden="true" />
      );
    case "spreadsheet":
      return <TableIcon className={iconClassName} aria-hidden="true" />;
    case "video":
      return <VideoLibraryIcon className={iconClassName} aria-hidden="true" />;
    case "document":
    default:
      return <DraftIcon className={iconClassName} aria-hidden="true" />;
  }
}
