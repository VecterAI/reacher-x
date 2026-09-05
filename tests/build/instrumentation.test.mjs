import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";

// Run after `pnpm build`: only traced deployment files are available to the child.
test("deployed instrumentation starts and logs errors without repository dependencies", () => {
  const root = process.cwd();
  const entry = resolve(root, ".next/server/instrumentation.js");
  const trace = JSON.parse(readFileSync(`${entry}.nft.json`, "utf8"));
  const isolated = mkdtempSync(join(tmpdir(), "reacher-instrumentation-"));

  try {
    for (const file of [
      entry,
      ...trace.files.map((file) => resolve(dirname(entry), file)),
    ]) {
      const projectPath = relative(root, file);
      assert.ok(
        !projectPath.startsWith(".."),
        `Trace escapes project: ${projectPath}`
      );
      const destination = join(isolated, projectPath);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(file, destination);
    }

    const result = spawnSync(
      process.execPath,
      [
        "--input-type=commonjs",
        "-e",
        `
      const hooks = require('./.next/server/instrumentation.js');
      (async () => {
        await Promise.all([hooks.register(), hooks.register()]);
        await hooks.onRequestError(
          new Error('Instrumentation deployment smoke test'),
          { path: '/instrumentation-smoke', method: 'GET', headers: {} },
          { routerKind: 'App Router', routePath: '/instrumentation-smoke', routeType: 'render' }
        );
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `,
      ],
      {
        cwd: isolated,
        env: {
          NODE_ENV: "production",
          NEXT_RUNTIME: "nodejs",
          LOG_ENVIRONMENT: "production",
        },
        encoding: "utf8",
        timeout: 10_000,
      }
    );

    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    const events = `${result.stdout}\n${result.stderr}`
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.ok(
      events.some(
        (event) =>
          event.message === "Instrumentation deployment smoke test" &&
          event.path === "/instrumentation-smoke" &&
          event.level === "error"
      ),
      "The packaged error hook must emit the structured error"
    );
  } finally {
    rmSync(isolated, { recursive: true, force: true });
  }
});
