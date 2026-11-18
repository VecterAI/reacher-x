# Benchmark development

The [final people search v2 proposal](../docs/benchmark/people-search-v2-proposal.pdf) is the design reference. `people-search/setup/plan.ts` records its path and SHA-256; `--plan` verifies the PDF before printing the plan. When an approved proposal changes, review the plan and update the source hash together. Do not silently change the methodology to match an implementation shortcut.

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

The approved 20 prompts, categories, model choices and production run settings are in `people-search/setup/plan.ts`, and each prompt's requirements are in `people-search/setup/criteria.ts` (a draft until the project lead and the proposal's author agree them). `pnpm benchmark --freeze <file>` then freezes the criteria, the reference date, one private qualifying example per prompt, the competitor rates and the run settings into `benchmarks/.local/people-search/frozen/plan.json` with its digest. It refuses draft criteria, a missing or wrong-type example, and any change to a plan already frozen. Per-step spend approval is recorded separately. Model choices have no effect on the app until explicitly configured on the development deployment.

The CLI supports `--help`, `--plan`, `--check-env`, `--freeze <file>`, `--offline-run <file>`, `--live <step>` (with `--resume-held`), `--dry-run [step]`, `--reset`, `--publish <run-id>`, and the quick check: plain `pnpm benchmark` with optional `--model <id>` and `--learning on|off|both`, `--capture-replay <file>` and `--restore-model`. With no options it runs the quick check once a replay set has been captured, and prints help until then. `--live` runs one paid step (see Running a step) and is the only command that starts a workspace; the quick check and its capture also make paid calls (see Quick check). `--dry-run` runs the same pipeline on synthetic data with no network and no deployment. Offline execution validates frozen inputs and exercises checkpoint storage using saved JSON. `--reset` contacts the deployment only when a live step was left open (see Live steps); no command deploys code.

The harness will reuse ReacherX's setup, prospecting and qualification logic through internal Convex hooks. Shared runner, spend, evidence, judging and statistics code belongs in `core/`; benchmark-specific plans and adapters belong in `people-search/`. People and organizations need distinct identities and grading. The learning-off condition must be scoped to benchmark workspaces and preserve ordinary deduplication, newer-post fetching and scheduled broadening.

## Layout

