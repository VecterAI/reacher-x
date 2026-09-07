# Prospect quality fixes: verification record

Verification record for the prospect-quality fixes. Intermediate experiments are distinguished from the final code and live run.

## Isolation and scope

Branch `codex/synthetic-onboarding`, starting at `8d6a3029`. Local main and freshly fetched origin/main matched at the start. The original dirty development checkout was preserved. The earlier synthetic-onboarding changes remain in this worktree. Implementation and QA were completed without committing or pushing. The user subsequently authorized a commit, push, and PR; merging still requires their approval.

Only the anonymous local Convex backend (`127.0.0.1:3215`) and local Next.js app (`localhost:3001`) were used for live QA. Existing development discovery credentials and the previous local paid-plan fixture were used. No production deployment, customer requalification, real billing, or outbound communication was performed.

Changes preserve the existing qualification formula, threshold, required/preferred criteria contract, and user-facing flow. Keyword planning, query conversion, and qualification use the existing configurable Sol helper route. People-search candidates fetch a real LinkedIn profile and up to ten posts; provider errors remain technical failures using existing retry handling. Profile evidence cannot prove activity-only requirements or invent recency.

## Automated verification

- `vitest run --maxWorkers=2`: **141 files, 767 tests passed**. Includes provider errors, successful empty activity, identity checks, scope/fingerprint guards, concurrent evidence preservation, profile/either/activity criteria, model routing, legacy summary/detail consistency, bounded query repair/fallback, and workflow-start concurrency. Includes the final standalone-entity query guard and completed-workspace legacy fallback regression cases.
- `tsx --test tests/*.test.ts`: **507 tests passed**.
- `tsc --noEmit`: passed after the final changes.
- `oxlint --ignore-path .gitignore --deny-warnings`: passed.
- Production `next build`: passed. Next 16's separate `.next/dev` output allowed the QA dev server to continue running.
- Prettier applied to changed supported files; final formatting/whitespace checks recorded below.
- The initial Node failure was traced to merged PR #72 (`7f9cfe6c`, “remove duplicate post panel border”). Its old assertion still demanded the removed Twitter border. The assertion now protects the intentional absence of that duplicate border; **no Post panel UI was changed**.
- A model-template check no longer requires an untracked developer `.env.local`; the tracked `.env.example` and configuration must still document every model role.

## Live runs and browser QA

Intermediate ScreenSei run: setup thread `m574n3n9c9a2m9fnmr62b366v58dx6np`, workspace `xh7ajvk55ac11vn3axac7qv7wx8dxrg7`. The exact original ScreenSei description generated five appropriate audience profiles and ten examples. Real browser approval and Connect later completed setup using the existing paid QA plan, then real discovery, qualification, and enrichment ran. The first enriched prospect, Louis, appeared in `/` and opened in the profile panel with the identical saved match explanation.

This run exposed remaining query-prompt defects: a forced strict-first quota, excessive keyword combinations, and customer-prospecting presets overemphasizing purchase pain. Those instructions were corrected. Intermediate yield is not presented as final quality evidence. At the saved snapshot it had 305 discoveries, 55 people profiles with fetched evidence, 23 qualified, 250 still pending, and one enriched. It was paused through the browser. Its data and query performance were exported locally before deleting only this temporary workspace to free the QA plan's fifth slot. The four original audit workspaces were preserved.

Browser checks completed: real card explanation replaces the bio; full profile still retains its bio; new Match reasoning row contains the same value; a saved, real source URL renders as a link in both places. At 390×844 the new row initially clipped long URLs. After adding wrapping, the explanation column's scrollWidth and clientWidth both measured 186px and the full URL was readable. Desktop viewport restored. A local query timed out during simultaneous deployment/test load; a fresh navigation recovered the app. This is recorded rather than hidden.

Fresh recruiting draft: thread `m57777d7jfgpzg5f0r48908jm98dxv95`. The exact original description produced two profiles and four platform examples: senior React engineers and product designers. The required criterion preserves fit for one of those stated roles; persona/channel preferences remain weighted rather than becoming universal requirements. Reviewed in the browser, exported, then deleted only this temporary draft. This was onboarding/persona QA, not a complete recruiting discovery run.

