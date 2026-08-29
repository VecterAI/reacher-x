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

### Transient admission under-utilization — 2026-08-28

A later enforced-mode burst produced a persistent single-workspace backlog
despite spare tenant-execution capacity. The incident peaked at 219 queued and
15 running with 21/36 slots free; a confirmation snapshot showed 198 queued,
20 running, 16/36 slots free, and an oldest queue age of about 386 seconds.
There were no failed jobs, expired leases, unresolved enqueue failures, or
pool/slot drift. The queue subsequently drained without any production
mutation, leaving 0 queued, 0 running, and 36/36 slots free while global
enforcement and the Workflow 64 + tenant execution 36 split remained correct.

Recovery does not make this window acceptable. Across the latest 800 completed
admissions, latency remained p50 about 122 seconds, p95 about 439 seconds, and
max about 474 seconds, well above the documented p95-under-30-seconds and
max-under-60-seconds rollout gates. Read-only code and Insights inspection
identified the fixed per-tenant 60-starts-per-minute token bucket as the
primary cause when one lane has short jobs; repeated whole-lane activation
reconciliation and `tenantJobLanes` OCC retries add secondary amplification.
Treat this as a recovered availability incident but an open scheduler SLO and
contention defect. Do not use the final drained snapshot alone as evidence that
admission performance passed.

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

### Fit-score Aggregate implementation (2026-08-28)

The separate `codex/fit-score-aggregate` phase implements the additive and
migration-safe portion without touching production data:

- mounts `@convex-dev/aggregate` as `fitScoreHistogramAggregate`;
- stores one item per non-preview prospect with a numeric score, namespaced by
  Aggregate version, workspace, platform, normalized prospect type, and status;
- keeps live write amplification to one idempotent Aggregate operation and
  skips all workspaces until an explicit rollout row exists;
- backfills only one paused/stopped workspace at a time in pages of at most 25;
- runs a separate source verification pass in pages of at most 100 and compares
  all ten bins with Aggregate before marking the workspace verified;
- uses revision plus cursor tokens so duplicate or superseded scheduled pages
  stop without starting duplicate chains;
- falls back to the existing raw histogram reader for absent, failed,
  backfilling, old-version, or unverified rollouts;
- cuts the existing authenticated query to Aggregate only when that exact
  workspace and Aggregate version are verified; and
- retains the rollout row until workspace prospect deletion has removed the
  corresponding component items, then removes the checkpoint during final
  workspace deletion.

The namespace deliberately stores exact filter dimensions instead of eight
wildcard copies per prospect. The worst unfiltered request is 300 bounded count
operations in one component query (2 platforms × 3 normalized prospect types ×
5 statuses × 10 score bins), while a normal filtered list is smaller. This is a
fixed read bound and avoids multiplying every qualification write.

Rollout remains a separate approval step:

1. Deploy the additive component, table, dual-write gate, and fallback reader.
2. Confirm there are no new prospect-write OCC regressions while no workspaces
   are opted in.
3. Pause one low-traffic workspace and start its internal migration.
4. Wait for `verified`; require exact expected/Aggregate bin parity and no new
   permanent component or prospect mutation failures.
5. Exercise unfiltered, platform, type, status, and creation-time histogram
   filters, then resume the workspace.
6. Repeat per workspace. Do not run a global 60,000-row scan.
7. Keep `prospectSummaries` and the raw fallback through the observation window;
   any narrowing or component-state cleanup is a separate destructive phase.

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

### Focused stabilization production checkpoint — 2026-08-28

PR #42 deployed successfully before the read-only checkpoint at 11:33 UTC. The
deployment inherited a qualification backlog, but the queue drained from 459
jobs to zero by 11:39 UTC without a control mutation. All 546 jobs queued in the
rollout window succeeded; none failed or were cancelled. The final snapshot had
zero queued/running jobs, 36/36 free tenant slots, zero expired leases, zero
unresolved enqueue failures, no pool/mode drift, and no ready lane left behind.

