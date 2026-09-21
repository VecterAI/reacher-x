import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createBrowser } from "./browserHelpers.mjs";

const origin = process.env.DEMO_TEST_URL;
if (!origin) throw new Error("Set DEMO_TEST_URL to the standalone demo app.");

test(
  "real app: workspace switch, card menu, status, conversation, history, archive and reset",
  { timeout: 120000 },
  async () => {
    const browser = createBrowser(`demo-app-${randomUUID()}`);
    const roleClick = (role, name) =>
      browser("find", "role", role, "click", "--name", name, "--exact");
    const evaluate = async (source) => (await browser("eval", source)).result;
    // The real panel stack keeps a hidden predecessor mounted. Role targeting
    // selects the visible back button, rather than the first DOM match.
    const goBack = () => roleClick("button", "Go back");
    const candidate = '[data-prospect-id="use_case_demo_candidates_1"]';
    const url = `${origin}/?scenario=workspaces-explained`;
    try {
      await browser("open", url);
      await browser("wait", candidate);
      await browser("click", '[role="combobox"]');
      await roleClick("option", "Customers — freelance designers");
      await browser(
        "wait",
        '[data-prospect-id="use_case_demo_customers_1"]'
      );
      assert.equal(await evaluate("location.href"), url);
      assert.equal(
        await evaluate(`document.querySelector('${candidate}') === null`),
        true
      );
      await browser("click", '[role="combobox"]');
      await roleClick("option", "Hiring — product designer");
      await browser("wait", candidate);
      await browser("click", `${candidate} button[aria-label="More options"]`);
      await roleClick("menuitem", 'Mark "Interviewing"');
      await browser(
        "wait",
        "--fn",
        `document.querySelector('${candidate}') === null`
      );
      await roleClick("tab", "Interviewing, 1 total");
      await browser("wait", candidate);
      await browser("click", candidate);
      await roleClick("button", "Profile menu");
      await roleClick("menuitem", "Message on LinkedIn");
      await browser(
        "wait",
        'button[aria-label="Record voice note"]:not(:disabled)'
      );
      await browser(
        "fill",
        '[role="textbox"][contenteditable="true"]',
        "Thursday works. I will send the role details."
      );
      // The real app's transient status toast can cover the composer button.
      await browser(
        "wait",
        "--fn",
        '!document.querySelector("[data-sonner-toast]")'
      );
      await roleClick("button", "Send");
      await browser(
        "wait",
        "--fn",
        'document.querySelector("[role=log]")?.textContent.includes("Thursday works. I will send the role details.")'
      );
      await goBack();
      await roleClick("tab", "Activity log");
      await browser(
        "wait",
        "--fn",
        'document.querySelector("[role=tabpanel][data-state=active]")?.textContent.toLowerCase().includes("discovered")'
      );
      await roleClick("tab", "Your interactions");
      await browser(
        "wait",
        "--fn",
        'document.querySelector("[role=tabpanel]") !== null'
      );
      await roleClick("button", "Profile menu");
      await roleClick("menuitem", "Archive");
      await browser("wait", "--fn", '!document.querySelector("[role=menu]")');
      await goBack();
      await roleClick("link", "Archives");
      await browser("wait", candidate);
      assert.equal(await evaluate("location.pathname"), "/archives");
      await browser("open", url);
      await browser("wait", candidate);
      assert.equal(
        await evaluate(
          'document.querySelector("[role=tab][aria-selected=true]").textContent.includes("Sourced")'
        ),
        true
      );
      const errors = await browser("errors");
      assert.deepEqual(errors.errors, []);
    } catch (error) {
      try {
        console.error(await browser("snapshot", "-i"));
      } catch {
        // Keep the original error if the browser has already disconnected.
      }
      throw error;
    } finally {
      await browser("close").catch(() => {});
    }
  }
);