```text
benchmarks/
  cli.ts                         Setup, live step, dry run, offline run and reset commands
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
    steps/
      units.ts                   One checkpoint per unit of live work; started-unfinished units held for review
      balances.ts                Free balance endpoints (OpenRouter, SocialAPI, Renidly, Treg), step budget
      keyGate.ts                 No judge or harness model call while a workspace runs
      interrupt.ts               Ctrl+C stops new work; the reset always finishes
    calls/
      http.ts                    Provider transport: live (one attempt), recording, exact replay
      llm.ts                     Structured OpenRouter calls, recorded and replayable
      rates.ts                   Frozen rates and funding applied to observed usage
    judging/
      identity.ts                Person/company identity keys and cross-tool repeat flags
      evidence.ts                Tavily web evidence, two searches per result, shared cache
      judges.ts                  Blind inputs, judgment validation, two-judge panel with tie-break
      judgeModel.ts              OpenRouter judge calls (own key, or the shared deployment key)
      judgeCandidate.ts          Evidence plus panel for one result, private case record
      labels.ts                  Human label sample, booklet, sheet and kappa gate
    analysis/
      metrics.ts                 Section 4 measures
      stats.ts                   Wilson, paired bootstrap, Holm, Cohen's kappa
      report.ts                  Markdown and JSON aggregate reports
      publish.ts                 Public results: aggregate-only guard, Markdown and JSON writer
      preview.ts                 Vendor preview: one tool's own results, private, for 3 days
  people-search/
    setup/
      plan.ts                    Approved prompts, categories, models and run policy
      filters.ts                 Shared prompt-to-filter step and per-tool coverage
      criteria.ts                Each prompt's requirements and definitions (draft until agreed)
      rates.ts                   Frozen competitor rates; quota units stay unpriced
      freeze.ts                  Frozen plan: criteria, reference date, examples, rates, settings
      schedule.ts                What each step runs: prompts, conditions, cycles, labels, competitors
    steps/
      pipeline.ts                One step: approval, budget, live session, phases, outcome and reports
      workspaces.ts              ReacherX, one checkpointed workspace at a time
      competitors.ts             Shared filter step, then each adapter one request at a time
      judging.ts                 Judged targets, evidence cache, blind panel, human label sheets
      reports.ts                 Step report, comparisons, learning measures, decision inputs
      live.ts                    Live wiring: environment, approval file, real providers
    dryRun/
      dryRun.ts                  The pipeline at $0 on synthetic data, in a temporary folder
      deployment.ts              Simulated development deployment and cycles
      providers.ts               Synthetic provider answers, balances, harness model and judges
    run/
      reacherx.ts                ReacherX top-K, rejected sample, export-to-entity mapping
      replay.ts                  Frozen qualification input and replay contract
    quick-check/
      deployment.ts              Replay hooks through the Convex CLI, dataset upload, model setting
      linkedPages.ts             Linked pages read once through Exa: 2 per candidate, $1.20 in total
      capture.ts                 Seeded draw of judged cases, capture, private copy, upload
      runner.ts                  Batched replay, model change and restore, model check on every call
      scoring.ts                 Agreement, precision, recall, wrong accepts and rejects, report
    analysis/
      decisions.ts               D1-D4 conditions and the one-page checkpoint report
      round1.ts                  Exact re-score of round one's saved verdicts
    reports/
      D1.md                      Decision point D1 after the smoke test (aggregate figures only)
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
    steps/                       Unit checkpoints, balances and budget, key gate, interrupts
    calls/                       Transport replay and rate pricing
    judging/                     Identity, evidence, judges and human labels
    analysis/                    Measures, statistics and reports
    people-search/               setup/, run/, analysis/, steps/, dryRun/ and quick-check/
    tools/                       Adapters against saved responses; organizations/ covers every company path
```

Each folder holds at most six files; a larger group is split into purpose-named subfolders.

Tests sit apart from the code, grouped by purpose, and import it from `core/` and `people-search/`. Add a new test file to the group it checks; a new group needs no script change.

