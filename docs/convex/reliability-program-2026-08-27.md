# ReacherX reliability program — 2026-08-27

## Scope and production-signal boundary

This worktree started at tenant-fair scheduler commit
`41ff14a7b1fd5ad1ac2b613ce890218a785d0a37`. The initial implementation phase
made no production change except the explicitly approved scheduler control
rollback recorded below. PR #39 was later merged and automatically deployed
only after explicit approval. All later production control changes and the
bounded lane-binding backfill are recorded below; no destructive data operation
or full prospect scan was performed.

A fresh read-only `npx convex insights --prod --details` check was attempted
before implementation. It stopped locally with `No CONVEX_DEPLOYMENT set`;
the isolated worktree has no `.env.local` or deployment selector. The check did
not contact or modify production.

The source task supplied fresh production heartbeats captured at 2026-08-27
16:39 and 16:57 UTC:

- Scheduler mode remained globally enforced with Workflow 64 + tenant
  execution 36.
- 644 tenant jobs had succeeded; 0 were queued, running, or failed, and no lease
  was expired.
- Admission latency had degraded to p50 647 ms, p95 211,081 ms (about 3.5
  minutes), and max 239,581 ms (about 4 minutes).
- Permanent OCC failures in `tenantScheduler:enqueueTenantJobInternal` against
  one `tenantJobLanes` document first increased from 9 to 10, then jumped to
  290 by 21:27:44 Asia/Karachi. The persisted scheduler state was still drained
  at 644/644 succeeded and 36/36 free, proving these failures happened before a
  `tenantJobs` row and were absent from job telemetry.
- The other incident baselines remain 66 `prospects:createProspectsBatch`
  failures near 16 MB read per transaction and a setup workflow that retained a
  workflow ID while making no progress.

The 29x permanent-conflict increase plus four-minute tail latency made continued
enforced admission an active loss-of-work risk even though the persisted queue
was drained. The existing legacy route was selected as the temporary rollback
path until the hot-lane fix is deployed and its immutable lane-binding backfill
is complete.

### Production rollback checkpoint — 2026-08-27 17:30 UTC

Immediately before rollback, a direct read-only check against production
deployment `effervescent-viper-357` confirmed:

- scheduler mode `enforced`;
- 0 queued jobs, 0 running jobs, 0 ready lanes, and 0 paused lanes;
- 0 claimed slots and 36/36 free tenant-execution slots; and
- no workspace override forcing enforced admission.

At 17:30:48 UTC, the explicitly approved control mutation changed only the
global scheduler mode from `enforced` to `legacy`. A second direct check
confirmed mode `legacy` with the same drained queue and 36/36 free slots. No
code was deployed and no schema migration or backfill ran. This prevents new
work from entering the contended tenant-lane admission path while preserving
the legacy pools as rollback capacity.

A fresh read-only production Insights check after the mode change also found:

- `prospects:createProspectsBatch` bytes-read failures had increased from 66 to
  70; the newest was at 16:25:38 UTC and again read roughly 16.2 MB from
  `prospects` plus analytics, summaries, and related rows;
- Action Retrier `cleanupExpiredRuns` had 3 bytes-read failures, each reading
  16,864,513 bytes across 1,040 component `runs` documents; and
- the historical incident window still contained the supplied 290 permanent
  `enqueueTenantJobInternal` conflicts against the hot `tenantJobLanes` row.

At this checkpoint these were pre-fix observations, not evidence against the
local changes: the reliability commits had not yet been deployed. Production
remained in `legacy` through review, deployment, bounded lane-binding backfill,
and initial acceptance verification.

### Deployment, canary failure, and full rollback — 2026-08-27 18:00–19:11 UTC

PR #39 was merged as `d1785684ff94ad3eb8ff40cb12905368d2581471` after its
frontend checks were green. The frontend and Convex backend deployed
successfully. The bounded lane-binding backfill completed with one insert on
its first page and zero inserts on its idempotent rerun; it did not scan
prospects.

