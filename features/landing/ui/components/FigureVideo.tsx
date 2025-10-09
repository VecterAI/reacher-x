"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { cn } from "@/shared/lib/utils/utils";

const LandingVideoPlayer = dynamic(() => import("./LandingVideoPlayer"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

interface FigureVideoProps {
  hlsUrl?: string;
  mp4Url?: string;
  ariaLabel?: string;
  className?: string;
  figureClassName?: string;
}

export const FigureVideo: React.FC<FigureVideoProps> = ({
  hlsUrl,
  mp4Url,
  ariaLabel,
  className,
  figureClassName,
}) => {
  return (
    <figure
      className={cn(
        "relative aspect-[1/1] overflow-hidden rounded-lg border border-border",
        figureClassName
      )}
    >
      <LandingVideoPlayer
        hlsUrl={hlsUrl}
        mp4Url={mp4Url}
        ariaLabel={ariaLabel}
        className={cn("h-full w-full", className)}
      />
    </figure>
  );
};