Implemented: the offline runner and checkpoint storage, the Convex driver, the spend guard, all eight competitor adapters (people and company paths), the shared filter step, Tavily evidence, the judge panel and its orchestration, human labels and the kappa gate, every section 4 measure, the decision-point checks and report, statistics and report rendering. The live session (run settings, provider key swap, production parity and the reset that always runs) and the workspace runner (cycle counting and capping, the wait for qualification and lessons, per-cycle timing and spend) are implemented and tested against a simulated deployment. The step schedules and the `--live`/`--dry-run` pipeline that composes them with the adapters, judging, reports and decision points are implemented and tested end to end against simulated services. The quick check (replay capture, batched replay, model check and scoring) and the public results and vendor preview writers are implemented and tested against simulated services. Adapter endpoints and filter names come from public documentation; the smoke test confirms them, and anything a tool cannot express is recorded in its receipt as unexpressed rather than dropped. Treg-routed calls record the provider that served them. Crustdata uses indexed search through Treg with explicit response fields. Clay and Firecrawl use a recorded harness model call (Clay to write its query from Clay's reference, Firecrawl to extract one entity per page); every model and HTTP exchange can be replayed at $0. Hard credit limits on the OpenRouter keys are set by the key owner; the spend guard stops a step in software before that.

## Offline runner

Once a frozen run file and its saved JSON artifacts exist, run or resume them with:

```sh
pnpm benchmark --offline-run benchmarks/.local/people-search/offline-run.json
```

The file shape is `{ "manifest": ..., "units": [...] }`, validated by `offlineRunFileSchema` in `core/setup/manifest.ts`. The manifest records the proposal reference, all 20 approved tasks with fixed criteria, one reference date, the seed, reference-example artifacts mapped to each task, and rate/runtime snapshot references. Compute `planSha256` with `getPlanDigest` after freezing those fields. Use `execution: { "mode": "offline" }`; no spending approval is invented for an offline run. Live manifests require a separate explicit approval structure and are rejected by this runner even if one is supplied.

Each work unit has an opaque ID, run/task/tool IDs, a saved JSON `input` artifact (`path` and SHA-256), and a cycle/learning condition or `null`. Artifact paths must stay under `benchmarks/.local/`. `tests/execution/runner.test.ts` includes synthetic examples of the complete format and a CLI integration test. They are storage tests, not benchmark findings or approved criteria.

The default CLI executor copies each verified saved JSON input into its own result artifact. Future offline pipeline stages can supply pure executors through `runOfflineUnits`; remote adapters must not be wired into this path. Output prints counts and a private checkpoint-report reference, never the raw response. This does not freeze or approve the still-incomplete research plan in `people-search/setup/plan.ts`.

State lives under `benchmarks/.local/runs/<run-id>/`: `frozen-run.json`, `checkpoints/`, `results/`, and `checkpoint-report.json`. Directories use mode `700`; written files use `600`. Writes flush to disk and replace a complete checkpoint atomically. One exclusive `benchmarks/.local/runner.lock` excludes other runs in this checkout. Use a local filesystem, not a shared/network drive.

On resume, the original manifest and work order must match, and input/result hashes are rechecked. Completed units are reused; only pending units execute. A `started` or `needs-review` checkpoint, missing state, changed artifact or corrupt record stops the run. A crash can leave a lock file; inspect the recorded process and outstanding work before removing it. The runner never expires locks, resets uncertain work, or deletes results automatically. These are deliberate stopping points, not an exactly-once guarantee for future remote services.

## Live steps

`core/execution/liveSession.ts` wraps one live step (proposal 5.3 steps 1 and 6). It first checks, without changing anything, that the deployment is at rest (jobs paused, automatic cycles off, no learning switch, pool limits, keyword post-search cap or LinkedIn kill switch left set), that the deployment's OpenRouter key is the local `OPENROUTER_API_KEY` whose spend is measured, and that no other workspace is running or due to restart. It then writes a private session record (`benchmarks/.local/live-session.json`, mode 600) holding the recorded settings and the development SocialAPI and LinkdAPI keys, and only then installs the funded keys through stdin, sets the frozen production and run-only values, confirms each by reading it back, sets the step's keyword post-search cap, unpauses jobs and applies the pool limits.

The reset runs whether the step succeeds, fails or is interrupted: it stops the tracked workspace (deleting its SocialAPI monitors while the funded key that created them is installed), clears pool limits and the keyword post-search cap, pauses jobs, restores every recorded setting, then restores the development keys and confirms them. The SocialAPI key is restored only after the monitors are gone. Anything it cannot finish keeps the session open and is reported; after fixing the cause, `pnpm benchmark --reset` repeats it. Once complete, the record keeps no key.

`core/execution/workspaceRun.ts` runs one workspace (step 2). Automatic cycles are on only when another cycle must follow; once the last planned cycle starts they are turned off, and any next cycle the deployment scheduled anyway is canceled, so the workspace keeps running until qualification and lesson writing settle (two quiet polls). A cycle beyond the plan stops the workspace at once and is recorded. Each cycle records its start, the end of discovery, when it settled, when the next cycle started (for the last cycle, when it was due), and the deployment key's spend at its boundaries; the first cycle includes the workspace's setup cost. Failed cycles, halted workspaces, timeouts, budget stops and interruptions end the workspace with the reason recorded, and it is always stopped and exported.

One OpenRouter key may serve the deployment, the judges and the harness's own model calls; the project lead agreed this change from the proposal's two keys on 15 Nov 2026. `BENCHMARK_JUDGE_OPENROUTER_API_KEY` is therefore optional. With a shared key, judge and harness calls must never run while a ReacherX workspace is running, because that workspace's cost is the key's spend before and after it; their own cost comes from each call's reported cost. Jev's pre-filter, which production runs in shadow mode only to collect evaluation data, stays off during runs.

## Running a step

```sh
pnpm benchmark --dry-run          # every step on synthetic data, $0, no network or deployment
pnpm benchmark --dry-run pilot    # through one step, printing only its reports
pnpm benchmark --live smoke       # then pilot, main, stage2, each after its decision point
pnpm benchmark --live smoke --resume-held  # continue a workspace held after a budget stop
```

`--live <step>` loads the frozen plan (`benchmarks/.local/people-search/frozen/plan.json`) and rechecks its digest and artifacts, then runs the step's next unfinished part from `people-search/setup/schedule.ts`: ReacherX one workspace at a time inside the live session, the competitors one request at a time (raw responses and model calls kept only in the run's private folder), then the judges. It ends with the step report and, at a decision point, the one-page checkpoint report, both printed and written under `benchmarks/.local/runs/<run-id>/`. Stage 1 is the smoke test (company prompt 14, competitors on it, D1), the pilot (prompts 1 and 6, four cycles per condition, D2) and the main run (17 first cycles, competitors on the other 19 prompts, D3). Stage 2 runs a third of its paired workspaces and stops at D4; the same command then runs the rest and judges all of them. A step cannot start before the earlier ones are complete. The smoke and pilot prompts are fixed by rule in `schedule.ts`, since the proposal does not name them.