The user-owned `ReacherX (Leads old)` workspace first passed a shadow canary
with 139 admissions across qualification, enrichment, memory evaluation, and
auto-plan. It produced no unresolved enqueue failure or new enqueue/lane OCC.
Its enforced canary then exposed legacy Agent-component `memories` IDs in RAG
metadata being passed to a validator that accepted only canonical
`workspaceMemories` IDs.

A second explicitly approved enforced canary on the paid Hobby workspace
confirmed the same compatibility defect under broader traffic. Scheduler
capacity remained healthy and there was no new historical enqueue OCC, but the
domain gate failed with 30 jobs: 27 qualification and 3 auto-plan. The workspace
was stopped, its lane was resumed only long enough to drain 830 already-durable
jobs while prospecting and monitors remained paused, and the final memory jobs
were cancelled through the scheduler's idempotent cancellation path. The lane
was paused again before removing the override. The enforced override was then
removed and the paid workspace was restarted through the legacy workflow.

The 19:11 UTC post-cleanup heartbeat confirmed global `legacy`, zero overrides,
zero queued/running/claimed jobs, 36/36 free tenant slots, no expired lease, and
the paid workspace running. The last 1,000 scheduler rows were 996 succeeded, 3
historical auto-plan failures, and 1 cancelled job. A fresh read-only control
check on 2026-08-28 confirmed the same drained state, with one intentionally
paused lane and no ready lane, drift, or unresolved enqueue failure.

Convex Insights also reported two permanent conflicts in
`tenantScheduler:resumeWorkspaceInternal`: one at 18:35:17 UTC on the workspace's
`tenantJobLanes` row, and one at 18:35:28 UTC on the indexed `tenantJobs` range
while an enqueue committed. A fresh read-only Insights check on 2026-08-28
confirmed these exact events and no later permanent scheduler resume or enqueue
failure. This made synchronous resume reconciliation a separate release blocker
even though the queue later drained cleanly. Global enforcement remains blocked
until both the mixed-memory-ID reader and resume/recovery contention fixes pass
another enforced canary.

### Corrected rollout and fresh production window — 2026-08-28

PR #40 deployed the mixed-memory-ID and asynchronous resume fixes. After the
approved canary sequence passed, global enforcement was restored. A fresh
read-only production check against `effervescent-viper-357` on 2026-08-28
confirmed:

- global mode `enforced`, 36 configured tenant slots, and zero overrides;
- 0 queued, running, or claimed jobs; 36/36 slots free;
- 0 expired leases, unresolved enqueue failures, or pool/slot drift;
- one intentionally paused old lane and no ready lane; and
- no permanent scheduler enqueue/resume OCC event newer than the pre-fix
  incident timestamps.

The same Insights window provided the evidence for the next migration:

- `workspaceAgentOpsDaily`: 85 permanent OCC failures (29 apply, 27 finalize,
  29 claim) plus 8,837 Workpool wrapper retries and hundreds of direct retries;
- `workspaceAnalyticsDaily`: 12 permanent failures plus 23,110 Workpool wrapper
  retries and 200 direct `createProspectsBatch` retries;
- `workspaceStats`: 3 permanent failures plus 42 wrapper and 22 direct retries;
- `prospects:createProspectsBatch`: 74 historical bytes-read failures, newest
  at 2026-08-27 17:31:44 UTC, with no newer event after the batch-size rollout;
- `getWorkspaceFitScoreHistogram`: one 18.6 MB / 18,163-row read failure; and
- Action Retrier `cleanupExpiredRuns`: three daily 16,864,513-byte failures over
  1,040 component rows. Version 0.3.1 retains the same 1,024-row cleanup shape,
  so upgrading alone does not clear this backlog.

These rollup numbers cross the previously documented migration threshold. The
local follow-up therefore widens the schema with 32 deterministic stripes for
the three multi-field rollups. Existing rows remain immutable baselines; new
source-document changes write signed deltas, and readers combine baseline plus
stripes before clamping user-visible totals. This makes the cutover correct for
updates and deletes of pre-cutover rows without scanning 60,000+ prospects.

### Post-rollup stabilization incident — 2026-08-28

