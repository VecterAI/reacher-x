"use client";

import { useCallback, useEffect, useRef } from "react";

/** Radix focus inside a transformed iframe can scroll its host article.
 * Preserve the reader's position across scripted actions only. Any real input
 * cancels restoration, so this never fights someone scrolling the article.
 */
export function useDemoHostScroll() {
  const pending = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef(0);
  const navigating = useRef(false);
  const cancel = useCallback(() => {
    pending.current = null;
    cancelAnimationFrame(frame.current);
  }, []);
  const capture = useCallback(() => {
    cancel();
    if (navigating.current) return;
    pending.current = { x: window.scrollX, y: window.scrollY };
  }, [cancel]);
  const restore = useCallback(() => {
    const position = pending.current;
    if (!position) return;
    const apply = () => {
      if (pending.current !== position) return;
      window.scrollTo({
        left: position.x,
        top: position.y,
        behavior: "instant",
      });
    };
    apply();
    frame.current = requestAnimationFrame(() => {
      apply();
      frame.current = requestAnimationFrame(() => {
        apply();
        if (pending.current === position) pending.current = null;
      });
    });
  }, []);
  useEffect(() => {
    let navigationEnd: ReturnType<typeof setTimeout> | undefined;
    const extendNavigation = () => {
      clearTimeout(navigationEnd);
      navigationEnd = setTimeout(() => {
        navigating.current = false;
      }, 200);
    };
    const onInput = () => {
      cancel();
      navigating.current = true;
      extendNavigation();
    };
    const onScroll = () => {
      // Keep ownership throughout momentum scrolling and smooth anchor jumps.
      if (navigating.current) extendNavigation();
    };
    const events = ["wheel", "touchmove", "pointerdown", "keydown"] as const;
    for (const name of events)
      window.addEventListener(name, onInput, { capture: true, passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancel();
      clearTimeout(navigationEnd);
      for (const name of events)
        window.removeEventListener(name, onInput, true);
      window.removeEventListener("scroll", onScroll);
    };
  }, [cancel]);
  return { capture, restore, cancel };
}