Each part needs its approval in `benchmarks/.local/people-search/approvals/<part>.json` (`smoke`, `pilot`, `main`, `stage2-first`, `stage2-rest`):

```json
{
  "segment": "smoke",
  "spend": {
    "approvalReference": "D0: smoke test approved",
    "approvedAt": "2026-11-16T09:00:00Z",
    "accountLimits": [
      { "accountId": "openrouter:<fingerprint>", "maxAdditionalUsd": 1.5 },
      { "accountId": "socialapi:<fingerprint>", "maxAdditionalUsd": 0.5 },
      { "accountId": "treg:<fingerprint>", "maxAdditionalUsd": 0.5 }
    ]
  },
  "credits": [{ "accountId": "renidly:<fingerprint>", "maxCredits": 30 }],
  "stage2": {
    "staticPrompts": 3,
    "cyclesPerWorkspace": 6,
    "plannedCycleCostUsd": 0.5
  }
}
```

`keywordPostSearchCallsPerCycle` (optional) is the step's keyword post-search cap per workspace cycle; it defaults to 50 and `null` turns it off. `matchLimitPerCycle` (optional) is the step's match limit per workspace cycle, fixed for the step; absent or `null` means none. `matchLimitPerQuery` (optional) is the step's match limit per workspace over all its cycles, fixed for the step the same way. `stage2` is for the stage 2 parts only. D4 may shrink the rest, never grow it: the prompts the first third already ran stay in, the people static prompts are topped up in the seed's draw order, and a size that cannot hold the static prompts already run is refused. An account ID is the provider and the first ten hex digits of the key's SHA-256; a step that names the wrong accounts is refused with the IDs it needs. Before anything changes, every account is read from its free endpoint (OpenRouter `/api/v1/key` and `/api/v1/credits`, SocialAPI `/user`, Renidly `/api/i/v1/credits/balance/k/`, Treg `/orgs` then `/orgs/{id}/balance`), and the step is refused when one holds less than its approval still needs. SocialAPI's `/user` reports its balance in US cents; it is converted to dollars. If the deployment key may not read `/api/v1/credits` (HTTP 401 or 403), the key's own remaining limit is used and the balance report says so.