After PR #41 deployed, production remained globally enforced with the correct
Workflow 64 + tenant execution 36 pool split, no overrides, no expired leases,
and no new permanent enqueue/resume OCC. A one-workspace traffic burst exposed
two remaining hot-path problems:

- the queue reached 219 queued and 20 running jobs while 16 of 36 execution
  slots were still free; oldest queue age rose from about 370 to 386 seconds;
  the queue later drained without mutation, but the last 800 admissions retained
  p50 about 122 seconds, p95 about 439 seconds, and max about 474 seconds;
- `activateLaneInternal` accumulated about 4,007 OCC retries on
  `tenantJobLanes` and 2,524 on the queued `tenantJobs` range because every
  enqueue scheduled a full same-lane reconciliation; and
- `createProspectsBatch` bytes-read failures continued after the five-row batch
  mitigation, reaching 126, while new permanent OCC appeared on `prospects`,
  `prospectSummaries`, and `workspaceStatsStripes`. Each failed transaction
  repeated heavyweight identity reads and a full qualified-prospect capacity
  scan before the row could be persisted.

The queue recovery proves no durable scheduler job was lost, but it does not
meet the admission SLO. This evidence is the gate for the focused stabilization
branch; the deferred fit-score Aggregate branch remains unpushed until these
write-path failures are fixed and canaried.

## Changes and invariants

### Tenant enqueue contention

`tenantJobs` is now the durable queue source of truth. Enqueue resolves its lane
through an immutable per-tenant binding, inserts a job without reading or
incrementing the mutable lane row, then schedules a lane activation.
Activation now reads at most the first indexed queued job and stores only a 0/1
ready marker plus its priority. Once a lane is ready, duplicate burst
activations return without reading the queued range, rewriting the lane, or
pinging the dispatcher. Durable job rows remain the exact queue source, and the
workspace status query counts bounded indexed queued/running rows rather than
presenting the marker as a total. A one-minute bounded repair pass catches a
missed activation independently of the external heartbeat.

This preserves one fair lane per workspace, exact priority/queue ordering,
idempotency keys, workspace ownership checks, and pause semantics. It does not
replace the lane with a deployment-wide counter or another global write point.
The 100-job same-workspace concurrency test asserts one immutable binding, 100
durable jobs, and one ready marker; activation can no longer make a steady-state
producer read or update the mutable lane.

The per-tenant start limiter now matches the existing 240 starts/minute global
budget with an initial capacity of 36. Per-tenant slot caps remain the fairness
authority: one active workspace may borrow capacity, while 2, 3, 10, 50, or 100
active lanes immediately reduce its fair share. The measured 219-job burst is
therefore no longer forced past one minute by the old 60 starts/minute limiter.

Every action caller now uses a shared, bounded three-attempt recovery helper;
setup and plan-batch workflows put the same idempotent operation behind durable
retrying action steps. A separate `tenantJobEnqueueFailures` ledger is written
outside the failed enqueue transaction, counts each outer attempt, and changes
to `resolved` when the same idempotency key succeeds. Memory evaluation now
uses the pending event ID rather than a timestamp for its key and treats a
queued row without a work ID as a resumable intent instead of a completed
enqueue. Resolved diagnostics are retained for seven days; unresolved records
remain visible for operator action.

### Resume/recovery contention after the first canary

`resumeWorkspaceInternal` no longer reads or writes `tenantJobLanes` or scans
the queued `tenantJobs` range in the caller's transaction. It atomically
schedules an internal reconciliation mutation and returns. The scheduled
mutation resolves the lane and rebuilds its bounded ready marker with resume
enabled; Convex durably retries internal OCC errors, and duplicate resume
requests are idempotent. This removes both measured conflict surfaces from the
recovery call while preserving jobs enqueued before or after the resume request.

### Mixed legacy/canonical memory IDs

Semantic RAG metadata is now widen-compatible. Canonical
`workspaceMemories` IDs are normalized and read directly; legacy Agent
`memories` IDs resolve through the existing workspace-scoped
`by_workspace_and_legacy_memory_id` index. Unknown, cross-table, and
cross-workspace IDs are ignored, and duplicate old/new references hydrate one
canonical memory. The read is capped at 64 IDs. No schema change, full backfill,
or Aggregate component is required before redeploying this compatibility fix;
stale RAG entries can be reindexed later as a bounded cleanup.

