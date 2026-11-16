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
import { freezeInputSchema, freezePlan } from "./people-search/setup/freeze";
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
import { BudgetStop } from "./core/execution/spend";
import { interruptOnSignals } from "./core/steps/interrupt";
import { SharedKeyConflict } from "./core/steps/keyGate";
import { STEPS, type StepId } from "./people-search/setup/schedule";
import { LiveSetupError, liveDependencies } from "./people-search/steps/live";
import { runStep, type SegmentResult } from "./people-search/steps/pipeline";
import { dryRun } from "./people-search/dryRun/dryRun";
import {
  ModelCheckError,
  captureQuickCheck,
  quickCheckDependencies,
  restoreQuickCheckModel,
  runQuickCheck,
} from "./people-search/quick-check/runner";
import { CURRENT_SET_PATH } from "./people-search/quick-check/capture";
import { PersonalDataError, writePublicResults } from "./core/analysis/publish";
import { peopleSearchPublicVocabulary } from "./people-search/analysis/publicVocabulary";

const help = `ReacherX benchmark

  pnpm benchmark               Quick check: replay the frozen set with the deployed model
  pnpm benchmark --model <id>  Quick check with another qualification model (restored afterwards)
  pnpm benchmark --learning on|off|both  Quick check with or without learned lessons
  pnpm benchmark --capture-replay <file>  Capture the quick-check set from judged ReacherX cases
  pnpm benchmark --restore-model  Restore a qualification model a quick check left changed
  pnpm benchmark --plan        Print the approved prompt plan as JSON
  pnpm benchmark --check-env   Check local variable presence and dev selection
  pnpm benchmark --freeze <file>  Freeze criteria, reference date and examples
                               (the file must be under benchmarks/.local/)
  pnpm benchmark --offline-run <file>  Checkpoint saved JSON work from a frozen manifest
  pnpm benchmark --live <step> Run one live step: smoke, pilot, main or stage2
  pnpm benchmark --live <step> --resume-held  Continue the step's workspaces
                               held after a budget stop or an interruption
  pnpm benchmark --dry-run [step]  The same pipeline on synthetic data at $0,
                               through the given step (all steps when omitted)
  pnpm benchmark --reset       Reset the development deployment after an interrupted live step
  pnpm benchmark --publish <run-id>  Write a reviewed step's aggregate results to the public folder
  pnpm benchmark --help        Show this help

--live runs the next unfinished part of the step from the frozen plan
(benchmarks/.local/people-search/frozen/plan.json) and stops at its decision
point (D1 after smoke, D2 after pilot, D3 after main, D4 a third into stage
2). It needs the step's spend approval in
benchmarks/.local/people-search/approvals/<part>.json, refuses to start when an
account holds less than the approval needs, and spends real money. ReacherX
runs one workspace at a time; competitors one request at a time; then the
judges. Every unit is checkpointed: running the same command again resumes,
reuses finished units and never repeats one that started without finishing.
Ctrl+C stops new work and always finishes the deployment reset; if that
reset cannot finish, fix the cause and run --reset.

--resume-held continues, inside the same kind of live session, a workspace
held after a budget stop or an interruption: the same workspace and cycle,
so its pending qualification, enrichment and lesson writing finish. It never
starts a discovery cycle. Its earlier use counts against the approval, so
raise the approval first. The step then carries on as usual.

While a step runs, the approval file is read again between status polls:
higher amounts apply at once; lower amounts and invalid files are ignored
(the approval in force is kept) and logged.

--dry-run makes no network call and contacts no deployment. It runs every
phase on invented data in a temporary folder and prints the reports.

--offline-run exercises persistence using saved JSON; it is not the judged
pipeline. Only --live and --reset contact the deployment; --reset stops the
step's workspace, pauses jobs, restores the recorded settings and development
keys, and does nothing when no step was left open.

Plain "pnpm benchmark" runs the quick check once a replay set has been
captured; until then it prints this help. The quick check needs the
deployment at rest with no live step open, and stops at $1.65 per learning
condition.`;