Fresh founder draft: thread `m570k5x83j10pfre6vb949bsd98dw0as`. The original two-audience description produced solo B2B SaaS founders and sales-development managers, with one example per platform per audience. Browser feedback requested founders only. Revision 2 took **26.455 seconds**, retained one founder profile/two examples, and added sales-development-manager exclusions. Reviewed and exported before deleting only this draft. This was generation/revision QA, not a complete founder discovery run.

Final ScreenSei run: thread `m570zw3mf9wvzmdme0h4mt36jd8dw13a`, session `x17c0sgy61cxdzmf8wckn3gajh8dwpj8`, workspace `xh79xfcse766baq5tyecpsq6718dwkz6`. Entered the exact original description in the browser. **46.167 seconds** to four audience profiles/eight examples, then Review → Continue → Connect later → ready using the existing local paid-plan fixture. Real discovery started after setup. Final outcome is recorded below.

The requested `/home` mock was opened in the built-in browser. Its cards use concise activity/fit explanations with keyword highlighting. The actual card now uses the saved qualification explanation with its existing renderer and styling.

## Saved-candidate replay

Used the original corrected ScreenSei targeting specification, unchanged thresholds and saved source text. These are dry-run decisions, not writes to the original prospect qualification records.

| Candidate                | Previous           | Sol replay            | Assessment                                                                                                                                                                                                            |
| ------------------------ | ------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Okwuchukwu Victor        | 0, rejected        | 96, qualified         | Real instructional videos for applications, onboarding and online task workflows; educator meaning recognized without requiring the exact phrase “screen recording”.                                                  |
| Anna Shigirdanova        | 0 without evidence | 97, qualified         | Real profile plus activity fetched. Documentation/internal-tool responsibilities provide a plausible use case; buying intent remains unproven.                                                                        |
| Md. Aminul Islam Bhuiyan | 97, qualified      | 100, qualified        | Explicit screen recordings in bug reports.                                                                                                                                                                            |
| Minsu Kim                | 96, qualified      | 100 fit, disqualified | Technical demonstrations fit; full evidence explicitly restricts accepted inquiries to enterprise PoCs for his products and rejects other inquiries. Goal-conflict gate remains effective independently of fit score. |
| Billy Thompson           | 0, rejected        | 0, rejected           | Cybersecurity news does not establish relevant recording activity.                                                                                                                                                    |
| Grimm                    | 55, rejected       | 81, qualified         | Corrected replay uses the workflow sanitizer and canonical URLs. Instructional software testing and video bug reports establish a practical use; persona and buying fit remain less certain.                          |

Additional saved-evidence negative controls: James Dann (camera/documentary production) scored 0, Richard Edwards (adjacent post-production education) scored 55, and Nancy Xu (actual software instruction/curriculum) scored 81. The first raw Grimm replay lacked canonical source URLs and was excluded; the corrected replay above uses the real workflow sanitizer.

These examples establish specific corrections, not a statistically reliable uplift estimate. High fit scores reflect the user's broad criteria and existing formula; they are not purchase probabilities.

## Query validation and limits

The final fresh workspace retained five X queries, five LinkedIn-post queries, and five LinkedIn-people queries (13 unique texts because two anchors serve both platforms). Both platforms retained **screen recording** and **Screen Studio**. Other queries cover product demos, onboarding videos, course lessons, and support walkthroughs. Generic role-only people searches are broad. The code caps each group at five and requires a standalone named-entity query per requested post platform, with one bounded Sol repair and a bounded keyword fallback.

Controlled provider checks used the original five queries versus generated five-query plans, one page per query, matching 30-day filters. X keyword comparisons used raw search on both sides to avoid the existing exact-search fallback adding extra requests; LinkedIn used relevance sorting. Results and inputs are saved in `/tmp/prospect-fixes-*-compare-*` and comparison index files. Returned volume alone was **not** treated as quality.

Reviewing the first three returned posts per query exposed noise in abstract phrases such as “developer documentation videos.” Planning was tightened to retain conventional category and standalone alternative-tool anchors. The standalone Screen Studio search returned explicit tool users/product-demo creators, including a founder describing hundreds of hours making Loom/Screen Studio demos and a LinkedIn author describing his paid Screen Studio usage and renewal. This establishes useful retrieval opportunities the old plan omitted; it does **not** establish a statistically reliable overall precision/recall uplift. Broad category searches still produce unrelated or incidental uses, which qualification must assess.

