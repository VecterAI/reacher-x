import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "./playwrightHelpers.mjs";

const origin = process.env.BLOG_TEST_URL;
if (!origin) throw new Error("Set BLOG_TEST_URL to the blog preview.");

for (const scenario of [
  "find-candidates",
  "manage-people-with-reacherx",
  "workspaces-explained",
]) {
  test(
    `${scenario}: website menu and demo complete independently`,
    { timeout: 90000 },
    async () => {
      const browser = await chromium.launch({
        channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
      });
      try {
        const page = await browser.newPage({
          viewport: { width: 1440, height: 3000 },
        });
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(`${origin}/blog/${scenario}`);
        const player = page.locator("[data-demo-scenario]");
        await player.hover();
        await page.locator('[data-demo-prepared="true"]').waitFor();
        await page
          .getByRole("button", { name: "Replay demo", exact: true })
          .click();
        // Anonymous preview: this is the same shared modal DropdownMenu used by
        // the authenticated website avatar, without faking production auth.
        await page
          .getByRole("button", { name: "Post options", exact: true })
          .last()
          .click();
        await page.keyboard.press("ArrowDown");
        const iframe = await page.locator("iframe").elementHandle();
        assert.ok(iframe, "Demo iframe missing");
        const frame = await iframe.contentFrame();
        assert.ok(frame, "Demo content frame missing");
        await frame.waitForFunction(() => document.body.inert);
        const result = await page.evaluate(
          () =>
            new Promise((resolve) => {
              const player = document.querySelector("[data-demo-scenario]");
              const maximum = Number(
                player.querySelector('input[type="range"]').max
              );
              const scroll = window.scrollY;
              const seen = new Set();
              const started = performance.now();
              const sample = () => {
                const shot = Number(player.dataset.demoShot);
                const menu = document.querySelector('[role="menu"]');
                const error =
                  player.dataset.demoError ||
                  (player.dataset.demoState !== "playing" &&
                    "Playback stopped") ||
                  (!menu?.contains(document.activeElement) &&
                    "Website menu lost focus") ||
                  (Math.abs(window.scrollY - scroll) > 2 &&
                    "Article scrolled") ||
                  (performance.now() - started > 55000 &&
                    "Playback did not complete");
                if (error) return resolve({ error, seen: [...seen] });
                if (shot === 0 && seen.has(maximum))
                  return resolve({ seen: [...seen], maximum });
                seen.add(shot);
                setTimeout(sample, 40);
              };
              sample();
            })
        );
        assert.equal(result.error, undefined, JSON.stringify(result));
        assert.deepEqual(
          [...result.seen].sort((a, b) => a - b),
          Array.from({ length: result.maximum + 1 }, (_, i) => i)
        );
        await page.keyboard.press("Escape");
        await page.getByRole("menu").waitFor({ state: "hidden" });
        await frame.waitForFunction(() => !document.body.inert);
        await player.hover();
        await page
          .getByRole("button", { name: "Expand demo", exact: true })
          .click();
        assert.equal(
          await frame.evaluate(() => document.body.inert),
          false,
          "Player's own fullscreen dialog must not block its app"
        );
        await player.hover();
        await page
          .getByRole("button", { name: "Replay demo", exact: true })
          .click();
        await page
          .locator('[data-demo-shot="0"][data-demo-prepared="true"]')
          .waitFor();
        await frame
          .getByRole("button", { name: "User menu", exact: true })
          .click();
        await frame.getByRole("menu").waitFor();
        assert.equal(
          await player.getAttribute("data-demo-state"),
          "interactive"
        );
        await page.keyboard.press("Escape");
        assert.deepEqual(errors, []);
      } finally {
        await browser.close();
      }
    }
  );
}
