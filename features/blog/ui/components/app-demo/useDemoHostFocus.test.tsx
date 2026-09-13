// @vitest-environment happy-dom
import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { useDemoHostFocus } from "./useDemoHostFocus";

test("offscreen demos remain inert when an external menu closes, and unlock only on return", async () => {
  let notify: IntersectionObserverCallback | undefined;
  const disconnect = vi.fn();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        notify = callback;
      }
      observe() {}
      disconnect = disconnect;
    }
  );
  const send = vi.fn();
  function Host() {
    const ref = useRef<HTMLElement>(null);
    useDemoHostFocus(ref, send);
    return <section ref={ref} />;
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const intersect = (isIntersecting: boolean) =>
    notify?.(
      [{ isIntersecting } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
  try {
    await act(async () => root.render(<Host />));
    expect(send).toHaveBeenLastCalledWith("reacherx:host-focus", {
      active: false,
    });
    intersect(false);
    expect(send).toHaveBeenLastCalledWith("reacherx:host-focus", {
      active: true,
    });
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    await act(async () => {
      document.body.append(menu);
    });
    await act(async () => {
      menu.remove();
    });
    expect(send).toHaveBeenLastCalledWith("reacherx:host-focus", {
      active: true,
    });
    intersect(true);
    expect(send).toHaveBeenLastCalledWith("reacherx:host-focus", {
      active: false,
    });
    vi.useFakeTimers();
    window.dispatchEvent(new Event("scroll"));
    expect(send).toHaveBeenLastCalledWith("reacherx:host-focus", {
      active: true,
    });
    vi.advanceTimersByTime(150);
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(150);
    expect(send).toHaveBeenLastCalledWith("reacherx:host-focus", {
      active: true,
    });
    vi.advanceTimersByTime(50);
    expect(send).toHaveBeenLastCalledWith("reacherx:host-focus", {
      active: false,
    });
  } finally {
    vi.useRealTimers();
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
  expect(disconnect).toHaveBeenCalledOnce();
});
