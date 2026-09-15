// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import {
  CapabilityCard,
  MARKETING_CAPABILITIES,
} from "./MarketingCapabilityCarousel";
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("@/features/blog/ui/components/app-demo/BlogAppDemo", () => ({
  BlogAppDemo: ({ playbackActive }: { playbackActive: boolean }) => (
    <iframe title="card demo" data-playing={playbackActive} />
  ),
}));

test("nearby cards preload paused, and distant cards release apps without changing layout", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const observers: IntersectionObserverCallback[] = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: IntersectionObserverCallback) {
        observers.push(cb);
      }
      observe() {}
      disconnect() {}
    }
  );
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const show = (i: number, visible: boolean) =>
    observers[i * 2 + 1](
      [{ isIntersecting: visible } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
  try {
    await act(async () =>
      root.render(
        <>
          {MARKETING_CAPABILITIES.map((item) => (
            <CapabilityCard key={item.demo} item={item} />
          ))}
        </>
      )
    );
    expect(host.querySelectorAll("iframe")).toHaveLength(0);
    // A fast scroll can enqueue both boundaries before one observer delivery.
    await act(async () => {
      observers[1](
        [
          { isIntersecting: false },
          { isIntersecting: true },
        ] as IntersectionObserverEntry[],
        {} as IntersectionObserver
      );
      vi.advanceTimersByTime(2000);
    });
    expect(host.querySelectorAll("iframe")).toHaveLength(1);
    const original = host.querySelector("iframe");
    await act(async () => {
      observers[0](
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
      vi.advanceTimersByTime(3000);
    });
    expect(host.querySelector("iframe")).toBe(original);
    await act(async () => {
      show(0, true);
      show(1, true);
      show(2, true);
    });
    expect(host.querySelectorAll("iframe")).toHaveLength(3);
    expect(host.querySelectorAll('iframe[data-playing="true"]')).toHaveLength(
      0
    );
    for (let i = 3; i < 8; i++) {
      await act(async () => {
        show(i - 3, false);
        show(i, true);
        vi.advanceTimersByTime(2000);
      });
      expect(host.querySelectorAll("iframe")).toHaveLength(3);
    }
    const card = host.querySelectorAll("article")[7];
    expect(card.querySelector("a")?.nextElementSibling?.className).toBe(
      "capability-demo"
    );
    expect(card.querySelector("a svg")).not.toBeNull();
    await act(async () => {
      show(7, false);
      vi.advanceTimersByTime(100);
      show(7, true);
      vi.advanceTimersByTime(2000);
    });
    expect(card.querySelector("iframe")).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
