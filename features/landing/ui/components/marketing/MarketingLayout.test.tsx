// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { expect, test } from "vitest";
import { inlinePlatformIcons } from "./MarketingLayout";

const text = (node: ReactNode) =>
  renderToStaticMarkup(<div>{node}</div>)
    .replace(/<[^>]+>/g, "")
    .trim();

test("icons precede each platform term in text order", () => {
  const markup = renderToStaticMarkup(
    <p>{inlinePlatformIcons("Watch LinkedIn and X/Twitter today.")}</p>
  );
  expect(markup.indexOf("LinkedIn")).toBeLessThan(markup.indexOf("X/Twitter"));
  expect(markup).toContain("svg");
  expect(text(inlinePlatformIcons("Watch LinkedIn and X/Twitter today."))).toBe(
    "Watch LinkedIn and X/Twitter today."
  );
});

test("terms outside the text are skipped and repeats each get an icon", () => {
  expect(text(inlinePlatformIcons("No platforms here."))).toBe(
    "No platforms here."
  );
  expect(text(inlinePlatformIcons("X/Twitter, then X/Twitter again."))).toBe(
    "X/Twitter, then X/Twitter again."
  );
  expect(
    renderToStaticMarkup(
      <p>{inlinePlatformIcons("X/Twitter, then X/Twitter again.")}</p>
    ).match(/<svg/g)?.length
  ).toBe(2);
});

test("icons are rendered as filled platform badge tiles", () => {
  const markup = renderToStaticMarkup(
    <p>{inlinePlatformIcons("X/Twitter and LinkedIn")}</p>
  );
  expect(markup).toContain("bg-platform-twitter-badge");
  expect(markup).toContain("text-platform-twitter-badge-foreground");
  expect(markup).toContain("bg-platform-linkedin-badge");
  expect(markup).toContain("text-platform-linkedin-badge-foreground");
  expect(markup).toContain("rounded-[4px]");
});