Convex Insights contained no scheduler OCC or `createProspectsBatch` bytes-read
event newer than the deployment. The historical admission sample still includes
the pre-deploy/backlog delay and therefore is not evidence that the long-term
latency gate has passed. The next natural post-deploy burst must still meet the
documented p95 below 30 seconds, max below 60 seconds, and zero-permanent-error
gate before the scheduler stabilization work is considered fully observed.

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
- The React app now calls the bounded snapshot actions instead of
  `analytics:getDashboardAnalytics`, `agentOps:getAgentOpsDashboard`,
  `agentOps:getAgentOpsMemoryInventoryPage`, `usage:getUsageDashboard`, and
  `prospectSummaries:getWorkspaceProspectStageCounts`. Keep these public query
  endpoints as compatibility paths until production function logs prove there
  are no older clients or external callers; remove them and any indexes made
  redundant by that proof only in the cleanup phase.

## Large-range read follow-up — 2026-08-28

The audit expanded beyond the measured fit-score failure. Analytics, Agent
observability, Usage, prospect stage counts, discovery inventory, memory
inventory, and Agent Ops detail panels all had at least one path whose work grew
with the full selected range or workspace size.

The implementation now uses point-in-time action snapshots and 31-day internal
query transactions for wide reports. Daily source rows remain exact; chart
output compacts to daily, weekly, or monthly buckets based on range length.
Discovery and memory inventories return one server page, Usage reads compact
prospect summaries in bounded pages, and prospect stage counts accumulate exact
counts across bounded pages. Hidden full scans in Agent Ops detail panels were
replaced with additive indexes and bounded reads.

Production evidence and the rollout contract are in
`docs/convex/large-range-query-rollout.md`. The fit-score Aggregate remains the
only component migration in this phase because it is the only user-facing
count/histogram with a measured 18.6 MB failure. Persisted weekly/monthly tables
remain gated on post-deployment evidence: current production history is too
short to justify their dual-write and backfill risk before the bounded snapshot
canary is measured.

Local verification after rebasing this work on deployed PR #42 passed 109
Convex test files / 549 tests, TypeScript, strict Oxlint, changed-file ESLint,
`git diff --check`, and the 74-route production build. React Doctor reported no
blocking changed-dashboard issue; the flagged sequential waits are the bounded
transaction/export sequencing that prevents a wide report from recreating a
read burst.

### Large-range zero-opt-in production gate — 2026-08-28

PR #43 deployed successfully with zero fit-score Aggregate rollout rows, so all
checks exercised the compatibility read path without changing production data.
On `ReacherX (Leads)`, 30-day, one-year, and all-time Analytics and Agent Ops
snapshots succeeded. Usage, exact prospect stage counts, discovery inventory,
query detail, and memory detail also succeeded, and the checks produced no new
bytes-read or permanent-OCC Insight.

The memory inventory gate failed on latency and read amplification: its 82,400
rows took about 18 seconds to produce a 10-row page, while the former CSV flow
would restart the same scan for every one of 824 export pages. No Aggregate
backfill was started. The follow-up replaces page numbers backed by full scans
with scope-bound opaque cursors and a fixed snapshot watermark; buffered rows
are carried by IDs, each internal transaction is capped at 300 rows / 2 MB, and
CSV export advances once through the snapshot. Production canary and Aggregate
migration remain blocked until that focused follow-up is merged and deployed.

## Writing-style memory orphan follow-up — 2026-08-28

A post-rollout `auto_plan` job failed after admission with `Auto plan grounding
incomplete: workspace writing style context is missing`. Read-only inspection
showed that the active paid Hobby workspace had a ready Twitter style profile
at version 1 and 22 retained, processed source samples, but its referenced
Agent-component memory, inventory row, and canonical `workspaceMemories` row
were all absent. The connected X source was current and the LinkedIn style was
healthy. This was a style-memory data-compatibility failure, not scheduler
capacity: the scheduler was enforced and drained with 36/36 slots free, no
expired lease, enqueue failure, or pool drift.

