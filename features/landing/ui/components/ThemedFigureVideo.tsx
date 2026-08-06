"use client";

import { useTheme } from "next-themes";
import {
  VIDEO_ASSETS,
  type VideoAsset,
  type VideoAssetKey,
} from "@/features/landing/lib/videoAssets";
import { cn } from "@/shared/lib/utils";
import { LandingMuxBackgroundVideo } from "./LandingMuxBackgroundVideo";
import { LandingMuxHoverPlayer } from "./LandingMuxHoverPlayer";

interface ThemedFigureVideoProps {
  videoAssetKey: VideoAssetKey;
  ariaLabel?: string;
  className?: string;
  figureClassName?: string;
  initialPreload?: "none" | "metadata";
  variant?: "background" | "player";
}

export function ThemedFigureVideo({
  videoAssetKey,
  ariaLabel,
  className,
  figureClassName,
  initialPreload,
  variant = "background",
}: ThemedFigureVideoProps) {
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === "dark" ? "dark" : "light";
  const asset: VideoAsset["light"] = VIDEO_ASSETS[videoAssetKey][mode];

  return (
    <figure
      className={cn("relative aspect-square overflow-hidden", figureClassName)}
    >
      {variant === "player" ? (
        <LandingMuxHoverPlayer
          playbackId={asset.playbackId}
          mp4Url={asset.mp4Url}
          posterUrl={asset.posterUrl}
          ariaLabel={ariaLabel}
          className={cn("h-full w-full", className)}
          loading={initialPreload === "metadata" ? "page" : "viewport"}
          maxResolution={videoAssetKey === "hero" ? "1080p" : "720p"}
          posterTime={asset.posterTime}
          sizes="(min-width: 768px) 1280px, 100vw"
        />
      ) : (
        <LandingMuxBackgroundVideo
          playbackId={asset.playbackId}
          mp4Url={asset.mp4Url}
          posterUrl={asset.posterUrl}
          posterTime={asset.posterTime}
          ariaLabel={ariaLabel}
          className={cn("h-full w-full", className)}
          initialPreload={initialPreload}
          maxResolution={videoAssetKey === "hero" ? "1080p" : "720p"}
        />
      )}
    </figure>
  );
}