The unchanged broad ScreenSei specification can qualify a narrow incidental use: ticket-verification recording scored 80–81, with the saved explanation explicitly saying adoption potential is uncertain. This is a product-quality limitation of the current broad “people who can use it” criterion and unchanged scoring formula. I did not silently add a professional-only/recurring-use gate or make buying intent mandatory.

## Queue race found during live QA

The intermediate run exposed a real race: action starters could enqueue several qualification workflows before the first workflow persisted its lease. The local run accumulated **2,118 qualification workflows** for its temporary workspace, delaying unrelated setup. Starting the workflow and saving its ID now happen atomically in one mutation. Three concurrent starts return one workflow; archived, qualified, missing, deleting-workspace, and wrong-workspace cases start none.

The contaminated intermediate run was paused; its duplicate qualification workflows were cancelled only for that temporary workspace. Local backend/dev processes also ended during the run and were restarted with their existing data. Workpool recovery was invoked for failed scheduled jobs following that restart. The final fresh run's first snapshot had **110 qualification workflows for 110 prospects, maximum one per prospect**. No concurrency limit was increased and no scheduler redesign was introduced.

## Review dispositions

CodeRabbit completed its first review with five issues:

1. Checklist phrasing could imply all-green results: clarified the earlier baseline failures.
2. Empty qualification source IDs could collapse different fallback entries: fixed empty/whitespace handling.
3. Suggested another synthetic-platform refinement: rejected. `validateSyntheticProfileExamples` already enforces exactly one Twitter and one LinkedIn example before persistence; existing regression tests cover it.
4. Suggested treating a prospect deleted during evaluation as a successful skip: no functional retry bug reproduced. The completion handler checks for the missing record and returns without scheduling retries or writing a verdict. Scope mismatch errors remain intentional.
5. Audit application omitted the new display explanation: added optional matchReasoning to the audit contract and persisted it with a legacy reasoning fallback.

React Doctor completed partially: maintainability analysis failed, so no comparable score was available. Its reported timer-cleanup error in AnimatedFitBar is a false positive: the effect clears the timeout both before starting and in its cleanup. Broad pre-existing style/performance warnings were not refactored into this task.

The second CodeRabbit review completed with three findings:

1. Prompt-only five-query limit: fixed schema, normalization and final-output caps; integration-tested overlong model output.
2. Discarded platform output could satisfy entity coverage: fixed per-requested-platform coverage and tested bounded repair/fallback. The final guard also requires the standalone entity instead of a narrower “using Tool” phrase.
3. Legacy refinement paths had inconsistent finalization guards: added the existing “use workspace settings” guard centrally and tested both connection and plan completion against a completed workspace. Completed workspaces remain protected; unsupported legacy refinement is not converted into an unintended new workspace.

## Evidence locations and final checks

Local evidence files use `/tmp/prospect-fixes-*`: saved workspace/session/query/prospect snapshots, replay inputs/results, compiler/test output, browser link fixture, and CodeRabbit NDJSON. The original four audit workspaces were preserved. Temporary QA-only backend helper files were removed, including their generated API references. The local QA plan remains at its original five-workspace limit. A final fetch confirmed both HEAD and origin/main still point to 8d6a3029; the index contains no staged file contents.

The implementation follows Convex's [action error-handling contract](https://docs.convex.dev/functions/error-handling), [durable workflow guidance](https://docs.convex.dev/agents/workflows), and [optional schema-field guidance](https://docs.convex.dev/database/schemas).