Cost of record: the deployment's OpenRouter key is not shared with production, so its spend before and after each cycle (one workspace at a time) is ReacherX's AI cost; it is checked between status polls. The funded SocialAPI and Renidly keys are also production's, so their balances never measure a workspace: ReacherX's X and LinkedIn use comes from the deployment's own records for the workspace (`runCosts` and `linkdApiUnitsSince`), priced at the frozen SocialAPI rate of $0.20 per 1,000 tweets or users, with Renidly credits kept as units. Their approved amounts are checked against those records before each workspace and again between status polls, where reaching one stops the workspace as a budget stop naming the account, and their balances only show there is enough left (before the step and before each workspace) and are recorded as a clearly labelled account change. Treg and the judge key are checked before each of their units. Exa, Tavily, Clay, Firecrawl and context.dev have no balance check here; their per-call cost or units are recorded and reported. If the closing balance read fails after paid work (three tries), the step's costs are marked incomplete and cost-based decision conditions show as unknown until a rerun reads them.

Every unit (a workspace, a filter translation, a competitor request, a judged result) has its own checkpoint. Running the same command again resumes: completed units are reused, and a unit that started without finishing, or failed, is held for review and never repeated automatically. So that an outage (the deployment or a provider down) holds only a few units for review, the step halts after the first failed workspace or three failed units in a row elsewhere; a workspace that reaches the approved spend stops the step as a budget stop. To repeat one deliberately after review, delete its checkpoint file. A rerun with nothing left to do only re-renders the reports and contacts nothing; this is how the pilot reads its label sheet (`benchmarks/.local/people-search/labels/pilot/sheet.csv`) once both people have filled it, for D2. The approved amount counts from the step's first start, across resumes.

A workspace held after a budget stop or an interruption can be continued instead of rerun: `pnpm benchmark --live <step> --resume-held`. Inside the usual live session (settings, key swap, caps, guard, reset) the same workspace is run again at the cycle it stopped in (`resumeWorkspace` in `core/execution/workspaceRun.ts`, `resumeHeldWorkspace` on the deployment): automatic cycles are confirmed off, the deployment refuses unless the cycle's discovery workflow has ended, cancels any scheduled cycle start, marks the workspace running without starting a workflow, and requeues its undecided prospects for qualification (clearing the retry backoff the stop left), its qualified, unenriched prospects for enrichment, and its lesson writing. No discovery cycle starts; one that appeared would end the continuation at once. The runner waits until qualification, enrichment and lessons settle, then stops and exports the workspace. Its earlier use counts against the step's approval (so raise the approval first), the old checkpoint is copied to the run's `held/` folder and its receipt stays in `results/`. The report labels the workspace "resumed after a budget stop" and splits its AI spend into before the stop, between stop and resume, and the continuation, with LinkedIn and X use before and since; its cycle cost is the combined cost on the deployment key and its active time leaves the pause out. D1 lists it under "Everything recorded correctly" so the decision sees the cycle was stitched. Only the last planned cycle of a workspace confirmed stopped can be continued; the step then carries on to competitors, judges and the decision report as usual.

While a workspace runs, the approval file is read again before each status poll. Higher amounts apply from that poll; a lower amount never lowers the approval during the step, and a missing or invalid file keeps the approval in force. Each change, and each ignored one, is logged once.

When the guard stops a workspace (or the step is interrupted) the stop is firm: the runner first sets `BENCHMARK_HALTED_WORKSPACE_ID`, a development-only kill switch that makes the deployment refuse every LinkdAPI reservation before it reaches the provider, then calls `stopRun` with `halt`, which also cancels the qualification and enrichment workflows already running for the workspace's prospects, so they take no further step. A step already executing finishes (OpenRouter has no reservation point to refuse, so at most that step's model call completes). The reset removes the switch, and the at-rest check refuses a step while it is set.