The local hotfix makes the canonical platform-specific style memory the first
read, retains the legacy Agent memory as a compatibility fallback, and checks
the exact prospect platform before any expensive grounding provider calls. A
ready profile with no usable memory schedules one deterministic rebuild from
the existing samples. Repeated calls converge on that event; no workspace or
prospect scan is used. Repair attempts are capped at three per workspace,
platform, and six-hour window, after which the profile becomes visibly failed
and the user receives a support-oriented recovery message.

Failed `writing_style_unavailable` auto-plans are recovery candidates, but the
recovery claim is gated until the exact platform context is genuinely ready.
This prevents retry storms while allowing the existing recovery worker to
resume affected prospects after promotion succeeds. Rollout must remain
bounded: deploy with no data mutation, invoke the platform-specific bootstrap
only for the diagnosed workspace, verify a canonical Twitter style memory and
ready profile, then observe the automatic plan retry and Convex Insights before
considering any broader repair audit.

## Memory-evaluation queue follow-up — 2026-08-29

The bounded Twitter repair succeeded, produced the canonical style memory, and
allowed the failed auto-plan to recover. During that repair, a second problem
was proven: the workspace queue still referenced old memory-evaluation work even
though no live tenant job could make progress. The workspace also had a large
ordinary learning-event backlog. The queue treated the stale `workId` as active,
and FIFO selection placed the urgent style-repair event behind that backlog.
The unrelated bulk drain was stopped; remaining learning events were preserved.

The local follow-up changes queue preparation in three bounded ways:

- A queue backed by a queued or running `tenantJobs` row remains active. A
  terminal or missing tenant-job pointer is reclaimed immediately. A legacy
  Workpool pointer is reclaimed only after the existing two-hour tenant lease
  window, and its pending component work is cancelled before replacement when
  possible.
- If stale work owned a `processing` event, that event is returned to `pending`
  only when its `evaluatorWorkflowId` exactly matches the stale queue pointer.
  The matching running evaluator audit row is marked failed, so a new worker can
  reuse it idempotently and the recovery remains observable.
- Explicit `style-repair:` events are selected from a bounded 25-row indexed
  window before the normal pending queue. All ordinary events retain oldest-first
  order, and every lookup remains workspace-scoped.

No schema field, table, index, data backfill, Aggregate migration, or global
event scan is required. Rollout is code-only. After deployment, verify with
read-only checks that the repaired workspace has no stale queue pointer, that a
new bounded repair is admitted ahead of old learning history, and that no
duplicate evaluator run or new scheduler/bytes-read Insight appears. Roll back
the code if active work is ever reclaimed or ordinary FIFO/cross-workspace
isolation changes; do not bulk-drain historical learning events as a rollback
mechanism.

This hotfix does not close the remaining reliability program. The next focused
phases remain: eliminate measured `prospectSummaries` batch contention, finish
bounded Action Retrier historical cleanup, observe scheduler admission latency,
and only then prepare a separate evidence-backed legacy cleanup PR.

### Post-deployment queue gate and enqueue-generation follow-up

The read-only gate after PR #47 deployed found no duplicate or running evaluator
runs and a healthy tenant scheduler: enforced mode, an empty queue, 36/36 tenant
slots free, no expired lease, unresolved enqueue failure, or pool drift. Convex
Insights also showed no newer scheduler OCC, prospect-batch bytes-read,
`prospectSummaries` OCC, or Action Retrier cleanup event than the prior snapshot.

The affected workspace was not recovered, however. Its queue had been reclaimed
and prepared again, but the scheduler idempotency key still used only workspace
and event. Enqueue therefore returned the historical cancelled `tenantJobs` row,
and the queue attached that terminal ID again. The failure was silent in
evaluator-run telemetry because no evaluator action started.

The local follow-up gives every prepared queue generation a stable numeric token
stored in the existing `lastEnqueuedAt` field. Concurrent retries reuse that
token and converge on one scheduler job; stale recovery advances it monotonically
and therefore cannot reuse the cancelled generation. The token travels in the
optional memory-evaluation payload for widen compatibility. Queue attachment and
worker start compare it before changing state, so a delayed older enqueue cannot
overwrite or execute a newer generation. A rejected duplicate is cancelled
best-effort. No schema change or data backfill is required.

