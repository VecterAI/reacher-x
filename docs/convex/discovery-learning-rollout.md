# Discovery and qualification learning rollout

## Release boundary

Treat discovery, qualification, lesson delivery, targeting freshness, existing-workspace repair, and reporting as one verified release. Separate commits or PRs may help review, but do not merge or deploy an incomplete subset to `main`. Production rollout requires release approval after the combined diff passes review and verification. The review branch `codex/discovery-learning-completion` has automatic Vercel deployments disabled in `vercel.json`; its backend is verified on an explicitly selected isolated QA deployment. Before enabling a hosted preview, verify that its `CONVEX_DEPLOY_KEY` is a preview key, as described in the [Convex deployment documentation](https://docs.convex.dev/production/multiple-deployments). The branch-specific rule does not disable deployment of `main`.

## What the system learns

The system learns query performance and advisory lessons from evaluated outcomes. It does not rewrite its own code or guarantee that every later decision improves.

1. Discovery records search results and their query lineage.
2. Qualification evaluates persisted prospect-authored evidence against the workspace's current required, preferred, and exclusion criteria.
3. Workflow events feed the evaluator. Validated lessons are promoted into canonical workspace memory; query outcomes update query performance.
4. Discovery receives applicable operator instructions and reusable pipeline lessons. Qualification retrieves those lessons and relevant verified examples for the next prospect.
5. Query prioritization uses measured outcomes alongside exploration. Strict/balanced/broad discovery stages remain a configured bootstrap policy, not a learned policy.

Lessons remain advisory. They cannot supply missing source evidence or override the current targeting requirements. The learning-enabled and learning-disabled model controls are regression checks; equal outcomes do not establish a measurable accuracy gain.

## Targeting and source ownership

A fingerprint identifies the audience description, original user request, use case, profile requirements, and targeting specification. Synthetic search copy and operational settings do not change this identity. Legacy use-case defaults normalize identically in database and workflow views.

New lessons, query candidates, query performance, executable keywords, qualification decisions, audit runs, and semantic examples carry their targeting provenance. Writes from an older in-flight generation or qualification are rejected. A delayed enrichment or outreach event retains its source qualification's targeting provenance. Old semantic content is rejected even when the source prospect has subsequently been requalified.

Before the first targeting reset, unversioned legacy learning remains compatible. After an explicit reset, unversioned historical learning is excluded until re-evaluated. Changing the targeting does not silently re-label old decisions as current.

Reusable pipeline lessons retain `sourceProspectId` as provenance. A legacy learned lesson's `prospectId` is interpreted as its source when its source/category defines a reusable qualification, enrichment, or outreach lesson. Person-specific operator instructions retain their original scope. Cross-workspace lessons and examples remain excluded.

## Existing workspace procedure

Run every command against an explicitly selected deployment. Rehearse this procedure on isolated QA data first.

1. Pause and drain discovery and any existing qualification/enrichment work. Inspect active workflows; a paused workspace flag alone is not evidence that background work has ended.
2. Regenerate and review the workspace's targeting specification against its original request. In particular, distinguish mandatory requirements from preferences and preserve the contact objective. Regeneration uses a compare-and-set check so a concurrent targeting edit cannot be overwritten by an older model response.
3. Keep discovery paused after regeneration. For an operator-led migration, call `workspaceSettingsActions:regenerateWorkspaceTargeting` with `resumeProspecting:false`; the normal settings flow resumes prospecting by default. Confirm that obsolete queries and learning no longer enter current context.
4. Read the current repair fingerprint:

   ```bash
   pnpm exec convex run --deployment <deployment-name> workflows/workspaceRequalification:getReadinessInternal \
     '{"workspaceId":"<workspace-id>"}'
   ```

5. Preview one page without changing prospects, then run the durable dry run for the complete bounded scan:

   ```bash
   pnpm exec convex run --deployment <deployment-name> workflows/workspaceRequalification:previewPageInternal \
     '{"workspaceId":"<workspace-id>","targetingFingerprint":"<fingerprint>","cursor":null}'
   pnpm exec convex run --deployment <deployment-name> workflows/workspaceRequalification:startInternal \
     '{"workspaceId":"<workspace-id>","targetingFingerprint":"<fingerprint>","dryRun":true,"maxProspects":100}'
   ```

   Inspect `getReadinessInternal` until the active workflow clears. Review `lastResult` and `lastError`; starting a workflow is not proof of success. Pages contain 25 prospects and each run scans at most 1,000. If `isDone` is false, retain `continueCursor`; repeat dry run and apply with that same `cursor` for the next chunk. `maxProspects` must be between 1 and 1,000. Setup previews, contacted/archived prospects, prospects with outreach plans or active workflows, and already-current completed decisions are skipped.

6. After reviewing the eligible scope, start the same run with `dryRun:false`
   and set `maxProspects` to the reviewed eligible count. The server requires a
   completed dry run for the same targeting and rejects a larger scope. It resets eligible decisions using the shared qualification mutation and executes the ordinary qualification workflow sequentially, with automatic enrichment disabled. It records learning and updates reporting through the existing paths. It neither sends outreach nor starts outreach plans.
7. Inspect the final result, individual verdicts and evidence, evaluator events, memory indexing, and query performance. A failed/canceled run records its error and releases the workspace lock. Investigate any skipped or failed record; use existing qualification recovery for stale workflow IDs before retrying. Current successful decisions are skipped on a repeat run. Targeting changes invalidate the run; preview again before restarting.
8. Handle already-engaged prospects deliberately with the existing qualification audit/application workflow. A repair scan that skips them is not a complete audit of their decisions. Existing audit results are invalid after targeting changes; generate a new audit rather than applying stale results.
9. For repaired qualified prospects that still need enrichment, review and enqueue the existing `workflows/enrichment:startEnrichment` path deliberately after qualification review, keeping automatic outreach disabled until the rollout is accepted. A qualification-only repair does not claim those prospects are enriched or ready for outreach. Drain learning work, then follow [the reporting migration procedure](./realtime-reporting-rollout.md). Verify version-3 totals, monthly dashboards, Agent Ops, and Usage. Verify idempotency before resuming discovery.
10. Resume one workspace, observe the next discovery/qualification cycle, then expand sequentially. Retain the original request, reviewed target, run IDs, skip/error counts, and verification evidence.

## Rollback and interrupted work

Do not delete historical learning to roll back. Fingerprints separate current context from history. Preserve the paused workspace, workflow journals, original target, evidence, and reporting data while diagnosing a failure. Cancel a repair through the workflow component when necessary and verify its completion callback released the lock. Do not manually clear a running lock.

Schema fields are optional for compatibility, but rolling back code can remove the freshness guards. Keep affected workspaces paused if the previous version cannot honor targeting provenance. Reporting rollback uses its own readiness marker and bounded snapshots; never bypass an aggregate parity failure.

## Verification contract

Before release, require clean type checking, the full test suite without unhandled errors, build/lint checks, review of legitimate CodeRabbit issues, and deployed QA evidence for:

- Fresh targeting generation and preservation of required-versus-preferred intent.
- Promotion → canonical memory → discovery and another prospect's qualification context.
- Current evidence and explicit requirements taking precedence over learned advice.
- Stale in-flight decisions, query screening, and semantic entries being rejected after retargeting.
- Single-run repair locking, pagination, dry-run immutability, deliberate skipped records, and durable completion.
- Qualified/disqualified counts, learning events, and query-performance updates after repair.
- Version-1/version-2 compatibility and exact version-3 migration totals, including unverified/failed reader gates.
- Browser rendering of the resulting prospects and reporting data.