Ctrl+C (or SIGTERM) stops new units; the running workspace is stopped and exported and the deployment reset runs before the command exits with code 130. Further Ctrl+C presses only print a reminder: the handlers stay installed until the reset is done, and Convex CLI calls run in their own process group so the terminal's signal cannot kill a reset command halfway. If the process is killed hard, `pnpm benchmark --reset` finishes the reset. The workspace that was interrupted is held for review.

The harness's own model calls (the shared filter step, Clay query writing, Firecrawl extraction) use `models.harness` in `plan.ts`, on the judge key or the shared key, and like the judges they never run while a workspace is running.

## Quick check (replay)

`pnpm benchmark --capture-replay <file>` freezes about 300 judged ReacherX results (a seeded draw spread over prompts and both labels) with everything qualification read: evidence posts, profile, targeting, the workspace policy with and without learned lessons, and up to two linked pages per candidate read once through Exa ($1.20 cap). The input file is private: `{ setId, seed, cases }`, built with `judgedReacherXCases`. The set is kept in `benchmarks/.local/people-search/quick-check/<setId>/` and uploaded byte-for-byte to the development deployment's file storage, where its digest is checked. Learning context is rebuilt at capture time, so capture soon after the run. The learning-off pass names each workspace in the learning switch only while its policy is read.

`pnpm benchmark` replays the set through `qualifyProspectCore` on the deployment, in batches of 25, and scores the decisions against the judges' labels: agreement, precision, recall, accepted-but-not-a-match, rejected-but-a-match, and the share matching the original run, each with a Wilson interval, plus recorded cost and the key's spend. `--model <id>` sets `AI_ONBOARDING_MODEL` only while the replay runs and restores it afterwards, even on failure (`--restore-model` finishes a restore a crash left open); every recorded call must use that model. `--learning off|both` replays without learned lessons. The deployment must be at rest with no workspace active and no live step open. The spend stop is $1.65 per condition. Decisions stay private; the printed report holds aggregates only.

## Public results and vendor previews

`pnpm benchmark --publish <run-id>` publishes a step after its private report has been reviewed: `writePublicResults` writes `<runId>.md` and `.json` to `benchmarks/people-search/results/` only after the report passes a strict aggregate schema and a scan for personal fields, links and email addresses, with every label checked against the plan's prompts, categories, tools, providers and units; any finding writes nothing. `writeVendorPreview` writes one tool's rows, requests and returned results with their verdicts to `benchmarks/.local/people-search/vendor-preview/<runId>/<toolId>.{md,json}` for the 3-day preview.

## Development hooks

The backend entry points from proposal section 5.2 are internal Convex functions, called through the authenticated CLI by `core/execution/convex.ts`:

