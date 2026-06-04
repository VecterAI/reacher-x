"use client";

import * as React from "react";
import {
  type LandingPlayableMediaElement,
  useLandingAutoPlay,
} from "../components/LandingAutoPlayProvider";

export function useAutoPlayOnVisible(
  videoRef: React.RefObject<LandingPlayableMediaElement | null>,
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
        // `playsInline` is declared on the rendered player/video element.
        // Mux Player 3.13 warns when it is reassigned imperatively.
        el.muted = true;
        Promise.resolve(el.play()).catch(() => {});
      } else {
        if (isCurrent(el)) {
          setCurrent(null);
        }
        try {
          el.pause();
        } catch {}
      }
    };

    const io = new IntersectionObserver(onIntersect, {
      threshold: [0, 0.6, 1],
    });
    io.observe(el as unknown as Element);
    return () => io.disconnect();
  }, [videoRef, enabled, setCurrent, isCurrent]);
}
