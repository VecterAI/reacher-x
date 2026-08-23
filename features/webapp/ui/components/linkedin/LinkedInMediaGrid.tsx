// features/webapp/ui/components/linkedin/LinkedInMediaGrid.tsx
"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import type {
  AvailableUnifiedMedia,
  UnifiedMedia,
  UnavailableUnifiedMedia,
} from "@/shared/lib/platforms/types";
import Image from "next/image";
import VideoPlayer from "@/features/landing/ui/components/VideoPlayer";
import { OpenGraphPreview } from "@/features/composer/ui/components/OpenGraphPreview";
import {
  isRenderableLinkedInImageUrl,
  normalizeLinkedInMediaType,
} from "@/shared/lib/linkedin/media";
import LinkedInGalleryViewer from "./LinkedInGalleryViewer";
import { MediaUnavailablePlaceholder } from "@/shared/ui/components/MediaUnavailablePlaceholder";
import { MediaRetryButton } from "@/shared/ui/components/MediaRetryButton";
import { getMediaAspectRatio } from "@/shared/lib/platforms/mediaPresentation";
import {
  getRememberedMediaAspectRatio,
  rememberMediaAspectRatio,
} from "@/shared/ui/lib/mediaAspectRatioCache";
import { useRetryableMediaFailures } from "@/shared/ui/hooks/use-retryable-media-failures";

export interface LinkedInMediaGridProps {
  media?: UnifiedMedia[];
  className?: string;
  eager?: boolean;
  layout?: "grid" | "conversation";
  onRetry?: (media: AvailableUnifiedMedia) => Promise<void> | void;
}

function LinkedInConversationImage({
  media,
  eager,
  rounded,
  onError,
  onOpen,
}: {
  media: AvailableUnifiedMedia;
  eager: boolean;
  rounded?: string;
  onError: (aspectRatio: number) => void;
  onOpen: () => void;
}) {
  const declaredAspectRatio = getMediaAspectRatio(media);
  const [aspectRatio, setAspectRatio] = React.useState(() =>
    getRememberedMediaAspectRatio(media.url, declaredAspectRatio)
  );

  React.useEffect(() => {
    setAspectRatio(
      getRememberedMediaAspectRatio(media.url, declaredAspectRatio)
    );
  }, [declaredAspectRatio, media.url]);

  return (
    <div
      className={cn(
        "border-border bg-muted/30 relative w-full overflow-hidden border",
        rounded ?? "rounded-md"
      )}
      style={{ aspectRatio }}
    >
      <Image
        src={media.url}
        alt=""
        fill
        className="object-contain"
        loading={eager ? "eager" : "lazy"}
        sizes="(max-width: 768px) 100vw, 700px"
        onLoad={(event) => {
          const image = event.currentTarget;
          if (image.naturalWidth > 0 && image.naturalHeight > 0) {
            const observedAspectRatio =
              image.naturalWidth / image.naturalHeight;
            rememberMediaAspectRatio(media.url, observedAspectRatio);
            setAspectRatio(observedAspectRatio);
          }
        }}
        onError={() => onError(aspectRatio)}
      />
      <button
        type="button"
        aria-label="Open media viewer"
        className="absolute inset-0 z-10"
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
      />
    </div>
  );
}

function LinkedInMediaUnavailable({
  kind,
  aspectRatio,
  isRetrying,
  onRetry,
}: {
  kind: "image" | "video";
  aspectRatio: number;
  isRetrying?: boolean;
  onRetry: () => void;
}) {
  const label = kind === "video" ? "Video" : "Image";
  return (
    <MediaUnavailablePlaceholder
      kind={kind}
      title={`${label} unavailable`}
      aspectRatio={aspectRatio}
      className="min-h-0"
      action={
        <MediaRetryButton
          label={label}
          isRetrying={isRetrying}
          onRetry={onRetry}
        />
      }
    />
  );
}

function LinkedInUnavailableAttachment({
  media,
}: {
  media: UnavailableUnifiedMedia;
}) {
  const kind =
    media.type === "video"
      ? "video"
      : media.type === "image"
        ? "image"
        : "file";
  const label =
    media.type === "video"
      ? "Video"
      : media.type === "image"
        ? "Image"
        : "Attachment";

  return (
    <MediaUnavailablePlaceholder
      kind={kind}
      title={`${label} unavailable`}
      aspectRatio={getMediaAspectRatio(media)}
      className="min-h-0"
    />
  );
}

function getUnavailableMediaKey(media: UnavailableUnifiedMedia): string {
  return (
    media.id ??
    [
      media.type,
      media.title ?? "attachment",
      media.description ?? "",
      media.width ?? "",
      media.height ?? "",
    ].join(":")
  );
}

function getAvailableMediaKey(media: AvailableUnifiedMedia): string {
  return `${media.type}:${media.id ?? media.url}`;
}

