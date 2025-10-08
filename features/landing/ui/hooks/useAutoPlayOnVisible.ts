"use client";

import * as React from "react";
import { useLandingAutoPlay } from "../components/LandingAutoPlayProvider";

export function useAutoPlayOnVisible(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  opts: { enabled?: boolean } = {}
) {
  const { setCurrent, isCurrent } = useLandingAutoPlay();
  const enabled = opts.enabled ?? true;

  React.useEffect(() => {
    const el = videoRef.current;
    if (!el || !enabled) return;

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches) return;

    const onIntersect: IntersectionObserverCallback = ([entry]) => {
      if (!entry) return;
      const visible = entry.isIntersecting && entry.intersectionRatio >= 0.6;
      if (visible) {
        setCurrent(el);
        // Autoplay policies require muted + playsInline
        el.muted = true;
        el.playsInline = true;
        el.play().catch(() => {});
      } else {
        if (!isCurrent(el)) {
          try {
            el.pause();
          } catch {}
        }
      }
    };

    const io = new IntersectionObserver(onIntersect, {
      threshold: [0, 0.6, 1],
    });
    io.observe(el);
    return () => io.disconnect();
  }, [videoRef, enabled, setCurrent, isCurrent]);
}
