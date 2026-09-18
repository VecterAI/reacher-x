// @vitest-environment node
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { HIGH_LOAD_NOTICE_COPY, HighLoadNotice } from "./HighLoadNotice";

function renderNotice(
  props: {
    state?: "queued" | "slow";
    helpHref?: string;
    onDismiss?: () => void;
    dismissing?: boolean;
  } = {}
) {
  return renderToStaticMarkup(createElement(HighLoadNotice, props)).replaceAll(
    "&#x27;",
    "'"
  );
}

describe("HighLoadNotice", () => {
  test("renders the queued copy by default", () => {
    const html = renderNotice();
    expect(html).toContain(HIGH_LOAD_NOTICE_COPY.queued);
    expect(html).not.toContain(HIGH_LOAD_NOTICE_COPY.slow);
  });

  test("renders the slow copy when requested", () => {
    const html = renderNotice({ state: "slow" });
    expect(html).toContain(HIGH_LOAD_NOTICE_COPY.slow);
    expect(html).not.toContain(HIGH_LOAD_NOTICE_COPY.queued);
  });

  test("copy is free of dashes that read like filler", () => {
    for (const copy of Object.values(HIGH_LOAD_NOTICE_COPY)) {
      expect(copy).not.toMatch(/—|–/);
    }
  });

  test("exposes the state on a data attribute for QA hooks", () => {
    expect(renderNotice()).toContain('data-high-load-notice-state="queued"');
    expect(renderNotice({ state: "slow" })).toContain(
      'data-high-load-notice-state="slow"'
    );
  });

  test("matches the plan usage notice banner styling", () => {
    const html = renderNotice();
    expect(html).toContain("bg-muted/20");
    expect(html).toContain("border-b");
    expect(html).toContain("font-pixel-square");
  });

  test("hides the dismiss button until a handler is provided", () => {
    expect(renderNotice()).not.toContain("Dismiss high load notice");
    expect(renderNotice({ onDismiss() {} })).toContain(
      "Dismiss high load notice"
    );
  });

  test("disables the dismiss button while dismissing", () => {
    expect(renderNotice({ onDismiss() {}, dismissing: true })).toContain(
      "disabled"
    );
  });

  test("renders the help link to X only when a help href is provided", () => {
    expect(renderNotice()).not.toContain("Get help");
    const html = renderNotice({ helpHref: "https://x.com/ReacherXfounder" });
    expect(html).toContain("Get help");
    expect(html).toContain('href="https://x.com/ReacherXfounder"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
  });

  test("stacks text above the help button on mobile like the plan notice", () => {
    const html = renderNotice({ helpHref: "https://x.com/ReacherXfounder" });
    expect(html).toContain(
      "flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4"
    );
  });

  test("reserves dismiss padding only when dismiss is rendered", () => {
    expect(
      renderNotice({ helpHref: "https://x.com/ReacherXfounder" })
    ).not.toContain("pr-12");
    expect(renderNotice({ onDismiss() {} })).toContain("pr-12");
  });
});
