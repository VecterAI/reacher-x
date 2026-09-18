// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { preserveDemoWheelInteraction } from "./marketingCarouselHelpers";

test("carousel wheel support leaves demo controls, expanded demos and browser zoom alone", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const plugin = vi.fn();
  try {
    await act(async () =>
      root.render(
        <div onWheelCapture={preserveDemoWheelInteraction}>
          <div data-viewport>
            <a href="#card">Card</a>
            <div className="blog-app-demo-controls">
              <input type="range" />
            </div>
            <div className="blog-app-demo-expanded">
              <button>Fullscreen control</button>
            </div>
          </div>
        </div>
      )
    );
    host.querySelector("[data-viewport]")!.addEventListener("wheel", plugin);
    for (const selector of ["input", "button"]) {
      const wheel = new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaX: 120,
      });
      host.querySelector(selector)!.dispatchEvent(wheel);
      expect(wheel.defaultPrevented).toBe(false);
      expect(plugin).not.toHaveBeenCalled();
    }
    host.querySelector("a")!.dispatchEvent(
      // happy-dom WheelEvent drops modifier keys; MouseEvent preserves them.
      new MouseEvent("wheel", { bubbles: true, ctrlKey: true })
    );
    expect(plugin).not.toHaveBeenCalled();
    host
      .querySelector("a")!
      .dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaX: 120 }));
    expect(plugin).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
