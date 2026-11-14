import { parseArgs } from "node:util";
import { readFile } from "node:fs/promises";
import {
  formatEnvironmentReport,
  inspectBenchmarkEnvironment,
  readBenchmarkEnvironment,
} from "./core/env";
import {
  assertPeopleSearchManifest,
  peopleSearchPlan,
} from "./people-search/plan";
import { verifyProposal } from "./core/proposal";
import { offlineRunFileSchema } from "./core/manifest";
import { runOfflineUnits } from "./core/runner";
import { RunnerStateError } from "./core/checkpoints";

const help = `ReacherX benchmark setup

  pnpm benchmark --plan        Print the approved prompt plan as JSON
  pnpm benchmark --check-env   Check local variable presence and dev selection
  pnpm benchmark --offline-run <file>  Checkpoint saved JSON work from a frozen manifest
  pnpm benchmark --help        Show this help

All commands run offline. --offline-run exercises persistence using saved JSON;
it is not the complete judged pipeline. Live runs, qualification replay and the
full --dry-run pipeline are not enabled. No command changes remote settings.`;

async function main() {
  let options;
  try {
    options = parseArgs({
      options: {
        help: { type: "boolean" },
        plan: { type: "boolean" },
        "check-env": { type: "boolean" },
        "offline-run": { type: "string" },
      },
    }).values;
    if (Object.values(options).filter(Boolean).length > 1) throw new Error();
  } catch {
    console.error("Unknown or conflicting options. Run pnpm benchmark --help.");
    process.exitCode = 1;
    return;
  }

  if (options["offline-run"]) {
    const run = offlineRunFileSchema.parse(
      JSON.parse(await readFile(options["offline-run"], "utf8"))
    );
    assertPeopleSearchManifest(run.manifest);
    const summary = await runOfflineUnits(process.cwd(), run);
    console.log(JSON.stringify(summary, null, 2));
  } else if (options.plan) {
    await verifyProposal(process.cwd(), peopleSearchPlan.sourceProposal);
    console.log(JSON.stringify(peopleSearchPlan, null, 2));
  } else if (options["check-env"]) {
    const environment = await readBenchmarkEnvironment(process.cwd());
    const report = inspectBenchmarkEnvironment(environment);
    console.log(formatEnvironmentReport(report));
    if (report.issues.length) process.exitCode = 1;
  } else {
    console.log(help);
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof RunnerStateError
      ? error.message
      : "Benchmark validation failed. Check the proposal, frozen manifest, artifact hashes and local file permissions."
  );
  process.exitCode = 1;
});
