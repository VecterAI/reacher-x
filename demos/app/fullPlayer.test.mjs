import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir } from "node:fs/promises";
import { chromium, firefox } from "./playwrightHelpers.mjs";
import {
  BLOG_DEMO_IDS,
  BLOG_DEMO_SHOTS,
  getBlogDemoDuration,
} from "../../features/blog/lib/blogDemoHelpers.ts";
const origin = process.env.BLOG_TEST_URL ?? "http://localhost:3125";
const demoOrigin = process.env.DEMO_TEST_URL ?? "http://localhost:3130";
const captures = process.env.DEMO_CAPTURE_DIR ?? "/tmp/reacherx-player-qa";
const browserName = process.env.DEMO_BROWSER ?? "chromium";
if (!["chromium", "firefox"].includes(browserName))
  throw new Error(`Unknown DEMO_BROWSER: ${browserName}`);
await mkdir(captures, { recursive: true });
const targets =
  process.env.DEMO_SCENARIOS === undefined
    ? BLOG_DEMO_IDS
    : process.env.DEMO_SCENARIOS.split(",").map((id) => id.trim());
for (const id of targets)
  if (!BLOG_DEMO_IDS.includes(id))
    throw new Error(`Unknown DEMO_SCENARIOS id: ${JSON.stringify(id)}`);
