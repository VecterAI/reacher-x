/**
 * UseCaseDemoFrame
 * Zealos-style scale-to-fit frame for the landing page demo.
 * Renders children at a fixed design size, measures the container,
 * and scales the content so the canvas always fills the frame width
 * exactly (up or down). The shell inside fills the canvas height,
 * so the frame never has dead space. Small containers get a taller
 * design height so the scaled frame keeps more vertical room.
 *
 */
"use client";

import * as React from "react";

// 1280px design width: 16rem sidebar + 1024px main area, so the prospects
// grid fits exactly 3 columns of min 20rem cards like the real desktop page.
// 1280x850 canvas; small containers get a taller design height so the
// scaled frame keeps more vertical room.
const DESIGN_WIDTH = 1280;
const DESIGN_HEIGHT = 850;
const DESIGN_HEIGHT_COMPACT = 900;
const COMPACT_CONTAINER_WIDTH = 640;

export function UseCaseDemoFrame({ children }: { children: React.ReactNode }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  const [designHeight, setDesignHeight] = React.useState(DESIGN_HEIGHT);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const width = entry.contentRect.width;
      setScale(width / DESIGN_WIDTH);
      setDesignHeight(
        width < COMPACT_CONTAINER_WIDTH ? DESIGN_HEIGHT_COMPACT : DESIGN_HEIGHT
      );
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full">
      <div
        className="rounded-lg shadow-[0_0_0_2px_hsl(var(--border))] md:rounded-xl"
        style={{ height: designHeight * scale }}
      >
        <div className="h-full overflow-hidden rounded-[inherit]">
          <div
            className="bg-background relative"
            style={{
              width: DESIGN_WIDTH,
              height: designHeight,
              transform: `scale(${scale})`,
              transformOrigin: "left top",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
