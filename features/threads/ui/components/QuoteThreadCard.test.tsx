// @vitest-environment node

import {
  Children,
  isValidElement,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { ThreadMenu } from "./ThreadMenu";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { QuoteThreadCard } from "./QuoteThreadCard";
import type { Tweet } from "../../types";
import { MOCK_PUBLIC_TESTIMONIALS } from "@/features/landing/lib/mockPublicTestimonials";

const open = vi.fn();
beforeEach(() => {
  open.mockClear();
  vi.stubGlobal("window", { open, getSelection: () => null });
});
afterEach(() => vi.unstubAllGlobals());

function cardHandlers(tweet: Tweet) {
  const element = QuoteThreadCard({ tweet });
  if (!isValidElement<HTMLAttributes<HTMLDivElement>>(element))
    throw new Error("Expected a quote card element");
  return element.props;
}

function event(overrides = {}) {
  const target = { closest: () => null };
  return {
    target,
    currentTarget: target,
    button: 0,
    detail: 1,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides,
  };
}

test("quote activation opens the quoted post itself on X, never the retired conversation route", () => {
  const handlers = cardHandlers({
    id_str: "123",
    conversation_id_str: "root",
    user: MOCK_PUBLIC_TESTIMONIALS[0].user,
  });
  handlers.onClick?.(
    event() as unknown as Parameters<NonNullable<typeof handlers.onClick>>[0]
  );
  expect(open).toHaveBeenCalledWith(
    "https://x.com/mayachen/status/123",
    "_blank",
    "noopener,noreferrer"
  );
});

test("missing handles use the shared X fallback and missing IDs never navigate", () => {
  for (const tweet of [{ id: 123 }, {}]) {
    const handlers = cardHandlers(tweet);
    handlers.onClick?.(
      event() as unknown as Parameters<NonNullable<typeof handlers.onClick>>[0]
    );
  }
  expect(open).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledWith(
    "https://x.com/i/status/123",
    "_blank",
    "noopener,noreferrer"
  );
});

test.each(["Enter", " "])(
  "keyboard %s opens one post and stops parent activation",
  (key) => {
    const handlers = cardHandlers({ id_str: "123" });
    const input = event({ key });
    handlers.onKeyDown?.(
      input as unknown as Parameters<NonNullable<typeof handlers.onKeyDown>>[0]
    );
    expect(open).toHaveBeenCalledTimes(1);
    expect(input.preventDefault).toHaveBeenCalled();
    expect(input.stopPropagation).toHaveBeenCalled();
  }
);

test("nested links and buttons keep their own click and keyboard behavior", () => {
  const handlers = cardHandlers({ id_str: "123" });
  const input = event({ key: "Enter", target: { closest: () => ({}) } });
  handlers.onClick?.(
    input as unknown as Parameters<NonNullable<typeof handlers.onClick>>[0]
  );
  handlers.onKeyDown?.(
    input as unknown as Parameters<NonNullable<typeof handlers.onKeyDown>>[0]
  );
  expect(open).not.toHaveBeenCalled();
  expect(input.preventDefault).not.toHaveBeenCalled();
});

test.each([
  { ctrlKey: true },
  { metaKey: true },
  { button: 1 },
  { defaultPrevented: true },
  { detail: 2 },
])("ignores non-primary activation %j", (overrides) => {
  const handlers = cardHandlers({ id_str: "123" });
  handlers.onClick?.(
    event(overrides) as unknown as Parameters<
      NonNullable<typeof handlers.onClick>
    >[0]
  );
  expect(open).not.toHaveBeenCalled();
});

function findElements(
  node: ReactNode,
  type: unknown
): Array<{ props: Record<string, unknown> }> {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return [];
    return [
      ...(child.type === type ? [child] : []),
      ...findElements(child.props.children, type),
    ];
  });
}

test("missing post IDs are not passed as broken URLs to the quote menu", () => {
  const props = cardHandlers({ full_text: "Missing ID" });
  const menus = findElements(props.children, ThreadMenu);
  expect(menus).toHaveLength(1);
  expect(menus[0].props.tweetUrl).toBeUndefined();
});

test("menus omit post actions without a post URL while preserving profile access", () => {
  function labels(tweetUrl?: string) {
    const menu = ThreadMenu({ tweetUrl, profileUrl: "https://x.com/tester" });
    const collectText = (node: ReactNode): string =>
      Children.toArray(node)
        .map((child): string => {
          if (typeof child === "string") return child;
          return isValidElement<{ children?: ReactNode }>(child)
            ? collectText(child.props.children)
            : "";
        })
        .join(" ");
    return collectText(menu);
  }
  expect(labels()).not.toContain("Open on X/Twitter");
  expect(labels()).not.toContain("Copy link");
  expect(labels()).toContain("View profile");
  expect(labels("https://x.com/tester/status/123")).toContain(
    "Open on X/Twitter"
  );
  expect(labels("https://x.com/tester/status/123")).toContain("Copy link");
});
