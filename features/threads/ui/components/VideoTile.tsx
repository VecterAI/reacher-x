"use client";

import React from "react";
import { Media } from "@/features/threads/types";
import {
  getBestMp4VariantUrl,
  type VideoVariant,
} from "@/shared/lib/twitter/mediaVariants";
import { toTwitterMediaProxyUrl } from "@/shared/lib/twitter/mediaProxy";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/components/Badge";

type VideoTileProps = {
  item: Media;
  className?: string;
  ariaLabel?: string;
  onClick?: () => void;
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const VideoTile: React.FC<VideoTileProps> = ({
  item,
  className,
  ariaLabel,
  onClick,
}) => {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [duration, setDuration] = React.useState<number | null>(null);

  const mp4Url = React.useMemo(
    () =>
      toTwitterMediaProxyUrl(
        getBestMp4VariantUrl(
          item.video_info?.variants as VideoVariant[] | undefined
        )
      ),
    [item.video_info?.variants]
  );
  const poster = item.media_url_https;

  React.useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onLoaded = () => setDuration(el.duration || null);
    el.addEventListener("loadedmetadata", onLoaded);
    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
    };
  }, []);

  React.useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (!entry.isIntersecting) {
          try {
            el.pause();
            el.currentTime = 0;
          } catch {}
        }
      },
      { rootMargin: "0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <button
      className={cn(
        "border-border relative h-full w-full overflow-hidden rounded-md border",
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      aria-label={ariaLabel}
      type="button"
    >
      <video
        ref={videoRef}
        className="h-full w-full bg-black object-contain"
        playsInline
        muted
        preload="metadata"
        poster={poster}
        aria-label={ariaLabel}
      >
        {mp4Url && <source src={mp4Url} type="video/mp4" />}
        Your browser does not support HTML5 video.
      </video>

      {duration !== null && (
        <Badge
          variant="outline"
          className="absolute right-2 bottom-2 z-10 bg-black/60 font-mono text-[11px] text-white"
        >
          {formatDuration(duration)}
        </Badge>
      )}
    </button>
  );
};

export default VideoTile;