Provider parameters were checked against the official [LinkdAPI documentation](https://linkdapi.com/docs) and [X search operator documentation](https://docs.x.com/x-api/posts/search/integrate/operators).

## Final live outcome and limitations

The final paused ScreenSei snapshot contains **190 discoveries, 11 qualified, 27 disqualified, 152 pending, and 11 enriched**. The browser showed the enriched cards; the existing Load new prospects control loaded the newly ready results with the same reasoning renderer and keyword highlights. Luka Barbakadze's card explanation exactly matched the new Match reasoning profile row; his separate Brief intro retained the bio. Opening Qualification sources displayed the actual post proposing a short screen recording of a real workflow, supporting that explanation. No outreach plan was generated or message sent.

The final run did not finish the whole discovery queue. OpenRouter began rejecting requests because the completion allowance exceeded available credits, and later because in-flight reservations consumed the available budget. Those technical failures stayed pending and used existing retry handling. The workspace was paused through the normal confirmation dialog. No credits were purchased and no billing settings changed. This is a bounded successful full-path test, not a claim that all 190 candidates finished processing. LinkedIn people acquisition was exercised on 55 profiles in the earlier live run and in the Anna replay; the final run had not reached people-search evidence acquisition before the pause.

Qualification now explicitly caps output at **16,384 tokens**, using the existing AI helper option, instead of inheriting the provider's 65,536-token completion allowance. The routing regression checks this cap. A final live replay with the cap was attempted but remained blocked by in-flight credit reservations, so it is **not reported as a successful post-cap model run**. Truncated/invalid model responses continue to fail schema validation rather than create an unsupported verdict. OpenRouter documents output limits and credit controls in its [support guidance](https://openrouter.zendesk.com/hc/en-us/articles/51690568268059-How-do-I-cap-my-spending-and-stop-runaway-usage-from-coding-agents).

A later workflow snapshot contained 349 qualification workflow records for 190 prospects: 291 failed attempts, 35 successes, and 23 in progress. These are sequential retries following provider failures, not concurrent duplicates: the 23 active workflows belonged to 23 different prospects, **maximum one active workflow per prospect**. The initial healthy snapshot was 110 workflows for 110 prospects.

Responsive QA used the built-in browser at an effective DOM viewport of **390×844**. The ordinary viewport override did not resize the final tab, so the tab's supported CDP emulation was used and the actual DOM dimensions verified. The reasoning column measured clientWidth=scrollWidth=186px. Emulation and viewport overrides were cleared afterward. The earlier long-source-URL fixture also passed at that width. A fresh desktop reload and supporting-source navigation worked. The browser console reported a missing local PostHog analytics token; it did not report a reasoning-render or hydration failure. The analytics configuration was not changed.

The third CodeRabbit review raised two issues. Its precise border-token test assertion was valid and fixed. Removing the existingWorkspaceId fallback was rejected: the code already refuses completed, missing, or foreign workspaces, and the centralized refinement guard protects legacy refinement. Two new integration cases prove that the legacy fallback cannot overwrite a completed workspace through either connection completion or plan selection. Keeping compatibility for an owned unfinished draft avoids an unnecessary behavior change.

New files were explicitly made visible to Git diff with intent-to-add entries for a final CodeRabbit pass; this stages no file contents and creates no commit. The final pass identified a valid identity-precedence issue in the new evidence collector: a matching username could override a conflicting known profile URN. The collector now requires the stable URN when available, and falls back to username only for seeds without a URN. Three regression cases cover conflicting URNs, renamed usernames with the same URN, and username-only seeds; all 13 affected acquisition tests passed. That review completed with this one issue; both newly added core modules were included in the reviewed-file list. Across four completed passes CodeRabbit raised 11 issues: eight verified issues were fixed and three suggestions were rejected with the dispositions above.

**Merge assessment:** automated code correctness and the complete browser-to-discovery-to-card path have been exercised. The known provider-credit limit prevents claiming a fully drained final batch or a successful live run of the final token-cap adjustment. Broad incidental matches and competing-tool builders remain possible under the intentionally unchanged criteria/score contract; the explanations explicitly flag weak customer-conversion potential. The evidence supports the specific fixes described here; it does not prove a statistical prospect-quality uplift or exhaustive coverage of every possible edge case.

Final delivery checks: 141 Vitest files / 767 tests passed; 507 Node tests passed; TypeScript and strict lint passed after the identity fix. Prettier and `git diff --check HEAD` pass. The production build passes. All requested checklist items are complete with the live-run limitations stated above. Implementation and QA were completed without committing or pushing. The user subsequently authorized a commit, push, and PR; merging still requires their approval.
