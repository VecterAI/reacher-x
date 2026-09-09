"use client";
import { useRef, useState } from "react";
import { useInView } from "motion/react";
import Image from "next/image";
import { Button } from "@/shared/ui/components/Button";

// Motion is opt-in, including for readers who prefer reduced motion.
export function BlogGif({
  src,
  poster,
  alt,
  caption,
  width,
  height,
}: {
  src: string;
  poster: string;
  alt: string;
  caption?: string;
  width: number;
  height: number;
}) {
  const figure = useRef<HTMLElement>(null);
  const visible = useInView(figure);
  const [playing, setPlaying] = useState(false);
  return (
    <figure ref={figure} className="not-prose my-10">
      <Image
        src={playing && visible ? src : poster}
        alt={alt}
        width={width}
        height={height}
        unoptimized
        sizes="(max-width: 768px) 100vw, 768px"
        className="border-border h-auto w-full rounded-lg border"
      />
      <figcaption className="mt-3 flex flex-col items-center gap-3 text-center text-sm leading-5">
        <span className="text-muted-foreground">{caption ?? alt}</span>
        <Button
          size="xs"
          variant="outline"
          onClick={() => setPlaying(!playing)}
        >
          {playing ? "Pause animation" : "Play animation"}
        </Button>
      </figcaption>
    </figure>
  );
}
