# Synthetic onboarding verification

Date: September 6, 2026. Isolated branch: `codex/synthetic-onboarding`, based on `origin/main` at `8d6a3029`.

## Isolation

The original dirty checkout was preserved on `codex/preserved-local-work-before-onboarding`. Local main was advanced to origin/main before creating the isolated worktree. Only approved onboarding UI/reference changes were carried forward. No commits or pushes were made.

The app was tested at localhost:3001 against a separate anonymous local Convex deployment at 127.0.0.1:3215. No production Convex deployment or customer records were changed. Real Sol requests ran against this local app. Billing was simulated with a local plan row; no charge was made. Social sending credentials were not installed in the local backend.

## Browser QA performed

- Actual production setup entry, composer submission, structured classification, Sol generation, and persisted review.
- Customer prospecting: two personas → four examples, then natural-language feedback → one persona/two examples.
- Real ProspectCard rendering with X/Twitter and LinkedIn badges, names, titles and bios; no synthetic contact/detail actions.
- Reload during review preserved the approved input and current generation. Older conversation snapshots remained read-only.
- Submitting feedback immediately disabled Continue; generation locked the composer.
- Existing connections UI, optional “Connect later”, disabled composer during connection/plan gates.
- Free-user plan gate and existing upgrade actions; no extra Continue in the plan screen.
- Existing billing success route consumed a locally simulated verified paid plan, finalized setup and started the real workflow.
- Inline ongoing-work status at zero results and View prospects navigation to the real app.
- Additional-workspace recruiting flow: dynamic candidate terminology, two personas/four examples, then one persona/two examples. Existing paid plan skipped plan selection.
- Injected a local generation failure during a real run. Verified the shared retry card, editable composer, Retry → real generation → review, and correct use-case copy.
- Desktop review and 390×844 mobile plan layout; no horizontal overflow. Viewport restored afterward.
- Workspace editor with one profile: found and fixed the obsolete padding to three profiles. Added a regression test.
- Edited the real workspace profile description: Sol regenerated its examples and targeting rules. Found and fixed a restart race caused by the publication trigger changing the targeting fingerprint; repeated the edit and verified discovery resumed.
- Changed the workspace description to add product designers: the manually edited React-engineer profile was preserved, the designer profile was added, both received two examples, and discovery restarted.
- Inspected dark-mode review and light-mode ongoing status. Restored the original System theme.

## Automated checks

| Check                                          | Final result                    |
| ---------------------------------------------- | ------------------------------- |
| TypeScript (`tsc --noEmit`)                    | Passed                          |
| Lint (`oxlint --deny-warnings`)                | Passed                          |
| Prettier (all changed and new supported files) | Passed                          |
| Vitest (`--maxWorkers=2`)                      | 136 files, 733 tests passed     |
| Node tests (`tsx --test tests/*.test.ts`)      | 504 passed, 3 baseline failures |
| Production build (`next build`)                | Passed                          |
| Git whitespace check (`git diff --check`)      | Passed                          |

All checks ran in the isolated worktree. No tests were skipped or weakened to hide failures.

The suite covers ownership, stale and repeated approval, payment gating, exactly-once startup, late generation/failure callbacks, retry context, unfinished legacy upgrades, concurrent workspace edits, complete platform coverage, manual pause protection, profile deletion, and existing auth/routing and prospecting behavior. Convex tests use the official convex-test/workflow component harnesses.

Three Node source checks also fail on an untouched checkout of origin/main: model-role environment templates, existing Post panel divider expectations, and qualification structured-output/fallback expectations. These are baseline failures, not changes introduced here. They are not hidden or suppressed.

A full-suite run under simultaneous live workflow load hit a 5-second timeout and exposed a setup lifecycle test unintentionally running the downstream discovery pipeline without its external-service components. The test now asserts exactly one discovery-start job, cancels that job inside the test harness, and finishes the setup workflow. The complete suite then passed with two workers. No tests were skipped or timeout limits increased.

## Review

CodeRabbit's first connection failed with “WebSocket closed”. The retry completed with 12 issues. Confirmed issues were fixed: stale setup tool descriptions, grammar, unavailable-state handling, status/timer consistency, explicit owner validation, targeting-rule refresh, and stale-publication reporting. The undefined-generation-revision issue was not reproduced: submission and upgrade already persist a revision before approval. The retry-input recommendation was superseded by the dedicated revision-preserving retry mutation.

A second completed CodeRabbit review covered all 73 changed files and reported four findings. The documentation placeholder was replaced with final results; legacy compatibility actions now explicitly await and return null; restart uses the actual post-publication workspace fingerprint (including trigger changes). The recommendation to clear keyword queues after publication was rejected: each deletion batch already checks the same input revision, and clearing before publication keeps discovery gated until cleanup completes. Moving cleanup after publication could remove newly resumed queries. A regression test verifies stale cleanup cannot delete the current queue.

React Doctor was run on changed files and the full repository. The untouched baseline scored 35/100. The changed checkout's maintainability analysis did not complete, so no comparable score was available. Its baseline errors were not broadly refactored into this branch.

