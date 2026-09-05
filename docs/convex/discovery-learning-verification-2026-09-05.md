# Discovery and qualification verification — 2026-09-05

## Scope and release decision

The combined discovery, qualification, learning delivery, targeting freshness, existing-workspace repair, and reporting changes passed local and isolated QA verification. They are ready for maintainer review as one release. Production deployment and migration have not been performed. Do not merge an incomplete subset or enable automatic merge.

The review branch is `codex/discovery-learning-completion`, based on `316fc9025746c815f7e85c8a1e9965da807b60c9`. The original working checkout and its uncommitted changes were preserved. QA used `tremendous-moose-99`; normal development uses `fast-poodle-167` and was not deployed by this work.

## What was corrected

- Preserve the original contact objective, mandatory requirements, preferences, exclusions, and required activity evidence through targeting generation and qualification.
- Search with strict, balanced, and broad stages; pass supported LinkedIn and X filters at the provider boundary, preserving meaningful syntax and full persisted source text.
- Deliver promoted reusable lessons to discovery and subsequent prospects. Keep their source prospect as provenance while retaining person-specific operator restrictions.
- Fingerprint targeting for learned memories, semantic examples, candidates, executable queries, performance, qualifications, and audits. Reject stale in-flight writes and stale context after targeting changes.
- Provide a paused, durable repair workflow with a mandatory dry run, an explicit apply limit, 25-record pages, at most 1,000 scanned records per run, continuation cursors, and a single active run per workspace. Repair uses normal qualification and suppresses automatic enrichment/outreach.
- Keep verified reporting versions 1 and 2 compatible; migrate explicitly to version 3 with exact parity checks. Deletion clears retained legacy namespaces without changing migration's destination semantics.

## Verification performed on the combined implementation

| Check                         | Result                                                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| Convex/Vitest suite           | 715 tests passed across 131 files; no unhandled errors                                       |
| Node regression suites        | 43 tests passed, including plan usage/analytics and batch behavior                           |
| TypeScript                    | `tsc --noEmit` passed; Convex deployment type checking passed                                |
| Lint                          | Oxlint with `--deny-warnings` passed                                                         |
| Production build              | Next.js 16.2.9 build passed                                                                  |
| Formatting and diff hygiene   | Prettier and `git diff --check` passed                                                       |
| CodeRabbit                    | Initial review raised 8 issues; follow-up review raised 0                                    |
| Existing QA dashboards        | 24 successful analytics/Agent Ops reads across six workspaces, using 7-day and 30-day ranges |
| Existing reporting migrations | All six version-3 checkpoints verified with matching recorded expected and aggregate totals  |

Two expanded migration tests initially exceeded Vitest's default five-second timeout during the full parallel suite. An unnecessary second migration was removed and a scoped 30-second timeout applied to those integration tests. The subsequent complete suite passed. Workflow test cleanup also drains/cancels scheduled test work so background model calls cannot escape test teardown.

### Real-model qualification controls

Four recorded public-evidence cases were run three times each with learning enabled and disabled: 24 model calls. Every call produced the expected verdict. The cases cover direct hiring authority with non-U.S./onsite preferences, talent-pool/market-research activity, an explicit “No agencies” restriction, and a remote engineering hiring announcement. Verdicts were unchanged between conditions; a small score variation occurred in one case.

These controls demonstrate no verdict regression on this set. They do not establish a statistically measured accuracy improvement, and they are replayed evidence rather than a fresh discovery-yield benchmark.

### Fresh four-record repair and learning pilot

A separate QA fixture account and workspace were created, with test-only plan entitlements. Targeting was regenerated from the original request while discovery remained paused. Generation preserved active hiring as essential and U.S./remote as preferences.

- Dry run: exactly 4 scanned, 4 eligible, no writes to qualification decisions.
- Apply: 4 completed, 0 failed; 2 qualified and 2 disqualified.
- All four qualification events reached `processed`.
- Seven canonical memories were active and indexed `ready`; six applicable promoted lessons were returned to discovery.
- Query performance reported 4 prospects found, 2 qualified, and a 50% qualification rate.
- The subsequent discovery action returned ten platform query entries with strict/balanced/broad stages; LinkedIn people queries were correctly absent for required activity evidence.
- A repeat repair dry run found 0 eligible and skipped all 4 current decisions.
- Monthly analytics showed 4 prospects, 2 qualified, 2 disqualified, and 0 pending. Usage showed 2 qualified prospects after the fixture was marked setup-complete. Automatic enrichment was suppressed, so the ready count correctly remained 0.