- `convex/benchmarkPeopleSearch.ts`: `prepareWorkspace` creates a workspace from the prompt with production setup models but does not start it; `startWorkspace` starts discovery afterwards, so the learning condition is applied first. `runStatus`, paginated `exportCandidates` (factual fields, no contact details), `runCosts`, `linkdApiUnitsSince`, `stopRun` (pause, cancel, remove SocialAPI monitors; with `halt`, also cancel the prospects' running qualification and enrichment workflows), `cancelScheduledCycles` (cancels a benchmark workspace's scheduled next cycle or automatic restart without pausing it), `resumeHeldWorkspace` with `markResumedInternal`, `requeueForResumeInternal` and `prospectWorkPage` (continue a held workspace's cycle without discovery), `deploymentActivity` (running workspaces and pending restarts) and `resetLinkdApiCircuit` support the run. These functions must be pushed to the development deployment, with approval, before the smoke test. `deleteBenchmarkWorkspace` is for approved manual cleanup only; the runner never deletes.
- `convex/benchmarkReplay.ts`: `replayQualification` passes frozen cases from dev file storage to `qualifyProspectCore`, at most 25 per call, sequentially. Each case carries its capture time (`now`), so post ages and "today" match the original run. Learning-off replay uses the case's operator-only policy and no lessons or similar cases. `replayUsageSince` lists the models recorded for a replay's calls. `captureQualificationInputs` (benchmark workspaces only, stored data only), `createDatasetUploadUrl` and `replayDatasetInfo` support capture; a stored dataset must carry the benchmark's `kind` marker. Like the other hooks, these must be pushed to the development deployment, with approval, before first use.
- The learning switch is the development setting `BENCHMARK_LEARNING_OFF_WORKSPACE_IDS` (`convex/lib/benchmarkLearningControl.ts`). For the named workspaces only, discovery receives no learned lessons, query scores or recent winners; qualification receives operator instructions only and no similar past cases; social queries rotate by oldest use without ranking or the cold-query pause. Operator instructions, deduplication, newer-post fetching and scheduled broadening are unchanged. It is never set in production. The driver names only the active control workspace, because one workspace runs at a time.

`core/execution/convex.ts` currently serves only the people-search benchmark: its function names are kept together in `PEOPLE_SEARCH_HOOKS`, the one place `core/` depends on people search. It will be generalized when a second benchmark needs it.

The driver records and restores an allowlist of non-secret settings (`RUNTIME_SETTINGS`) and passes values on stdin.

Starter runs at most 8 scheduled jobs at once, while production asks for 64 workflow slots plus 10 qualification and 10 enrichment workers. `BENCHMARK_POOL_LIMITS` (development only, `convex/lib/benchmarkConcurrency.ts`) sets the workflow manager and every legacy worker pool together from one JSON value. The workflow manager reads it on each start; `tenantScheduler.reconcilePoolConfigurationInternal` applies it to the pools. The workpool component has no read API, so `poolLimitsStatus` reports the limits from the same resolver both use, and `applyPoolLimits` in the driver stops unless the deployment confirms exactly the requested values. An invalid value never changes behaviour; it reports an error instead. Reconciliation is skipped while autonomous jobs are paused, so the runner applies limits after unpausing and clears them before pausing again. The smoke test measures the resulting runtime; the limits themselves are a D1 decision, not fixed here.

`BENCHMARK_KEYWORD_POST_SEARCH_LIMIT` (development only, `convex/lib/benchmarkLinkdApiCap.ts`) caps one kind of LinkdAPI call: enrichment's search of each qualified LinkedIn prospect's own posts for nine finance keywords (up to 18 calls a prospect), which made 656 of the smoke test's 1,051 calls. Only that search marks its calls (`KEYWORD_POST_SEARCH_PURPOSE`); discovery searches, profile and company reads, and every search qualification makes are never counted or refused, so qualification and prospect typing (`/company/` URLs and company data) are unchanged. The search feeds only enrichment's finance and pain-point evidence: enrichment runs after a prospect is qualified, and qualification skips prospects already decided. Each call takes a reservation in `convex/linkdapiBudget.ts`; calls carry no workspace, so they count against the cycle (prospecting workflow) of the benchmark workspace that started last, and workspaces not named `Benchmark ...` are never counted. A call past the cap is refused before it reaches the provider, as an open circuit refuses it, without opening the circuit; the search then stops and enrichment carries on with the posts it already has. The default of 50 covers about three prospects' full searches per cycle. Unset means no cap; an invalid value never changes behaviour and is reported by `keywordPostSearchLimitStatus`, which the runner reads to confirm the cap. The cap is step-only (the approval's `keywordPostSearchCallsPerCycle`), never part of the frozen run settings, and each step report states whether it was in force. It is never set in production.

