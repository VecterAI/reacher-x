"use client";

import { useEffect, useRef, useState } from "react";

/** Load nearby apps once; retain their state while offscreen playback is paused. */
export function useDemoVisibility(preloadRoot?: HTMLElement) {
  const root = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let nearby = false;
    let rootNearby = !preloadRoot;
    const updateMount = () => {
      if (nearby && rootNearby) setMounted(true);
    };
    const observer = new IntersectionObserver((entries) => {
      const entry = entries.at(-1);
      if (!entry) return;
      setVisible(entry.isIntersecting);
    });
    const preload = new IntersectionObserver(
      (entries) => {
        const entry = entries.at(-1);
        if (!entry) return;
        nearby = entry.isIntersecting;
        updateMount();
      },
      {
        root: preloadRoot,
        rootMargin: preloadRoot ? "0px 400px" : "1000px 400px",
      }
    );
    // A local carousel root can see past the page's horizontal clipping edge.
    // Separately gate it by distance from the browser viewport, so a distant
    // carousel cannot load its slides before the reader approaches the row.
    const rootVisibility = preloadRoot
      ? new IntersectionObserver(
          (entries) => {
            const entry = entries.at(-1);
            if (!entry) return;
            rootNearby = entry.isIntersecting;
            updateMount();
          },
          { rootMargin: "1000px 0px" }
        )
      : undefined;
    observer.observe(node);
    preload.observe(node);
    if (preloadRoot) rootVisibility?.observe(preloadRoot);
    return () => {
      observer.disconnect();
      preload.disconnect();
      rootVisibility?.disconnect();
    };
  }, [preloadRoot]);
  return { root, visible, mounted };
}
