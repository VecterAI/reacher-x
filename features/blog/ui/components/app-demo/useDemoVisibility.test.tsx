// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { useDemoVisibility } from "./useDemoVisibility";

function Demo({ preloadRoot }: { preloadRoot?: HTMLElement }) {
  const { root, visible, mounted } = useDemoVisibility(preloadRoot);
  return (
    <section ref={root} data-visible={visible}>
      {mounted && <iframe title="demo" />}
    </section>
  );
}

test("preloading does not mark a demo visible, preserves it on return, and cleans up delayed release", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const observers: {
    callback: IntersectionObserverCallback;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      disconnect = vi.fn();
      constructor(callback: IntersectionObserverCallback) {
        observers.push({ callback, disconnect: this.disconnect });
      }
      observe() {}
    }
  );
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const show = (index: number, ...values: boolean[]) =>
    observers[index].callback(
      values.map(
        (isIntersecting) => ({ isIntersecting }) as IntersectionObserverEntry
      ),
      {} as IntersectionObserver
    );
  try {
    await act(async () => root.render(<Demo />));
    await act(async () => show(1, true));
    const iframe = host.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(host.querySelector("section")?.dataset.visible).toBe("false");
    await act(async () => show(0, true, false));
    expect(host.querySelector("section")?.dataset.visible).toBe("false");
    await act(async () => {
      show(1, false);
      vi.advanceTimersByTime(1500);
    });
    expect(host.querySelector("iframe")).toBe(iframe);
    await act(async () => {
      show(1, true);
      vi.advanceTimersByTime(3000);
    });
    expect(host.querySelector("iframe")).toBe(iframe);
    await act(async () => {
      show(1, false);
      vi.advanceTimersByTime(2000);
    });
    expect(host.querySelector("iframe")).toBeNull();
    await act(async () => {
      show(1, true, false);
    });
    await act(async () => root.render(<Demo preloadRoot={host} />));
    await act(async () => show(3, true));
    expect(host.querySelector("iframe")).toBeNull();
    await act(async () => show(4, true));
    expect(host.querySelector("iframe")).not.toBeNull();
    // Horizontally adjacent slides must still release when the row is far away.
    await act(async () => {
      show(4, false);
      vi.advanceTimersByTime(2000);
    });
    expect(host.querySelector("iframe")).toBeNull();
    await act(async () => {
      show(4, true);
      show(3, false);
      vi.advanceTimersByTime(2000);
    });
    expect(host.querySelector("iframe")).toBeNull();
    await act(async () => show(3, true));
    expect(host.querySelector("iframe")).not.toBeNull();
    await act(async () => root.unmount());
    expect(vi.getTimerCount()).toBe(0);
    for (const observer of observers)
      expect(observer.disconnect).toHaveBeenCalledOnce();
  } finally {
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
