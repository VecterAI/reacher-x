// @vitest-environment node
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { BlogToolbar } from "./BlogToolbar";

test("stale category props cannot crash the toolbar after a category is deleted", () => {
  const html = renderToStaticMarkup(
    createElement(BlogToolbar, {
      categories: JSON.parse(
        '["engineering","demo-content","removed-category"]'
      ),
    })
  );
  expect(html).toContain('href="/blog/category/engineering"');
  expect(html).toContain(">Engineering<");
  expect(html).toContain(">All<");
  expect(html).not.toMatch(/demo-content|removed-category/);
});

test("the toolbar keeps All and search when every cached category has been deleted", () => {
  const html = renderToStaticMarkup(
    createElement(BlogToolbar, {
      categories: JSON.parse('["demo-content"]'),
    })
  );
  expect(html).toContain('href="/blog"');
  expect(html).toContain('aria-label="Search blog posts"');
  expect(html).not.toContain("/blog/category/");
});
