import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "./playwrightHelpers.mjs";
import { BLOG_DEMO_SHOTS } from "../../features/blog/lib/blogDemoHelpers.ts";
import {
  REACH_OUT_BUBBLE_PROMPT,
  REACH_OUT_BUBBLE_TASKS,
  REACH_OUT_UNICODE_PROMPT,
  REACH_OUT_UNICODE_TASKS,
} from "../../features/blog/lib/reachOutDemoCopy.ts";

const origin = process.env.BLOG_TEST_URL ?? "http://localhost:3000";
const scenarios = [
  "reach-out-writing-preferences",
  "reach-out-personal-video",
  "send-voice-notes",
  "reach-out-message-bubbles",
  "reach-out-unicode-formatting",
];

test(
  "the article has five captioned demos and Copy preserves plain text, Unicode, and retry feedback",
  { timeout: 90000 },
  async () => {
    const browser = await chromium.launch({ channel: "chrome" });
    try {
      const page = await browser.newPage({ reducedMotion: "reduce" });
      await page.addInitScript(() => {
        window.copiedText = null;
        window.denyCopy = false;
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async (text) => {
              if (window.denyCopy)
                throw new DOMException("Denied", "NotAllowedError");
              window.copiedText = text;
            },
          },
        });
      });
      await page.goto(`${origin}/blog/reach-out-and-get-replies`);
      assert.equal(await page.locator("[data-demo-scenario]").count(), 5);
      assert.equal(
        await page.getByText(/Interactive demo placeholder/).count(),
        0
      );
      for (const scenario of scenarios) {
        const figure = page
          .locator("figure")
          .filter({ has: page.locator(`[data-demo-scenario="${scenario}"]`) });
        assert.equal(await figure.count(), 1);
        const caption = figure.locator("figcaption");
        await caption.waitFor({ state: "visible" });
        assert.ok((await caption.innerText()).length > 30);
      }
      const blocks = page
        .locator("div.not-prose")
        .filter({ has: page.locator(".blog-code") });
      assert.equal(await blocks.count(), 6);
      for (const block of await blocks.all()) {
        const expected = await block.locator("pre code").textContent();
        await block.getByRole("button", { name: "Copy", exact: true }).click();
        assert.equal(await page.evaluate(() => window.copiedText), expected);
        await block
          .getByRole("button", { name: "Copied", exact: true })
          .waitFor();
      }
      const block = blocks.first();
      await page.evaluate(() => {
        window.denyCopy = true;
      });
      await block.getByRole("button").click();
      await block
        .getByRole("status")
        .getByText("Could not copy. Select and copy the text manually.")
        .waitFor();
      await page.evaluate(() => {
        window.denyCopy = false;
      });
      await block.getByRole("button", { name: "Copy", exact: true }).click();
      await block
        .getByRole("button", { name: "Copied", exact: true })
        .waitFor();
      await block.getByRole("button", { name: "Copy", exact: true }).waitFor();
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1
          ),
          false,
          `Overflow at ${width}px`
        );
        for (const scenario of scenarios) {
          const player = page.locator(`[data-demo-scenario="${scenario}"]`);
          await player.scrollIntoViewIfNeeded();
          await player
            .getByRole("button", { name: "Play demo", exact: true })
            .waitFor();
          assert.equal(await player.getAttribute("data-demo-shot"), "0");
        }
      }
    } finally {
      await browser.close();
    }
  }
);