Rollout remains code-only: deploy first, confirm the existing stale pointer is
replaced by a different queued/running job, then require one evaluator run for
the selected event and no duplicate run, scheduler failure, or new Insights
regression. Do not start the `prospectSummaries` contention change until this
gate passes, because combining the two fixes would make rollback ambiguous.

### Bounded queue recovery gate — 2026-08-29

After the generation fix deployed, the approved production operation invoked
only `prepareMemoryEvaluationQueueEnqueueInternal` for the diagnosed workspace.
It reclaimed the historical cancelled pointer, selected pending event
`n575xs9f8qsx0hnrdpt9zrxrsn8d9ese`, and advanced the queue generation to
`1787949197202`. Verification found the queue in `queued` state with no `workId`,
no replacement tenant job, no running evaluator, and the ordinary backlog still
intact. This closed the stale-pointer recovery gate without bulk-draining or
otherwise processing preserved learning events. Exact-once execution remains a
production observation gate for the next natural enqueue, not a prerequisite
for the independent summary-contention fix.

## Prospect summary contention follow-up — 2026-08-29

Production Insights recorded eight permanent `createProspectsBatch` conflicts
on `prospectSummaries`; the latest was 2026-08-28 14:40:15 UTC. Repeated failures
targeted the same per-prospect summary IDs, and each exhausted Convex's four OCC
retries. The source mutation was already limited to one prospect per transaction
and its action caller already retried idempotently, so another global queue,
Aggregate, or sharded counter would not address this per-prospect dependency.

The focused fix suppresses read-model work before opening the conflicting read
set. A provider refresh whose derived summary is unchanged now returns before
reading or patching `prospectSummaries`. The prospect trigger also compares the
old and new stats and daily-analytics contributions before reading or writing
their 32-way stripes. Genuine summary, stats, and analytics transitions still
write through the existing trigger, while raw provider payload refreshes update
only their source prospect. There is no schema change, backfill, or rollout
migration. Integration coverage proves an irrelevant provider refresh advances
the source prospect while leaving the summary and both rollup stripes byte-for-
byte unchanged; existing transition coverage proves real status changes still
update the striped read models.

### Prospect-summary deployment gate

PR #49 deployed as merge commit `2ab3aa28d34e5d455bfc3ef8ccc915b08ea64295`.
The immediate read-only gate found no permanent `prospectSummaries` OCC or
`createProspectsBatch` bytes-read event newer than the pre-deploy baselines
(2026-08-28 14:40:15 UTC and 11:29:40 UTC respectively). The scheduler remained
globally enforced with the correct 36-slot tenant pool, no override, expired
lease, unresolved enqueue failure, or drift while new qualification traffic was
running.

The previously repaired memory queue also advanced naturally to a new
generation. Its selected event reached the terminal `ignored` state, the
cancelled historical pointer was not reused, and a later queue generation held
a different work ID. No duplicate active processing was observed, and no
production control or repair mutation was used for this gate.

## Action Retrier historical cleanup follow-up — 2026-08-29

The post-deploy Insights snapshot confirmed the remaining component failure was
unchanged: `actionRetrier:cleanupExpiredRuns` had three daily failures, newest
2026-08-28 13:13:24 UTC, each reading 16,864,513 bytes across 1,040 component
run documents. Version 0.3.1 is still the latest published package, and its
current upstream source still takes 1,024 expired rows in one mutation. New
terminal runs already receive delayed per-run cleanup in app code, so this is a
bounded historical component-state problem rather than an app-table migration.

The local package patch reduces the component cleanup page to four runs and
uses that constant for both the indexed read and continuation condition. The
existing immediate continuation therefore drains every eligible historical row
without a global transaction. Four is intentionally conservative because a
delete can add transaction reads after the initial query; it remains below the
Convex read budget even when stored action arguments or results approach the
document-size ceiling. No app schema, component schema, public function, or
prospect/workspace scan changes.

