import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "./playwrightHelpers.mjs";
import { BLOG_DEMO_IDS } from "../../features/blog/lib/blogDemoHelpers.ts";
const origin = process.env.BLOG_TEST_URL ?? "http://localhost:3125";
test(
  "all 21 stories inherit theme and retain usable mobile controls",
  { timeout: 300000 },
  async () => {
    const browser = await chromium.launch({ channel: "chrome" });
    try {
      for (const scenario of BLOG_DEMO_IDS) {
        console.log(`Starting presentation: ${scenario}`);
        const page = await browser.newPage({
          viewport: { width: 390, height: 844 },
          colorScheme: "light",
          reducedMotion: "reduce",
        });
        try {
          await page.goto(`${origin}/blog/${scenario}`);
          const player = page.locator("[data-demo-scenario]");
          await player.scrollIntoViewIfNeeded();
          await player.hover();
          await page.waitForFunction(
            () =>
              document.querySelector("[data-demo-scenario]")?.dataset
                .demoPrepared === "true"
          );
          const frame = await player
            .locator("iframe")
            .elementHandle()
            .then((el) => el.contentFrame());
          const choose = async (name) => {
            await page
              .getByRole("combobox", { name: "Select color theme" })
              .click();
            await page.getByRole("option", { name, exact: true }).click();
          };
          for (const theme of ["Dark", "Light"]) {
            await choose(theme);
            await player.scrollIntoViewIfNeeded();
            await frame.waitForFunction(
              (t) => document.documentElement.classList.contains(t),
              theme.toLowerCase()
            );
          }
          await choose("System");
          await page.emulateMedia({ colorScheme: "dark" });
          await player.scrollIntoViewIfNeeded();
          await frame.waitForFunction(() =>
            document.documentElement.classList.contains("dark")
          );
          await player.scrollIntoViewIfNeeded();
          await player.hover();
          assert.equal(await player.getAttribute("data-demo-state"), "paused");
          assert.equal(await player.getAttribute("data-demo-shot"), "0");
          await player
            .getByRole("button", { name: "Play demo", exact: true })
            .waitFor();
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1
          );
          assert.equal(overflow, false, scenario);
          assert.equal(await player.getAttribute("data-demo-error"), null);
          console.log(`Verified mobile and themes: ${scenario}`);
        } finally {
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  }
);