### Prospect persistence read budget

All three production writers that call `createProspectsBatch` now use one
prospect per transaction. The mutation rejects a larger internal batch so a
future caller cannot silently reintroduce read amplification. Identity lookup
stops after a stable Twitter/LinkedIn actor match instead of also reading the
external-ID row, and pending discovery no longer repeats the full qualified
capacity scan already owned by the workflow gate and qualification transition.

Every one-row save is idempotent by stable provider identity and has a bounded
five-attempt action-level OCC retry after Convex's built-in retries are
exhausted. Twitter, LinkedIn, and setup-preview writers retain every input and
combine the per-row results; no prospect is truncated or filtered by this
change. This also covers measured conflicts in `prospectSummaries` and
`workspaceStatsStripes`, because those trigger writes remain in the same
one-prospect transaction and the entire idempotent operation is retried.

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
commits, and the control-status query now reports bounded unresolved enqueue
failures plus their newest timestamp. A five-minute internal reconciliation
reasserts the pool split from the authoritative scheduler mode; the installed
Workpool component exposes a config update but no config-read API, so status
reports the expected split and the repair pass bounds external drift.

## Contention audit

| State                     | Write shape               | Finding                                                              | Decision                                                                              |
| ------------------------- | ------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `prospectSummaries`       | One row per prospect      | Naturally partitioned; multi-row retries amplified heavyweight reads | Keep; one prospect per idempotent transaction with bounded OCC retry                  |
| `workspaceStats`          | One row per workspace     | 3 permanent failures and 64 measured retries                         | Widen to 32 deterministic signed-delta stripes                                        |
| `workspaceAnalyticsDaily` | One row per workspace/day | 12 permanent failures and 23,000+ measured retries                   | Widen to 32 deterministic signed-delta stripes                                        |
| `workspaceAgentOpsDaily`  | One row per workspace/day | 85 permanent failures and 10,000+ measured retries                   | Widen to 32 deterministic signed-delta stripes                                        |
| Provider budget state     | One row per provider      | Deliberate serialization enforces exact request spacing              | Keep; existing action-level bounded OCC retry is appropriate                          |
| Provider circuit state    | One row per provider      | Healthy calls caused unnecessary writes                              | Fixed by writing only state transitions                                               |
| Action Retrier            | Component-owned run rows  | Automatic cleanup permanently exceeds bytes read at 1,040 large rows | Upgrade to 0.3.1 and schedule per-run cleanup after terminal state is safely observed |
| Scheduler resume          | One lane + queued range   | Two permanent conflicts while enqueue traffic continued              | Fixed by durable, idempotent reconciliation outside the caller transaction            |
| Memory RAG ID hydration   | Up to 64 indexed reads    | Stale component IDs failed strict canonical-ID argument validation   | Widen reader; resolve through the existing workspace-scoped legacy-ID index           |

Aggregate is a good fit for the exact fit-score histogram: it can namespace by
workspace/filter scope and count ten bounded score bins without reading every
summary. It is not the right representation for the three hot read models,
which contain reversible multi-field contributions, hourly arrays, sums, and
averages. A Sharded Counter would require a separate counter for every field and
would lose coherent snapshots. The measured rollup contention therefore uses
striped application rows; the histogram remains a separate Aggregate migration
with dual writes, bounded per-workspace backfill, reconciliation, and only then
a read cutover.

### Evidence threshold and widen–migrate–narrow outline

The 2026-08-28 Insights snapshot crossed this threshold for all three workspace
rows. The implementation uses this no-global-scan variant:

1. **Widen:** add the three stripe tables and indexes while retaining the old
   baseline tables.
2. **Write/read cutover:** stop normal writes to the hot baseline row. Route each
   source document to one stable stripe and store signed change deltas. Readers
   atomically combine the old baseline with every stripe in range.
3. **Verify:** compare public/internal snapshots before and after insert, update,
   and delete traffic; monitor permanent OCC and retry counts by table.