The regression test creates ten approximately 700 KB completed component runs
under a synthetic 6 MB transaction limit. One invocation deletes exactly four,
and scheduled continuations delete the remaining six without exceeding the
limit. Rollout is code-first: deploy the pinned patch, invoke or await one
bounded component cleanup chain, verify the expired sample is empty, and require
no new `cleanupExpiredRuns` bytes-read Insight. Do not use a direct component
table export/import or full backup as the cleanup mechanism.

### Action Retrier deployment and drain gate

PR #50 deployed as merge commit `89ad875f620f26ec21653b67b26cb07336e5d2f8`.
The read-only pre-cleanup gate found an eligible four-row sample and no
`cleanupExpiredRuns` bytes-read event newer than the historical 2026-08-28
13:13:24 UTC baseline. The approved production invocation deleted exactly four
expired terminal runs and started the component's existing continuation chain.
Subsequent bounded samples showed the oldest eligible completion timestamp
advancing while the failure baseline remained unchanged. Only one cleanup
chain was started; no overlapping sweep, component export/import, app-table
mutation, or production control change was used. The final empty-sample gate
remains pending while that conservative four-row chain drains the multi-week
history.

## Scheduler burst throughput follow-up — 2026-08-29

The latest production sample before this local change contained 1,000 started
memory-evaluation jobs from one tenant. Typical admission was healthy (p50 434
ms, p95 617 ms, max 5,702 ms, and zero admissions over 30 seconds), with no
failed job, expired lease, unresolved enqueue failure, or pool drift. This is a
healthy current checkpoint, but it does not explain away the two earlier burst
windows that queued hundreds of jobs for several minutes while tenant slots
remained free.

A subsequent natural burst reproduced the regression before this fix could be
deployed. Of the newest 1,000 jobs, 999 had started across 741 memory-evaluation
and 258 qualification admissions for one tenant; 150 waited at least 30 seconds.
The distribution moved to p50 482 ms, p95 67,632 ms, and max 85,652 ms. The
live queue was already moving into running work, global mode and the 64 + 36
pool split were correct, and there was no failed job, expired lease, unresolved
enqueue failure, drift, or new permanent scheduler error. This third transient
window fails both rollout gates and confirms that a drained snapshot or healthy
median cannot close the burst-throughput defect.

The remaining under-utilization mechanism is now reproduced in code. The
dispatcher reads up to eight free slots but previously returned only one queued
job per ready lane. A one-workspace burst therefore admitted one job per Batch
Worker transaction even when seven more slots were available. Every one-job
dispatch and every completion also wrote the same `tenantJobLanes` row. The
72-hour Insights snapshot still showed thousands of retried conflicts on that
lane across activation, dispatch, Workpool completion, and tenant-execution
completion paths. They were not permanent failures, but they amplify the
serialized dispatcher exactly when a same-tenant burst arrives.

The local fix keeps the existing eight-slot batch and exact per-workspace queue
order, but allocates those slots round-robin across active lanes. A single busy
lane can fill all eight assignments; with A=100 and B/C=1, B and C receive one
slot before A borrows the remaining six. Claimed `tenantSchedulerSlots` are the
authoritative bounded source for live tenant concurrency, so completions no
longer read or write the lane marker. Dispatch patches each participating lane
once per batch and schedules an idempotent post-drain activation to close the
concurrent-enqueue race. Reads remain bounded to 64 ready lanes, 36 claimed
slots, and nine small tenant-job rows per lane; a dispatch writes at most eight
jobs and slots.

No Aggregate or sharded-counter component is introduced here. The 36
independent slot documents already provide exact, bounded, naturally sharded
concurrency state; another counter would duplicate that authority and create a
new consistency problem. There is no schema or data migration. The legacy lane
`runningCount` field remains widen-compatible but is no longer consulted for
admission; its eventual removal belongs to the separate cleanup phase.