## Limits

This is real browser/backend/model QA, but not a live payment or social-provider certification. Fresh WorkOS callback on port 3001 was not verified: the configured OAuth callback still uses port 3000, and testing used an authenticated localhost session. Live X/LinkedIn authorization, sending, billing webhooks, and production deployment migration still need staging verification before release. Live search, qualification, and enrichment were verified in the follow-up below using development provider credentials.

No claim is made that every possible edge case or a production rollout has been tested.

## Follow-up after user QA

### Corrections

- Product descriptions now infer plausible audiences when the user has not specified roles. Explicit audience restrictions still take precedence. Product benefits do not become invented job titles, shopping requirements, or separate personas.
- Examples describe ordinary occupations, projects, and interests. Synthetic posts can show everyday work, not only pain or buying intent. The example generator remains on the existing Sol route.
- Discovery business context contains the user's descriptions, not fictional biographies. Qualification receives examples grouped under their owning ICP with explicit instructions that they are illustrations, not evidence or extra requirements. Names and incidental biography details are not search constraints.
- Continue atomically saves one use-case-specific user approval message alongside the state transition. Duplicate clicks do not create duplicate acknowledgements. Chat approval retains the user's actual message instead of inserting another.
- The new read-only setup tool returns actual saved ICPs and targeting criteria after checking ownership. It reads current workspace targeting after setup finishes.
- The inline progress card fills its message container. Missing search configuration stops discovery with an actionable status shared by onboarding and the global Agent dialog, rather than indefinite automatic recovery.

### Real end-to-end evidence

Tested the real `/agent/setup` implementation, not the mock preview. The local backend received existing development discovery/enrichment credentials without logging values or changing the development or production deployment.

1. Original ScreenSei description generated five audience ICPs and ten examples. A fresh generation after the prompt correction used one required practical-use criterion and did not require shopping/adoption intent. Ordinary roles included product designer, software engineer, instructor, support professional, and product marketer. Each ICP had an X/Twitter and LinkedIn example.
2. Asking Agent for the saved ICPs returned the persisted titles and criteria. Feedback updated the targeting and examples together.
3. A separate browser edit, “Keep only solo B2B SaaS founders. Remove every other audience,” produced one ICP and two examples. Continue was unavailable and the composer locked during generation; review reopened the composer. Deleting this QA draft through the UI returned to the existing workspace.
4. Continue on the completed ScreenSei review persisted `I approve these example prospects. Continue with setup.` The message remained after reopening the thread. Connect later completed the connection gate with the existing paid-plan test fixture, and the real workflow started.
5. Live discovery returned **411 records: 56 X/Twitter and 355 LinkedIn**. Two LinkedIn candidates qualified at 96 and 97, completed enrichment, and received `readyAt`. Real evidence included technical gameplay demonstrations and a QA/developer's explicit screen-recording bug-report workflow. No synthetic prospect records or fabricated qualification evidence were inserted.
6. The inline card and global Agent dialog showed **411 found / 2 qualified / 2 enriched**. View prospects navigated to the real app; enriched profile data rendered in the existing ProspectCard. The QA workspace was then paused through the global Agent dialog to stop further discovery.

Reproducible local evidence: completed setup thread `m576x26nnwax596r2y354w46eh8dwmtk`; workspace `xh79bxh4kcm22w22p0xjkhg9bd8dxtzr`. Provider run summary was saved locally to `/tmp/synthetic-followup-e2e-final.json`. Test output is in `/tmp/synthetic-followup-full-vitest-2.log`, `/tmp/synthetic-followup-node-tests.log`, and `/tmp/synthetic-followup-build.log`.

### Additional regression checks and review

Added coverage for missing/partial/blank provider configuration, actionable status derivation, exactly-once approval messages, discovery context excluding fictional bios, and saved-targeting tool ownership/current-workspace behavior. Existing revision, concurrent-edit, retry, cancellation, legacy migration, and auth-routing suites passed.

The follow-up CodeRabbit review completed over all changed files and raised **two minor issues**. Both were valid and fixed: generic configuration-error copy in the global Agent dialog and a personal worktree path in the checklist. TypeScript, lint, Prettier, production build, full Convex suite, and Git whitespace checks passed. The Node suite still has exactly the three independently reproduced baseline failures listed above.

### Performance and remaining limits

The initial generation took about 63 seconds; a separate fresh generation took about 41 seconds. During the 411-record background qualification run, a subsequent setup revision waited in the existing shared workflow queue before executing. This is a load-related delay, not evidence that removing preview makes every onboarding interaction instant. Scheduling policy was not changed in this branch. A sustained staging load test is still needed before promising a latency target.

Two qualified results from 411 discoveries proves execution and evidence flow, not superior targeting quality or a production yield comparison. No thresholds were lowered to produce matches. The local Next.js issue overlay reports the absent PostHog analytics token in the unchanged provider; it is not an onboarding runtime error.