function getFailedAspectRatio(media: AvailableUnifiedMedia): number {
  return getRememberedMediaAspectRatio(media.url, getMediaAspectRatio(media));
}

function LinkedInImageGrid({
  items,
  overflow,
  className,
  eager,
  failedMediaUrls,
  retryingMediaUrls,
  onError,
  onOpen,
  onRetry,
}: {
  items: AvailableUnifiedMedia[];
  overflow: number;
  className?: string;
  eager: boolean;
  failedMediaUrls: Set<string>;
  retryingMediaUrls: Set<string>;
  onError: (url: string) => void;
  onOpen: (index: number) => void;
  onRetry: (media: AvailableUnifiedMedia) => void;
}) {
  const count = items.length;

  return (
    <div
      className={cn(
        "grid overflow-hidden rounded-md",
        count === 2 && "grid-cols-2 gap-1",
        count === 3 && "grid-cols-2 gap-1",
        count === 4 && "grid-cols-2 gap-1",
        className
      )}
    >
      {items.map((media, index) => {
        const isTallThree = count === 3 && index === 0;
        const isLast = index === items.length - 1 && overflow > 0;
        const rounded =
          count === 4
            ? [
                index === 0 && "rounded-tl-md",
                index === 1 && "rounded-tr-md",
                index === 2 && "rounded-bl-md",
                index === 3 && "rounded-br-md",
              ]
                .filter(Boolean)
                .join(" ")
            : isTallThree
              ? "rounded-l-md"
              : index === 1 && count === 3
                ? "rounded-tr-md"
                : index === 2 && count === 3
                  ? "rounded-br-md"
                  : "";

        if (media.type === "image") {
          return (
            <div
              key={getAvailableMediaKey(media)}
              className={cn("relative", isTallThree && "row-span-2")}
            >
              {failedMediaUrls.has(media.url) ? (
                <LinkedInMediaUnavailable
                  kind="image"
                  aspectRatio={getMediaAspectRatio(media)}
                  isRetrying={retryingMediaUrls.has(media.url)}
                  onRetry={() => onRetry(media)}
                />
              ) : (
                <>
                  <Image
                    src={media.url}
                    alt=""
                    width={media.width ?? 800}
                    height={media.height ?? 800}
                    className={cn("h-full w-full object-cover", rounded)}
                    loading={eager ? "eager" : "lazy"}
                    sizes="(max-width: 768px) 50vw, 350px"
                    onError={() => onError(media.url)}
                  />
                  <button
                    type="button"
                    aria-label="Open media viewer"
                    className="absolute inset-0 z-10"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpen(index);
                    }}
                  />
                  {isLast && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40 text-lg font-medium text-white">
                      +{overflow}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        }

        return (
          <a
            key={getAvailableMediaKey(media)}
            href={media.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className={cn(
              "bg-muted/20 text-muted-foreground flex items-center justify-center border text-xs",
              isTallThree ? "row-span-2" : "",
              rounded
            )}
          >
            {media.type === "video" ? "Video" : "Link"}
          </a>
        );
      })}
    </div>
  );
}

export const LinkedInMediaGrid: React.FC<LinkedInMediaGridProps> = ({
  media,
  className,
  eager = false,
  layout = "grid",
  onRetry,
}) => {
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [initialIndex, setInitialIndex] = React.useState(0);
  const {
    failedKeys: failedMediaUrls,
    markFailed: markMediaUnavailable,
    retry: retryFailedMedia,
    retryingKeys: retryingMediaUrls,
  } = useRetryableMediaFailures();
  const { normalizedMedia, unavailableMedia } = React.useMemo(() => {
    const normalized: AvailableUnifiedMedia[] = [];
    const unavailable: UnavailableUnifiedMedia[] = [];

    for (const item of media ?? []) {
      if (item.unavailable) {
        unavailable.push(item);
        continue;
      }

      const type = normalizeLinkedInMediaType(item.type, item.url);
      if (!type) {
        continue;
      }
      normalized.push({ ...item, type });
    }

    return { normalizedMedia: normalized, unavailableMedia: unavailable };
  }, [media]);
  if (normalizedMedia.length === 0) {
    return unavailableMedia.length > 0 ? (
      <div className={cn("grid gap-2", className)}>
        {unavailableMedia.map((item) => (
          <LinkedInUnavailableAttachment
            key={getUnavailableMediaKey(item)}
            media={item}
          />
        ))}
      </div>
    ) : null;
  }

  // Enforce LinkedIn constraints:
  // - If any video exists, render a single video (no images/links with it).
  // - If images exist, prefer images over link preview.
  // - Otherwise render the link card.
  const videos = normalizedMedia.filter((m) => m.type === "video");
  const images = normalizedMedia.filter((m) => m.type === "image");
  const links = normalizedMedia.filter((m) => m.type === "link");

  let display: AvailableUnifiedMedia[] = [];
  if (videos.length > 0) {
    display = [videos[0]];
  } else if (images.length > 0) {
    display = images;
  } else if (links.length > 0) {
    display = [links[0]];
  }

  if (display.length === 0) return null;

  const items = layout === "conversation" ? display : display.slice(0, 4);
  const count = items.length;
  const overflow = display.length - items.length;
  const unavailableMediaShells =
    unavailableMedia.length > 0 ? (
      <div className="mt-2 grid gap-2">
        {unavailableMedia.map((item) => (
          <LinkedInUnavailableAttachment
            key={getUnavailableMediaKey(item)}
            media={item}
          />
        ))}
      </div>
    ) : null;

  const openViewerAt = (index: number) => {
    setInitialIndex(index);
    setViewerOpen(true);
  };

  const retryMedia = (item: AvailableUnifiedMedia) => {
    void retryFailedMedia(item.url, () => onRetry?.(item)).catch((error) => {
      console.warn(
        "[LinkedInMediaGrid] Unable to retry media",
        error instanceof Error ? error.message : String(error)
      );
    });
  };

  const markUnavailable = (
    item: AvailableUnifiedMedia,
    aspectRatio = getMediaAspectRatio(item)
  ) => {
    rememberMediaAspectRatio(item.url, aspectRatio);
    markMediaUnavailable(item.url);
  };

  if (count === 1) {
    const m = items[0]!;
    return (
      <>
        <div className={cn("overflow-hidden rounded-md", className)}>
          {failedMediaUrls.has(m.url) &&
          (m.type === "video" || m.type === "image") ? (
            <LinkedInMediaUnavailable
              kind={m.type}
              aspectRatio={getFailedAspectRatio(m)}
              isRetrying={retryingMediaUrls.has(m.url)}
              onRetry={() => retryMedia(m)}
            />
          ) : m.type === "video" ? (
            <div
              className="border-border relative w-full overflow-hidden rounded-md border"
              style={{ aspectRatio: getMediaAspectRatio(m) }}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerMove={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
            >
              <VideoPlayer
                mp4Url={m.url}
                ariaLabel="LinkedIn video"
                onError={() => markUnavailable(m)}
              />
            </div>
          ) : m.type === "link" || !isRenderableLinkedInImageUrl(m.url) ? (
            <div className="mt-0">
              <OpenGraphPreview
                url={m.url}
                context="timeline"
                debounceMs={300}
                enableCache
                retryOnError
              />
            </div>
          ) : layout === "conversation" ? (
            <LinkedInConversationImage
              media={m}
              eager={eager}
              onError={(aspectRatio) => markUnavailable(m, aspectRatio)}
              onOpen={() => openViewerAt(0)}
            />
          ) : (
            <div
              className="border-border bg-muted/30 relative w-full overflow-hidden rounded-md border"
              style={{ aspectRatio: getMediaAspectRatio(m) }}
            >
              <Image
                src={m.url}
                alt=""
                fill
                className="object-cover"
                loading={eager ? "eager" : "lazy"}
                sizes="(max-width: 768px) 100vw, 700px"
                onError={() => markUnavailable(m)}
              />
              <button
                type="button"
                aria-label="Open media viewer"
                className="absolute inset-0 z-10"
                onClick={(event) => {
                  event.stopPropagation();
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
        {unavailableMediaShells}
      </>
    );
  }

  if (layout === "conversation") {
    return (
      <>
        <div className={cn("flex flex-col gap-1", className)}>
          {items.map((m, index) =>
            failedMediaUrls.has(m.url) ? (
              <LinkedInMediaUnavailable
                key={getAvailableMediaKey(m)}
                kind="image"
                aspectRatio={getFailedAspectRatio(m)}
                isRetrying={retryingMediaUrls.has(m.url)}
                onRetry={() => retryMedia(m)}
              />
            ) : (
              <LinkedInConversationImage
                key={getAvailableMediaKey(m)}
                media={m}
                eager={eager}
                onError={(aspectRatio) => markUnavailable(m, aspectRatio)}
                onOpen={() => openViewerAt(index)}
              />
            )
          )}
        </div>
        <LinkedInGalleryViewer
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          media={images}
          initialIndex={initialIndex}
        />
        {unavailableMediaShells}
      </>
    );
  }

  // 2/3/4 image grid (LinkedIn-like)
  return (
    <>
      <LinkedInImageGrid
        items={items}
        overflow={overflow}
        className={className}
        eager={eager}
        failedMediaUrls={failedMediaUrls}
        retryingMediaUrls={retryingMediaUrls}
        onError={markMediaUnavailable}
        onOpen={openViewerAt}
        onRetry={retryMedia}
      />
      <LinkedInGalleryViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        media={images}
        initialIndex={initialIndex}
      />
      {unavailableMediaShells}
    </>
  );
};
