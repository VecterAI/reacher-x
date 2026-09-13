import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createBrowser } from "./browserHelpers.mjs";

const origin = process.env.BLOG_TEST_URL;
if (!origin) throw new Error("Set BLOG_TEST_URL to the blog preview.");

test(
  "390px player: reduced motion, hover controls, visible cursor, border and keyboard seek",
  { timeout: 60000 },
  async () => {
    const browser = createBrowser(`demo-accessibility-${randomUUID()}`);
    const evaluate = async (source) => (await browser("eval", source)).result;
    try {
      await browser("open", "about:blank");
      await browser("set", "viewport", "390", "844");
      await browser("set", "media", "dark", "reduced-motion");
      await browser("open", `${origin}/blog/manage-people-with-reacherx`);
      await browser("hover", "[data-demo-scenario]");
      await browser(
        "wait",
        '[data-demo-prepared="true"][data-demo-state="paused"]'
      );
      await browser("hover", "[data-demo-scenario]");
      await browser(
        "wait",
        "--fn",
        'getComputedStyle(document.querySelector(".blog-app-demo-controls")).opacity === "1"'
      );
      assert.equal(
        await evaluate("document.documentElement.scrollWidth <= innerWidth"),
        true
      );
      assert.equal(
        await evaluate(
          'getComputedStyle(document.querySelector(".blog-app-demo")).borderTopWidth'
        ),
        "1px"
      );
      assert.equal(
        await evaluate(
          'getComputedStyle(document.querySelector(".blog-app-demo")).borderRadius'
        ),
        "6px"
      );
      assert.equal(
        await evaluate(
          'getComputedStyle(document.querySelector(".blog-app-demo-cursor")).opacity'
        ),
        "1"
      );
      await browser("mouse", "move", "0", "0");
      await browser(
        "wait",
        "--fn",
        'getComputedStyle(document.querySelector(".blog-app-demo-controls")).opacity === "0"'
      );
      await browser("focus", 'input[aria-label="Demo progress"]');
      await browser("press", "ArrowRight");
      await browser("wait", '[data-demo-shot="1"][data-demo-prepared="true"]');
      assert.equal(
        await evaluate(
          'document.querySelector("[data-demo-scenario]").dataset.demoState'
        ),
        "paused"
      );
      await browser("screenshot", "/tmp/reacherx-player-mobile.png");
    } finally {
      await browser("close").catch(() => {});
    }
  }
);
