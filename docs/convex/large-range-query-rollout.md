# Large-range query reliability rollout

## Why this exists

The fit-score histogram was the first measured failure, but it was not the only
unsafe read. A production audit on 2026-08-28 found these user-facing paths:

| Surface                 | Previous read shape                                     | Largest observed / projected risk                                                     | New read shape                                                                                       |
| ----------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Analytics               | selected + comparison ranges in one query               | 32 stripes/day makes a one-year comparison about 24,000 source rows and roughly 58 MB | point-in-time action snapshot; 31-day transactions; exact totals; daily/weekly/monthly chart buckets |
| Agent observability     | Analytics + Agent Ops stripes in one query              | one-year comparison about 48,000 source rows and well above 16 MiB                    | two bounded 31-day reads per chunk; compact chart payload                                            |
| Discovery inventory     | every matching `queryCandidates` row returned to React  | 5,068 rows / about 3.6 MB in the largest workspace observed                           | bounded backend scan when exact filters require it; one server page returned                         |
| Memory inventory        | apparent UI pages backed by a full-window scan          | potentially hundreds of daily reads and an unbounded result in one query              | bounded 250-row internal pages; one server page returned                                             |
| Usage                   | every qualified full `prospects` document per workspace | grows with all qualified prospects and reads large source documents                   | 250-row `prospectSummaries` pages with a legacy fallback only when `qualifiedAt` is absent           |
| Prospect stage counts   | full summary iterator for each visible stage            | 61,257 prospects in `ReacherX (Leads)`                                                | bounded 250-row transactions with exact accumulated counts                                           |
| Agent Ops detail panels | full workspace event/suggestion scans                   | hidden failure path after opening a dashboard row                                     | additive exact indexes plus bounded `take(...)` reads                                                |

Convex production still records one historical
`getWorkspaceFitScoreHistogram` failure at 18,573,630 bytes / 18,163 rows.
The local Aggregate migration remains the read model for this measured
count/histogram hotspot. It is gated per workspace and does not require a
60,000-prospect global scan.

## Read-budget contract

- Convex query transactions are capped at 16 MiB and 32,000 documents.
- Dashboard source reads are split into inclusive 31-day chunks.
- With one baseline plus 32 stripes/day, one daily read-model transaction is
  capped at 1,023 rows. Agent Ops loads Analytics and Agent Ops concurrently as
  separate transactions, never as one combined transaction.
- Detailed record reads use 250 requested items with explicit 300-row and 2 MB
  scan limits. Actions continue from the returned cursor if Convex returns a
  partial page.
- Exact totals are preserved. The browser receives only the requested detail
  page, never the full inventory.
- Time-series presentation is daily through 31 days, weekly through 180 days,
  and monthly above 180 days. A one-year selection returns 13 chart buckets;
  the selected and comparison totals still cover every hour exactly.

These dashboards are intentionally point-in-time report snapshots rather than
large reactive subscriptions. Workspace status and other operational controls
remain realtime. Changing a range, tab, page, sort, or filter refreshes the
snapshot, and every error surface has an explicit retry.

## Why there are no new global weekly/monthly tables

The existing daily read models are already the exact, reversible source of
truth and are now written through low-contention stripes. Current production
has only 29 Analytics days and 37 Agent Ops days in the largest user workspace,
so another physical period-table migration would add dual-write and backfill
risk without current evidence that the bounded 31-day action reads are slow.

Weekly and monthly rollups are compacted in memory after bounded transactions.
If production action duration or internal-query count becomes the next measured
bottleneck, persisted weekly/monthly tables are the next widen-migrate-narrow
step. They must be dual-written, backfilled one workspace at a time, verified
against the daily source, and gated before read cutover.

## Verification completed locally

- One-year current + comparison range splits into 24 transactions.
- Every transaction is at most 31 days / 1,023 rows per striped daily model.
- One-year charts compact to 13 monthly points without losing the first or last
  millisecond of the selected window.
- 31/32-day and 180/181-day granularity boundaries are covered.
- Existing analytics and usage exactness tests still pass.
- The full Convex suite passes with 549 tests after rebasing on deployed PR #42.

Production largest-workspace verification cannot run until this code is merged
and deployed. No production control or data was changed while preparing it.

## Controlled rollout

1. Push this branch and open one large-range reliability PR. Keep the existing
   fit-score Aggregate commit in the same PR so code and rollout gates stay
   aligned.
2. Merge only after Vercel, typecheck, lint, full tests, build, Convex review,
   security review, and React verification are green.
3. After deployment, observe production with every
   `fitScoreAggregateRollouts` row still absent or non-verified. The bounded
   dashboard actions and detail pagination are safe immediately and require no
   data migration.
4. Exercise 30-day, one-year, and all-time Analytics, Agent observability,
   Usage, Prospects counts, discovery, memory inventory, and detail panels on
   `ReacherX (Leads)` read-only. Record action duration, subquery count, bytes,
   rows, and any resource-limit event.
5. Pause one low-traffic workspace. Run only that workspace's bounded fit-score
   Aggregate backfill and exact verification. Test histogram platform, type,
   status, and date filters, then resume it.
6. Expand the Aggregate migration workspace by workspace. Never run a global
   prospect scan and never mark a workspace verified unless exact source and
   Aggregate bins match.
7. Hold persisted weekly/monthly tables unless the production canary shows the
   bounded snapshot duration is still unacceptable. If that threshold is
   crossed, introduce them additively in a separate PR and repeat the same
   workspace-scoped gate.
8. Handle legacy tables, indexes, compatibility endpoints, and component state
   only in the separately approved cleanup phase after proving reads and writes
   are absent.
