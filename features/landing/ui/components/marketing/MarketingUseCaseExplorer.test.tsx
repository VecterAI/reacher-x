// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { HOME_PERSONA_USE_CASES } from "@/features/landing/lib/marketingUseCaseHelpers";
import { MarketingUseCaseExplorer } from "./MarketingUseCaseExplorer";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("@/shared/ui/components/Carousel", () => ({
  Carousel: ({
    children,
    setApi: _setApi,
    ...props
  }: {
    children: ReactNode;
    setApi?: unknown;
  }) => <div {...props}>{children}</div>,
  CarouselContent: ({
    children,
    className,
    viewportClassName,
  }: {
    children: ReactNode;
    className?: string;
    viewportClassName?: string;
  }) => (
    <div className={viewportClassName}>
      <div className={className}>{children}</div>
    </div>
  ),
  CarouselItem: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));
vi.mock("@/features/blog/ui/components/app-demo/BlogAppDemo", () => ({
  BlogAppDemo: ({ scenario }: { scenario: string }) => (
    <div data-demo={scenario} />
  ),
}));

let container: HTMLDivElement;
let root: Root;
let observers: IntersectionObserverCallback[];

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  observers = [];
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
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<MarketingUseCaseExplorer />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

test("renders one card per audience with its guide link", () => {
  const cards = container.querySelectorAll("article");
  expect(cards).toHaveLength(HOME_PERSONA_USE_CASES.length);
  for (const [index, card] of cards.entries()) {
    const selected = HOME_PERSONA_USE_CASES[index];
    expect(card.querySelector("a")?.getAttribute("href")).toBe(
      selected.blogHref
    );
    expect(card.querySelector("h3")?.textContent).toBe(selected.goal);
  }
});

test("distant cards mount no demo until they become visible", async () => {
  expect(container.querySelectorAll("[data-demo]")).toHaveLength(0);
  // Two observers per card: visibility and preload. Reveal the first slide.
  const reveal = (card: number, visible: boolean) => {
    for (const offset of [0, 1]) {
      observers[card * 2 + offset](
        [{ isIntersecting: visible } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    }
  };
  await act(async () => reveal(0, true));
  expect(container.querySelectorAll("[data-demo]")).toHaveLength(1);
  expect(
    container.querySelector("[data-demo]")?.getAttribute("data-demo")
  ).toBe(HOME_PERSONA_USE_CASES[0].guide);
  await act(async () => reveal(1, true));
  expect(container.querySelectorAll("[data-demo]")).toHaveLength(2);
  expect(
    container.querySelectorAll("[data-demo]")[1].getAttribute("data-demo")
  ).toBe(HOME_PERSONA_USE_CASES[1].guide);
});
