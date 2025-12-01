// features/webapp/ui/components/linkedin/LinkedInMediaGrid.tsx
"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import type { UnifiedMedia } from "@/shared/lib/platforms/types";
import Image from "next/image";
import VideoPlayer from "@/features/landing/ui/components/VideoPlayer";
import { OpenGraphPreview } from "@/features/composer/ui/components/OpenGraphPreview";
import LinkedInGalleryViewer from "./LinkedInGalleryViewer";

export interface LinkedInMediaGridProps {
  media?: UnifiedMedia[];
  className?: string;
}

export const LinkedInMediaGrid: React.FC<LinkedInMediaGridProps> = ({
  media,
  className,
}) => {
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [initialIndex, setInitialIndex] = React.useState(0);
  if (!media || media.length === 0) return null;

  // Enforce LinkedIn constraints:
  // - If any video exists, render a single video (no images/links with it).
  // - If images exist, prefer images over link preview.
  // - Otherwise render the link card.
  const videos = media.filter((m) => m.type === "video");
  const images = media.filter((m) => m.type === "image");
  const links = media.filter((m) => m.type === "link");

  let display: UnifiedMedia[] = [];
  if (videos.length > 0) {
    display = [videos[0]];
  } else if (images.length > 0) {
    display = images;
  } else if (links.length > 0) {
    display = [links[0]];
  }

  if (display.length === 0) return null;

  const items = display.slice(0, 4);
  const count = items.length;
  const overflow = display.length - items.length;

  const openViewerAt = (index: number) => {
    setInitialIndex(index);
    setViewerOpen(true);
  };

  if (count === 1) {
    const m = items[0]!;
    return (
      <>
        <div className={cn("overflow-hidden rounded-md", className)}>
          {m.type === "video" ? (
            <div
              className="relative w-full overflow-hidden rounded-md border border-border"
              style={{ aspectRatio: 16 / 9 }}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerMove={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
            >
              <VideoPlayer mp4Url={m.url} ariaLabel="LinkedIn video" />
            </div>
          ) : m.type === "link" ? (
            <div className="mt-0">
              <OpenGraphPreview
                url={m.url}
                context="timeline"
                debounceMs={300}
                enableCache
                retryOnError
              />
            </div>
          ) : (
            <div
              className="relative w-full overflow-hidden rounded-md border border-border"
              style={{ aspectRatio: (m.width ?? 1200) / (m.height ?? 675) }}
            >
              <Image
                src={m.url}
                alt=""
                fill
                className="object-cover"
                loading="lazy"
                sizes="(max-width: 768px) 100vw, 700px"
              />
              <button
                type="button"
                aria-label="Open media viewer"
                className="absolute inset-0 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  openViewerAt(0);
                }}
              />
            </div>
          )}
        </div>
        <LinkedInGalleryViewer
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          media={images}
          initialIndex={initialIndex}
        />
      </>
    );
  }

  // 2/3/4 image grid (LinkedIn-like)
  return (
    <>
      <div
        className={cn(
          "grid overflow-hidden rounded-md",
          count === 2 && "grid-cols-2 gap-1",
          count === 3 && "grid-cols-2 gap-1",
          count === 4 && "grid-cols-2 gap-1",
          className
        )}
      >
        {items.map((m, idx) => {
          const isTallThree = count === 3 && idx === 0;
          const isLast = idx === items.length - 1 && overflow > 0;
          const rounded =
            count === 4
              ? [
                  idx === 0 && "rounded-tl-md",
                  idx === 1 && "rounded-tr-md",
                  idx === 2 && "rounded-bl-md",
                  idx === 3 && "rounded-br-md",
                ]
                  .filter(Boolean)
                  .join(" ")
              : isTallThree
                ? "rounded-l-md"
                : idx === 1 && count === 3
                  ? "rounded-tr-md"
                  : idx === 2 && count === 3
                    ? "rounded-br-md"
                    : "";

          if (m.type === "image") {
            return (
              <div
                key={idx}
                className={cn("relative", isTallThree && "row-span-2")}
              >
                <Image
                  src={m.url}
                  alt=""
                  width={m.width ?? 800}
                  height={m.height ?? 800}
                  className={cn("h-full w-full object-cover", rounded)}
                  loading="lazy"
                  sizes="(max-width: 768px) 50vw, 350px"
                />
                <button
                  type="button"
                  aria-label="Open media viewer"
                  className="absolute inset-0 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    openViewerAt(idx);
                  }}
                />
                {isLast && overflow > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40 text-lg font-medium text-white">
                    +{overflow}
                  </div>
                )}
              </div>
            );
          }

          // Fallback tile for non-image in grid (shouldn't happen due to rules)
          return (
            <a
              key={idx}
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "flex items-center justify-center border bg-muted/20 text-xs text-muted-foreground",
                isTallThree ? "row-span-2" : "",
                rounded
              )}
            >
              {m.type === "video" ? "Video" : "Link"}
            </a>
          );
        })}
      </div>
      <LinkedInGalleryViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        media={images}
        initialIndex={initialIndex}
      />
    </>
  );
};