Local verification passed 114 test files and 576 tests, including one-lane
eight-slot dispatch, stale compatibility counters, A=100/B=C=1 fairness, and
10/50/100 active-lane visibility. TypeScript, strict Oxlint, and the 74-route
production build also passed. Rollout is code-only: deploy after review, then
require the A=100/B=C=1 acceptance load to keep admission p95 below 30 seconds
and max below 60 seconds with no permanent scheduler OCC, expired lease, or
slot drift. Larger natural bursts must be evaluated against their measured
arrival rate, job duration, and 30-slot single-tenant cap instead of applying
that fixed latency threshold to an overload that cannot physically meet it.

## Post-deployment baseline and final cleanup audit — 2026-08-29

PR #51 deployed as merge commit `294357f71cf7a47ac4c3ab98d3af29bb8e7e5f64`.
The first read-only baseline after deployment was drained: enforced mode, zero
queued or running jobs, 36/36 tenant slots free, Workflow parallelism 64,
tenant-execution parallelism 36, and no expired lease, unresolved enqueue
failure, or configuration drift. The latest 1,000-job sample at that cutoff
still contained work completed before the baseline, so its p95 of 72,789 ms and
maximum of 78,830 ms cannot be used as a post-deploy acceptance result. The
next natural workload therefore remained an observation gate pending workload-
normalized analysis rather than a blanket latency pass/fail.

The Action Retrier expired-terminal cleanup is complete. An indexed, bounded
component query found zero terminal runs older than the seven-day retention
window. Insights still contains only the three historical bytes-read failures,
newest 2026-08-28 13:13:24 UTC; no failure was added by the bounded drain.

A final ascending component-table audit found one separate historical run from
2026-05-12 still marked `inProgress`. Its referenced scheduled-function row has
already aged out, so it is not executing and cannot enter the terminal-only
cleanup index. It is retained without mutation. A future bounded stale-run
repair may mark it terminal and let the existing cleanup remove it, but that is
a component-state cleanup candidate rather than an active bytes-read or
scheduler defect.

The cleanup audit paired repository reachability with 50,000 recent production
function executions and bounded component/table checks. This commit removes
only artifacts whose reads and writes are absent:

- `setupSessions:markWorkflowStartedInternal`, superseded by the atomic setup
  workflow claim, had no repository caller and no execution in the inspected
  production window;
- `PREVIEW_BATCH_LIMITS.previewProspectWriteBatch` had no reader after preview
  persistence batching was centralized;
- the canonical-memory migration now uses the live workspace-scoped legacy-ID
  index instead of the global `by_legacy_memory_id` index.

The audit also proved that `tenantSchedulerSlots.by_job`,
`workspaceMemories.by_workspace_and_prospect_and_status`, and the global
`workspaceMemories.by_legacy_memory_id` have no remaining query site. They stay
defined for this deployment because Convex classifies removing the two memory
indexes across 106,480 documents as a large-index deletion requiring an
explicit production confirmation flag. PR #52's first deployment attempt was
therefore blocked before any production change. Index removal is deferred to a
separate explicitly approved operation; the documents themselves are not
cleanup candidates.

No document, table, component, or rollback path is removed. Production still
contains canonical memories with legacy IDs and legacy memory-inventory rows,
so the workspace-scoped compatibility reader remains required. The six legacy
Workpools are paused and empty, but their modules and scheduler configuration
remain active rollback paths. Scheduler `legacy`/`shadow` modes, workspace
overrides, persisted plan-batch compatibility, and lane `runningCount` also
remain until an explicit end-of-rollback-window decision. Removing
`runningCount` requires a separate widen-migrate-narrow data change because the
field is still present on production lane rows.

### Cleanup deployment correction

PR #52's first production build was correctly blocked before changing
production because Convex classified deletion of two indexes across 106,480
`workspaceMemories` rows and one index across 36 `tenantSchedulerSlots` rows as
destructive index removal. PR #53 restored all three definitions while keeping
the proven dead-code cleanup. Its dry-run reported zero index deletions, and it
deployed as merge commit `a0c45767`.

The post-deployment read-only gate confirmed all three retained indexes were
queryable, the removed setup function was absent from the deployed function
specification, the scheduler was enforced and drained with 36/36 slots free,
and there was no expired lease, unresolved enqueue failure, pool drift, or new
permanent Insight. No production document, table, component state, or control
was changed by this correction.