`BENCHMARK_MATCH_LIMIT_PER_CYCLE` (development only, `convex/lib/benchmarkMatchLimit.ts`) limits the matches a benchmark workspace's cycle produces, through production's plan-limit gate (agreed by the project lead, 17 Nov 2026). A cycle's matches are the prospects qualified since its `prospectingWorkflowStartedAt`, counted as the plan limit counts them. Once a cycle has N, the execution-time gate (`checkBackgroundWorkAllowedInternal`, reason `benchmark_match_limit_reached`) and the qualification recovery claim park further qualification as they do at a plan limit; qualifications already running finish, so a cycle can end a few over N. Enrichment then stays open only for the cycle's first N matches by `qualifiedAt` (then by prospect ID within one millisecond, so exactly N); the overshoot and earlier cycles' matches are parked. The cycle-start limit check never reads it, so the workspace is never put in `limit_reached`, no plan-limit notification is sent, this limit never stops a cycle from starting or being rescheduled (the limit per query below can), and each new cycle counts from zero. `runStatus` reports `matchLimit` (the limit, this cycle's matches, whether it is reached, and the pending and enrichment work it parked); the runner counts parked work as finished when deciding a cycle (or a continuation) has settled, while lessons still have to finish, and under a limit a cycle also waits for its unparked enrichment (uncapped cycles do not, as before). It is step-only (the approval's `matchLimitPerCycle`), never part of the frozen run settings: set before jobs unpause, confirmed through `matchLimitStatus`, cleared by the reset and refused by the at-rest check. Because a continuation can run with a different value than the cycle it continues, the limit is recorded on each workspace run and each continuation, never as a step setting; the step report gives one line when every run had the same value and otherwise states it per workspace (for example, no limit during the cycle and 20 from a later resume). Workspaces not named `Benchmark ...` are never limited, and it is never set in production.

`BENCHMARK_MATCH_LIMIT_PER_QUERY` (development only, same file) limits the matches a benchmark workspace produces over all its cycles (agreed by the project lead, 17 Nov 2026: 100 per query). Each cycle may qualify only what earlier cycles left: its limit N is the lower of the limit per cycle and the limit per query minus the matches qualified before the cycle started (never below 0, when everything is parked), and everything above (the gate, the recovery claim, enrichment of the cycle's first N, the parked work) uses that N. Unlike the limit per cycle it also mimics a used-up plan at the cycle start: a cycle that starts with the workspace's matches already in ends at once as `limit_reached` and schedules no next cycle (reason `benchmark_query_limit_reached` in its memory event), without the plan-limit capacity reconcile or notification. `runStatus` adds `queryLimit`, `queryMatches` and `queryReached` to `matchLimit`. Once `queryReached` turns true before the last planned cycle, the runner treats the current cycle as the last: it turns automatic cycles off, cancels any next cycle, waits for the cycle to settle, and ends the workspace `match-limit-per-query`, a completed ending recorded with the cycle it was reached in (`queryLimitReached`); a cycle the deployment ended at its start is not counted. It is applied, confirmed (`matchLimitPerQueryStatus`), cleared, recorded and reported exactly like the limit per cycle, from the approval's `matchLimitPerQuery`. Unset means no limit and reads nothing; it is never set in production.

The eventual runner must keep one workspace active, wait for qualification and lesson writing, and restore the development settings after success or failure. Checkpoints with uncertain billing stop for review instead of automatically repeating a request. Read actual effective workflow and worker limits; setting a single concurrency env variable is insufficient. Persist private outputs under `benchmarks/.local/people-search/`. Create `people-search/results/` only when reviewed aggregate results exist.

Blind inputs are built from explicit factual fields with a new opaque case ID. Provider IDs, ranks, fit scores and generated verdicts stay outside the judging input. Statistics use Wilson intervals for binary proportions only and a seeded paired bootstrap over prompts within a category, with Holm correction across comparisons; single observations remain descriptive.

Implementation references: [Convex internal functions](https://docs.convex.dev/functions/internal-functions), [Convex CLI](https://docs.convex.dev/cli/overview), and the installed `ai`/OpenRouter SDK documentation. Provider prices and quotas must be checked before live steps; historical proposal balances are not current balances.

Store private responses, evidence, checkpoints and replay inputs in `benchmarks/.local/`, which is ignored by git. Keep local key files private. A separate judge OpenRouter key is optional (see Live steps). Never commit raw profiles or evidence. Ordinary frontend authentication, billing, email and Unipile credentials are not needed for these offline commands.
