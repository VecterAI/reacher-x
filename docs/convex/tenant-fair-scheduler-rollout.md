# Tenant-fair scheduler architecture and production rollout

## Outcome

Every workspace has its own durable lane. One workspace can use spare capacity,
but it cannot take every execution slot or prevent a newly active workspace from
starting. Pausing one workspace pauses only that lane. New workspaces use the
same policy automatically after the global mode is enforced.

This rollout does **not** rewrite, scan, or backfill the existing 60,000+
prospects. It adds scheduler tables and initializes only 36 slot documents.
A full production backup is not required for this additive rollout. Source
control plus the `legacy`/`shadow` control modes provide the code rollback path.

## Capacity model

The Professional plan runs on Convex S256. The platform limit is 256 concurrent
queries, 256 mutations, 512 Convex actions, 256 Node actions, and 256 scheduled
jobs. Those are platform ceilings, not tenant isolation by themselves.

The application deliberately uses a smaller controlled budget:

- 64 shared durable Workflow step slots.
- 36 tenant execution/admission slots.
- 100 total configured Workflow + Workpool parallelism, matching the Workpool
  maintainer's Professional-plan recommendation.
- One tenant may burst to 30 of the 36 tenant slots.
- The remaining 6 slots let new tenants start immediately.
- With 2 active tenants, the cap is 18 each; 3 tenants, 12 each; 10 tenants,
  3 each; 36 or more tenants, at least 1 each.

These numbers are application admission limits, not Convex's maximum user or
request capacity. Thousands of signed-in sessions and ordinary queries can run
outside this background-work budget. Increase the 36/64 split only after load
testing and revisiting Convex's current guidance.

Official references:

- [Convex deployment and concurrency limits](https://docs.convex.dev/production/state/limits)
- [Workpool component and Professional-plan guidance](https://github.com/get-convex/workpool#configuring-the-workpool)
- [Batch Worker self-recovering queue](https://www.convex.dev/components/batch-worker)
- [Rate Limiter sharding and fair queuing](https://www.convex.dev/components/rate-limiter)
- [Durable Workflow behavior](https://www.convex.dev/components/workflow)

## Request path

```text
setup / qualification / enrichment / plans / memory
                         |
                         v
              workspace-specific lane
              (ready, paused, or idle)
                         |
                         v
          fair dispatcher + per-tenant rate limit
                         |
                         v
        36 app-owned slots -> Workpool -> Workflow/action
                         |
                         v
       completion frees the exact slot and wakes the queue
```

The Batch Worker owns a single self-recovering dispatch loop. Individual slot
documents avoid a hot global counter. Idempotency keys prevent duplicate queue
rows. A 10-minute cron detects expired leases, cancels the associated Workpool
job or nested Workflow, releases its slot, and allows other tenants to continue.
Terminal scheduler history is retained for seven days and deleted in bounded
batches.

## UI impact

There is no redesign. The existing workspace system-status dialog now shows the
workspace lane as active, waiting, or paused. Its pause explanation makes clear
that queued work waits while an already-running task may finish safely.

## Production rollout

Run every command from the tested commit. Add `--prod` exactly as shown. Do not
deploy local uncommitted work.

### 1. Preflight

1. Pause the agent for **every production workspace**, not only the current paid
   workspace.
2. Confirm the old Workflow/Workpool backlogs are drained and there are no
   orphaned running jobs. The Aug 27 incident recovery is a separate completed
   operation; do not assume old component state is healthy without checking.
3. Record the current production deployment and component configuration for an
   audit trail.

### 2. Deploy safely in legacy mode

Deploy the branch. With no scheduler control row, all entrypoints continue on
the legacy routes. The new tables are additive and the new queue starts empty.

Verify:

```bash
pnpm exec convex run tenantScheduler:getControlStatusInternal '{}' --prod
```

Expected: `control: null` immediately after the first deployment.

### 3. Initialize shadow mode

```bash
pnpm exec convex run tenantScheduler:setControlInternal \
  '{"mode":"shadow","slotCount":36,"baseSlotsPerTenant":1,"burstSlotsPerTenant":30}' \
  --prod
```

Shadow mode writes scheduler observations but executes through the old pools.
Resume all intended workspaces briefly to exercise normal production flows, then
check logs, error rates, and status. Pause all workspaces again and let the old
pools drain before enforced cutover.

### 4. Optional short canary

This is temporary validation, **not** the final architecture. Keep every other
workspace paused because enabling an enforced override changes the shared pool
split globally.

```bash
pnpm exec convex run tenantScheduler:setWorkspaceOverrideInternal \
  '{"workspaceId":"<workspace-id>","mode":"enforced"}' --prod
```

Resume the canary, verify setup plus representative background work, wait until
its scheduler queue is empty, and pause it again. If no meaningful canary traffic
exists, skip this phase rather than inventing production work.

### 5. Enforce globally

```bash
pnpm exec convex run tenantScheduler:setControlInternal \
  '{"mode":"enforced","slotCount":36,"baseSlotsPerTenant":1,"burstSlotsPerTenant":30}' \
  --prod

pnpm exec convex run tenantScheduler:getControlStatusInternal '{}' --prod
```

Expected: 36 configured slots, global mode `enforced`, and counts consistent with
the paused workspaces. Remove a temporary canary override after global enforcement:

```bash
pnpm exec convex run tenantScheduler:setWorkspaceOverrideInternal \
  '{"workspaceId":"<workspace-id>"}' --prod
```

Resume **every workspace that should operate**. There is no one-workspace
allowlist in the final state. Future workspaces inherit global enforced mode.

## Acceptance checks

Before declaring the rollout complete:

- Setup ideal-profile generation completes and its UI leaves the generating
  state on both success and failure.
- Qualification, enrichment, auto-plan, plan-batch items, and memory evaluation
  all enter and leave scheduler jobs correctly.
- Pause workspace A: A's queued count remains waiting, while workspace B starts
  and completes work.
- Load scenario: A queues 100 jobs, then B and C queue one each. B and C must
  start while A is capped; A must not consume more than 30 tenant slots.
- Test at 10, 50, and 100 active tenant lanes. Track admission lag, permanent
  failure rate, retries, queued count, running count, and expired leases.
- Confirm no cross-workspace data access and no idempotency-key duplicates.

## Rollback

The control mutation intentionally refuses to leave enforced mode while any
tenant job is queued or running. This prevents a rollback from silently
stranding claimed prospects or plan items.

For a normal rollback:

1. At a quiet point, wait for `queued: 0` and `running: 0` in
   `getControlStatusInternal`.
2. Pause every workspace.
3. Switch to shadow mode:

```bash
pnpm exec convex run tenantScheduler:setControlInternal '{"mode":"shadow"}' --prod
```

4. Verify the legacy pools are restored, then resume the intended workspaces.

Do not disable the scheduler globally because one tenant has a bad job. Pause
only that workspace. The lease reaper cancels expired work and releases its slot,
while other tenants keep operating. Investigate and repair the affected domain
state before resuming that workspace.

## Separate follow-up

This change isolates and schedules expensive background work. It does not rewrite
the existing 60,000+ prospect records and does not replace every historical
aggregate/counter pattern in the product. A separate performance pass should use
production metrics to find hot read/write aggregates and, only where evidence
supports it, migrate them with the Aggregate component or sharded counters.
