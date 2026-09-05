# Realtime reporting Aggregate rollout

## What changes

Analytics, Agent Ops, the all-time workspace progress dialog, and Usage switch
back to Convex subscriptions after a workspace passes an exact Aggregate
verification. The existing bounded actions remain the fallback while a
workspace is unverified or migrating, so deploying this code does not expose
the old unbounded reactive reads.

The `workspaceReportingAggregate` component stores one item per source record,
metric, and non-zero hour. Source-table triggers update those items in the same
transaction as the business write. Dashboard queries then read range sums from
the Aggregate component instead of scanning daily rows and stripes. Range cost
is logarithmic in aggregate size and does not grow with the requested time
span.

No weekly or monthly application tables are added. The component's ordered
tree is the persisted rollup, and the UI still uses the existing daily, weekly,
and monthly presentation buckets.

## Safety gates

- New workspaces begin on Aggregate version 3 and dual-write from their first
  source record.
- Existing workspaces stay on the bounded action snapshots until their
  `workspaceReportingRollouts` row is `verified` at a supported version (1, 2, or 3).
  Verified version-1 and version-2 workspaces keep their existing reads and
  writes until explicitly migrated. Version 3 partitions by metric and two
  stable source stripes.
- Migration is accepted only when prospecting is not running or has never
  started.
- Backfill runs in resumable transactions of 10 records by default and never
  more than 25. Prospect pages remain capped at 10, and outreach tasks are
  bounded to one plan and 100 tasks per page.
- Verification independently totals the existing Analytics and Agent Ops read
  models plus qualified-prospect usage, then compares those totals with the
  Aggregate before cutover. If parity exposes an older stale read model, rebuild
  that workspace's read models and restart the Aggregate migration; never bypass
  the mismatch.
- A mismatch or a workspace becoming active marks that workspace failed; its
  UI continues using snapshots.

## Controlled deployment

1. Verify the combined change and migration in an isolated deployment first.
   After release approval, deploy the schema, component, triggers, queries, and
   fallback UI together.
2. Confirm existing workspaces still render through the snapshot fallback.
3. Choose one inactive canary workspace. Pause discovery and drain discovery,
   qualification, enrichment, and memory evaluation work before migration.
   Do not run requalification or targeting regeneration concurrently with the
   migration. Then start its migration:

   ```bash
   pnpm exec convex run --deployment <deployment-name> workspaceReportingMigration:prepareAndStartWorkspaceMigrationInternal \
     '{"workspaceId":"<workspace-id>"}'
   ```

4. Inspect the checkpoint until it is `verified`:

   ```bash
   pnpm exec convex run --deployment <deployment-name> workspaceReportingMigration:getWorkspaceMigrationStatusInternal \
     '{"workspaceId":"<workspace-id>"}'
   ```

5. With Analytics or Agent Ops open, create or update a source record and
   confirm the displayed value changes without navigation or reload. Confirm
   Usage and all-time workspace progress the same way.
6. Observe function failures, transaction conflicts, bandwidth, document
   reads, and subscription churn for the canary before migrating another
   workspace. Expand sequentially, never with a global scan.

The preparation action first repairs the app-owned memory inventory from the
Agent component and rebuilds the current Agent Ops read model, then starts the
Aggregate backfill. Use `restart: true` only for a failed or explicitly
revalidated workspace. It clears and rebuilds that workspace's version-3
Aggregate namespace. Do not run it while prospecting is active.

## Rollback

Do not delete component data during rollback. Remove or disable the verified
rollout marker for the affected workspace so the clients immediately use the
existing bounded snapshot actions. Source read models and snapshot endpoints
remain intact throughout the rollout, which makes the fallback reversible
without a data restore.
