import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createBrowser } from "./browserHelpers.mjs";

const origin = process.env.BLOG_TEST_URL;
if (!origin) throw new Error("Set BLOG_TEST_URL to the blog preview.");
const scenarios = [
  "find-candidates",
  "manage-people-with-reacherx",
  "workspaces-explained",
];

for (const scenario of scenarios) {
  test(
    `${scenario}: complete autoplay and replay with the real app`,
    { timeout: 150000 },
    async () => {
      const session = `demo-playback-${randomUUID()}`;
      const browser = createBrowser(session);
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
        await browser("wait", '[data-demo-ready="true"]');
        await browser(
          "find",
          "role",
          "button",
          "click",
          "--name",
          "Replay demo",
          "--exact"
        );
        const result = (
          await browser(
            "eval",
            `new Promise(resolve => {
        const seen = new Set();
        const started = performance.now();
        const player = document.querySelector('[data-demo-scenario]');
        const maximum = Number(player.querySelector('input[type=range]').max);
        const sample = () => {
          const shot = Number(player.dataset.demoShot);
          const error = player.dataset.demoError;
          if (error || player.dataset.demoState === 'paused') return resolve({ error: error || 'Unexpected pause', seen: [...seen], maximum });
          if (shot === 0 && seen.has(maximum)) return resolve({ seen: [...seen], maximum, looped: true });
          seen.add(shot);
          if (performance.now() - started > 55000) return resolve({ error: 'Playback did not complete', seen: [...seen], maximum });
          setTimeout(sample, 40);
        };
        sample();
      })`
          )
        ).result;
        assert.equal(result.error, undefined, JSON.stringify(result));
        assert.equal(result.looped, true);
        assert.deepEqual(
          [...result.seen].sort((a, b) => a - b),
          Array.from({ length: result.maximum + 1 }, (_, index) => index)
        );
        await browser(
          "find",
          "role",
          "button",
          "click",
          "--name",
          "Replay demo",
          "--exact"
        );
        await browser(
          "find",
          "role",
          "button",
          "click",
          "--name",
          "Pause demo",
          "--exact"
        );
        await browser("wait", '[data-demo-shot="0"]');
        await browser("wait", "1200");
        const bounds = (
          await browser(
            "eval",
            `(() => {
        const container = document.querySelector('[data-demo-scenario]').getBoundingClientRect();
        const app = document.querySelector('.blog-app-demo-window').getBoundingClientRect();
        return { left: app.left-container.left, top: app.top-container.top, right: container.right-app.right, bottom: container.bottom-app.bottom };
      })()`
          )
        ).result;
        for (const margin of Object.values(bounds))
          assert.ok(margin > 0, JSON.stringify(bounds));
        await browser("screenshot", `/tmp/reacherx-${scenario}-wide.png`);
      } finally {
        await browser("close").catch(() => {});
      }
    }
  );
}
