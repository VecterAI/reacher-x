// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { BlogAppDemo } from "./BlogAppDemo";

vi.mock("@/features/blog/lib/blogDemoUrl", () => ({
  getBlogDemoUrl: () => "about:blank",
}));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "dark" }) }));
vi.mock("./useDemoHostFocus", () => ({ useDemoHostFocus: () => vi.fn() }));
vi.mock("./useDemoHostScroll", () => {
  const controls = { capture: vi.fn(), restore: vi.fn(), cancel: vi.fn() };
  return { useDemoHostScroll: () => controls };
});
vi.mock("./useDemoExpansion", () => ({ useDemoExpansion: vi.fn() }));
let host: HTMLDivElement;
let root: Root;
let intersect: IntersectionObserverCallback;
const scenario = "workspaces-explained" as const;
const props = { scenario, title: "Workspaces", caption: "Demo" };
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_BLOG_DEMO_ORIGIN", "http://localhost:3101");
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: IntersectionObserverCallback) {
        intersect = cb;
      }
      observe() {}
      disconnect() {}
    }
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const state = () =>
  host.querySelector("[data-demo-state]")?.getAttribute("data-demo-state");

test("cards initially render the app without replaying checkpoints, then follow hover and explicit pause", async () => {
  await act(async () =>
    root.render(<BlogAppDemo {...props} playbackActive={false} />)
  );
  const iframe = host.querySelector("iframe")!;
  expect(iframe).not.toBeNull();
  expect(host.textContent).not.toContain("Loading preview");
  const post = vi.fn();
  Object.defineProperty(iframe, "contentWindow", {
    value: { postMessage: post },
    configurable: true,
  });
  await act(async () =>
    intersect(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    )
  );
  expect(state()).toBe("paused");
  await act(async () =>
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "null",
        source: iframe.contentWindow,
        data: { type: "reacherx:ready", bridgeId: "test" },
      })
    )
  );
  expect(
    post.mock.calls.some(
      ([m]) => m.type === "reacherx:ambient" && m.active === false
    )
  ).toBe(true);
  expect(post.mock.calls.some(([m]) => m.type === "reacherx:prepare")).toBe(
    false
  );
  await act(async () => root.render(<BlogAppDemo {...props} playbackActive />));
  expect(state()).toBe("playing");
  await act(async () =>
    (
      host.querySelector('[aria-label="Pause demo"]') as HTMLButtonElement
    ).click()
  );
  expect(state()).toBe("paused");
  await act(async () => root.render(<BlogAppDemo {...props} playbackActive />));
  expect(state()).toBe("paused");
  await act(async () =>
    root.render(<BlogAppDemo {...props} playbackActive={false} />)
  );
  expect(state()).toBe("paused");
  await act(async () => root.render(<BlogAppDemo {...props} playbackActive />));
  expect(state()).toBe("paused");
});

test("fixed marketing demos retain autoplay and expose reset, progress and fullscreen", async () => {
  await act(async () =>
    root.render(<BlogAppDemo {...props} presentation="fixed" />)
  );
  expect(state()).toBe("playing");
  for (const label of ["Replay demo", "Demo progress", "Expand demo"])
    expect(host.querySelector(`[aria-label="${label}"]`)).not.toBeNull();
  const iframe = host.querySelector("iframe");
  await act(async () =>
    (
      host.querySelector('[aria-label="Expand demo"]') as HTMLButtonElement
    ).click()
  );
  expect(host.querySelector('[role="dialog"]')?.getAttribute("popover")).toBe(
    "manual"
  );
  expect(host.querySelector("iframe")).toBe(iframe);
  await act(async () =>
    (
      host.querySelector(
        '[aria-label="Exit fullscreen demo"]'
      ) as HTMLButtonElement
    ).click()
  );
  expect(host.querySelector("iframe")).toBe(iframe);
});

test("carousel iframe gestures and keyboard entry are reserved for fullscreen", async () => {
  await act(async () =>
    root.render(
      <BlogAppDemo
        {...props}
        interaction="expanded"
        loading="eager"
        playbackActive={false}
      />
    )
  );
  const iframe = host.querySelector("iframe")!;
  expect(iframe.tabIndex).toBe(-1);
  expect(iframe.hasAttribute("inert")).toBe(true);
  expect(iframe.getAttribute("loading")).toBe("eager");
  await act(async () =>
    (
      host.querySelector('[aria-label="Expand demo"]') as HTMLButtonElement
    ).click()
  );
  expect(host.querySelector("iframe")).toBe(iframe);
  expect(iframe.hasAttribute("inert")).toBe(false);
  expect(iframe.hasAttribute("tabindex")).toBe(false);
  await act(async () =>
    (
      host.querySelector(
        '[aria-label="Exit fullscreen demo"]'
      ) as HTMLButtonElement
    ).click()
  );
  expect(iframe.hasAttribute("inert")).toBe(true);
});

test("a failed load can reconnect through Play without replacing the player", async () => {
  vi.useFakeTimers();
  await act(async () =>
    root.render(<BlogAppDemo {...props} presentation="fixed" />)
  );
  const iframe = host.querySelector("iframe")!;
  const replace = vi.fn();
  Object.defineProperty(iframe, "contentWindow", {
    value: { postMessage: vi.fn(), location: { replace } },
    configurable: true,
  });
  await act(async () =>
    intersect(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    )
  );
  await act(async () => vi.advanceTimersByTime(15000));
  expect(host.querySelector('[role="status"]')?.textContent).toContain(
    "The demo could not load."
  );
  await act(async () =>
    (
      host.querySelector('[aria-label="Play demo"]') as HTMLButtonElement
    ).click()
  );
  expect(replace).toHaveBeenCalledWith("about:blank");
  expect(host.querySelector('[role="status"]')).toBeNull();
  expect(host.querySelector("iframe")).toBe(iframe);
  await act(async () =>
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "null",
        source: iframe.contentWindow,
        data: { type: "reacherx:ready", bridgeId: "recovered" },
      })
    )
  );
  expect(host.querySelector('[data-demo-ready="true"]')).not.toBeNull();
  expect(state()).toBe("playing");
});