## Final scheduler burst diagnosis — 2026-08-29

A clearly post-PR #51 production window initially appeared to fail the proposed
p95-below-30-seconds and max-below-60-seconds gate. The broader sample contained
668 successful admissions with p50 about 349 ms, p95 about 66.4 seconds, max
about 77.8 seconds, and 161 admissions over 30 seconds. The queue drained on its
own and produced no permanent scheduler error, failed job, expired lease,
unresolved enqueue failure, or slot drift.

The bounded job-level trace isolated the delayed interval instead of treating
the whole 1,000-job window as one burst:

- 286 jobs arrived in 89.9 seconds; 282 were qualification and 4 were memory
  evaluation;
- arrival rate was 3.18 jobs/second;
- qualification-dominated execution averaged 18.1 seconds, with median 13.9
  seconds and p95 36.5 seconds;
- the scheduler reached the configured 30 concurrent jobs for that tenant;
- peak starts in any rolling minute were 105, far below the 240/minute token
  bucket, proving the admission rate limiter was not binding; and
- at the observed mean duration, 30 slots can finish about 1.66 jobs/second.
  Even lending all 36 slots would provide only about 1.99 jobs/second, still
  below the measured 3.18 jobs/second arrival rate.

The resulting queue was therefore bounded overload/backpressure, not a stuck
dispatcher or unused-capacity defect. Removing the rate limiter, adding an
Aggregate, or replacing exact slot rows with a sharded counter would not make
that workload satisfy the fixed gate and would weaken provider protection or
tenant isolation. The correct production criteria are now:

1. For the specified A=100/B=C=1 acceptance load, keep p95 below 30 seconds and
   max below 60 seconds while B and C start before A drains.
2. For larger natural overloads, require the busy tenant to reach its 30-slot
   cap, preserve the six newcomer slots, make continuous forward progress,
   drain without intervention, and produce no permanent scheduler error,
   expired lease, duplicate, lost job, or slot drift.
3. Report overload queue age and admission distribution separately from
   scheduler correctness. Capacity increases require a separate provider and
   Workflow-capacity review; they are not a reliability hotfix.

The final post-cleanup snapshot was enforced, zero queued, zero running, 36/36
free, zero expired leases, zero unresolved enqueue failures, and no pool or mode
drift. This closes the scheduler burst-throughput investigation without an
unsupported production-capacity change.

## Qualification structured-output incident — 2026-08-29

The 12:46 UTC read-only production gate found a new provider-output incident,
not a scheduler-capacity failure. The newest 1,000 tenant jobs contained 74
failed qualification jobs completed between 12:40:49 and 12:44:45 UTC. They
represented 41 unique prospects in one workspace: 20 prospects had one failed
job, 9 had two, and 12 had three. Sixty failures were `Unexpected end of JSON
input`; the other fourteen were malformed-JSON errors such as unterminated
strings or missing delimiters. Every failed job exhausted two model attempts on
the configured `openai/gpt-oss-120b` Cerebras/Groq route. At the snapshot, 11
jobs were running, zero were queued, 25/36 tenant slots were free, and there was
no expired lease, pool drift, or scheduler-control error.

A later read-only checkpoint found 241 additional completed jobs after the
incident cutoff and no new qualification model-output failure. Scheduler state
was enforced and drained with 36/36 slots free, zero queued/running jobs, zero
expired leases, zero unresolved enqueue failures, and no pool drift. Three
later failures were unrelated auto-plan jobs whose LinkedIn recent-post refresh
received invalid/missing URNs from LinkdAPI; they are not attributed to this
qualification incident or scheduler capacity.

The application retry loop previously resent both attempts with the same
ordered provider options. OpenRouter can fail over when a provider request
fails, but a provider returning HTTP success with malformed JSON is an
application-level parse failure; retrying the same order can select the same
endpoint again. Qualification also requested JSON only through prompt text
instead of the AI SDK's schema-constrained output contract. Finally, the
capacity reconciler could see the prospect as pending immediately after a
failed workflow and launch it again, explaining why 74 jobs mapped to only 41
prospects.

