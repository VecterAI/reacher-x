import {
  REACH_OUT_BUBBLES,
  REACH_OUT_MEMORY_DRAFT,
  REACH_OUT_VIDEO_DRAFT,
  REACH_OUT_UNICODE_DRAFT,
} from "../../features/blog/lib/reachOutDemoCopy.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "./playwrightHelpers.mjs";
import { BLOG_DEMO_SHOTS } from "../../features/blog/lib/blogDemoHelpers.ts";
import {
  AUDIENCE_DEMO_IDS,
  getBlogDemoInitialPath,
} from "../../features/blog/lib/blogDemoCatalog.ts";
import { AUDIENCE_DEMO_INVITATIONS } from "../../features/blog/lib/audienceDemoCopy.ts";

const demoOrigin = process.env.DEMO_TEST_URL ?? "http://localhost:3131";
const parentOrigin = process.env.BLOG_TEST_URL ?? "http://localhost:3125";
for (const scenario of [
  "reach-out-writing-preferences",
  "reach-out-personal-video",
  "reach-out-message-bubbles",
  "reach-out-unicode-formatting",
  ...AUDIENCE_DEMO_IDS,
  "find-candidates",
  "how-reacherx-enrichment-works",
  "send-voice-notes",
  "create-plans-for-several-people",
  "getting-started-with-reacherx",
  "manage-dm-conversations",
  "introducing-reacherx-v4",
  "outreach-with-images-and-video",
  "write-with-autocomplete",
  "what-reacherx-does-automatically",
  "teach-reacherx-what-you-want",
  "read-your-reacherx-analytics",
  "understand-agent-observability",
  "agent-around-the-clock",
]) {
  test(
    `${scenario}: real controls complete the story and preserve the sent message`,
    { timeout: 90000 },
    async () => {
      const browser = await chromium.launch({
        channel: "chrome",
        // The fulfilled test parent has no network address for Chrome’s local-network check.
        args: ["--disable-features=LocalNetworkAccessChecks"],
      });
      try {
        const page = await browser.newPage({
          viewport: { width: 1440, height: 1000 },
        });
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (
            message.type() === "error" &&
            /DemoServices|Unimplemented demo service|Mention query failed/.test(
              message.text()
            )
          )
            errors.push(message.text());
        });
        const src = `${demoOrigin}${getBlogDemoInitialPath(scenario)}?scenario=${scenario}`;
        await page.route(`${parentOrigin}/scenario-qa`, (route) =>
          route.fulfill({
            contentType: "text/html",
            body: `<iframe name="reacherx-demo:${scenario}" allow="autoplay" src="${src}" style="width:1280px;height:850px;border:0"></iframe><script>window.events=[];addEventListener('message',e=>window.events.push(e.data))</script>`,
          })
        );
        await page.goto(`${parentOrigin}/scenario-qa`);
        const post = (data) =>
          page.evaluate(
            ({ data, demoOrigin }) =>
              document
                .querySelector("iframe")
                .contentWindow.postMessage(data, demoOrigin),
            { data, demoOrigin }
          );
        await page.waitForFunction(() =>
          window.events.some((event) => event.type === "reacherx:ready")
        );
        await post({ type: "reacherx:theme", theme: "light" });
        for (const [index, shot] of BLOG_DEMO_SHOTS[scenario].entries()) {
          await post({
            type: "reacherx:prepare",
            index,
            revision: index,
            reset: index === 0,
          });
          await page.waitForFunction(
            (revision) =>
              window.events.some(
                (event) =>
                  event.revision === revision &&
                  ["reacherx:prepared", "reacherx:error"].includes(event.type)
              ),
            index
          );
          const error = await page.evaluate(
            (revision) =>
              window.events.find(
                (event) =>
                  event.revision === revision && event.type === "reacherx:error"
              ),
            index
          );
          if (error) {
            console.log(
              await page.frameLocator("iframe").locator("body").innerText()
            );
            console.log(errors);
          }
          assert.equal(
            error,
            undefined,
            `${scenario}: ${shot.label}: ${JSON.stringify(error)}`
          );
          if (shot.action) {
            await post({ type: "reacherx:act", index, revision: index });
            await page.waitForFunction(
              (revision) =>
                window.events.some(
                  (event) =>
                    event.revision === revision &&
                    ["reacherx:acted", "reacherx:error"].includes(event.type)
                ),
              index
            );
          }
        }
        const bridgeErrors = await page.evaluate(() =>
          window.events.filter((event) => event.type === "reacherx:error")
        );
        if (bridgeErrors.length)
          console.log(
            await page.frameLocator("iframe").locator("body").innerText()
          );
        assert.deepEqual(bridgeErrors, []);
        const frame = page.frameLocator("iframe");
        if (AUDIENCE_DEMO_IDS.includes(scenario))
          assert.ok(
            await frame
              .getByRole("log")
              .getByText(AUDIENCE_DEMO_INVITATIONS[scenario], { exact: true })
              .isVisible()
          );
        if (scenario === "teach-reacherx-what-you-want") {
          assert.ok(
            await frame
              .locator("aside")
              .getByText(
                /Hi Nora, I saw your post about keeping client feedback/
              )
              .isVisible()
          );
          assert.equal(
            await frame
              .getByRole("button", { name: "Stop generating", exact: true })
              .count(),
            0
          );
        }
        if (scenario === "read-your-reacherx-analytics")
          assert.ok(
            await frame
              .locator("aside")
              .getByRole("heading", { name: "Outreach plan" })
              .isVisible()
          );
        if (scenario === "understand-agent-observability")
          assert.ok(
            await frame
              .getByText("Workflow event detail", { exact: true })
              .isVisible()
          );
        if (scenario === "reach-out-message-bubbles") {
          const texts = await frame
            .locator('aside [role="log"] article')
            .allTextContents();
          assert.equal(texts.length, 3);
          REACH_OUT_BUBBLES.forEach((message, index) =>
            assert.ok(texts[index].includes(message))
          );
          assert.equal(
            (
              await frame.locator('aside [contenteditable="true"]').innerText()
            ).trim(),
            ""
          );
        }
        if (scenario === "reach-out-unicode-formatting") {
          const message = frame.locator('aside [role="log"] article');
          assert.equal(await message.count(), 1);
          assert.ok(
            (await message.innerText()).includes(REACH_OUT_UNICODE_DRAFT)
          );
          assert.equal(await message.locator("strong, code").count(), 0);
        }
        if (scenario === "reach-out-writing-preferences")
          assert.ok(
            await frame
              .locator("aside")
              .getByText(REACH_OUT_MEMORY_DRAFT)
              .isVisible()
          );
        if (scenario === "reach-out-personal-video") {
          assert.ok(
            await frame
              .locator('aside [role="log"]')
              .getByText(REACH_OUT_VIDEO_DRAFT, { exact: true })
              .isVisible()
          );
          const video = frame.locator('aside [role="log"] video');
          assert.equal(await video.count(), 1);
          assert.ok(
            await video.evaluate(async (element) => {
              element.muted = true;
              await element.play();
              await new Promise((resolve) => setTimeout(resolve, 350));
              const played = element.currentTime > 0 && !element.error;
              element.pause();
              return played;
            }),
            "The delivered video must decode and play, not just render a tag"
          );
        }
        assert.deepEqual(errors, []);
      } finally {
        await browser.close();
      }
    }
  );
}
