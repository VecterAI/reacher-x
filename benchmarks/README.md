# Benchmark development

The [final people search v2 proposal](../docs/benchmark/people-search-v2-proposal.pdf) is the design reference. `people-search/plan.ts` records its path and SHA-256; `--plan` verifies the PDF before printing the plan. When an approved proposal changes, review the plan and update the source hash together. Do not silently change the methodology to match an implementation shortcut.

Requires Node.js 22 or later and the repository's pinned pnpm version.

```sh
pnpm install --frozen-lockfile
cp .env.benchmark.example .env.benchmark.local
chmod 600 .env.benchmark.local
pnpm benchmark --plan
pnpm benchmark --check-env
pnpm test:benchmark
```

Fill `.env.benchmark.local` using your own approved development credentials. Exported shell variables take precedence. The environment check only reads local values. It does not validate keys, balances, Convex login or remote settings. Keep deployment keys and self-hosted overrides out of this shell; `CONVEX_DEPLOYMENT` must be `dev:<name>`.

The approved 20 prompts, categories and model choices are in `people-search/plan.ts`. This is the setup scaffold, not a frozen run manifest. Criteria, source examples, reference dates, prices and per-step spend approval must be recorded before live execution. Model choices have no effect on the app until explicitly configured on the development deployment.

The CLI supports `--help`, `--plan`, `--check-env`, `--offline-run <file>` and `--reset`. With no options it prints help. Offline execution validates frozen inputs and exercises checkpoint storage using saved JSON. It is not the complete adapter/judging pipeline described by `--dry-run` in the PDF. Live runs, qualification replay and the full dry-run pipeline still need implementation. Only `--reset` contacts the deployment, and only when a live step was left open (see Live steps); no command calls a paid API, deploys code or starts a workspace.

The harness will reuse ReacherX's setup, prospecting and qualification logic through internal Convex hooks. Shared runner, spend, evidence, judging and statistics code belongs in `core/`; benchmark-specific plans and adapters belong in `people-search/`. People and organizations need distinct identities and grading. The learning-off condition must be scoped to benchmark workspaces and preserve ordinary deduplication, newer-post fetching and scheduled broadening.

## Layout

```text
benchmarks/
  cli.ts                         Setup, offline run and reset commands
  core/
    types.ts                     People/company schemas, evidence and task types
    random.ts                    Seeded generator and shuffle for reproducible draws
    setup/
      proposal.ts                Proposal integrity check
      env.ts                     Local credentials and dev-selection checks
      manifest.ts                Frozen plan and work-unit validation, stable digests
    execution/
      checkpoints.ts             Private atomic storage and process exclusion
      runner.ts                  Sequential offline execution and safe resumption
      convex.ts                  Convex CLI driver, learning switch, settings snapshot/restore
      liveSession.ts             Run settings on for one live step, always reset; key swap, parity
      workspaceRun.ts            One workspace: cycles counted and capped, settle wait, timing, spend
      spend.ts                   Usage/funding summary, OpenRouter key spend, step spend guard
    calls/
      http.ts                    Provider transport: live (one attempt), recording, exact replay
      llm.ts                     Structured OpenRouter calls, recorded and replayable
      rates.ts                   Frozen rates and funding applied to observed usage
    judging/
      identity.ts                Person/company identity keys and cross-tool repeat flags
      evidence.ts                Tavily web evidence, two searches per result, shared cache
      judges.ts                  Blind inputs, judgment validation, two-judge panel with tie-break
      judgeModel.ts              OpenRouter judge calls on the separate judge key
      judgeCandidate.ts          Evidence plus panel for one result, private case record
      labels.ts                  Human label sample, booklet, sheet and kappa gate
    analysis/
      metrics.ts                 Section 4 measures
      stats.ts                   Wilson, paired bootstrap, Holm, Cohen's kappa
      report.ts                  Markdown and JSON aggregate reports
  people-search/
    plan.ts                      Approved prompts, categories, models and run policy
    filters.ts                   Shared prompt-to-filter step and per-tool coverage
    decisions.ts                 D1-D4 conditions and the one-page checkpoint report
    replay.ts                    Frozen qualification input and replay contract
    reacherx.ts                  ReacherX top-K, rejected sample, export-to-entity mapping
    round1.ts                    Exact re-score of round one's saved verdicts
    tools/
      types.ts                   Adapter contract: search context in, typed results and receipt out
      catalog.ts                 Nine tools, transports and judged top K
      registry.ts                One adapter per competitor
      common.ts                  Shared parsing helpers
      direct/                    exa.ts, firecrawl.ts, context.ts, clay.ts: called directly
      treg/                      treg.ts (calls, cost, served-by, ignored filters, its own search);
                                 apollo.ts, lusha.ts, crustdata.ts called through it
  tests/                         Offline tests with synthetic data only, mirroring the code
    setup/                       Local credentials and proposal integrity
    execution/                   Runner, Convex driver, live session, workspace runs, spend guard
    calls/                       Transport replay and rate pricing
    judging/                     Identity, evidence, judges and human labels
    analysis/                    Measures, statistics and reports
    people-search/               Plan rules, filters, decisions, ReacherX results, round one
    tools/                       Adapters against saved responses
```

