import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { promisify } from "node:util";

const run = promisify(execFile);
const origin = process.env.BLOG_TEST_URL;
if (!origin)
  throw new Error("Set BLOG_TEST_URL to a running production preview.");
const session = `blog-regression-${randomUUID()}`;

async function browser(...args) {
  const { stdout } = await run(
    "npx",
    ["--yes", "agent-browser@0.37.1", "--session", session, "--json", ...args],
    { timeout: 45_000, maxBuffer: 2 * 1024 * 1024 }
  );
  const result = JSON.parse(stdout);
  assert.equal(result.success, true, JSON.stringify(result.error));
  return result.data;
}

async function evaluate(source) {
  return (await browser("eval", source)).result;
}

test(
  "blog and Explore cards navigate without reloads and preserve their layouts",
  { timeout: 240_000 },
  async () => {
    try {
      await browser("set", "viewport", "1280", "900");
      await browser("open", new URL("/blog", origin).href);
      await browser("wait", "section[aria-label='Blog posts'] article");
      await browser("snapshot", "-i");
      const marker = randomUUID();
      await evaluate(
        `window.__blogNavigationCheck = ${JSON.stringify(marker)}`
      );
      const first = await evaluate(`(() => {
      const card = document.querySelector("section[aria-label='Blog posts'] article");
      return {
        href: card.querySelector('a').getAttribute('href'),
        title: card.querySelector('h2').textContent,
        coverAreas: card.querySelectorAll('[class*="aspect-"]').length,
      };
    })()`);
      assert.equal(
        first.coverAreas,
        0,
        "Listing cards must not have cover placeholders"
      );
      await browser(
        "click",
        "section[aria-label='Blog posts'] article:first-child a"
      );
      await browser("wait", "--url", `**${first.href}`);
      assert.equal(await evaluate("window.__blogNavigationCheck"), marker);
      await browser(
        "wait",
        "--fn",
        `Array.from(document.querySelectorAll('h1')).some(h => h.checkVisibility() && h.textContent === ${JSON.stringify(first.title)})`
      );

      for (const [width, height] of [
        [1280, 900],
        [390, 844],
      ]) {
        await browser("set", "viewport", String(width), String(height));
        const cards =
          await evaluate(`Array.from(document.querySelectorAll('[aria-labelledby="related-posts"] article')).filter(card => card.checkVisibility()).map(card => {
        const cover = card.querySelector('a > :first-child');
        const body = card.querySelector('a > :last-child');
        return {
          cover: cover.getBoundingClientRect().width,
          left: cover.getBoundingClientRect().left,
          dateLeft: card.querySelector('time').getBoundingClientRect().left,
          titleLeft: card.querySelector('h2').getBoundingClientRect().left,
          authorLeft: card.querySelector('footer').getBoundingClientRect().left,
          padding: getComputedStyle(body).paddingLeft,
        };
      })`);
        assert.equal(cards.length, 2);
        for (const card of cards) {
          assert.ok(card.cover > 0);
          assert.equal(card.padding, "0px");
          for (const left of [card.dateLeft, card.titleLeft, card.authorLeft])
            assert.ok(
              Math.abs(card.left - left) < 1,
              `Misaligned Explore text at ${width}px`
            );
        }
        assert.equal(
          await evaluate("document.documentElement.scrollWidth > innerWidth"),
          false
        );
      }

      await browser("snapshot", "-i");
      const next = await evaluate(
        `Array.from(document.querySelectorAll('[aria-labelledby="related-posts"] article a')).find(a => a.checkVisibility()).getAttribute('href')`
      );
      await browser(
        "click",
        "[aria-labelledby='related-posts'] article:first-child a"
      );
      await browser("wait", "--url", `**${next}`);
      assert.equal(await evaluate("window.__blogNavigationCheck"), marker);
      await browser("back");
      await browser("wait", "--url", `**${first.href}`);
      await browser("back");
      await browser("wait", "--fn", 'location.pathname === "/blog"');
      assert.equal(await evaluate("window.__blogNavigationCheck"), marker);
    } finally {
      await browser("close");
    }
  }
);
