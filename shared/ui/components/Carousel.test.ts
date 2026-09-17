// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { Carousel } from "./Carousel";
const { scrollPrev, scrollNext } = vi.hoisted(() => ({
  scrollPrev: vi.fn(),
  scrollNext: vi.fn(),
}));
vi.mock("embla-carousel-react", () => ({
  default: () => [
    () => {},
    {
      scrollPrev,
      scrollNext,
      canScrollPrev: () => true,
      canScrollNext: () => true,
      on: () => {},
      off: () => {},
    },
  ],
}));
test("timeline arrows stay with the input while carousel arrows still navigate", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        createElement(
          Carousel,
          null,
          createElement("input", {
            type: "range",
            "aria-label": "Demo progress",
          })
        )
      )
    );
    const input = host.querySelector("input")!;
    for (const key of ["ArrowLeft", "ArrowRight"]) {
      const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    // Browsers expose inherited and plaintext-only editing through this property.
    const editableChild = document.createElement("span");
    Object.defineProperty(editableChild, "isContentEditable", { value: true });
    host.querySelector('[role="region"]')!.append(editableChild);
    for (const key of ["ArrowLeft", "ArrowRight"]) {
      const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      });
      editableChild.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(scrollPrev).not.toHaveBeenCalled();
    expect(scrollNext).not.toHaveBeenCalled();
    const region = host.querySelector('[role="region"]')!;
    region.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      })
    );
    expect(scrollNext).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
