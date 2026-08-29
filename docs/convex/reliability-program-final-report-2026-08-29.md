# ReacherX reliability program — completion report

## Status

The reliability implementation, migrations, bounded cleanup, and production
verification are complete. Global tenant scheduling remains enforced with the
Workflow 64 + tenant execution 36 split. The final read-only checkpoint was
drained with 36/36 slots free, no expired lease, unresolved enqueue failure,
pool drift, or new permanent scheduler error.

No destructive production table, document, component-state, or index deletion
was performed.

## What is live

### Scheduler and recovery

- Enqueue no longer writes the hot mutable lane document. Immutable lane
  bindings, durable job rows, bounded activation, and an enqueue-failure ledger
  preserve exact idempotent recovery when a mutation fails before a job exists.
- Dispatch fills an eight-slot batch, preserves A=100/B=C=1 fairness, and keeps
  all lanes visible at 10, 50, and 100 active lanes.
- Claimed slot rows are the exact concurrency authority; completion no longer
  turns the lane marker into a hot counter.
- Setup workflows detect bounded staleness and recover safely instead of
  treating any stored workflow ID as progress.
- Legacy/canonical memory IDs, missing writing-style memories, stale memory
  queue pointers, and cancelled-generation reuse have bounded idempotent
  recovery paths.
- Coverage spans every tenant job kind for acceptance, deduplication, and
  cross-workspace rejection, plus terminal success/failure, retry exhaustion,
  pause/resume, and idempotent completion behavior.

### Large reads and write contention

- Analytics, Agent Ops, Usage, prospect counts, inventories, exports, and
  detail panels use bounded snapshots, compacted chart buckets, or cursor
  pagination instead of loading an unbounded selected range.
- Fit-score histograms use `@convex-dev/aggregate` after a bounded 25-row
  backfill and 100-row verification process. All 34 production workspaces are
  verified; 83,516 scored summaries matched exactly. No backfill remains.
- `workspaceStats`, `workspaceAnalyticsDaily`, and
  `workspaceAgentOpsDaily` use 32 deterministic application stripes. They are
  signed multi-field read-model deltas, so the generic sharded-counter
  component was not used; it would duplicate the exact rollup model rather
  than improve it.
- Prospect creation is one row per transaction with bounded identity and
  capacity reads. Unchanged provider refreshes now skip `prospectSummaries`
  and rollup read/write sets, removing the measured per-prospect conflict path.
- Action Retrier cleanup is patched to four large rows per transaction. Its
  historical expired terminal backlog reached zero without an export/import
  or full component scan.

### Cleanup and observability

- Removed only the proven dead setup workflow export and obsolete preview
  batch constant.
- The canonical-memory migration now uses the workspace-scoped legacy-ID
  index.
- Queue age, lease expiry, pool/mode drift, unresolved pre-row enqueue
  failures, and scheduler state are available from the bounded control status.
- Production Insight baselines cover scheduler OCC, prospect bytes-read,
  rollup contention, fit-score reads, summary conflicts, and Action Retrier
  cleanup.

## Aggregate and sharded-counter decision

The component choices are complete and deliberate:

| State                                       | Production implementation                             | Reason                                                                                                  |
| ------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Fit-score counts/histograms                 | `@convex-dev/aggregate`                               | Ordered, filtered counts need logarithmic range queries.                                                |
| Workspace stats/analytics/Agent Ops rollups | 32 deterministic stripes                              | Exact signed multi-field deltas need domain-specific merge and reversal behavior.                       |
| Scheduler concurrency                       | 36 independent slot documents                         | Exact bounded ownership already supplies natural sharding; another counter would create dual authority. |
| Prospect summary                            | One row per prospect with unchanged-write suppression | Contention was same-prospect duplicate work, not a global count.                                        |

There is no currently evidenced remaining Aggregate or sharded-counter
migration.

## Final burst finding

The post-PR #51 delayed interval was a real queue but not a scheduler defect.
During the isolated interval, 286 jobs arrived in 89.9 seconds (3.18 jobs/s),
282 of them qualification. Mean execution was 18.1 seconds, the busy workspace
reached its 30-slot cap, and peak starts were only 105/min against the 240/min
limiter. Thirty slots could finish about 1.66 jobs/s; even all 36 could finish
only about 1.99 jobs/s. The queue therefore represented expected bounded
backpressure and drained without intervention.

The fixed p95-below-30-seconds/max-below-60-seconds gate remains valid for the
specified A=100/B=C=1 acceptance load. Larger traffic bursts are judged by
full slot use, newcomer isolation, forward progress, eventual drain, and zero
permanent correctness failure. Raising capacity is a separate product/provider
capacity decision, not unfinished reliability work.

## Intentionally retained cleanup candidates

- Three proven-unused indexes remain because their first deletion attempt was
  correctly blocked as destructive across production data. Remove them only in
  a separately approved Convex deployment with the explicit large-index
  confirmation.
- Six paused legacy Workpools plus `legacy`, `shadow`, and workspace-override
  scheduler paths remain as rollback compatibility. Remove them only after an
  explicit end-of-rollback-window decision and an observation period with no
  legacy use.
- `tenantJobLanes.runningCount` remains widen-compatible on existing rows. Its
  removal requires its own widen-migrate-narrow change.
- Persisted plan-batch compatibility remains because historical Workflow steps
  may still replay it.
- Legacy memory inventory/data remains until bounded migration evidence proves
  the compatibility reader can be removed.
- One Action Retrier run from 2026-05-12 remains historically marked
  `inProgress` although its scheduled-function row has aged out. It is not
  executing and does not participate in terminal cleanup. Repair it only
  through a reviewed bounded stale-run path; do not delete component state by
  hand.

These are cleanup candidates, not active reliability defects. None should be
deleted merely because repository search reports no current caller.

## Rollout and rollback

No further migration or production backfill is pending. Continue normal
read-only monitoring for regression baselines. If scheduler correctness
regresses, pause only the affected workspace when possible; preserve the
enforced control row and use the documented drain/cancel path before changing
global mode. Any capacity increase, rollback-path removal, or destructive index
cleanup requires a separate review and explicit production approval.
