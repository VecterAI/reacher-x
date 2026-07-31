"use client";

import Image from "next/image";
import MuxPlayer from "@mux/mux-player-react";
import { getMuxPosterUrl } from "@/features/landing/lib/muxVideo";
import { cn } from "@/shared/lib/utils";
import { useMuxPlaybackIdStatus } from "../hooks/useMuxPlaybackIdStatus";

interface LandingMuxHoverPlayerProps {
  playbackId?: string;
  mp4Url?: string;
  ariaLabel?: string;
  className?: string;
  posterTime?: number;
  loading?: "page" | "viewport";
  maxResolution?: "720p" | "1080p";
  sizes?: string;
}

export function LandingMuxHoverPlayer({
  playbackId,
  mp4Url,
  ariaLabel,
  className,
  posterTime = 0,
  loading = "viewport",
  maxResolution = "720p",
  sizes = "(min-width: 1280px) 28vw, (min-width: 768px) 35vw, 75vw",
}: LandingMuxHoverPlayerProps) {
  const playbackStatus = useMuxPlaybackIdStatus(playbackId);
  const canUseMux = playbackStatus !== "invalid" && !!playbackId;
  const posterUrl = playbackId
    ? getMuxPosterUrl(playbackId, { time: posterTime, width: 1600 })
    : null;

  return (
    <div
      className={cn(
        "bg-muted relative h-full w-full overflow-hidden",
        className
      )}
    >
      {posterUrl ? (
        <Image
          src={posterUrl}
          alt=""
          aria-hidden="true"
          fill
          sizes={sizes}
          className="object-cover"
        />
      ) : null}

      {canUseMux ? (
        <MuxPlayer
          className="absolute inset-0 h-full w-full bg-transparent"
          style={{
            "--media-object-fit": "cover",
            "--media-object-position": "center",
          }}
          preload={loading === "page" ? "auto" : "metadata"}
          accentColor="hsl(var(--muted-foreground))"
          playbackId={playbackId}
          poster={posterUrl ?? undefined}
          placeholder={posterUrl ?? undefined}
          title=""
          videoTitle=""
          metadataVideoTitle=""
          thumbnailTime={posterTime}
          streamType="on-demand"
          maxResolution={maxResolution}
          defaultHiddenCaptions
          volume={1}
          loop
          playsInline
          disablePictureInPicture
          noVolumePref
          noMutedPref
        />
      ) : mp4Url ? (
        <video
          src={mp4Url}
          controls
          loop
          playsInline
          preload="metadata"
          aria-label={ariaLabel}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
    </div>
  );
}
