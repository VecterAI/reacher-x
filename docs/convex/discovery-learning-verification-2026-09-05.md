# Discovery and qualification verification — 2026-09-05

## Current release boundary

The release now covers future discovery, qualification, and learning for new activity in existing workspaces. It excludes bulk requalification and reporting v3. Existing saved decisions must not be rewritten by the rollout. Production has not been deployed or migrated; keep the PR draft and unmerged until release approval.

Branch: `codex/discovery-learning-completion`, based on `316fc9025746c815f7e85c8a1e9965da807b60c9`. The original checkout and its uncommitted changes remain preserved. The earlier combined implementation is preserved at `e1e9de2045bf369bde4b2691d7215d940708fb61` on `codex/discovery-learning-full-snapshot`. Reporting work is parked separately on `codex/reporting-v3-deferred` at `8fcd8ee3` and has not been published as a separate release.

## Included behavior

- Preserve the original contact objective, mandatory requirements, preferences, exclusions, and required activity evidence through targeting and qualification.
- Generate strict, balanced, and broad searches; pass supported LinkedIn/X filters, preserve meaningful syntax, and persist full source text.
- Deliver reusable promoted lessons to discovery and subsequent qualification. Keep person-specific restrictions scoped.
- Fingerprint targeting for memories, semantic examples, candidates, executable queries, performance, qualifications, and audits. Reject stale context and in-flight writes after retargeting.
- Refresh workspace targeting and queries without reevaluating old prospects. The normal deduplication/qualification guards preserve completed decisions.
- Use the installed OpenRouter provider's `textEmbeddingModel` API for its embedding fallback. Fresh QA with only an OpenRouter key exposed an invalid method call that the OpenAI-primary environment had masked; a regression now constructs the real installed provider without network access.

The removed bulk repair workflow, repair-only schema/validators, and repair-specific tests are absent from the final tree. Reporting files match `main` exactly, retaining aggregate version 1. Reporting v3 migration is not required by this release.

## Current verification

| Check                  | Result                                                                      |
| ---------------------- | --------------------------------------------------------------------------- |
| Convex/Vitest suite    | 711 tests passed across 132 files, without unhandled errors                 |
| Node regression suites | 43 tests passed                                                             |
| Convex deployment      | Pushed successfully with type checking to isolated `pleasant-kookabura-347` |
| Next.js build          | Passed with the installed Next.js 16.2.9 configuration                      |
| TypeScript             | `tsc --noEmit` passed                                                       |
| Strict lint            | Passed                                                                      |

The new integration regression snapshots four existing records (qualified, disqualified, contacted, archived), refreshes targeting/searches, and checks complete records remain unchanged. Attempts to start qualification for those completed records return no work. Only a newly inserted prospect schedules qualification, and its decision receives the current targeting fingerprint. Reporting checkpoint state remains unchanged and aggregate version stays 1.

A separate fresh QA deployment is used for the current future-only verification because the older QA deployment already contains reporting v3 data. A version-1 fixture is prepared before the rollout test; the tested refresh/new-activity transition must not perform any migration. Its results and cleanup are recorded in `future-only-live.json`, `future-only-complete.log`, and `future-query-reuse.json` under the local evidence directory.

### Live future-only results

The isolated existing-workspace fixture passed all ten checks:

- Two old records (one qualified, one disqualified) remained byte-for-byte unchanged after targeting refresh and after new activity. The unit regression additionally covers contacted and archived records.
- Targeting refresh preserved U.S./remote as preferences and left discovery paused. It generated eleven future query entries.
- Two newly inserted recorded-evidence prospects completed the ordinary durable qualification workflow. Both were correctly disqualified and stamped with the current targeting fingerprint.
- Both qualification events reached `processed`. Three promoted memories were active and indexed `ready`; all three reached discovery and qualification context.
- A subsequent real-model generation with those lessons available returned ten query entries successfully.
- The existing reporting checkpoint remained unchanged at version 1 throughout the tested transition. Analytics showed four total prospects, one qualified, three disqualified, and zero pending; Usage remained one qualified prospect. Query performance recorded two new prospects and zero qualified.

The fixture's empty v1 reporting baseline was prepared before the preservation snapshot. No migration occurred during targeting refresh or new activity. There were no outreach plans. The first new prospect initially failed because the isolated environment lacked the external-page-reading credential; after configuring that QA dependency, the normal scheduled retry completed successfully. Test-harness fixes handled CLI null output, normalized keyword text, and reading full persisted metadata rather than the deliberately reduced workflow projection. These were verification-script corrections, not additional product behavior changes.

