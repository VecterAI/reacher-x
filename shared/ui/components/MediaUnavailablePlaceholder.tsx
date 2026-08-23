import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import {
  AttachFileIcon,
  ImageIcon,
  MicIcon,
  VideoLibraryIcon,
} from "@/shared/ui/components/icons/index";

interface MediaUnavailablePlaceholderProps {
  kind?: "audio" | "image" | "video" | "file";
  title: string;
  aspectRatio?: number;
  className?: string;
  action?: ReactNode;
}

export function MediaUnavailablePlaceholder({
  kind = "file",
  title,
  aspectRatio,
  className,
  action,
}: MediaUnavailablePlaceholderProps) {
  const Icon =
    kind === "audio"
      ? MicIcon
      : kind === "video"
        ? VideoLibraryIcon
        : kind === "image"
          ? ImageIcon
          : AttachFileIcon;

  return (
    <div
      className={cn(
        "flex min-h-20 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-md border px-4 py-5 text-center",
        className
      )}
      role={action ? undefined : "status"}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      <Icon className="size-5 shrink-0 fill-current" aria-hidden="true" />
      <p className="max-w-full truncate text-xs leading-4 font-medium">
        {title}
      </p>
      {action}
    </div>
  );
}
