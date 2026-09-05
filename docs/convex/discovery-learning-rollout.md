# Discovery and qualification: future-only rollout

## Release scope

Existing workspaces should use the improved system for future discovery and newly discovered prospects. Existing saved qualification decisions must remain unchanged by the rollout. Do not run qualification audits, bulk requalification, historical learning replays, or reporting migrations as part of this release.

The bulk workspace requalification feature has been removed from this PR. Reporting implementation and rollout documentation match the current `main` baseline (aggregate version 1). Reporting v3 work is parked separately on `codex/reporting-v3-deferred`; it is not a dependency of this release and needs its own verification before any future release.

The review branch is `codex/discovery-learning-completion`. Keep its PR unmerged until the complete future-only change passes review and verification. Production deployment requires explicit approval. Automatic Vercel deployment is disabled for this branch in `vercel.json`, because the linked build command also invokes `convex deploy`. This branch-specific rule does not affect `main`.

## What refresh means

Regenerate the workspace's machine-generated targeting and search phrases from the user's original request. Preserve manually maintained profiles and the distinction between requirements, preferences, and exclusions. The operation updates workspace configuration and replaces executable search queries; it does not reevaluate stored prospects.

New discovery uses the regenerated configuration. New qualification uses current evidence and targeting. Rediscovery of an existing person follows ordinary deduplication behavior: it may update source evidence, but does not enqueue another qualification for an already completed decision. The rollout does not freeze unrelated normal user actions on existing prospects.

## How learning continues

1. Future searches record query outcomes and source lineage.
2. New prospects are qualified against the current targeting and persisted evidence.
3. Evaluators turn qualifying events into advisory lessons and query-performance signals.
4. Discovery and subsequent qualification receive applicable lessons; query prioritization uses measured performance alongside exploration.

Target fingerprints prevent old or in-flight results from contaminating a changed audience. Historical records are retained. Unversioned old lessons stop participating after an explicit targeting refresh; future lessons accumulate normally. Person-specific instructions retain their scope, and learned advice cannot override evidence or mandatory criteria.

This is feedback-driven adaptation, not automatic code rewriting. A working loop does not guarantee that every future result is better. The model controls documented in the verification report establish no verdict regression on the sampled cases, not a measured accuracy improvement.

## After explicit production approval

The following is a release procedure, not authorization to execute it now:

1. Record the approved code revision and workspace scope. Pause one canary workspace and let existing work finish before taking the comparison snapshot. Record its saved prospect decisions and current reporting readiness/version.
2. Release the reviewed code through the normal approved deployment path. Confirm the selected Convex and Vercel environments before running commands.
3. For the canary, call the existing owner-authorized `workspaceSettingsActions:regenerateWorkspaceTargeting` action with the original request, current profiles, and `resumeProspecting: false`. Review the generated targeting. This refresh leaves discovery paused and deletes obsolete search phrases; it does not touch saved prospect decisions.
4. Compare the old prospect records and reporting checkpoint with the snapshot. They must remain unchanged. Do not run a reporting migration or qualification repair to make this comparison pass.
5. Resume normal discovery through the existing workspace controls. The next cycle generates fresh queries. Verify new prospects receive current-fingerprint qualifications, new outcome events process successfully, and applicable lessons reach later discovery/qualification context. Existing dashboard storage remains in use.
6. Pause and investigate if checks fail. Expand to other approved existing workspaces only after the canary passes, using the same future-only procedure.

Do not rewrite historical decisions, regenerate outreach plans for existing prospects, or replay old events to bootstrap this rollout. Any separate user-requested action on an existing prospect remains a distinct operation.

## Rollback

Pause affected discovery before rollback. Preserve workspace configuration snapshots, old decisions, source evidence, and learning history. Rolling code back can remove targeting freshness guards, so do not resume an old revision without confirming it honors the saved targeting provenance. No reporting version change or reporting rollback is part of this release.

## Verification required

Require clean TypeScript, lint, build, regression suites, and independent review of legitimate CodeRabbit issues. Verify on an isolated deployment that refresh leaves existing decisions and reporting checkpoints unchanged, new prospects are processed normally, and new lessons reach discovery and qualification. Verify current intent/evidence outrank advice and stale writes/context are rejected.

See [the verification report](./discovery-learning-verification-2026-09-05.md). Environment separation follows [Convex deployment documentation](https://docs.convex.dev/production/multiple-deployments) and [Vercel branch deployment controls](https://vercel.com/docs/project-configuration/git-configuration).
