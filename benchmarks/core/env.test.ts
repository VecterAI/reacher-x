import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  formatEnvironmentReport,
  inspectBenchmarkEnvironment,
  readBenchmarkEnvironment,
} from "./env";

test("production and credential overrides cannot pass the dev preflight", () => {
  const prod = inspectBenchmarkEnvironment({
    CONVEX_DEPLOYMENT: "prod:production-example",
  });
  assert.ok(
    prod.issues.some((issue) => issue.includes("must select a dev deployment"))
  );
  for (const name of [
    "CONVEX_DEPLOY_KEY",
    "CONVEX_DEPLOYMENT_TOKEN",
    "CONVEX_SELF_HOSTED_URL",
    "CONVEX_SELF_HOSTED_ADMIN_KEY",
  ]) {
    const report = inspectBenchmarkEnvironment({
      CONVEX_DEPLOYMENT: "dev:example-deployment",
      [name]: "test-only-secret",
    });
    assert.ok(report.issues.some((issue) => issue.startsWith(`Unset ${name}`)));
  }
});

test("reports never echo credentials, invalid deployment values or placeholder values", () => {
  const credential = "test-only-secret-marker";
  const report = inspectBenchmarkEnvironment({
    CONVEX_DEPLOYMENT: "prod:private-target-marker",
    OPENROUTER_API_KEY: credential,
    BENCHMARK_JUDGE_OPENROUTER_API_KEY: credential,
    EXA_API_KEY: "your_api_key",
  });
  assert.ok(
    report.issues.some((issue) => issue.includes("distinct OpenRouter keys"))
  );
  assert.ok(report.issues.includes("Missing EXA_API_KEY."));
  const output = formatEnvironmentReport(report);
  for (const value of [credential, "private-target-marker", "your_api_key"]) {
    assert.ok(!output.includes(value));
  }
});

test("local env parsing honors shell precedence without changing process.env", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "reacherx-benchmark-env-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const before = process.env.BENCHMARK_USER_ID;
  const path = join(root, ".env.benchmark.local");
  await writeFile(
    path,
    'BENCHMARK_USER_ID="local-owner"\nCONVEX_DEPLOYMENT=dev:example-deployment\n',
    { mode: 0o600 }
  );
  const environment = await readBenchmarkEnvironment(root, {
    BENCHMARK_USER_ID: "shell-owner",
  });
  assert.equal(environment.BENCHMARK_USER_ID, "shell-owner");
  assert.equal(environment.CONVEX_DEPLOYMENT, "dev:example-deployment");
  assert.equal(process.env.BENCHMARK_USER_ID, before);

  if (process.platform !== "win32") {
    await chmod(path, 0o644);
    await assert.rejects(
      readBenchmarkEnvironment(root, {}),
      /file permissions/
    );
  }
});
