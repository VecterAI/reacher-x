import { parseArgs } from "node:util";
import { readFile } from "node:fs/promises";
import {
  formatEnvironmentReport,
  inspectBenchmarkEnvironment,
  readBenchmarkEnvironment,
} from "./core/setup/env";
import {
  assertPeopleSearchManifest,
  peopleSearchPlan,
} from "./people-search/setup/plan";
import { verifyProposal } from "./core/setup/proposal";
import { offlineRunFileSchema } from "./core/setup/manifest";
import { runOfflineUnits } from "./core/execution/runner";
import {
  FileCheckpointStore,
  RunnerStateError,
} from "./core/execution/checkpoints";
import { ConvexReacherXDriver, npxConvexRunner } from "./core/execution/convex";
import {
  LiveSessionError,
  ResetIncomplete,
  hasOpenSession,
  resetLiveSession,
  sessionFileIn,
} from "./core/execution/liveSession";

const help = `ReacherX benchmark setup

  pnpm benchmark --plan        Print the approved prompt plan as JSON
  pnpm benchmark --check-env   Check local variable presence and dev selection
  pnpm benchmark --offline-run <file>  Checkpoint saved JSON work from a frozen manifest
  pnpm benchmark --reset       Reset the development deployment after an interrupted live step
  pnpm benchmark --help        Show this help

--offline-run exercises persistence using saved JSON; it is not the complete
judged pipeline. Live runs, qualification replay and the full --dry-run
pipeline are not enabled. Only --reset contacts the deployment: it stops the
step's workspace, pauses jobs, restores the recorded settings and development
keys, and does nothing when no step was left open.

Per the proposal, plain "pnpm benchmark" will run the quick check (replay) and
"--model <id>", "--live <step>" and "--dry-run" will follow. Until the frozen
replay set exists, plain "pnpm benchmark" prints this help.`;

async function main() {
  let options;
  try {
    options = parseArgs({
      options: {
        help: { type: "boolean" },
        plan: { type: "boolean" },
        "check-env": { type: "boolean" },
        "offline-run": { type: "string" },
        reset: { type: "boolean" },
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
  } else if (options.reset) {
    const environment = await readBenchmarkEnvironment(process.cwd());
    const deployment = environment.CONVEX_DEPLOYMENT;
    if (
      !deployment?.startsWith("dev:") ||
      inspectBenchmarkEnvironment(environment).issues.some((issue) =>
        /CONVEX|deployment/.test(issue)
      )
    ) {
      console.error(
        "Select the development deployment first. Run pnpm benchmark --check-env."
      );
      process.exitCode = 1;
      return;
    }
    const dev = deployment as `dev:${string}`;
    const driver = new ConvexReacherXDriver(dev, npxConvexRunner(dev));
    const store = new FileCheckpointStore(process.cwd(), "reset");
    const file = sessionFileIn(store);
    await store.withLock(async () => {
      if (!(await hasOpenSession(file))) {
        console.log("No live step was left open; nothing was changed.");
        return;
      }
      const problems = await resetLiveSession(driver, file);
      if (problems.length) {
        console.error(new ResetIncomplete(problems).message);
        process.exitCode = 1;
      } else
        console.log(
          "The step's workspace is stopped, jobs are paused, and the recorded settings and development keys are restored."
        );
    });
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
    error instanceof RunnerStateError ||
      error instanceof LiveSessionError ||
      error instanceof ResetIncomplete
      ? error.message
      : "Benchmark validation failed. Check the proposal, frozen manifest, artifact hashes and local file permissions."
  );
  process.exitCode = 1;
});