const modifiesQuickCheck = (options: { model?: string; learning?: string }) =>
  options.model !== undefined || options.learning !== undefined;

const isStep = (value: string): value is StepId =>
  (STEPS as readonly string[]).includes(value);

function print(results: readonly SegmentResult[]) {
  for (const result of results) {
    console.log(result.report);
    if (result.decision) console.log(result.decision);
  }
}

async function main() {
  let options;
  let positionals: string[];
  try {
    const parsed = parseArgs({
      allowPositionals: true,
      options: {
        help: { type: "boolean" },
        plan: { type: "boolean" },
        "check-env": { type: "boolean" },
        "offline-run": { type: "string" },
        freeze: { type: "string" },
        reset: { type: "boolean" },
        live: { type: "string" },
        "dry-run": { type: "boolean" },
        model: { type: "string" },
        learning: { type: "string" },
        "capture-replay": { type: "string" },
        "restore-model": { type: "boolean" },
        publish: { type: "string" },
        "resume-held": { type: "boolean" },
      },
    });
    options = parsed.values;
    positionals = parsed.positionals;
    // An empty value (an unset shell variable) must never fall through to the
    // default, paid quick check.
    if (Object.values(options).some((value) => value === "")) throw new Error();
    // --model and --learning only modify the default quick check.
    const commands = Object.entries(options).filter(
      ([name, value]) =>
        value &&
        name !== "model" &&
        name !== "learning" &&
        name !== "resume-held"
    );
    if (commands.length > 1 || (commands.length && modifiesQuickCheck(options)))
      throw new Error();
    // --resume-held only modifies a live step.
    if (options["resume-held"] && options.live === undefined) throw new Error();
    if (
      options.learning !== undefined &&
      !["on", "off", "both"].includes(options.learning)
    )
      throw new Error();
    // Only --dry-run takes a step without a flag value.
    if (
      positionals.length > (options["dry-run"] ? 1 : 0) ||
      (positionals[0] !== undefined && !isStep(positionals[0])) ||
      (options.live !== undefined && !isStep(options.live))
    )
      throw new Error();
  } catch {
    console.error("Unknown or conflicting options. Run pnpm benchmark --help.");
    process.exitCode = 1;
    return;
  }

  if (options.live !== undefined && isStep(options.live)) {
    const step = options.live;
    const root = process.cwd();
    await verifyProposal(root, peopleSearchPlan.sourceProposal);
    const environment = await readBenchmarkEnvironment(root);
    const interrupt = interruptOnSignals();
    try {
      const deps = await liveDependencies(
        root,
        environment,
        interrupt.signal,
        (line) => console.error(line)
      );
      const result = await runStep(step, {
        ...deps,
        resumeHeld: options["resume-held"] === true,
      });
      print([result]);
      console.error(`Private files: ${result.files.join(", ")}.`);
      if (result.outcome.status === "interrupted") {
        console.error(
          "The step was interrupted and the deployment was reset. Run the same command to resume; units that started without finishing are held for review."
        );
        process.exitCode = 130;
      } else if (result.outcome.status === "halted") {
        console.error(
          `The step halted: ${result.outcome.stopReason ?? ""} The deployment was reset; fix the cause, then run the same command to resume.`
        );
        process.exitCode = 1;
      } else if (result.outcome.status === "budget-stop") {
        console.error(
          `The step stopped before spending more: ${result.outcome.stopReason ?? ""} Review it, update the approval if more is agreed, then run the same command to resume; add --resume-held to continue the stopped workspace's cycle.`
        );
        process.exitCode = 1;
      }
    } finally {
      interrupt.dispose();
    }
  } else if (options["dry-run"]) {
    const interrupt = interruptOnSignals();
    try {
      const through = positionals[0];
      const results = await dryRun({
        through: through !== undefined && isStep(through) ? through : undefined,
        signal: interrupt.signal,
        log: (line) => console.error(line),
      });
      print(results);
      // Scripts must be able to tell a stopped dry run from a complete one.
      const stopped = results.find(
        (result) => result.outcome.status !== "complete"
      );
      if (stopped) {
        console.error(
          `Dry run stopped (${stopped.outcome.status}): ${stopped.outcome.stopReason ?? ""}`
        );
        process.exitCode = stopped.outcome.status === "interrupted" ? 130 : 1;
      } else
        console.error(
          "Dry run finished: synthetic data only, no network or deployment contact, $0."
        );
    } finally {
      interrupt.dispose();
    }
  } else if (options["offline-run"]) {
    const run = offlineRunFileSchema.parse(
      JSON.parse(await readFile(options["offline-run"], "utf8"))
    );
    assertPeopleSearchManifest(run.manifest);
    const summary = await runOfflineUnits(process.cwd(), run);
    console.log(JSON.stringify(summary, null, 2));
  } else if (options.freeze) {
    // Reference examples are real people and companies, so the input must be
    // a private file; the store rejects paths outside benchmarks/.local/,
    // parent-directory steps and symlinks.
    await verifyProposal(process.cwd(), peopleSearchPlan.sourceProposal);
    const store = new FileCheckpointStore(process.cwd(), "freeze");
    const text = await store.readPrivate(options.freeze);
    if (text === null) {
      console.error("The freeze input file was not found.");
      process.exitCode = 1;
      return;
    }
    const input = freezeInputSchema.parse(JSON.parse(text));
    const plan = await store.withLock(() => freezePlan(store, input));
    console.log(
      `Plan frozen: ${plan.tasks.length} prompts, reference date ${plan.referenceDate}, digest ${plan.planSha256}.`
    );
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
  } else if (options["capture-replay"]) {
    const set = await captureQuickCheck(options["capture-replay"]);
    const spent = set.linkedPages.spentUsd.toFixed(3);
    console.log(
      `Quick-check set ${set.setId}: ${set.cases} cases, linked pages USD ${spent}.`
    );
  } else if (options["restore-model"]) {
    const deps = await quickCheckDependencies(process.cwd());
    const restored = await deps.store.withLock(() =>
      restoreQuickCheckModel(deps)
    );
    console.log(
      restored
        ? "The qualification model is restored."
        : "No model change was left open."
    );
  } else if (options.publish) {
    // Only after the step's private report has been reviewed: the writer
    // refuses any personal field, link, email or unapproved label.
    const store = new FileCheckpointStore(process.cwd(), options.publish);
    const text = await store.readPrivate(store.runFile("aggregate.json"));
    if (text === null) {
      console.error("That run has no aggregate report yet.");
      process.exitCode = 1;
      return;
    }
    const paths = await writePublicResults(
      process.cwd(),
      peopleSearchPlan.artifacts.public,
      JSON.parse(text),
      peopleSearchPublicVocabulary()
    );
    console.log(`Public results written: ${paths.markdown}, ${paths.json}.`);
  } else if (options.help) {
    console.log(help);
  } else {
    // The quick check needs a captured set; until one exists, show the help.
    const captured = await new FileCheckpointStore(
      process.cwd(),
      "quick-check"
    ).readPrivate(CURRENT_SET_PATH);
    if (captured === null && !modifiesQuickCheck(options)) {
      console.log(help);
      return;
    }
    const result = await runQuickCheck({
      model: options.model,
      learning: options.learning as "on" | "off" | "both" | undefined,
    });
    console.log(result.markdown);
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof RunnerStateError ||
      error instanceof LiveSessionError ||
      error instanceof ResetIncomplete ||
      error instanceof BudgetStop ||
      error instanceof SharedKeyConflict ||
      error instanceof LiveSetupError ||
      error instanceof ModelCheckError ||
      error instanceof PersonalDataError
      ? error.message
      : "Benchmark validation failed. Check the proposal, frozen manifest, artifact hashes and local file permissions."
  );
  process.exitCode = 1;
});
