import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createBrowser } from "./browserHelpers.mjs";

const origin = process.env.PARITY_TEST_URL;
if (!origin)
  throw new Error("Set PARITY_TEST_URL to the standalone experiment.");
const session = `parity-${randomUUID()}`;
const browser = createBrowser(session);
async function evaluate(source) {
  return (await browser("eval", source)).result;
}
const waitFor = (source) => browser("wait", "--fn", source);
const click = async (label) => {
  // Production notifications can temporarily overlap the narrow composer.
  await waitFor('!document.querySelector("[data-sonner-toast]")');
  return browser("click", `button[aria-label="${label}"]`);
};
const fill = (text) => browser("fill", '[role="textbox"]', text);

test(
  "unchanged production panel: send, retry, reply, recorder, upload, playback and mobile",
  { timeout: 300000 },
  async () => {
    try {
      await browser(
        "--args",
        "--use-fake-device-for-media-stream,--use-fake-ui-for-media-stream",
        "open",
        origin
      );
      await browser(
        "wait",
        'button[aria-label="Record voice note"]:not(:disabled)'
      );
      assert.equal(
        await evaluate(
          'document.querySelector("button[aria-label=Send]").disabled'
        ),
        true
      );
      await fill("We are hiring a designer for onboarding.");
      await click("Send");
      await waitFor('document.querySelectorAll("article").length === 2');
      assert.equal(
        await evaluate(
          'document.querySelector("[role=textbox]").textContent.trim()'
        ),
        ""
      );

      await browser(
        "find",
        "role",
        "button",
        "click",
        "--name",
        "Fail next send"
      );
      await fill("Could we talk on Tuesday?");
      await click("Send");
      await waitFor('document.body.textContent.includes("Not sent")');
      await browser(
        "find",
        "role",
        "button",
        "click",
        "--name",
        "Retry",
        "--exact"
      );
      await waitFor('!document.body.textContent.includes("Not sent")');
      assert.equal(
        await evaluate('document.querySelectorAll("article").length'),
        3
      );

      await browser(
        "click",
        'article:first-of-type button[aria-label="Reply to message"]'
      );
      await fill("Happy to share details.");
      await click("Send");
      await waitFor('document.querySelector("blockquote") !== null');
      assert.match(
        await evaluate('document.querySelector("blockquote").textContent'),
        /design role/
      );

      await fill("x".repeat(8001));
      await waitFor(
        'document.querySelector("button[aria-label=Send]").disabled'
      );
      // Start the independent recorder journey from a fresh fixture.
      // The native browser CLI's empty fill does not clear Lexical reliably.
      await browser("open", origin);
      await browser(
        "wait",
        'button[aria-label="Record voice note"]:not(:disabled)'
      );
      await click("Conversation menu");
      await browser("press", "Escape");
      await waitFor('document.querySelector("[role=menu]") === null');

      await click("Record voice note");
      await browser("wait", 'button[aria-label="Cancel recording"]');
      await click("Cancel recording");
      await browser("wait", 'button[aria-label="Record voice note"]');
      await click("Record voice note");
      await browser("wait", 'button[aria-label="Stop recording"]');
      await browser("wait", "1500");
      await click("Stop recording");
      await browser("wait", 'button[aria-label="Delete voice note"]');
      await click("Delete voice note");
      await browser("wait", 'button[aria-label="Record voice note"]');

      await click("Record voice note");
      await browser("wait", 'button[aria-label="Stop recording"]');
      await browser("wait", "1500");
      await click("Stop recording");
      await browser("wait", 'button[aria-label="Send voice note"]');
      await click("Play voice note");
      await waitFor(
        'Array.from(document.querySelectorAll("audio")).some(a => !a.paused && a.currentTime > 0)'
      );
      await click("Send voice note");
      await browser("wait", 'article button[aria-label="Play voice note"]');
      await browser("click", 'article button[aria-label="Play voice note"]');
      await waitFor(
        'Array.from(document.querySelectorAll("article audio")).some(a => !a.paused && a.currentTime > 0 && !a.error)'
      );
      assert.equal(
        await evaluate(
          'document.querySelector("button[aria-label=Send]").disabled'
        ),
        true
      );

      await browser("set", "viewport", "390", "844");
      assert.equal(
        await evaluate(
          "document.documentElement.scrollWidth <= window.innerWidth"
        ),
        true
      );
      await browser("screenshot", "/tmp/reacherx-experiment-mobile.png");
      await browser("set", "viewport", "1280", "900");
      await browser("screenshot", "/tmp/reacherx-experiment-desktop.png");
      const remoteRequests = await evaluate(
        'performance.getEntriesByType("resource").map(r => r.name).filter(url => /^https?:/.test(url) && new URL(url).origin !== location.origin)'
      );
      assert.deepEqual(remoteRequests, []);
      console.log(
        "Verified text send, failed send/retry, quote, length limit, menu Escape, recording cancellation, delete, preview, upload, playback, mobile and local-only resources."
      );
    } catch (error) {
      try {
        console.error(
          await evaluate(
            'JSON.stringify({textLength: document.querySelector("[role=textbox]")?.textContent.length, buttons: Array.from(document.querySelectorAll("button")).map(b => ({label:b.getAttribute("aria-label"), disabled:b.disabled}))})'
          )
        );
      } catch {
        // A disconnected browser must not replace the original test failure.
      }
      throw error;
    } finally {
      await browser("close").catch(() => {});
    }
  }
);
