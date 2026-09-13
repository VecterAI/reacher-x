import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { chromium } from "../app/playwrightHelpers.mjs";
const directory = await mkdtemp(join(tmpdir(), "reacherx-product-"));
const origin = process.env.DEMO_TEST_URL ?? "http://localhost:3130";
const browser = await chromium.launch({ channel: "chrome" });
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
    colorScheme: "light",
    recordVideo: { dir: directory, size: { width: 1280, height: 850 } },
  });
  const page = await context.newPage();
  await page.goto(`${origin}/?scenario=introducing-reacherx-v4`);
  await page
    .getByRole("button", {
      name: "View Isabelle Fontaine profile",
      exact: true,
    })
    .waitFor();
  await page.waitForTimeout(1500);
  await page.locator('[data-prospect-id="use_case_demo_candidates_1"]').click();
  await page
    .getByRole("tab", { name: "Relevant activity", exact: true })
    .click();
  await page.getByRole("tabpanel").scrollIntoViewIfNeeded();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: "Profile menu", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Message on LinkedIn", exact: true })
    .click();
  await page.getByRole("log").waitFor();
  await page.waitForTimeout(3500);
  const video = page.video();
  await context.close();
  execFileSync(
    process.env.FFMPEG_BIN ?? "ffmpeg",
    [
      "-y",
      "-i",
      await video.path(),
      "-ss",
      "1",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-an",
      fileURLToPath(
        new URL("../app/public/media/reacherx-workflow.mp4", import.meta.url)
      ),
    ],
    { stdio: "inherit" }
  );
} finally {
  await browser.close();
}
