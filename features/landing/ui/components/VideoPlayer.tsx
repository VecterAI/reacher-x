"use client";

import React from "react";
import { cn } from "@/shared/lib/utils/utils";
import "media-chrome/react";
import "media-chrome/react/menu";
import { MediaTheme } from "media-chrome/react/media-theme";

interface VideoPlayerProps {
  hlsUrl?: string;
  mp4Url?: string;
  ariaLabel?: string;
  className?: string;
}

type MediaThemeElementLike = HTMLElement & { template?: HTMLTemplateElement };

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  hlsUrl,
  mp4Url,
  ariaLabel,
  className,
  ...props
}) => {
  const attachTemplate = React.useCallback((el: Element | null) => {
    if (!el) return;
    const tmpl =
      typeof document !== "undefined"
        ? (document.getElementById(
            "media-theme-yt"
          ) as HTMLTemplateElement | null)
        : null;
    if (tmpl) {
      (el as unknown as MediaThemeElementLike).template = tmpl;
    }
  }, []);

  return (
    <MediaTheme
      ref={attachTemplate}
      className={cn("h-full min-h-0 w-full overflow-hidden", className)}
      style={{ "--media-accent-color": "#ffffff" } as React.CSSProperties}
      {...props}
    >
      <video
        slot="media"
        className="h-full w-full object-contain"
        aria-label={ariaLabel}
        playsInline
        crossOrigin="anonymous"
      >
        {hlsUrl && <source src={hlsUrl} type="application/x-mpegURL" />}
        {mp4Url && <source src={mp4Url} type="video/mp4" />}
        Your browser does not support HTML5 video.
      </video>
    </MediaTheme>
  );
};

export default VideoPlayer;
