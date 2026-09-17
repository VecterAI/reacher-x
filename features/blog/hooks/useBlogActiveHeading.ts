"use client";

import { useEffect, useState } from "react";
import type { BlogHeading } from "../lib/blogHelpers";

/** Follow native anchor navigation and scrolling without changing focus or URL. */
export function useBlogActiveHeading(headings: BlogHeading[]) {
  const [activeId, setActiveId] = useState<string>();

  useEffect(() => {
    if (headings.length < 2) return;
    const elements = headings.flatMap(({ id }) => {
      const element = document.getElementById(id);
      return element ? [element] : [];
    });
    let frame: number | undefined;
    const update = () => {
      frame = undefined;
      let current: string | undefined;
      for (const element of elements) {
        const offset =
          Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
        if (element.getBoundingClientRect().top > offset + 1) break;
        current = element.id;
      }
      setActiveId(current);
    };
    const scheduleUpdate = () => {
      if (frame === undefined) frame = requestAnimationFrame(update);
    };
    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("hashchange", scheduleUpdate);
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("hashchange", scheduleUpdate);
    };
  }, [headings]);

  return activeId;
}