4. **Compact later:** after an observation window, rebuild one workspace at a
   time into a fresh baseline and clear only that workspace's stripes while its
   writers are paused. This is optional for correctness, not a deployment gate.
5. **Narrow/cleanup:** remove old compatibility helpers or tables only in a
   separately approved destructive phase after a full retention window.

The Action Retrier follow-up similarly avoids a global component scan. Once a
caller observes a terminal result, it schedules idempotent cleanup one hour
later, after the caller has had time to persist its own outcome. This prevents
new terminal rows from feeding the oversized seven-day component cleanup. The
existing 1,040-row backlog still needs a bounded upstream/component maintenance
path; it is not safe to pretend the package upgrade alone repairs historical
state.

### Stripe rollout and rollback gates

This follow-up has not been pushed or deployed. When it is approved, treat the
baseline-plus-delta cutover as a data migration even though it needs no prospect
backfill:

1. Deploy the additive tables, readers, and writers together during a monitored
   window. The first post-deploy write creates a stripe lazily; untouched rows
   remain represented by the old baseline.
2. Compare the public/internal stats, analytics, and Agent Ops snapshots for a
   low-traffic workspace before and after insert/update/delete traffic.
3. Gate expansion on zero new permanent OCC for the three old hot tables, exact
   snapshot parity, bounded stripe counts (at most 32 per workspace/day), and no
   material increase in read latency.
4. Do not roll code back to a version that ignores stripes after stripe writes
   exist. A rollback must first pause the affected workspace writers and run the
   existing per-workspace stats/analytics rebuild plus the Agent Ops rebuild to
   fold current source truth into fresh baseline rows and clear that
   workspace's stripes. Only then is an old reader safe.
5. Keep the baseline and stripe schemas through at least one complete analytics
   retention window. Narrowing/removal is a separately approved cleanup phase.

The fit-score Aggregate follows a separate widen–migrate–narrow sequence: mount
and dual-write idempotently, backfill one indexed workspace page at a time,
reconcile counts, cut over the histogram query only for verified workspaces,
then stop the raw scan. It is intentionally not bundled into the rollup cutover
because its multi-filter namespace design and 60,000-row historical population
need their own load and migration gates.

## Additive rollout

No full prospect scan or backup is required for this phase.

1. Keep the scheduler in the already-established `legacy` rollback mode while
   the reviewed additive schema, function, and UI code are deployed together.
   This adds optional setup recovery fields, the setup status/time index, the
   tenant-job status/queue-time index, immutable lane bindings, and the
   enqueue-failure ledger without activating the repaired scheduler path.
2. Run `tenantScheduler:backfillLaneBindingsInternal` in bounded cursor pages
   before peak traffic. This scans scheduler lanes only, not 60,000+ prospects;
   enqueue also has a lazy compatibility bridge for a missed lane.
3. Resume tenant-scheduler admissions only after the binding backfill and
   scheduler diagnostics are clean. Existing setup rows default to recovery
   revision and attempts of zero; they are updated only when touched or found
   stale.
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
- all accepted idempotency keys have a durable job; all exhausted attempts have
  an unresolved failure-ledger row even when no job transaction committed;
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

- Full Convex suite: 105 files and 533 tests passed. New coverage proves three
  failed pre-row attempts produce one unresolved diagnostic, a later enqueue on
  the same key creates exactly one job and resolves it, and a memory queue row
  without a work ID remains retryable with the same event-based key. Plan-batch
  item replay also proves one atomic queued count and one tenant job. Follow-up
  coverage proves mixed old/new RAG IDs hydrate one canonical memory and that a
  job enqueued between resume request and reconciliation is retained exactly.
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

Fresh production Insights were captured after both the control rollback and the
corrected rollout as recorded above. No scheduler enqueue/resume permanent OCC
event is newer than the pre-fix incident window.

### Follow-up verification — 2026-08-28

- Full Convex suite: 107 files and 538 tests passed. New tests cover stable
  32-way distribution, signed baseline cutover updates/deletes, exact hourly
  analytics, exact Agent Ops failure reversal, and an end-to-end triggered
  prospect status transition against a pre-cutover baseline.
