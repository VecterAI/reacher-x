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
    `${scenario}: inherited light/dark/system themes preserve the visible scene`,
    { timeout: 120000 },
    async () => {
      const browser = await chromium.launch({
        channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
        headless: true,
      });
      const page = await browser.newPage({
        colorScheme: "light",
        reducedMotion: "reduce",
        viewport: { width: 1440, height: 1000 },
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.setDefaultTimeout(12000);
      const chooseTheme = async (theme) => {
        await page
          .getByRole("combobox", { name: "Select color theme" })
          .click();
        await page.getByRole("option", { name: theme, exact: true }).click();
      };
      try {
        await page.goto(`${origin}/blog/${scenario}`);
        await page.locator("[data-demo-scenario]").hover();
        await page.locator('[data-demo-prepared="true"]').waitFor();
        const frame = await page
          .locator("iframe")
          .elementHandle()
          .then((element) => element.contentFrame());
        assert.ok(frame);
        const assertTheme = async (theme) => {
          await frame.waitForFunction(
            (mode) => document.documentElement.classList.contains(mode),
            theme,
            { polling: 100 }
          );
          assert.equal(
            await frame.evaluate(
              () => getComputedStyle(document.documentElement).colorScheme
            ),
            theme
          );
          assert.equal(
            await frame
              .locator("[data-demo-session]")
              .evaluate((el) => getComputedStyle(el).visibility),
            "visible"
          );
        };
        await assertTheme("light");
        await chooseTheme("Dark");
        await assertTheme("dark");
        await chooseTheme("Light");
        await assertTheme("light");
        await chooseTheme("System");
        await page.emulateMedia({ colorScheme: "dark" });
        await assertTheme("dark");
        await page.emulateMedia({ colorScheme: "light" });
        await assertTheme("light");

        const seek = async (target) => {
          await page
            .getByRole("slider", { name: "Demo progress" })
            .press("Home");
          await page
            .locator('[data-demo-shot="0"][data-demo-prepared="true"]')
            .waitFor();
          for (let index = 1; index <= target; index++) {
            await page
              .getByRole("slider", { name: "Demo progress" })
              .press("ArrowRight");
            await page
              .locator(`[data-demo-shot="${index}"][data-demo-prepared="true"]`)
              .waitFor();
          }
        };
        if (scenario === "find-candidates") {
          await seek(5);
          assert.match(
            await frame.getByRole("tabpanel").textContent(),
            /keyboard navigation/i
          );
          await seek(7);
          assert.match(
            await frame.locator("aside article").first().textContent(),
            /keyboard.navigation|introduction|review/i
          );
        }
        if (scenario === "workspaces-explained") {
          await seek(3);
          assert.equal(new URL(frame.url()).pathname, "/");
          assert.equal(
            await frame.locator("main h1").textContent(),
            "Prospects"
          );
          assert.match(
            await frame.locator("main").textContent(),
            /Daniel Okafor/
          );
          assert.doesNotMatch(
            await frame.locator("main").textContent(),
            /Isabelle Fontaine/
          );
          await seek(6);
          assert.equal(new URL(frame.url()).pathname, "/");
          assert.match(
            await frame.locator("main").textContent(),
            /Isabelle Fontaine/
          );
        }
        if (scenario === "manage-people-with-reacherx") {
          for (let index = 1; index <= 4; index++) {
            await page
              .getByRole("slider", { name: "Demo progress" })
              .press("ArrowRight");
            await page
              .locator(`[data-demo-shot="${index}"][data-demo-prepared="true"]`)
              .waitFor();
          }
          const articles = frame.locator("[role=log] article");
          await articles.nth(1).waitFor();
          assert.equal(await articles.count(), 2);
          assert.match(
            await articles.nth(0).textContent(),
            /your work caught my attention/
          );
          assert.match(
            await articles.nth(0).textContent(),
            /senior frontend engineer/
          );
          assert.match(await articles.nth(1).textContent(), /Thursday/);
          const session = await frame
            .locator("[data-demo-session]")
            .getAttribute("data-demo-session");
          const assertFraming = async () => {
            // Bounding boxes use parent viewport coordinates even across the iframe.
            const player = await page
              .locator("[data-demo-scenario]")
              .boundingBox();
            assert.ok(player, "Demo player bounding box missing");
            for (const article of await articles.all()) {
              const bubble = await article.boundingBox();
              assert.ok(bubble, "Conversation bubble bounding box missing");
              assert.ok(
                bubble.x >= player.x - 1 && bubble.y >= player.y - 1,
                JSON.stringify({ player, bubble })
              );
              assert.ok(
                bubble.x + bubble.width <= player.x + player.width + 1 &&
                  bubble.y + bubble.height <= player.y + player.height + 1,
                JSON.stringify({ player, bubble })
              );
            }
          };
          await assertFraming();
          await page.setViewportSize({ width: 390, height: 844 });
          await page.locator("[data-demo-scenario]").scrollIntoViewIfNeeded();
          await page
            .locator("[data-demo-scenario]")
            .screenshot({ path: "/tmp/reacherx-conversation-mobile.png" });
          await assertFraming();
          await page.setViewportSize({ width: 1440, height: 1000 });
          await page.locator("[data-demo-scenario]").scrollIntoViewIfNeeded();
          await page
            .locator("[data-demo-scenario]")
            .screenshot({ path: "/tmp/reacherx-conversation-light.png" });
          await chooseTheme("Dark");
          await assertTheme("dark");
          await assertFraming();
          assert.equal(
            await frame
              .locator("[data-demo-session]")
              .getAttribute("data-demo-session"),
            session
          );
          await page.locator("[data-demo-scenario]").hover();
          await page
            .getByRole("button", { name: "Expand demo", exact: true })
            .click();
          await frame.getByRole("log").click();
          await frame
            .locator("[data-sonner-toast]")
            .waitFor({ state: "hidden" });
          await frame
            .locator('[role="textbox"][contenteditable="true"]')
            .fill("Thursday works. Let's talk at 2 pm.");
          await frame
            .getByRole("button", { name: "Send", exact: true })
            .click();
          await frame.waitForFunction(
            () =>
              document
                .querySelector("[role=log]")
                ?.textContent.includes("Thursday works. Let's talk at 2 pm."),
            undefined,
            { polling: 100 }
          );
          await page.locator("[data-demo-scenario]").hover();
          await page
            .getByRole("button", { name: "Exit fullscreen demo" })
            .click();
          await chooseTheme("Light");
          await assertTheme("light");
          assert.equal(
            await frame
              .locator("[data-demo-session]")
              .getAttribute("data-demo-session"),
            session
          );
          assert.match(
            await frame.locator("[role=log]").textContent(),
            /Thursday works. Let's talk at 2 pm\./
          );
          assert.equal(
            await page
              .locator("[data-demo-scenario]")
              .getAttribute("data-demo-shot"),
            "4"
          );
          await chooseTheme("Dark");
          await assertTheme("dark");
          await page
            .locator("[data-demo-scenario]")
            .screenshot({ path: "/tmp/reacherx-conversation-dark.png" });
        }
        assert.deepEqual(errors, []);
      } catch (error) {
        await page
          .screenshot({ path: `/tmp/reacherx-${scenario}-failure.png` })
          .catch(() => {});
        const frame = page.frames().find((item) => item !== page.mainFrame());
        console.error({
          parent: await page
            .locator("[data-demo-scenario]")
            .evaluate((el) => ({ ...el.dataset }))
            .catch(() => null),
          content: await frame
            ?.locator("body")
            .innerText()
            .catch(() => null),
        });
        throw error;
      } finally {
        await browser.close();
      }
    }
  );
}
