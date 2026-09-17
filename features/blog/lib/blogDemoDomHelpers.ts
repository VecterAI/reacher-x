import { isRecord, getNumberProperty } from "@/convex/lib/typeGuards";
import type { DemoRect, DemoTarget } from "./blogDemoHelpers";

/** Targets resolve inside the demo document, including Radix portals. Never use authored pixels. */
export function findDemoTargets(
  document: Document,
  target: DemoTarget
): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(target.selector)
  ).filter((element) => {
    const rect = element.getBoundingClientRect();
    const label = (element.textContent ?? "").replace(/\s+/g, " ").trim();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      !element.closest('[hidden], [aria-hidden="true"]') &&
      (!target.within ||
        element
          .closest(target.within.selector)
          ?.textContent?.includes(target.within.containsText)) &&
      (target.containsText === undefined ||
        label.includes(target.containsText)) &&
      (target.text === undefined ||
        label === target.text ||
        (element.getAttribute("role") === "tab" &&
          label.startsWith(target.text)))
    );
  });
}
export function findDemoTarget(
  document: Document,
  target: DemoTarget
): HTMLElement | undefined {
  return findDemoTargets(document, target)[0];
}

export function measureDemoFocus(
  document: Document,
  target: DemoTarget
): DemoRect | undefined {
  const matches = findDemoTargets(document, target);
  const rects = (target.all ? matches : matches.slice(0, 1)).map(
    measureDemoTarget
  );
  if (!rects.length) return undefined;
  const x = Math.min(...rects.map((rect) => rect.x));
  const y = Math.min(...rects.map((rect) => rect.y));
  return {
    x,
    y,
    width: Math.max(...rects.map((rect) => rect.x + rect.width)) - x,
    height: Math.max(...rects.map((rect) => rect.y + rect.height)) - y,
  };
}
export function measureDemoTarget(element: HTMLElement): DemoRect {
  const rect = element.getBoundingClientRect();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

/** Use Radix's pointer contract for triggers/options; normal buttons use their click handler. */
export function activateDemoTarget(element: HTMLElement) {
  if (element.matches(':disabled,[aria-disabled="true"],[data-disabled]'))
    throw new Error("The demo control is disabled");
  const { x, y, width, height } = measureDemoTarget(element);
  const init = {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
    button: 0,
    clientX: x + width / 2,
    clientY: y + height / 2,
  };
  if (element.getAttribute("role") === "tab") {
    element.dispatchEvent(new MouseEvent("mousedown", init));
  } else if (
    element.getAttribute("role") === "option" &&
    !element.matches("button")
  ) {
    element.dispatchEvent(new PointerEvent("pointermove", init));
    element.dispatchEvent(new PointerEvent("pointerup", init));
  } else if (element.hasAttribute("aria-haspopup")) {
    element.dispatchEvent(new PointerEvent("pointerdown", init));
    element.dispatchEvent(new PointerEvent("pointerup", init));
  } else {
    element.click();
  }
}

/** Scroll only the app's own panels; scrollIntoView can also move the host article. */
export function revealDemoTarget(element: HTMLElement) {
  for (
    let parent = element.parentElement;
    parent && parent !== element.ownerDocument.body;
    parent = parent.parentElement
  ) {
    if (parent.scrollHeight <= parent.clientHeight) continue;
    const overflow = getComputedStyle(parent).overflowY;
    if (overflow !== "auto" && overflow !== "scroll") continue;
    const target = element.getBoundingClientRect(),
      viewport = parent.getBoundingClientRect();
    if (target.top < viewport.top)
      parent.scrollTop += target.top - viewport.top;
    else if (target.bottom > viewport.bottom)
      parent.scrollTop += Math.min(
        target.top - viewport.top,
        target.bottom - viewport.bottom
      );
  }
}

export function readDemoRect(value: unknown): DemoRect | undefined {
  if (!isRecord(value)) return;
  const x = getNumberProperty(value, "x"),
    y = getNumberProperty(value, "y"),
    width = getNumberProperty(value, "width"),
    height = getNumberProperty(value, "height");
  if (
    x === undefined ||
    y === undefined ||
    width === undefined ||
    height === undefined ||
    ![x, y, width, height].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0
  )
    return;
  return { x, y, width, height };
}
