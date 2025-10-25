"use client";

import React from "react";
import { Media } from "@/features/threads/types";
import { cn } from "@/shared/lib/utils/utils";
import { Badge } from "@/shared/ui/components/Badge";

type VideoTileProps = {
  item: Media;
  className?: string;
  ariaLabel?: string;
  onClick?: () => void;
};

type Variant = { content_type: string; url: string; bitrate?: number };

function getBestMp4(variants?: Variant[]): string | undefined {
  if (!variants) return undefined;
  const mp4s = variants.filter((v) => v.content_type === "video/mp4");
  mp4s.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
  return mp4s[0]?.url;
}

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
    () => getBestMp4(item.video_info?.variants as Variant[] | undefined),
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
        "relative h-full w-full overflow-hidden rounded-md border border-border",
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
          className="absolute bottom-2 right-2 z-10 bg-black/60 font-mono text-[11px] text-white"
        >
          {formatDuration(duration)}
        </Badge>
      )}
    </button>
  );
};

export default VideoTile;
