# ReacherX reliability program — 2026-08-27

## Scope and production-signal boundary

This worktree starts at tenant-fair scheduler commit
`41ff14a7b1fd5ad1ac2b613ce890218a785d0a37`. No deployment, production write,
or destructive data operation is part of this change.

A fresh read-only `npx convex insights --prod --details` check was attempted
before implementation. It stopped locally with `No CONVEX_DEPLOYMENT set`;
the isolated worktree has no `.env.local` or deployment selector. The check did
not contact or modify production.

The source task supplied a fresh production heartbeat captured at 2026-08-27
16:39 UTC (21:39 Asia/Karachi):

- Scheduler mode remained globally enforced with Workflow 64 + tenant
  execution 36.
- 644 tenant jobs had succeeded; 0 were queued, running, or failed, and no lease
  was expired.
- Admission latency had degraded to p50 647 ms, p95 211,081 ms (about 3.5
  minutes), and max 239,581 ms (about 4 minutes).
- Permanent OCC failures in `tenantScheduler:enqueueTenantJobInternal` against
  `tenantJobLanes` increased from 9 to 10. The newest occurred at 2026-08-27
  21:07:36 Asia/Karachi.
- The other incident baselines remain 66 `prospects:createProspectsBatch`
  failures near 16 MB read per transaction and a setup workflow that retained a
  workflow ID while making no progress.

## Changes and invariants

### Tenant enqueue contention

`tenantJobs` is now the durable queue source of truth. Enqueue resolves its lane
through an immutable per-tenant binding, inserts a job without reading or
incrementing the mutable lane row, then schedules a lane activation.
Activation rebuilds exact `pendingCount`, `minPriority`, and ready/paused state
from the lane's indexed queued jobs. A one-minute bounded repair pass catches a
missed activation independently of the external heartbeat.

This preserves one fair lane per workspace, exact priority/queue ordering,
idempotency keys, workspace ownership checks, and pause semantics. It does not
replace the lane with a deployment-wide counter or another global write point.
The 100-job same-workspace concurrency test asserts one immutable binding, 100
durable jobs, and exact reconciled lane totals; activation can no longer make a
steady-state producer read `tenantJobLanes`.

### Prospect persistence read budget

All three production writers that call `createProspectsBatch` now use one
central persistence batch size of 5. The mutation rejects a larger internal
batch so a future caller cannot silently reintroduce the large transaction.
Twitter, LinkedIn, and setup-preview writers retain every input and combine the
per-batch results; no prospect is truncated or filtered by this change.

### Setup workflow self-healing

Setup workflow health now checks component status instead of treating a stored
ID as proof of progress. Machine-owned states become stale after 15 minutes.
The recovery path cancels an in-progress stale run best effort, starts the
replacement atomically with the session patch, increments a recovery revision,
and gives generation admission a revision-specific idempotency key.

Recovery is capped at three replacements. Exhaustion moves the session to a
clear `failed` state with a user-retry message. Human-wait states are never
classified as stale. A five-minute indexed internal repair pass checks at most
one stale row per machine status, so abandoned tabs recover without a full scan
or the external heartbeat.

### Provider circuit write amplification

Every provider call still appends a `providerRequestEvents` audit row. A stable,
closed circuit no longer rewrites its provider-wide state row on each healthy
request. Circuit state is written on failures and real recovery transitions.
The provider budget rows remain serialized intentionally: they implement exact
account-wide request spacing, and sharding them would change rate semantics.

### Scheduler observability and UI

The internal control status now exposes indexed oldest queue time/age, earliest
lease expiry, expired-lease sample counts, slot-count mismatch, claimed-slot vs
running-job mismatch, and the expected enforced pool split. The scheduler UI
keeps its live Convex subscription and existing tokens, but presents `Agent
working`, `Agent waiting`, `Agent paused`, and `Agent ready` rather than internal
queue terminology. Its live region is atomic.

Canonical enqueue-attempt and prospect-persistence-attempt logs include the
job kind/idempotency key or batch size before risky reads and writes. Convex
function failures can therefore be correlated even when no `tenantJobs` row
commits. A five-minute internal reconciliation reasserts the pool split from
the authoritative scheduler mode; the installed Workpool component exposes a
config update but no config-read API, so status reports the expected split and
the repair pass bounds external drift.

## Contention audit

| State                     | Write shape               | Finding                                                                         | Decision                                                                                       |
| ------------------------- | ------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `prospectSummaries`       | One row per prospect      | Naturally partitioned; the large batch amplified reads, not one global write    | Keep; batch writers at 5                                                                       |
| `workspaceStats`          | One row per workspace     | Every material prospect/notification change can contend within a busy workspace | Do not migrate without fresh per-table conflict evidence; candidate for striped workspace rows |
| `workspaceAnalyticsDaily` | One row per workspace/day | Prospect, activity, plan, and task triggers converge on today's row             | Same staged striped-row candidate                                                              |
| `workspaceAgentOpsDaily`  | One row per workspace/day | Keywords, candidates, evaluator runs, suggestions, and events converge          | Same staged striped-row candidate                                                              |
| Provider budget state     | One row per provider      | Deliberate serialization enforces exact request spacing                         | Keep; existing action-level bounded OCC retry is appropriate                                   |
| Provider circuit state    | One row per provider      | Healthy calls caused unnecessary writes                                         | Fixed by writing only state transitions                                                        |
| Action Retrier            | Component-owned run rows  | Component has indexed automatic cleanup after seven days                        | Keep; no duplicate app cleanup                                                                 |

