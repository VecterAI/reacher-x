"use client";

import React from "react";
import { cn } from "@/shared/lib/utils";
import { toTwitterMediaProxyUrl } from "@/shared/lib/twitter/mediaProxy";
import "media-chrome/react";
import "media-chrome/react/menu";
import { MediaTheme } from "media-chrome/react/media-theme";

interface VideoPlayerProps {
  hlsUrl?: string;
  mp4Url?: string;
  ariaLabel?: string;
  className?: string;
  poster?: string;
}

type MediaThemeElementLike = HTMLElement & { template?: HTMLTemplateElement };

/** React's `VideoHTMLAttributes` omits `referrerPolicy`; HTML still allows it on `<video>`. */
type VideoWithReferrerPolicy = React.VideoHTMLAttributes<HTMLVideoElement> & {
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  hlsUrl,
  mp4Url,
  ariaLabel,
  className,
  poster,
  ...props
}) => {
  const resolvedMp4Url = React.useMemo(
    () => toTwitterMediaProxyUrl(mp4Url),
    [mp4Url]
  );
  const resolvedHlsUrl = React.useMemo(
    () => toTwitterMediaProxyUrl(hlsUrl),
    [hlsUrl]
  );

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
        preload="metadata"
        poster={poster}
        {...({
          referrerPolicy: "no-referrer",
        } satisfies VideoWithReferrerPolicy)}
      >
        {resolvedMp4Url ? (
          <source src={resolvedMp4Url} type="video/mp4" />
        ) : null}
        {resolvedHlsUrl ? (
          <source src={resolvedHlsUrl} type="application/x-mpegURL" />
        ) : null}
        Your browser does not support HTML5 video.
      </video>
    </MediaTheme>
  );
};

export default VideoPlayer;
