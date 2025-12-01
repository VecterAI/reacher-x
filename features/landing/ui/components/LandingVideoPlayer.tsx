"use client";

import React from "react";
import { cn } from "@/shared/lib/utils";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { useAutoPlayOnVisible } from "../hooks/useAutoPlayOnVisible";
import "media-chrome/react";
import "media-chrome/react/menu";
import { MediaTheme } from "media-chrome/react/media-theme";

interface LandingVideoPlayerProps {
  hlsUrl?: string;
  mp4Url?: string;
  ariaLabel?: string;
  className?: string;
  autoPlayOnVisible?: boolean;
  muted?: boolean;
  posterUrl?: string;
  initialPreload?: "none" | "metadata";
}

type MediaThemeElementLike = HTMLElement & { template?: HTMLTemplateElement };

const LandingVideoPlayer: React.FC<LandingVideoPlayerProps> = ({
  hlsUrl,
  mp4Url,
  ariaLabel,
  className,
  autoPlayOnVisible = true,
  muted = true,
  posterUrl,
  initialPreload = "none",
  ...props
}) => {
  const [loaded, setLoaded] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [preloadValue, setPreloadValue] =
    React.useState<HTMLVideoElement["preload"]>(initialPreload);

  const attachTemplate = React.useCallback((el: Element | null) => {
    if (!el) return;
    const tmpl =
      typeof document !== "undefined"
        ? (document.getElementById(
            "media-theme-landing"
          ) as HTMLTemplateElement | null)
        : null;
    if (tmpl) {
      (el as unknown as MediaThemeElementLike).template = tmpl;
    }
  }, []);

  useAutoPlayOnVisible(videoRef, { enabled: autoPlayOnVisible });

  // Upgrade preload to metadata when near viewport for faster first frame
  React.useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (preloadValue === "metadata") return; // already set (e.g., hero)
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting || entry.intersectionRatio > 0) {
          setPreloadValue("metadata");
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [preloadValue]);

  return (
    <div className={cn("relative h-full w-full", className)}>
      {/* Keep minimal skeleton for dynamic import only; do not overlay after mount */}
      {!loaded && initialPreload === "none" && (
        <Skeleton className="absolute inset-0 h-full w-full" />
      )}
      <MediaTheme
        ref={attachTemplate}
        className={cn("h-full w-full overflow-hidden", className)}
        style={{ "--media-accent-color": "#ffffff" } as React.CSSProperties}
        {...props}
      >
        <video
          slot="media"
          className="h-full w-full object-contain"
          aria-label={ariaLabel}
          playsInline
          preload={preloadValue}
          crossOrigin="anonymous"
          muted={muted}
          poster={posterUrl}
          ref={videoRef}
          onLoadedMetadata={() => setLoaded(true)}
        >
          {hlsUrl && <source src={hlsUrl} type="application/x-mpegURL" />}
          {mp4Url && <source src={mp4Url} type="video/mp4" />}
          Your browser does not support HTML5 video.
        </video>
      </MediaTheme>
    </div>
  );
};

export default LandingVideoPlayer;