for (const story of [
  {
    scenario: "reach-out-message-bubbles",
    prompt: REACH_OUT_BUBBLE_PROMPT,
    messages: REACH_OUT_BUBBLE_TASKS,
  },
  {
    scenario: "reach-out-unicode-formatting",
    prompt: REACH_OUT_UNICODE_PROMPT,
    messages: REACH_OUT_UNICODE_TASKS,
  },
])
  test(
    `${story.scenario}: Agent drafts, reviewer edits and approves, delivery preserves text, replay resets`,
    { timeout: 120000 },
    async () => {
      const browser = await chromium.launch({ channel: "chrome" });
      try {
        const page = await browser.newPage({
          viewport: { width: 1440, height: 1000 },
          reducedMotion: "reduce",
        });
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(`${origin}/blog/reach-out-and-get-replies`);
        const player = page.locator(`[data-demo-scenario="${story.scenario}"]`);
        await player.scrollIntoViewIfNeeded();
        await player.hover();
        await player
          .getByRole("button", { name: "Expand demo", exact: true })
          .click();
        const frame = player.frameLocator("iframe");
        await frame
          .locator('[data-prospect-id="use_case_demo_audience_1"]')
          .click();
        await frame
          .locator("aside")
          .getByRole("button", { name: "Agent", exact: true })
          .click();
        await frame.locator('main [contenteditable="true"]').fill(story.prompt);
        await frame
          .getByRole("button", { name: "Send message", exact: true })
          .click();
        await frame
          .getByRole("button", { name: "Show plan", exact: true })
          .click();
        assert.equal(
          await frame.locator("aside article li").count(),
          story.messages.length
        );
        await frame
          .locator('aside [role="toolbar"]')
          .getByRole("button", { name: "Approve", exact: true })
          .click();
        const delivered = [];
        for (const [index, message] of story.messages.entries()) {
          if (index)
            await frame
              .getByRole("button", { name: "Show plan", exact: true })
              .click();
          await frame
            .locator("aside article li")
            .filter({ hasText: message.description })
            .getByRole("button", { name: "Edit", exact: true })
            .click();
          const editor = frame.locator('aside [contenteditable="true"]');
          assert.equal((await editor.innerText()).trim(), message.content);
          const text =
            message.content +
            (index === story.messages.length - 1 ? " Happy to show you." : "");
          delivered.push(text);
          await editor.fill(text);
          // Leave transient confirmation toasts so hover does not hold them
          // over the approval control while this test clicks through quickly.
          await page.mouse.move(0, 0);
          await frame
            .locator('[data-sonner-toast][data-visible="true"]')
            .first()
            .waitFor({ state: "hidden" });
          await frame
            .locator("aside")
            .getByRole("button", { name: "Approve DM", exact: true })
            .click();
          await frame
            .locator('aside [role="log"] article')
            .filter({ hasText: text })
            .waitFor();
        }
        const bubbles = frame.locator('aside [role="log"] article');
        assert.equal(await bubbles.count(), story.messages.length);
        (await bubbles.allTextContents()).forEach((text, index) =>
          assert.ok(text.includes(delivered[index]))
        );
        for (const scenario of scenarios.filter((id) => id !== story.scenario))
          assert.equal(
            await page
              .locator(`[data-demo-scenario="${scenario}"]`)
              .getAttribute("data-demo-shot"),
            "0"
          );
        await player.hover();
        await player
          .getByRole("button", { name: "Replay demo", exact: true })
          .click();
        await player.getByRole("slider").press("End");
        await page.waitForFunction(
          ({ scenario, last }) => {
            const e = document.querySelector(
              `[data-demo-scenario="${scenario}"]`
            );
            return (
              e.dataset.demoPrepared === "true" &&
              Number(e.dataset.demoShot) === last
            );
          },
          {
            scenario: story.scenario,
            last: BLOG_DEMO_SHOTS[story.scenario].length - 1,
          }
        );
        assert.equal(await bubbles.count(), story.messages.length);
        (await bubbles.allTextContents()).forEach((text, index) => {
          assert.ok(text.includes(story.messages[index].content));
          assert.ok(!text.includes("Happy to show you."));
        });
        await player
          .getByRole("button", { name: "Exit fullscreen demo", exact: true })
          .click();
        assert.equal(await page.getByRole("dialog").count(), 0);
        assert.deepEqual(errors, []);
      } finally {
        await browser.close();
      }
    }
  );