Both model/page-reading credentials were temporary QA dependencies. Final cleanup paused the workspace, drained qualification and learning work, and removed those credentials; script access tokens were revoked. The fresh deployment expires after seven days.

## Earlier verification retained as supporting evidence

The prior combined implementation on isolated `tremendous-moose-99` passed 715 tests and an earlier CodeRabbit follow-up raised 0 issues. Those counts include now-removed repair/reporting tests and do not describe the final tree.

Four recorded public-evidence cases were run three times each with learning enabled and disabled (24 model calls). All produced the expected verdicts: direct hiring with non-U.S./onsite preferences, talent-pool/market-research activity, explicit “No agencies,” and remote engineering hiring. These demonstrate no sampled verdict regression, not a measured accuracy improvement or a fresh discovery-yield benchmark.

The earlier learning pilot processed four qualification events, produced seven active indexed memories, delivered six reusable lessons to discovery, and generated ten subsequent query entries. A live targeting change excluded stale lessons/performance and rejected an old-fingerprint qualification write. Restoring the target restored applicable fingerprinted lessons. These checks exercised learning code retained in the current release.

Earlier browser checks covered populated prospect cards, source evidence, monthly Analytics, Agent Ops, and Usage without captured browser errors. Those checks used the previous isolated QA data/reporting version; they do not substitute for current v1 compatibility checks. No frontend or authentication code is changed by the scope correction.

## Review and QA history

The current CodeRabbit review of the scope correction raised two minor documentation issues and no code issues. The claimed mismatch with `main` was rejected: `docs/convex/realtime-reporting-rollout.md` has the exact same Git blob (`955f451400ce88c8f4a5b822e90222b411f37806`) as `main`. The request for explicit deployment selectors is useful for the separate reporting procedure and is already implemented in the parked reporting branch. The active future-only runbook expressly forbids migration and requires environment confirmation. Neither suggestion warrants reintroducing reporting changes here. The new provider-construction test was also checked locally; CodeRabbit's uncommitted review did not include that untracked file.

CodeRabbit suggestions were checked against actual behavior. Confirmed earlier fixes included provider-filter metadata, candidate deduplication fingerprints, permanent missing-workflow references, LinkedIn OR normalization, and excluding generated search hints from targeting identity. Repair/reporting-specific fixes were removed from this release along with those features.

An earlier QA script incorrectly began repairing a stress fixture with 1,766 eligible records. It was canceled after three QA rows were touched (one qualified, one disqualified, one pending); no outreach plans were created. This happened only in `tremendous-moose-99`, before the future-only scope correction. The feature responsible has now been removed from this PR. Historical evidence remains in local logs; do not repeat that procedure for production.

All seven older QA workspaces were paused, active workflows drained, and temporary model credentials removed after that verification. New future-only QA uses a separate deployment. Normal development (`fast-poodle-167`) and production are not deployment targets of this work.

## Deployment boundary

The linked Vercel build command also invokes `convex deploy`. Preview key scope could not be verified using the available connector/CLI. Therefore the feature branch disables automatic Vercel deployment using the documented branch-specific `git.deploymentEnabled` rule. This does not affect `main`. No Vercel deployment was performed.

After explicit release approval, follow only [the future-only rollout](./discovery-learning-rollout.md): pause/drain, refresh workspace targeting from the original request, verify old decisions and reporting checkpoint remain unchanged, then resume future discovery. Do not audit/requalify historical prospects or run reporting migration as part of it.

## Evidence and primary documentation

Local evidence directory: `/private/tmp/reacher-learning-completion/`. Current evidence uses the `future-*` prefix. Earlier supporting evidence includes `live-controls.json`, `small-repair.json`, `post-learning-check.json`, `live-targeting-boundary.json`, and `reviewed-dashboard.json`. These are QA artifacts, not production telemetry.

Implementation and checks used the project skills and installed SDKs, [Convex agent context](https://docs.convex.dev/agents/context), [Convex Workflow](https://github.com/get-convex/workflow), [Convex testing](https://docs.convex.dev/testing/convex-test), [AI SDK structured generation](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data), [OpenRouter's provider API](https://github.com/OpenRouterTeam/ai-sdk-provider), [Convex deployment separation](https://docs.convex.dev/production/multiple-deployments), and [Vercel branch deployment controls](https://vercel.com/docs/project-configuration/git-configuration).