Each folder holds at most six files; a larger group is split into purpose-named subfolders.

Tests sit apart from the code, grouped by purpose, and import it from `core/` and `people-search/`. Add a new test file to the group it checks; a new group needs no script change.

Implemented: the offline runner and checkpoint storage, the Convex driver, the spend guard, all eight competitor adapters (people and company paths), the shared filter step, Tavily evidence, the judge panel and its orchestration, human labels and the kappa gate, every section 4 measure, the decision-point checks and report, statistics and report rendering. The live session (run settings, provider key swap, production parity and the reset that always runs) and the workspace runner (cycle counting and capping, the wait for qualification and lessons, per-cycle timing and spend) are implemented and tested against a simulated deployment. Not implemented yet: the step plans and the `--live`/`--dry-run` commands that compose them with the adapters and judging, replay capture, and the frozen manifest. Adapter endpoints and filter names come from public documentation; the smoke test confirms them, and anything a tool cannot express is recorded in its receipt as unexpressed rather than dropped. Treg-routed calls record the provider that served them. Crustdata uses indexed search through Treg with explicit response fields. Clay and Firecrawl use a recorded harness model call (Clay to write its query from Clay's reference, Firecrawl to extract one entity per page); every model and HTTP exchange can be replayed at $0. Hard credit limits on the OpenRouter keys are set by the key owner; the spend guard stops a step in software before that.

## Offline runner

Once a frozen run file and its saved JSON artifacts exist, run or resume them with:

```sh
pnpm benchmark --offline-run benchmarks/.local/people-search/offline-run.json
```

The file shape is `{ "manifest": ..., "units": [...] }`, validated by `offlineRunFileSchema` in `core/setup/manifest.ts`. The manifest records the proposal reference, all 20 approved tasks with fixed criteria, one reference date, the seed, reference-example artifacts mapped to each task, and rate/runtime snapshot references. Compute `planSha256` with `getPlanDigest` after freezing those fields. Use `execution: { "mode": "offline" }`; no spending approval is invented for an offline run. Live manifests require a separate explicit approval structure and are rejected by this runner even if one is supplied.

Each work unit has an opaque ID, run/task/tool IDs, a saved JSON `input` artifact (`path` and SHA-256), and a cycle/learning condition or `null`. Artifact paths must stay under `benchmarks/.local/`. `tests/execution/runner.test.ts` includes synthetic examples of the complete format and a CLI integration test. They are storage tests, not benchmark findings or approved criteria.

The default CLI executor copies each verified saved JSON input into its own result artifact. Future offline pipeline stages can supply pure executors through `runOfflineUnits`; remote adapters must not be wired into this path. Output prints counts and a private checkpoint-report reference, never the raw response. This does not freeze or approve the still-incomplete research plan in `people-search/plan.ts`.

State lives under `benchmarks/.local/runs/<run-id>/`: `frozen-run.json`, `checkpoints/`, `results/`, and `checkpoint-report.json`. Directories use mode `700`; written files use `600`. Writes flush to disk and replace a complete checkpoint atomically. One exclusive `benchmarks/.local/runner.lock` excludes other runs in this checkout. Use a local filesystem, not a shared/network drive.

On resume, the original manifest and work order must match, and input/result hashes are rechecked. Completed units are reused; only pending units execute. A `started` or `needs-review` checkpoint, missing state, changed artifact or corrupt record stops the run. A crash can leave a lock file; inspect the recorded process and outstanding work before removing it. The runner never expires locks, resets uncertain work, or deletes results automatically. These are deliberate stopping points, not an exactly-once guarantee for future remote services.

## Live steps

`core/execution/liveSession.ts` wraps one live step (proposal 5.3 steps 1 and 6). It first checks, without changing anything, that the deployment is at rest (jobs paused, automatic cycles off, no learning switch or pool limits left set), that the deployment's OpenRouter key is the local `OPENROUTER_API_KEY` whose spend is measured, and that no other workspace is running or due to restart. It then writes a private session record (`benchmarks/.local/live-session.json`, mode 600) holding the recorded settings and the development SocialAPI and LinkdAPI keys, and only then installs the funded keys through stdin, sets the frozen production and run-only values, confirms each by reading it back, unpauses jobs and applies the pool limits.

The reset runs whether the step succeeds, fails or is interrupted: it stops the tracked workspace (deleting its SocialAPI monitors while the funded key that created them is installed), clears pool limits, pauses jobs, restores every recorded setting, then restores the development keys and confirms them. The SocialAPI key is restored only after the monitors are gone. Anything it cannot finish keeps the session open and is reported; after fixing the cause, `pnpm benchmark --reset` repeats it. Once complete, the record keeps no key.

`core/execution/workspaceRun.ts` runs one workspace (step 2). Automatic cycles are on only when another cycle must follow; once the last planned cycle starts they are turned off, and any next cycle the deployment scheduled anyway is canceled, so the workspace keeps running until qualification and lesson writing settle (two quiet polls). A cycle beyond the plan stops the workspace at once and is recorded. Each cycle records its start, the end of discovery, when it settled, when the next cycle started (for the last cycle, when it was due), and the deployment key's spend at its boundaries; the first cycle includes the workspace's setup cost. Failed cycles, halted workspaces, timeouts, budget stops and interruptions end the workspace with the reason recorded, and it is always stopped and exported.

## Development hooks

The backend entry points from proposal section 5.2 are internal Convex functions, called through the authenticated CLI by `core/execution/convex.ts`:

- `convex/benchmarkPeopleSearch.ts`: `prepareWorkspace` creates a workspace from the prompt with production setup models but does not start it; `startWorkspace` starts discovery afterwards, so the learning condition is applied first. `runStatus`, paginated `exportCandidates` (factual fields, no contact details), `runCosts`, `linkdApiUnitsSince`, `stopRun` (pause, cancel, remove SocialAPI monitors), `cancelScheduledCycles` (cancels a benchmark workspace's scheduled next cycle without pausing it), `deploymentActivity` (running workspaces and pending restarts) and `resetLinkdApiCircuit` support the run. These functions must be pushed to the development deployment, with approval, before the smoke test. `deleteBenchmarkWorkspace` is for approved manual cleanup only; the runner never deletes.
- `convex/benchmarkReplay.ts`: `replayQualification` passes frozen cases from dev file storage to `qualifyProspectCore`, at most 25 per call, sequentially. Each case carries its capture time (`now`), so post ages and "today" match the original run. Learning-off replay uses the case's operator-only policy and no lessons or similar cases. `replayUsageSince` lists the models recorded for a replay's calls.
- The learning switch is the development setting `BENCHMARK_LEARNING_OFF_WORKSPACE_IDS` (`convex/lib/benchmarkLearningControl.ts`). For the named workspaces only, discovery receives no learned lessons, query scores or recent winners; qualification receives operator instructions only and no similar past cases; social queries rotate by oldest use without ranking or the cold-query pause. Operator instructions, deduplication, newer-post fetching and scheduled broadening are unchanged. It is never set in production. The driver names only the active control workspace, because one workspace runs at a time.

The driver records and restores an allowlist of non-secret settings (`RUNTIME_SETTINGS`) and passes values on stdin.

Starter runs at most 8 scheduled jobs at once, while production asks for 64 workflow slots plus 10 qualification and 10 enrichment workers. `BENCHMARK_POOL_LIMITS` (development only, `convex/lib/benchmarkConcurrency.ts`) sets the workflow manager and every legacy worker pool together from one JSON value. The workflow manager reads it on each start; `tenantScheduler.reconcilePoolConfigurationInternal` applies it to the pools. The workpool component has no read API, so `poolLimitsStatus` reports the limits from the same resolver both use, and `applyPoolLimits` in the driver stops unless the deployment confirms exactly the requested values. An invalid value never changes behaviour; it reports an error instead. Reconciliation is skipped while autonomous jobs are paused, so the runner applies limits after unpausing and clears them before pausing again. The smoke test measures the resulting runtime; the limits themselves are a D1 decision, not fixed here.

The eventual runner must keep one workspace active, wait for qualification and lesson writing, and restore the development settings after success or failure. Checkpoints with uncertain billing stop for review instead of automatically repeating a request. Read actual effective workflow and worker limits; setting a single concurrency env variable is insufficient. Persist private outputs under `benchmarks/.local/people-search/`. Create `people-search/results/` only when reviewed aggregate results exist.

Blind inputs are built from explicit factual fields with a new opaque case ID. Provider IDs, ranks, fit scores and generated verdicts stay outside the judging input. Statistics use Wilson intervals for binary proportions only and a seeded paired bootstrap over prompts within a category, with Holm correction across comparisons; single observations remain descriptive.

Implementation references: [Convex internal functions](https://docs.convex.dev/functions/internal-functions), [Convex CLI](https://docs.convex.dev/cli/overview), and the installed `ai`/OpenRouter SDK documentation. Provider prices and quotas must be checked before live steps; historical proposal balances are not current balances.

Store private responses, evidence, checkpoints and replay inputs in `benchmarks/.local/`, which is ignored by git. Keep local key files private and use separate OpenRouter keys for the deployment and judges. Never commit raw profiles or evidence. Ordinary frontend authentication, billing, email and Unipile credentials are not needed for these offline commands.
