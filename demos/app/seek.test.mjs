import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createBrowser } from "./browserHelpers.mjs";

const origin = process.env.BLOG_TEST_URL;
if (!origin) throw new Error("Set BLOG_TEST_URL to the blog preview.");

for (const scenario of [
  "find-candidates",
  "manage-people-with-reacherx",
  "workspaces-explained",
]) {
  test(
    `${scenario}: seek backwards and forwards, resume and replay`,
    { timeout: 120000 },
    async () => {
      const browser = createBrowser(`demo-seek-${randomUUID()}`);
      const ready = async () => {
        const shot = (
          await browser(
            "eval",
            `document.querySelector('input[aria-label="Demo progress"]').value`
          )
        ).result;
        assert.match(String(shot), /^\d+$/);
        await browser(
          "wait",
          `[data-demo-shot="${shot}"][data-demo-prepared="true"]`
        );
      };
      try {
        await browser("open", `${origin}/blog/${scenario}`);
        await browser("hover", "[data-demo-scenario]");
        await browser(
          "find",
          "role",
          "button",
          "click",
          "--name",
          "Expand demo",
          "--exact"
        );
        await ready();
        for (const key of ["End", "Home", "End", "ArrowLeft"]) {
          // Real Radix menus can transfer focus into the iframe during restoration.
          await browser("focus", 'input[aria-label="Demo progress"]');
          await browser("press", key);
          await ready();
          const data = (
            await browser(
              "eval",
              '({...document.querySelector("[data-demo-scenario]").dataset})'
            )
          ).result;
          assert.equal(data.demoState, "paused");
          assert.equal(data.demoError, undefined);
        }
        await browser("hover", "[data-demo-scenario]");
        await browser(
          "find",
          "role",
          "button",
          "click",
          "--name",
          "Play demo",
          "--exact"
        );
        await ready();
        await browser("hover", "[data-demo-scenario]");
        await browser(
          "find",
          "role",
          "button",
          "click",
          "--name",
          "Replay demo",
          "--exact"
        );
        await ready();
        const data = (
          await browser(
            "eval",
            '({...document.querySelector("[data-demo-scenario]").dataset})'
          )
        ).result;
        assert.equal(data.demoShot, "0");
        assert.equal(data.demoError, undefined);
      } finally {
        await browser("close").catch(() => {});
      }
    }
  );
}
