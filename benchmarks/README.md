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

The CLI supports `--help`, `--plan`, `--check-env`, and `--offline-run <file>`. With no options it prints help. Offline execution validates frozen inputs and exercises checkpoint storage using saved JSON. It is not the complete adapter/judging pipeline described by `--dry-run` in the PDF. Live runs, qualification replay and the full dry-run pipeline still need implementation. No available command calls an API, deploys code, changes remote settings or starts a workspace.

The harness will reuse ReacherX's setup, prospecting and qualification logic through internal Convex hooks. Shared runner, spend, evidence, judging and statistics code belongs in `core/`; benchmark-specific plans and adapters belong in `people-search/`. People and organizations need distinct identities and grading. The learning-off condition must be scoped to benchmark workspaces and preserve ordinary deduplication, newer-post fetching and scheduled broadening.

## Layout

```text
benchmarks/
  cli.ts                       Offline setup commands
  core/
    types.ts                   People/company schemas, evidence and task types
    proposal.ts                Proposal integrity check
    env.ts                     Local credentials and dev-selection checks
    manifest.ts                Frozen plan and work-unit validation, stable digests
    checkpoints.ts             Private atomic storage and process exclusion
    runner.ts                  Sequential offline execution and safe resumption
    convex.ts                  Development driver and runtime snapshot contract
    spend.ts                   Usage/funding types and cost summary
    evidence.ts                Evidence provider and cache contracts
    judges.ts                  Blind inputs and judgment validation
    stats.ts                   Statistical method contracts
    report.ts                  Public aggregate report contract
    *.test.ts                  Offline contract tests with synthetic data
  people-search/
    plan.ts                    Approved prompts, categories, models and run policy
    replay.ts                  Frozen qualification input and replay contract
    tools/
      types.ts                 Adapter and documented capability contracts
      catalog.ts               Nine tools and their planned transports/top K
```

The offline runner and checkpoint storage are implemented. Spend-limit updates, live orchestration, evidence fetching, model calls, statistical algorithms and public report rendering are not implemented yet. The tool catalog marks every adapter as pending; it does not declare a task unsupported. Add each provider's implementation and documented capabilities when its endpoints are verified. Preserve native filter translations and the actual serving provider in private request receipts. Crustdata uses indexed search through Treg; optional enrichment is off by default.

## Offline runner

Once a frozen run file and its saved JSON artifacts exist, run or resume them with:

```sh
pnpm benchmark --offline-run benchmarks/.local/people-search/offline-run.json
```

The file shape is `{ "manifest": ..., "units": [...] }`, validated by `offlineRunFileSchema` in `core/manifest.ts`. The manifest records the proposal reference, all 20 approved tasks with fixed criteria, one reference date, the seed, reference-example artifacts mapped to each task, and rate/runtime snapshot references. Compute `planSha256` with `getPlanDigest` after freezing those fields. Use `execution: { "mode": "offline" }`; no spending approval is invented for an offline run. Live manifests require a separate explicit approval structure and are rejected by this runner even if one is supplied.

Each work unit has an opaque ID, run/task/tool IDs, a saved JSON `input` artifact (`path` and SHA-256), and a cycle/learning condition or `null`. Artifact paths must stay under `benchmarks/.local/`. `core/runner.test.ts` includes synthetic examples of the complete format and a CLI integration test. They are storage tests, not benchmark findings or approved criteria.

The default CLI executor copies each verified saved JSON input into its own result artifact. Future offline pipeline stages can supply pure executors through `runOfflineUnits`; remote adapters must not be wired into this path. Output prints counts and a private checkpoint-report reference, never the raw response. This does not freeze or approve the still-incomplete research plan in `people-search/plan.ts`.

State lives under `benchmarks/.local/runs/<run-id>/`: `frozen-run.json`, `checkpoints/`, `results/`, and `checkpoint-report.json`. Directories use mode `700`; written files use `600`. Writes flush to disk and replace a complete checkpoint atomically. One exclusive `benchmarks/.local/runner.lock` excludes other runs in this checkout. Use a local filesystem, not a shared/network drive.

On resume, the original manifest and work order must match, and input/result hashes are rechecked. Completed units are reused; only pending units execute. A `started` or `needs-review` checkpoint, missing state, changed artifact or corrupt record stops the run. A crash can leave a lock file; inspect the recorded process and outstanding work before removing it. The runner never expires locks, resets uncertain work, or deletes results automatically. These are deliberate stopping points, not an exactly-once guarantee for future remote services.

Backend entry points from proposal section 5.2 are still to be built: `convex/benchmarkPeopleSearch.ts` and `convex/benchmarkReplay.ts`. Use internal functions through the authenticated CLI, not public client actions. Preparation must allow the learning condition to be set before discovery starts. Replay inputs stay aligned with the production qualification parameter type and exclude runtime telemetry. Freeze the time/reference context as well as profile, post, linked-page and learning inputs before replay is enabled.

The eventual runner must keep one workspace active, wait for qualification and lesson writing, and restore the development settings after success or failure. Checkpoints with uncertain billing stop for review instead of automatically repeating a request. Read actual effective workflow and worker limits; setting a single concurrency env variable is insufficient. Persist private outputs under `benchmarks/.local/people-search/`. Create `people-search/results/` only when reviewed aggregate results exist.

Blind inputs are built from explicit factual fields with a new opaque case ID. Provider IDs, ranks, fit scores and generated verdicts stay outside the judging input. Statistical contracts reserve Wilson intervals for binary proportions and paired bootstrap for prompt-level comparisons within a category; single observations remain descriptive.

Implementation references: [Convex internal functions](https://docs.convex.dev/functions/internal-functions), [Convex CLI](https://docs.convex.dev/cli/overview), and the installed `ai`/OpenRouter SDK documentation. Provider prices and quotas must be checked before live steps; historical proposal balances are not current balances.

Store private responses, evidence, checkpoints and replay inputs in `benchmarks/.local/`, which is ignored by git. Keep local key files private and use separate OpenRouter keys for the deployment and judges. Never commit raw profiles or evidence. Ordinary frontend authentication, billing, email and Unipile credentials are not needed for these offline commands.