- TypeScript, strict Oxlint, changed-file ESLint, and `git diff --check` passed.
- The production Next.js build passed all 74 static/PPR pages.
- React Doctor scored 83/100. Its 22 findings are backend `await`-in-loop
  warnings; the changed loops intentionally serialize Convex writes, ordered
  component calls, or bounded deletion/rebuild operations. No React/TSX file
  changed in this follow-up.
- Convex/security review found no new public function, authorization surface, or
  client-supplied document ID. Public rollup readers retain their existing
  workspace ownership checks; the new Action Retrier cleanup entry point is
  internal and validates the component run ID with the package validator.
- Realtime behavior is preserved because the public readers remain reactive
  Convex queries; they now subscribe to both baseline and stripe index ranges.

### Focused stabilization verification — 2026-08-28

- Full Convex suite: 108 files and 546 tests passed. New coverage uses a 250 KB
  provider payload, proves stable actor identity makes an uncertain repeat
  converge on one prospect, rejects multi-row persistence, verifies 100 durable
  queued jobs behind one lane-ready marker, reports the real bounded queue count,
  and repairs a stale ready marker.
- The observed 219-job production burst is below the pure rate-budget
  one-minute gate after initial capacity; A=100/B=C=1 and 10/50/100-lane
  fairness coverage remains green.
- TypeScript, strict Oxlint, changed-file ESLint, `git diff --check`, and the
  production Next.js build with all 74 static/PPR pages passed.
- Convex review found no unbounded collection added: persistence is one row,
  activation reads zero rows for an already-ready/paused lane and at most one
  queued row otherwise, repair samples at most 100 queued jobs and 100 ready
  lanes, and the authenticated status query caps each indexed job range at
  1,001 rows.
- Security review found no new public write or authorization surface. The only
  changed public query retains `requireOwnedWorkspace`; scheduler and
  persistence writes remain internal, scheduled targets remain internal, and
  the provider `v.any()` payload is pre-existing and inaccessible to clients.
- No React/TSX or schema file changed in this focused hotfix. The production
  build is the proportionate React verification; no migration or backfill is
  required for deployment.

## Cleanup candidates — no deletion in this phase

The 2026-08-28 static call-site audit produced three different outcomes; they
must not be treated as the same kind of “unused” code:

- `setupSessions:markWorkflowStartedInternal` and
  `PREVIEW_BATCH_LIMITS.previewProspectWriteBatch` have definition-only static
  matches. Production function/config history is still required before removal.
- The six legacy Workpool modules have live imports in qualification,
  enrichment, outreach-plan, preview, and memory workflows, and the scheduler
  still updates their configuration for legacy/shadow rollback. They are active
  compatibility paths, not cleanup-ready.
- `planBatches:dispatchPlanBatchPage` is still reachable through
  `dispatchPlanBatchPageWithRetryInternal` from persisted workflow steps. Static
  reachability confirms it cannot yet be removed.

The audit also reconfirmed that workspace deletion does not own tenant scheduler
lanes/bindings. Adding blind row deletion would be unsafe because durable jobs
can still reference a lane. A future cleanup step must first pause admission,
cancel or drain the workspace's jobs, prove zero queued/running references, and
only then delete the binding and idle lane.

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
- `planBatches:dispatchPlanBatchPage` remains for workflows already persisted
  with the old mutation step. New workflows use per-item atomic retry. Prove no
  old workflow history can replay that step before removing the compatibility
  function in a later commit.
- New Action Retrier terminal rows now receive delayed per-run cleanup. The
  historical component backlog remains a cleanup candidate because the
  component's own 1,024-row mutation exceeds the bytes limit; clear it only via
  a reviewed bounded component/upstream path.
- Workspace deletion currently does not include scheduler lanes or their new
  immutable bindings. Add both to a separately tested scheduler-retention
  cleanup only after proving no queued/running references remain.
- No table or index should be removed based on static search alone. Pair code
  search with production function/table usage, stop writes, migrate if needed,
  observe, then use a separate destructive commit.
