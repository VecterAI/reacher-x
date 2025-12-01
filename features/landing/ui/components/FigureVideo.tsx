"use client";

import React from "react";
import dynamic from "next/dynamic";
import { cn } from "@/shared/lib/utils";

const LandingVideoPlayer = dynamic(() => import("./LandingVideoPlayer"), {
  ssr: false,
});

interface FigureVideoProps {
  hlsUrl?: string;
  mp4Url?: string;
  ariaLabel?: string;
  className?: string;
  figureClassName?: string;
  posterUrl?: string;
  initialPreload?: "none" | "metadata";
}

export const FigureVideo: React.FC<FigureVideoProps> = ({
  hlsUrl,
  mp4Url,
  ariaLabel,
  className,
  figureClassName,
  posterUrl,
  initialPreload,
}) => {
  return (
    <figure
      className={cn(
        "relative aspect-square overflow-hidden rounded-lg",
        figureClassName
      )}
    >
      <LandingVideoPlayer
        hlsUrl={hlsUrl}
        mp4Url={mp4Url}
        ariaLabel={ariaLabel}
        className={cn("h-full w-full", className)}
        posterUrl={posterUrl}
        initialPreload={initialPreload}
      />
    </figure>
  );
};
