"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/utils/utils";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { Button } from "@/shared/ui/components/Button";
import { Toggle } from "@/shared/ui/components/Toggle";
import { CloseIcon, LinkIcon, BarcodeIcon } from "@/shared/ui/components/icons";
import Image from "next/image";
import { useOgPreview } from "@/shared/hooks/useOgPreview";
import { logger } from "@/shared/lib/logger";

interface OpenGraphPreviewProps {
  url: string;
  className?: string;
  onRemove?: () => void;
  context?: "composer" | "timeline";
  debounceMs?: number;
  enableCache?: boolean;
  retryOnError?: boolean;
}

export function OpenGraphPreview({
  url,
  className,
  onRemove,
  context = "composer",
  debounceMs = 500,
  enableCache = true,
  retryOnError = true,
}: OpenGraphPreviewProps) {
  const { data, loading, error, fromCache } = useOgPreview(url, {
    debounceMs,
    enableCache,
    retryOnError,
  });

  const [imageError, setImageError] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [faviconError, setFaviconError] = useState(false);

  // Handle image load errors gracefully without showing error UI
  const handleImageError = (
    imageUrl: string | null | undefined,
    error: React.SyntheticEvent<HTMLImageElement, Event>
  ) => {
    logger.warn("OpenGraph image failed to load:", imageUrl, error);
    setImageError(true);
  };

  const handleFaviconError = (
    faviconUrl: string | null | undefined,
    error: React.SyntheticEvent<HTMLImageElement, Event>
  ) => {
    logger.warn("Favicon failed to load:", faviconUrl, error);
    setFaviconError(true);
  };

  const showCloseButton = context === "composer" && onRemove;

  const handleImageClick = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleFaviconClick = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // While fetching data, show skeleton immediately to avoid empty gap
  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        <div
          className="relative w-full overflow-hidden rounded-md"
          style={{ aspectRatio: "16 / 9" }}
        >
          <Skeleton className="animate-pulse-fast absolute inset-0 h-full w-full" />
        </div>
        {/* Status row skeleton: favicon + site name, matching final layout */}
        <div className="mt-2 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-sm" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          {/* Right-side status (e.g., Cached) omitted in loading */}
        </div>
      </div>
    );
  }

  // Hide preview completely on error (mimic Twitter)
  if (error) {
    return null;
  }

  // Only render if image exists; otherwise render nothing
  if (!data || !data.image) {
    return null;
  }

  const proxied = (u: string | null | undefined) =>
    u
      ? `/api/opengraph?asset=image&url=${encodeURIComponent(u)}&ref=${encodeURIComponent(url)}`
      : (u ?? undefined);

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className="relative w-full overflow-hidden rounded-md"
        style={{ aspectRatio: "16 / 9" }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleImageClick();
          }}
          className="relative h-full w-full cursor-pointer rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label={`Open link: ${data.title || url}`}
        >
          {data.image && !imageError ? (
            <Image
              src={proxied(data.image) as string}
              alt={data.title ?? "preview"}
              fill
              className="object-fill"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              onError={(e) => handleImageError(data.image, e)}
              // Important: avoid Next.js remote allowlist for arbitrary OG images
              unoptimized
              priority={fromCache}
            />
          ) : null}
        </button>

        {showCloseButton && (
          <Button
            variant="outline"
            size="xsIcon"
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.();
            }}
            className="absolute right-2 top-2"
            aria-label="Remove preview"
          >
            <CloseIcon className="fill-current" />
          </Button>
        )}

        <Toggle
          pressed={showDetails}
          onPressedChange={setShowDetails}
          size="xsIcon"
          variant="outline"
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-2 left-2 bg-background"
          aria-label="Toggle details"
        >
          <BarcodeIcon className="fill-current" />
        </Toggle>
      </div>

      {showDetails && (data.title || data.description) && (
        <div className="mt-2 space-y-2">
          {data.title && (
            <div className="line-clamp-2 text-sm font-medium">{data.title}</div>
          )}
          {data.description && (
            <div className="line-clamp-2 text-xs text-muted-foreground">
              {data.description}
            </div>
          )}
        </div>
      )}

      {/* Status + Description Row (16px gap) - matching MediaUploadSection */}
      <div className="mt-2 flex items-start gap-4">
        <div className="flex-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleFaviconClick();
            }}
            className="flex items-center gap-2 rounded-sm transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label={`Visit ${data.siteName || new URL(url).hostname}`}
          >
            {data.favicon && !faviconError ? (
              <Image
                src={proxied(data.favicon) as string}
                alt={data.siteName || new URL(url).hostname}
                width={16}
                height={16}
                className="rounded-sm border"
                onError={(e) => handleFaviconError(data.favicon, e)}
                // Important: avoid Next.js remote allowlist for arbitrary favicons
                unoptimized
                priority={false}
              />
            ) : (
              <LinkIcon className="h-4 w-4 fill-current" />
            )}
            <span className="text-sm text-muted-foreground">
              {data.siteName || new URL(url).hostname}
            </span>
          </button>
        </div>

        {fromCache && (
          <div className="text-xs text-muted-foreground/60">· Cached</div>
        )}
      </div>
    </div>
  );
}
