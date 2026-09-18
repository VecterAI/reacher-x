import type { ComponentProps, WheelEvent } from "react";
import type { Carousel } from "@/shared/ui/components/Carousel";

const DEMO_CONTROLS = ".blog-app-demo-controls, .blog-app-demo-expanded";

export const MARKETING_CAROUSEL_OPTIONS: ComponentProps<
  typeof Carousel
>["opts"] = {
  align: "start",
  dragFree: true,
  watchDrag: (_api, event) =>
    !(event.target instanceof Element && event.target.closest(DEMO_CONTROLS)),
};

/** Wheel plugins synthesize dragging on the viewport, losing the original target. */
export function preserveDemoWheelInteraction(event: WheelEvent<HTMLElement>) {
  if (
    event.ctrlKey ||
    (event.target instanceof Element && event.target.closest(DEMO_CONTROLS))
  )
    event.stopPropagation();
}
