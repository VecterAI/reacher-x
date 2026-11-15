import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { FileCheckpointStore } from "../../../core/execution/checkpoints";
import { peopleSearchPlan } from "../../../people-search/setup/plan";
import { approvalReader } from "../../../people-search/steps/live";
import { approvalPath } from "../../../people-search/steps/pipeline";

// Synthetic values only; these runs stop before any network or deployment call.
async function checkout(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "reacherx-live-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

const tsx = createRequire(import.meta.url).resolve("tsx/cli");
const cli = fileURLToPath(new URL("../../../cli.ts", import.meta.url));

async function live(root: string, env: Record<string, string>) {
  return promisify(execFile)(process.execPath, [tsx, cli, "--live", "smoke"], {
    cwd: root,
    env: { PATH: process.env.PATH ?? "", NODE_ENV: "test", ...env },
  }).then(
    () => ({ code: 0, stderr: "" }),
    (error: { code: number; stderr: string }) => error
  );
}

test("--live refuses to start without its local setup and frozen plan", async (t) => {
  const root = await checkout(t);
  const pdf = join(root, peopleSearchPlan.sourceProposal.path);
  await mkdir(dirname(pdf), { recursive: true });
  await copyFile(
    fileURLToPath(
      new URL(
        `../../../../${peopleSearchPlan.sourceProposal.path}`,
        import.meta.url
      )
    ),
    pdf
  );
  const missing = await live(root, {});
  assert.equal(missing.code, 1);
  assert.match(
    missing.stderr,
    /The local environment is not ready: Missing CONVEX_DEPLOYMENT/
  );

  const secret = "synthetic-secret-value";
  const configured = await live(root, {
    CONVEX_DEPLOYMENT: "dev:synthetic",
    BENCHMARK_USER_ID: "synthetic-user",
    ...Object.fromEntries(
      [
        "OPENROUTER_API_KEY",
        "SOCIALAPI_API_KEY",
        "LINKDAPI_API_KEY",
        "EXA_API_KEY",
        "TREG_TOKEN",
        "TREG_TOKEN_REACHERX",
        "CLAY_API_KEY",
        "CONTEXT_DEV_API_KEY",
        "FIRECRAWL_API_KEY",
        "TAVILY_API_KEY",
      ].map((name) => [name, secret])
    ),
  });
  assert.equal(configured.code, 1);
  assert.match(configured.stderr, /No frozen plan/);
  assert.ok(!configured.stderr.includes(secret));
});

test("a step's approval is read from its private file and must name that step", async (t) => {
  const root = await checkout(t);
  const store = new FileCheckpointStore(root, "live");
  const read = approvalReader(store);
  assert.equal(await read("smoke"), null);
  const write = async (segment: string, value: Record<string, unknown>) => {
    const path = join(root, approvalPath("smoke"));
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(path, JSON.stringify({ segment, ...value }), {
      mode: 0o600,
    });
  };
  const spend = {
    approvalReference: "Synthetic approval",
    approvedAt: "2026-11-15T00:00:00Z",
    accountLimits: [{ accountId: "openrouter:abc", maxAdditionalUsd: 1 }],
  };
  await write("smoke", { spend });
  assert.deepEqual((await read("smoke"))?.credits, []);
  await write("pilot", { spend });
  await assert.rejects(read("smoke"), /is for pilot, not smoke/);
  await write("smoke", { spend: { ...spend, accountLimits: [] } });
  await assert.rejects(read("smoke"), /is not valid/);
});
