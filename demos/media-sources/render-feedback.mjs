import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "../app/playwrightHelpers.mjs";
const frames = "/tmp/reacherx-feedback-frames";
await mkdir(frames, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  await page.goto(new URL("./client-feedback.html", import.meta.url).href);
  for (let i = 0; i < 180; i++) {
    await page.evaluate((t) => window.renderAt(t), (i * 1000) / 30);
    await page.screenshot({
      path: `${frames}/${String(i).padStart(4, "0")}.png`,
    });
  }
  await page.evaluate(() => window.renderAt(5000));
  await page.screenshot({
    path: fileURLToPath(
      new URL("../app/public/media/client-feedback.png", import.meta.url)
    ),
  });
} finally {
  await browser.close();
}

execFileSync(
  process.env.FFMPEG_BIN ?? "ffmpeg",
  [
    "-y",
    "-framerate",
    "30",
    "-i",
    `${frames}/%04d.png`,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    fileURLToPath(
      new URL("../app/public/media/client-feedback.mp4", import.meta.url)
    ),
  ],
  { stdio: "inherit" }
);