### Live targeting boundary

After learning completed, the dedicated QA audience was temporarily changed. The fingerprint changed, discovery returned zero stale lessons and zero stale performance rows, and an old-fingerprint qualification write was rejected. Restoring the audience restored its six applicable lessons. Source qualification and memory fingerprints were also inspected directly.

Integration regressions additionally cover source ownership, legacy use-case normalization, scoped operator instructions, stale semantic content after requalification, late evaluator events, stale query screening, repair locking and pagination, and reporting readiness gates.

### Browser verification

The isolated application was served locally at the configured login origin. Verified populated prospect cards, qualification details, preserved source evidence, monthly Analytics, monthly Agent observability, and Usage. QA D displayed 125 total prospects, 2 qualified/ready, and 123 disqualified. No browser errors were captured for the completed flow. The original development server was restored afterward.

An initial attempt on another local port encountered an authentication refresh failure. Verification succeeded on the configured origin; no authentication code was changed.

## CodeRabbit triage

The initial eight issues were evaluated against code behavior. Confirmed fixes included actual provider-filter metadata, batch deduplication fingerprints, bounded repair runs, permanent missing-workflow references, LinkedIn OR normalization, excluding generated search hints from targeting identity, and clearing legacy reporting data during deletion.

Suggestions were narrowed where necessary: arbitrary workflow-status errors remain fatal rather than being ignored, and migration continues clearing its destination version rather than the currently active legacy version. The project-required console logging convention was retained. No code change was made merely to satisfy a review suggestion.

## QA incident and cleanup

An early script mistakenly applied a repair after discovering that an existing stress-test workspace contained 1,766 eligible records. The run was canceled promptly. Three QA records were touched: one qualified, one disqualified, and one left pending. No outreach plans were created. The nested workflow was confirmed canceled before its stale prospect reference was cleared. This led to the mandatory reviewed scope limit and bounded continuation behavior above. Subsequent verification used the separate four-record fixture.

Final QA inspection found all seven workspaces paused, no active repair or component workflows, and no pending/processing memory events. Temporary script access tokens were deleted in cleanup. The temporarily installed QA model key was removed. Historical stress data and the canceled run remain available for audit.

## Deployment boundary and remaining release procedure

The locally linked Vercel project configuration uses a build command that also invokes `convex deploy`. Preview key scope could not be verified through the available project connector; the local CLI credential received HTTP 403 from the project API. Therefore this review branch explicitly disables automatic Vercel deployment using the documented branch-specific `git.deploymentEnabled` setting. The isolated backend and local production build supplied the verification environment.

This is not an approval to deploy production. After maintainer approval, follow [the discovery and learning rollout](./discovery-learning-rollout.md) and [the reporting migration procedure](./realtime-reporting-rollout.md): pause and drain, review regenerated targeting, dry-run and apply bounded repairs, separately review engaged prospects, deliberately enrich qualifying records, migrate reporting, verify parity, and resume one canary before expanding. Existing production decisions are not automatically repaired by merging code.

## Evidence and references

Detailed local logs and recorded results are retained in `/private/tmp/reacher-learning-completion/`, including `final-tests-2.log`, `node-tests.log`, `final-build.log`, `coderabbit-final.ndjson`, `live-controls.json`, `small-repair.json`, `pilot-provenance.json`, `post-learning-check.json`, `live-targeting-boundary.json`, and `reviewed-dashboard.json`. These artifacts are local QA evidence, not production telemetry.

The implementation and operational checks used the installed SDKs, project skills, and primary documentation: [Convex agent context](https://docs.convex.dev/agents/context), [Convex Workflow](https://github.com/get-convex/workflow), [Convex testing](https://docs.convex.dev/testing/convex-test), [AI SDK structured generation](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data), [Convex deployment separation](https://docs.convex.dev/production/multiple-deployments), and [Vercel branch deployment controls](https://vercel.com/docs/project-configuration/git-configuration).