The local hotfix makes qualification use native schema-constrained output with
OpenRouter response healing, while retaining final Zod validation and all
evidence gates. It pins the first two application attempts to different
providers (Cerebras, then Groq) and makes one bounded recovery attempt on the
stronger onboarding model. Arbitrary truncated output is never guessed or
accepted. Failed attempts log only safe metadata: configured/selected provider,
model, finish reason, response length, output-token count, duration, and error
class; prospect and model content are not logged.

The failure record is widened with optional `workflowAttemptCount` and
`nextRetryAt` fields. The first exhausted workflow schedules one retry after a
five-minute cooldown. A second exhausted workflow records the failure and
stops. Capacity reconciliation respects the cooldown and exhaustion marker, so
it cannot create an unbounded retry loop. This is an additive optional-field
change: existing documents remain valid and no scan or backfill is required.

Local verification includes provider-rotation and error-chain unit tests plus a
Convex integration test proving exactly one delayed workflow retry and no second
schedule after exhaustion. The complete suite passed 115 test files and 577
tests. TypeScript, strict Oxlint, formatting, the 74-route production build, and
the production-targeted Convex dry run also passed; the dry run reported no
index deletion. Cleanup remains paused until the hotfix deploys and the recovery
gate passes.

Rollout is code-first. After deployment, confirm no new malformed-output burst,
then replay only the 41 unique affected prospects whose latest state is still
pending, lease-free, and carries the diagnosed model-failure marker. Reuse the
existing qualification enqueue idempotency contract, verify each prospect
reaches one terminal qualification result or the bounded exhausted state, and
require no duplicate active workflow, retry storm, new permanent scheduler
error, or schema/bytes-read failure. Resume the separate destructive-cleanup
sequence only after that gate passes.

### Separate LinkedIn provider-data incident

The 13:03 UTC follow-up contained three additional `auto_plan` failures at
12:49:54, 12:50:26, and 12:52:24 UTC. All three came from LinkdAPI's successful-
HTTP no-data response during recent-post refresh: the data could not be
displayed or did not exist and the supplied URN needed verification. The queue
still drained with all 36 tenant slots free and no lease, pool, mode, or
scheduler failure. This is a stale provider-identity/data-availability defect,
not part of the qualification JSON incident and not scheduler exhaustion.

The background social-context path previously called the user-authenticated
LinkedIn profile action even though that action deliberately returns no recent
posts. On failure it retried the stored prospect URN directly. A stale URN then
escaped as a generic retryable auto-plan generation error, causing repeated
paid work without changing the underlying identity.

The local fix resolves the prospect through the existing canonical LinkedIn
identity helper, refreshes the live profile by username without sending the
stale URN, and tries the provider's canonical profile URN before the stored
fallback. LinkdAPI's exact no-data response becomes an explicit empty recent-
post result; authentication, rate-limit, network, and server failures still
throw and retain transient retry behavior.

An empty post result degrades only when another verified outreach channel is
available. Connected prospects and the existing connect-first LinkedIn flow
may receive a grounded DM plan, while the draft validator continues to reject
invented post IDs. If neither a verified post nor an allowed messaging path is
available, the run stops with the new terminal `provider_data_unavailable`
code. That code is intentionally excluded from automatic recovery, preventing
a stale-URN retry storm. No prospect identifier is rewritten and no data
migration or backfill is required by this hotfix.

After deployment, verify a diagnosed prospect once. Acceptance requires either
a plan grounded in a provider-returned post, a valid DM/connect-first plan with
no post reference, or one terminal provider-data notification. It must not
create repeated auto-plan runs, invent a post, or hide transient provider
outages. Repairing stored LinkedIn identifiers, if later justified by bounded
evidence, remains a separate data migration.

Combined local verification passed 115 Convex test files and 578 tests,
TypeScript, strict Oxlint, changed-file formatting, and the 74-route production
build. The production-targeted Convex dry run passed schema validation and
reported no index deletion. No production function, control, or document was
changed.
