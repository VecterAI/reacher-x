// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { useDemoHostScroll } from "./useDemoHostScroll";

test("demo restoration cannot interrupt smooth navigation, but resumes after scrolling settles", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  let guard: ReturnType<typeof useDemoHostScroll>;
  function Host() {
    guard = useDemoHostScroll();
    return null;
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<Host />));
    guard!.capture();
    window.dispatchEvent(new Event("pointerdown"));
    guard!.restore();
    expect(scroll).not.toHaveBeenCalled();
    for (let step = 0; step < 6; step++) {
      vi.advanceTimersByTime(150);
      window.dispatchEvent(new Event("scroll"));
      guard!.capture();
      guard!.restore();
    }
    expect(scroll).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    guard!.capture();
    guard!.restore();
    expect(scroll).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
