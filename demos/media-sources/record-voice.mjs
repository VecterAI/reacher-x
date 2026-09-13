// macOS source for the fictional sample microphone. No visitor microphone is used.
import { execFileSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const folder = await mkdtemp(join(tmpdir(), "reacherx-voice-"));
const aiff = join(folder, "sample.aiff");
execFileSync("say", [
  "-v",
  "Samantha",
  "-r",
  "200",
  "-o",
  aiff,
  "Hi Nora. No account is needed to leave feedback.",
]);
execFileSync(
  process.env.FFMPEG_BIN ?? "ffmpeg",
  [
    "-y",
    "-i",
    aiff,
    "-af",
    "apad",
    "-t",
    "10",
    "-ar",
    "48000",
    "-ac",
    "1",
    "-c:a",
    "aac",
    fileURLToPath(
      new URL("../app/public/media/voice-sample.m4a", import.meta.url)
    ),
  ],
  { stdio: "inherit" }
);
