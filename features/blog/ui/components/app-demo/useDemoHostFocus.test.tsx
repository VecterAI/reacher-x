// @vitest-environment happy-dom
import { act, useRef, useState, useCallback } from "react";
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
  function Host({ suppressFocus = false }: { suppressFocus?: boolean }) {
    const ref = useRef<HTMLElement>(null);
    useDemoHostFocus(ref, send, suppressFocus);
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
    notify?.(
      [
        { isIntersecting: true },
        { isIntersecting: false },
      ] as IntersectionObserverEntry[],
      {} as IntersectionObserver
    );
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
    await act(async () => root.render(<Host suppressFocus />));
    intersect(true);
    expect(send).toHaveBeenLastCalledWith("reacherx:host-focus", {
      active: true,
    });
    await act(async () => root.render(<Host />));
    intersect(true);
    expect(send).toHaveBeenLastCalledWith("reacherx:host-focus", {
      active: false,
    });
  } finally {
    vi.useRealTimers();
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
  expect(disconnect).toHaveBeenCalledTimes(3);
});

test("a replacement fullscreen root is observed and releases its frame", async () => {
  const callbacks: IntersectionObserverCallback[] = [];
  const observed: Element[] = [];
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        callbacks.push(callback);
      }
      observe(node: Element) {
        observed.push(node);
      }
      disconnect() {}
    }
  );
  const send = vi.fn();
  function Host({ expanded }: { expanded: boolean }) {
    const ref = useRef<HTMLElement>(null);
    const [node, setNode] = useState<HTMLElement | null>(null);
    useDemoHostFocus(ref, send, false, node);
    const attach = useCallback((element: HTMLElement | null) => {
      ref.current = element;
      setNode(element);
    }, []);
    return <section key={String(expanded)} ref={attach} />;
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<Host expanded={false} />));
    callbacks.at(-1)?.(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
    const before = observed.at(-1);
    await act(async () => root.render(<Host expanded />));
    expect(observed.at(-1)).not.toBe(before);
    callbacks.at(-1)?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
    expect(send).toHaveBeenLastCalledWith("reacherx:host-focus", {
      active: false,
    });
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

test("fullscreen stays interactive after a stale offscreen notification, while host menus still own focus", async () => {
  let notify: IntersectionObserverCallback | undefined;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        notify = callback;
      }
      observe() {}
      disconnect() {}
    }
  );
  const send = vi.fn();
  function Host({ expanded }: { expanded: boolean }) {
    const ref = useRef<HTMLElement>(null);
    useDemoHostFocus(ref, send, false, undefined, expanded);
    return <section ref={ref} role={expanded ? "dialog" : "region"} />;
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const menu = document.createElement("div");
  menu.setAttribute("role", "menu");
  menu.getClientRects = () =>
    [new DOMRect(0, 0, 20, 20)] as unknown as DOMRectList;
  try {
    await act(async () => root.render(<Host expanded={false} />));
    window.dispatchEvent(new Event("scroll"));
    expect(send).toHaveBeenLastCalledWith("reacherx:host-focus", {
      active: true,
    });
    await act(async () => root.render(<Host expanded />));
    notify?.(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
    expect(send).toHaveBeenLastCalledWith("reacherx:host-focus", {
      active: false,
    });
    await act(async () => {
      document.body.append(menu);
    });
    expect(send).toHaveBeenLastCalledWith("reacherx:host-focus", {
      active: true,
    });
    await act(async () => {
      menu.remove();
    });
    expect(send).toHaveBeenLastCalledWith("reacherx:host-focus", {
      active: false,
    });
    await act(async () => root.render(<Host expanded={false} />));
    notify?.(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
    expect(send).toHaveBeenLastCalledWith("reacherx:host-focus", {
      active: true,
    });
  } finally {
    await act(async () => root.unmount());
    menu.remove();
    container.remove();
    vi.unstubAllGlobals();
  }
});
