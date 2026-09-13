import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
// Resolve the pinned CLI once; spawning npm for every pointer action adds delay.
const { stdout } = await run("npx", [
  "--yes",
  "--package=agent-browser@0.37.1",
  "which",
  "agent-browser",
]);
const executable = stdout.trim();

export function createBrowser(session) {
  return async (...args) => {
    const { stdout } = await run(
      executable,
      ["--session", session, "--json", ...args],
      {
        timeout: 65000,
        maxBuffer: 2 * 1024 * 1024,
      }
    );
    const result = JSON.parse(stdout);
    assert.equal(result.success, true, JSON.stringify(result.error));
    return result.data;
  };
}
