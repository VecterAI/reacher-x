import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

// Use Playwright's frame API: agent-browser 0.37.1 cannot select this cross-origin iframe.
const { stdout } = await promisify(execFile)("npx", [
  "--yes",
  "--package=playwright@1.62.1",
  "which",
  "playwright",
]);
const packageDirectory = dirname(await realpath(stdout.trim()));
export const { chromium, firefox } = await import(
  pathToFileURL(join(packageDirectory, "index.mjs")).href
);
