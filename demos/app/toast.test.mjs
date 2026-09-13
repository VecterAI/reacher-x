import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { chromium } from "./playwrightHelpers.mjs";

const origin = process.env.BLOG_TEST_URL;
if (!origin) throw new Error("Set BLOG_TEST_URL to the blog preview.");
const icons = await readFile(
  new URL("../../shared/ui/components/icons/index.tsx", import.meta.url),
  "utf8"
);
const checkIcon = icons.match(
  /export const CheckCircleIcon\b[\s\S]*?(?=\nexport |$)/
)?.[0];
assert.ok(checkIcon, "CheckCircleIcon must exist in the shared icon registry");
const checkPaths = Array.from(
  checkIcon.matchAll(/<path\b[^>]*\bd="([^"]+)"/g),
  (match) => match[1]
);
assert.ok(checkPaths.length, "CheckCircleIcon must expose its SVG paths");
const readPaths = (elements) => elements.map((el) => el.getAttribute("d"));

test(
  "status toasts use the shared icon and match both website themes",
  { timeout: 90000 },
  async () => {
    const browser = await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
    });
    try {
      const page = await browser.newPage({
        colorScheme: "light",
        reducedMotion: "reduce",
        viewport: { width: 1440, height: 1000 },
      });
      await page.goto(`${origin}/blog/manage-people-with-reacherx`);
      await page.locator("[data-demo-scenario]").hover();
      await page.locator('[data-demo-prepared="true"]').waitFor();
      const iframe = await page.locator("iframe").elementHandle();
      assert.ok(iframe, "Demo iframe missing");
      const frame = await iframe.contentFrame();
      assert.ok(frame, "Demo content frame missing");
      for (const theme of ["dark", "light"]) {
        // Keep the OS opposite to catch accidental theme="system" in Sonner.
        await page.emulateMedia({
          colorScheme: theme === "dark" ? "light" : "dark",
        });
        await page
          .getByRole("combobox", { name: "Select color theme" })
          .click();
        await page
          .getByRole("option", {
            name: theme === "dark" ? "Dark" : "Light",
            exact: true,
          })
          .click();
        await frame.waitForFunction(
          (mode) => document.documentElement.classList.contains(mode),
          theme,
          { polling: 100 }
        );
        await page.locator("[data-demo-scenario]").hover();
        const slider = page.getByRole("slider", { name: "Demo progress" });
        await slider.press("Home");
        await page
          .locator('[data-demo-shot="0"][data-demo-prepared="true"]')
          .waitFor();
        for (let index = 1; index <= 8; index++) {
          await slider.press("ArrowRight");
          await page
            .locator(`[data-demo-shot="${index}"][data-demo-prepared="true"]`)
            .waitFor();
        }
        const toast = frame
          .locator('[data-sonner-toast][data-type="success"]')
          .last();
        await toast.waitFor();
        assert.equal(
          await frame
            .locator("[data-sonner-toaster]")
            .getAttribute("data-sonner-theme"),
          theme
        );
        assert.deepEqual(
          await toast.locator("[data-icon] svg path").evaluateAll(readPaths),
          checkPaths
        );
        const readColors = (el) => {
          const style = getComputedStyle(el);
          return [style.backgroundColor, style.color, style.borderColor];
        };
        const demoColors = await toast.evaluate(readColors);
        assert.equal(
          demoColors[0],
          theme === "dark" ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)"
        );
        await page
          .getByRole("button", { name: "Post options", exact: true })
          .last()
          .click();
        await page
          .getByRole("menuitem", { name: "Copy link", exact: true })
          .click();
        const websiteToast = page
          .locator('[data-sonner-toast][data-type="success"]')
          .filter({ hasText: "Link copied" })
          .last();
        await websiteToast.waitFor();
        assert.deepEqual(
          demoColors,
          await websiteToast.evaluate(readColors),
          `${theme} demo toast must match production Sonner`
        );
        assert.deepEqual(
          await websiteToast
            .locator("[data-icon] svg path")
            .evaluateAll(readPaths),
          checkPaths
        );
      }
    } finally {
      await browser.close();
    }
  }
);