Aggregate is a good fit for simple indexed counts, but these read models contain
reversible multi-field contributions, sums, and averages. A sharded/striped
read model is the safer candidate if production evidence crosses the migration
threshold below; neither component is introduced speculatively in this phase.

### Evidence threshold and widen–migrate–narrow outline

Start the migration only after read-only Insights attributes sustained permanent
OCC failures or material retry latency to one of the three workspace rows.

1. **Widen:** add striped rows and indexes; keep existing readers. Do not require
   a deployment-wide scan.
2. **Migrate:** dual-write deterministic source-based stripes. Backfill one
   workspace at a time with cursors and checkpoints, then reconcile old totals
   against summed stripes.
3. **Read cutover:** read summed stripes after per-workspace verification, with
   the old row as a temporary fallback.
4. **Narrow writes:** stop writes to the old row and observe at least one full
   analytics retention window.
5. **Cleanup:** remove old data/schema only in a separately approved destructive
   phase.

## Additive rollout

No full prospect scan or backup is required for this phase.

1. Deploy the additive schema first: optional setup recovery fields, the setup
   status/time index, the tenant-job status/queue-time index, and immutable lane
   bindings.
2. Run `tenantScheduler:backfillLaneBindingsInternal` in bounded cursor pages
   before peak traffic. This scans scheduler lanes only, not 60,000+ prospects;
   enqueue also has a lazy compatibility bridge for a missed lane.
3. Deploy function and UI code. Existing setup rows default to recovery revision
   and attempts of zero; they are updated only when touched or found stale.
4. Verify `tenantScheduler:getControlStatusInternal` with an operator-supplied
   current UTC timestamp. Confirm zero expired leases and no slot mismatches.
5. Monitor enqueue conflict count, `createProspectsBatch` bytes read, setup
   recovery warnings/errors, queue age, and provider-circuit conflicts.
6. Run fresh read-only Insights after an observation window before deciding on
   striped counters or cleanup.

### Post-rollout scheduler acceptance

Use the 2026-08-27 heartbeat above as the before measurement. Under a
representative same-workspace burst and the A=100, B/C=1 fairness shape:

- no new permanent `enqueueTenantJobInternal` / `tenantJobLanes` OCC failure;
- all accepted idempotency keys have a durable job or an explicit failed
  function execution log;
- 0 expired leases and no claimed-slot/running-job mismatch after drain;
- B and C begin while A remains backlogged, and 10/50/100 active-lane scans do
  not strand a lane;
- admission p95 materially recovers from 211,081 ms. Treat less than 30 seconds
  and at least an 80% reduction as the initial rollout gate, with max below 60
  seconds. Tighten the SLO after the first clean production window rather than
  treating this incident threshold as the long-term target.

Rollback is code-only while the additive fields/indexes remain. Do not remove
them during rollback.

## Verification

- Full Convex suite: 105 files and 528 tests passed.
- TypeScript: `tsc --noEmit` passed.
- Strict project lint: Oxlint passed with warnings denied.
- ESLint on every changed TypeScript/TSX file passed.
- Production Next.js build passed, including all 74 static/PPR pages.
- React Doctor changed-file score remained 85/100. Its remaining findings are
  bounded server mutation loops (ordered dispatch, paginated migration writes,
  cleanup, and deliberately sequential persistence batches), not the changed UI.
- The repository-wide ESLint baseline is not clean: `eslint .` reports 456
  issues in unrelated existing files, including bundled `.agents` scripts and
  pre-existing React compiler findings. This change does not modify them.

Fresh post-change production Insights remain pending because this worktree has
no production deployment selector or credentials. No production command was
initialized as a workaround.

## Cleanup candidates — no deletion in this phase

- `setupSessions:markWorkflowStartedInternal` has no current call site after
  atomic workflow start. Prove absence in production function logs before a
  cleanup commit.
- `PREVIEW_BATCH_LIMITS.previewProspectWriteBatch` has no current reader after
  centralizing persistence batches. Remove only with its compatibility cleanup.
- Legacy qualification, enrichment, preview, outreach-plan, and memory pools are
  still referenced by legacy/shadow routing and provide rollback capacity. Stop
  compatibility writes and observe no legacy/shadow use before removing their
  components or files.
- Scheduler `legacy`, `shadow`, and per-workspace override paths remain rollout
  safety mechanisms. Require an approved end-of-rollback-window decision before
  narrowing validators, tables, indexes, or documentation.
- Workflow/component records need a separate retention audit. Action Retrier is
  already covered by its component cleanup; do not add a competing cleanup job.
- Workspace deletion currently does not include scheduler lanes or their new
  immutable bindings. Add both to a separately tested scheduler-retention
  cleanup only after proving no queued/running references remain.
- No table or index should be removed based on static search alone. Pair code
  search with production function/table usage, stop writes, migrate if needed,
  observe, then use a separate destructive commit.