for (const scenario of targets)
  test(
    `${scenario}: real player completes, seeks, and restores its wide view`,
    { timeout: 240000 },
    async () => {
      const browser = await (browserName === "firefox"
        ? firefox.launch()
        : chromium.launch({ channel: "chrome" }));
      try {
        const page = await browser.newPage({
          viewport: { width: 1440, height: 1000 },
          colorScheme: "light",
        });
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("console", (message) => {
          if (
            /\[(DemoPlayback|BlogAppDemo|DemoServices)\]/.test(message.text())
          )
            errors.push(message.text());
        });
        // Public demonstrations must work without device access or a browser
        // encoder (including browsers that cannot record LinkedIn's M4A format).
        await page.addInitScript(() => {
          // Reproduce a stale inline visibility notification reaching fullscreen.
          const NativeIntersectionObserver = window.IntersectionObserver;
          window.IntersectionObserver = class extends (
            NativeIntersectionObserver
          ) {
            constructor(callback, options) {
              super(
                (entries, observer) =>
                  callback(
                    entries.map((entry) =>
                      entry.target.matches(
                        '[data-demo-scenario="find-podcast-guests"][role="dialog"]'
                      )
                        ? new Proxy(entry, {
                            get(target, property) {
                              return property === "isIntersecting"
                                ? false
                                : Reflect.get(target, property, target);
                            },
                          })
                        : entry
                    ),
                    observer
                  ),
                options
              );
            }
          };
          window.__demoUnexpectedToasts = [];
          document.addEventListener("DOMContentLoaded", () => {
            new MutationObserver(() => {
              for (const toast of document.querySelectorAll(
                "[data-sonner-toast]"
              )) {
                if (
                  toast.dataset.type === "error" ||
                  /Your .* are ready|Workspace setup update/.test(
                    toast.textContent
                  )
                )
                  window.__demoUnexpectedToasts.push(toast.textContent);
              }
            }).observe(document.body, {
              childList: true,
              subtree: true,
              characterData: true,
            });
          });
          window.__demoMicrophoneCalls = 0;
          if (navigator.mediaDevices)
            Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
              configurable: true,
              value: () => {
                window.__demoMicrophoneCalls++;
                return Promise.reject(new Error("Microphone denied by QA"));
              },
            });
          Object.defineProperty(window, "MediaRecorder", {
            configurable: true,
            value: undefined,
          });
        });
        await page.goto(`${origin}/blog`);
        await page.goto(`${origin}/blog/${scenario}`);
        const player = page.locator(`[data-demo-scenario="${scenario}"]`);
        await player.scrollIntoViewIfNeeded();
        await player.hover();
        await player
          .getByRole("button", { name: "Expand demo", exact: true })
          .click();
        await page.waitForFunction(
          () =>
            document.querySelector("[data-demo-scenario]")?.dataset
              .demoReady === "true"
        );
        const initialHistoryLength = await page.evaluate(() => history.length);
        await player.hover();
        await player
          .getByRole("button", { name: "Replay demo", exact: true })
          .click();
        const count = BLOG_DEMO_SHOTS[scenario].length;
        const result = await page.evaluate(
          ({ count, timeout }) =>
            new Promise((resolve) => {
              const element = document.querySelector("[data-demo-scenario]"),
                seen = new Set();
              const start = performance.now();
              const timer = setInterval(() => {
                const index = Number(element.dataset.demoShot),
                  error = element.dataset.demoError;
                if (
                  error ||
                  element.dataset.demoState === "paused" ||
                  performance.now() - start > timeout
                ) {
                  clearInterval(timer);
                  resolve({
                    error: error ?? "Paused or timed out",
                    seen: [...seen],
                  });
                  return;
                }
                if (
                  index === 0 &&
                  element.dataset.demoPrepared === "true" &&
                  seen.has(count - 1)
                ) {
                  clearInterval(timer);
                  resolve({ seen: [...seen], looped: true });
                  return;
                }
                seen.add(index);
              }, 40);
            }),
          { count, timeout: getBlogDemoDuration(scenario) + 45000 }
        );
        if (result.error) {
          console.log(
            await page
              .frames()
              .find((f) => f.url().startsWith(demoOrigin))
              ?.locator("body")
              .innerText()
          );
          await page.screenshot({
            path: `${captures}/${scenario}-failure.png`,
          });
        }
        assert.equal(result.error, undefined, JSON.stringify(result));
        assert.equal(result.looped, true);
        assert.equal(result.seen.length, count);
        await player.hover();
        await player
          .getByRole("button", { name: "Pause demo", exact: true })
          .click();
        const slider = player.locator('input[type="range"]');
        // Browser-native range events exercise the actual player's seeking path.
        // Rapidly seeking setup must survive its real navigation/reconnection.
        for (const seekIndex of [count - 1, 0, count - 1])
          await slider.evaluate((el, index) => {
            Object.getOwnPropertyDescriptor(
              HTMLInputElement.prototype,
              "value"
            ).set.call(el, String(index));
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }, seekIndex);
        await page.waitForFunction(
          (index) => {
            const e = document.querySelector("[data-demo-scenario]");
            return (
              Number(e.dataset.demoShot) === index &&
              e.dataset.demoPrepared === "true"
            );
          },
          count - 1,
          { timeout: 45000 }
        );
        assert.equal(await player.getAttribute("data-demo-error"), null);
        const frame = page.frames().find((f) => f.url().startsWith(demoOrigin));
        assert.ok(frame);
        assert.equal(
          await frame.evaluate(() => window.__demoMicrophoneCalls),
          0
        );
        assert.deepEqual(
          await frame.evaluate(() => window.__demoUnexpectedToasts),
          []
        );
        if (scenario === "manage-dm-conversations") {
          await slider.evaluate((el) => {
            Object.getOwnPropertyDescriptor(
              HTMLInputElement.prototype,
              "value"
            ).set.call(el, "12");
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          });
          await page.waitForFunction(
            () => {
              const e = document.querySelector("[data-demo-scenario]");
              return (
                e.dataset.demoShot === "12" && e.dataset.demoPrepared === "true"
              );
            },
            undefined,
            { timeout: 45000 }
          );
          const attachment = frame.locator('[role="log"] img');
          assert.ok(
            await attachment.evaluateAll((images) =>
              images.some(
                (image) =>
                  image.currentSrc.includes("client-feedback") &&
                  image.naturalWidth > 0
              )
            )
          );
        }
        if (scenario === "manage-dm-conversations") {
          await frame
            .locator('aside input[aria-label="Upload images"]')
            .setInputFiles(
              new URL("./public/media/client-feedback.png", import.meta.url)
                .pathname
            );
          const send = frame.locator('aside button[aria-label="Send"]');
          await send.click();
          await frame.waitForFunction(() =>
            [...document.querySelectorAll('[role="log"] img')].some(
              (image) =>
                image.currentSrc.includes("/api/upload?") &&
                image.naturalWidth > 0
            )
          );
          assert.equal(
            await frame.getByText("Image unavailable", { exact: true }).count(),
            0
          );
        }
        if (scenario === "getting-started-with-reacherx")
          assert.equal(
            await frame
              .locator("aside article li")
              .getByRole("button", { name: "Show less", exact: true })
              .count(),
            1
          );
        if (scenario === "send-voice-notes") {
          const audio = frame.locator('[role="log"] audio');
          assert.equal(await audio.count(), 1);
          await audio.evaluate(
            (a) =>
              new Promise((resolve, reject) => {
                if (a.readyState >= 1) return resolve();
                a.addEventListener("loadedmetadata", resolve, { once: true });
                a.addEventListener("error", reject, { once: true });
                a.load();
              })
          );
          assert.ok(
            await audio.evaluate(async (a) => {
              a.muted = true;
              await a.play();
              await new Promise((resolve) => setTimeout(resolve, 350));
              const played = a.currentTime > 0 && !a.error;
              a.pause();
              return played;
            })
          );
        }
        if (scenario === "find-creators")
          assert.equal(await frame.locator('[role="log"] video').count(), 1);
        if (scenario === "outreach-with-images-and-video")
          assert.ok(await frame.locator("aside video").count());
        await page.screenshot({ path: `${captures}/${scenario}-end.png` });
        await player.hover();
        await player
          .getByRole("button", { name: "Replay demo", exact: true })
          .click();
        await player
          .getByRole("button", { name: "Pause demo", exact: true })
          .click();
        await page.waitForFunction(
          () =>
            document.querySelector("[data-demo-scenario]").dataset.demoShot ===
            "0"
        );
        await page.waitForTimeout(1300);
        const margins = await player.evaluate((e) => {
          const outer = e.getBoundingClientRect(),
            inner = e
              .querySelector(".blog-app-demo-window")
              .getBoundingClientRect();
          return [
            inner.left - outer.left,
            inner.top - outer.top,
            outer.right - inner.right,
            outer.bottom - inner.bottom,
          ];
        });
        assert.ok(
          margins.every((n) => n > 0),
          JSON.stringify(margins)
        );
        await page.screenshot({ path: `${captures}/${scenario}-start.png` });
        assert.equal(
          await page.evaluate(() => history.length),
          initialHistoryLength
        );
        await page.goBack();
        await page.waitForURL(`${origin}/blog`);
        assert.deepEqual(errors, []);
      } catch (error) {
        console.error(scenario, error);
        const failedPage = browser.contexts()[0]?.pages()[0];
        if (failedPage) {
          console.log(
            await failedPage
              .frames()
              .find((f) => f.url().startsWith(demoOrigin))
              ?.locator("body")
              .innerText()
          );
          console.log(
            await failedPage
              .locator("[data-demo-scenario]")
              .evaluate((e) => ({ ...e.dataset }))
          );
          await failedPage.screenshot({
            path: `${captures}/${scenario}-failure.png`,
          });
        }
        throw error;
      } finally {
        await browser.close();
      }
    }
  );
