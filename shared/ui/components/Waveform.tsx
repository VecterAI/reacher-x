"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";

export interface WaveformProps extends React.HTMLAttributes<HTMLDivElement> {
  data: number[];
  progress?: number;
  barWidth?: number;
  barGap?: number;
  minimumBarHeight?: number;
  height?: number;
  interactive?: boolean;
  onProgressChange?: (progress: number) => void;
}

/**
 * Responsive canvas waveform adapted from ElevenLabs UI's Waveform primitive.
 * The canvas stays presentational; an optional native range input provides
 * continuous touch, pointer, and keyboard seeking semantics.
 */
export function Waveform({
  data,
  progress = 0,
  barWidth = 3,
  barGap = 2,
  minimumBarHeight = 3,
  height = 36,
  interactive = false,
  onProgressChange,
  className,
  ...props
}: WaveformProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mutedColorRef = React.useRef<HTMLSpanElement>(null);
  const renderRef = React.useRef<() => void>(() => undefined);
  const normalizedProgress = Math.min(Math.max(progress, 0), 1);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const render = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * pixelRatio);
      canvas.height = Math.round(rect.height * pixelRatio);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);

      // Canvas cannot resolve Tailwind's raw HSL token channels (for example,
      // `0 0% 98%`). Reading computed `color` values keeps drawing aligned
      // with the active semantic theme in both light and dark modes.
      const foreground = getComputedStyle(container).color;
      const muted = mutedColorRef.current
        ? getComputedStyle(mutedColorRef.current).color
        : foreground;
      const step = barWidth + barGap;
      const barCount = Math.max(1, Math.floor(rect.width / step));
      const center = rect.height / 2;
      const fallback = data.length > 0 ? data : [0.08];

      for (let index = 0; index < barCount; index += 1) {
        const dataIndex = Math.min(
          fallback.length - 1,
          Math.floor((index / barCount) * fallback.length)
        );
        const value = Math.min(Math.max(fallback[dataIndex] ?? 0.08, 0.04), 1);
        const currentBarHeight = Math.max(
          minimumBarHeight,
          value * rect.height * 0.86
        );
        const x = index * step;
        const y = center - currentBarHeight / 2;
        const barProgress = index / barCount;

        context.fillStyle =
          barProgress <= normalizedProgress ? foreground : muted;
        context.globalAlpha =
          barProgress <= normalizedProgress ? 0.95 : 0.34 + value * 0.2;
        context.beginPath();
        context.roundRect(x, y, barWidth, currentBarHeight, barWidth / 2);
        context.fill();
      }
      context.globalAlpha = 1;
    };

    renderRef.current = render;
    render();
  }, [barGap, barWidth, data, minimumBarHeight, normalizedProgress]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const redraw = () => renderRef.current();
    const observer = new ResizeObserver(redraw);
    observer.observe(container);
    const themeObserver = new MutationObserver(redraw);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    return () => {
      observer.disconnect();
      themeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "text-foreground focus-within:bg-muted/60 relative min-w-0 overflow-hidden rounded-sm transition-colors",
        className
      )}
      style={{ height }}
      {...props}
    >
      <canvas className="block size-full" aria-hidden="true" ref={canvasRef} />
      <span
        ref={mutedColorRef}
        className="text-muted-foreground pointer-events-none absolute size-0 overflow-hidden"
        aria-hidden="true"
      />
      {interactive ? (
        <input
          type="range"
          min={0}
          max={1_000}
          step={1}
          value={Math.round(normalizedProgress * 1_000)}
          className="absolute inset-0 size-full cursor-pointer touch-pan-y opacity-0 focus:outline-none focus-visible:outline-none"
          aria-label="Seek voice note"
          aria-valuetext={`${Math.round(normalizedProgress * 100)}%`}
          onChange={(event) => {
            onProgressChange?.(event.currentTarget.valueAsNumber / 1_000);
          }}
        />
      ) : null}
    </div>
  );
}
