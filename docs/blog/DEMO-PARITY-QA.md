# Interactive demo parity and QA

Worktree: `codex/reacherx-blog`, `/Users/salman/.codex/worktrees/reacherx-blog/reacher-x`.
No commits, pushes, deployment, or backend changes.

## To-do

- [x] Check local and remote Git state; preserve existing uncommitted work.
- [x] Inspect the three demos in the built-in browser; read shared components and docs.
- [x] Share the real conversation header, composer, messages, and workspace transition UI.
- [x] Replace disconnected snapshots and authored click coordinates with actual UI actions and measured targets.
- [x] Define complete, bounded hiring-review, CRM-stage, and workspace-switch journeys.
- [x] Refine corners, contextual framing, hover controls, captions, and background motion.
- [x] Run Prettier, type checking, lint, regression tests, and production builds.
- [x] Perform built-in-browser QA and record its limits below.
- [x] Complete the second CodeRabbit review, including previously untracked files.
- [x] Finish final production verification and record Git state.

## What changed

- Live X and LinkedIn conversations and the demo now use `DmConversationHeader`,
  `DmComposer`, and `DmComposerFrame`. The demo also uses the existing
  `ConversationMessageViewport`, `ConversationMessageList`, and conversation menu.
  Backend effects stay in the live adapters. Demo sending and attachments stay local.
- Workspace switching uses `WorkspaceTransitionProvider` and `WorkspaceTransitionBar`.
  It preserves the selected page, disables repeated switching during the transition,
  and changes the local dataset after the loading interval.
- Scenario definitions describe targets and actions. Normal playback operates the
  same mounted app. Seek/replay/manual-resume use explicit checkpoints.
- Cursor positions come from real element bounds, including Radix portals. The
  driver waits for bounds to settle after menu entry animations before measuring.
  Read-only scenes do not generate fake taps.
- Motion values drive camera and background transforms without rendering React on
  every animation frame. Close-ups follow the actual subject. Manual pointer-down
  stops the moving camera; the wider view follows after the click lands.
- Embedded corners are 6px; controls use a compact translucent blur. Hover reveals
  them; keyboard focus and touch have separate visibility paths. All player icons
  are imported from `shared/ui/components/icons/index.tsx`.
- Captions are one short sentence. The longer fictional-data/accessibility notice
  remains screen-reader text. The obsolete fixed-timestamp export script was removed;
  prior exports and `DEMO-PILOT-QA.md` are historical, not current evidence.

## Journeys

| Example    | Actual sequence                                                                                | Deliberate endpoint                                |
| ---------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Hiring     | Role brief → Candidates → Isabelle → Relevant activity → Overview                              | Review the outreach plan; no invented hire         |
| CRM        | Candidate → profile menu → conversation → return → Mark Interviewing → list → Interviewing tab | Isabelle appears in Interviewing and counts update |
| Workspaces | Candidates → workspace menu → People to try the app → workspace menu → Hire a designer         | Same people page with each workspace's own dataset |

## Automated checks

| Check                                                                | Result / evidence                                                                                                                                                                                    |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blog, editorial, auth and demo regressions                           | 48 passed; `/tmp/reacherx-blog-regression-final.log`                                                                                                                                                 |
| Shared prospect, conversation and composer tests; toolbar regression | 78 passed across 16 files; `/tmp/reacherx-demo-shared-tests.log`                                                                                                                                     |
| Production HTTP checks                                               | 13 passed, including all published articles, metadata/images, Markdown, feeds and protected-route redirects; `/tmp/reacherx-demo-http.log`                                                           |
| TypeScript                                                           | Passed; `/tmp/reacherx-demo-types-final.log`                                                                                                                                                         |
| Repository Oxlint                                                    | Passed with no diagnostics after fixes; `/tmp/reacherx-full-lint-final.log`                                                                                                                          |
| Prettier                                                             | All changed implementation files, captions, tests and package file pass; `/tmp/reacherx-demo-prettier-final.log`                                                                                     |
| Production build                                                     | Passed repeatedly; final build log `/tmp/reacherx-demo-build-release-check.log`                                                                                                                      |
| React Doctor                                                         | Same three player/conversation source files: pre-task copy 65/100, current 84/100, zero current errors. Logs `/tmp/reacherx-doctor-player-before.log` and `/tmp/reacherx-doctor-player-current.log`. |

React Doctor's full changed/untracked scan includes unrelated existing blog work.
Its warnings were inspected rather than suppressed: iframe sandbox is explicitly
present; animation frames are cancelled; retained object URLs are revoked on
unmount; subscription callbacks are stable. Component-size and optional lazy-motion
suggestions remain architectural suggestions, not demonstrated runtime failures.

## Built-in-browser QA

Tests used the Codex in-app Chromium browser against development and production
previews. Read-only CDP measurements supplemented semantic UI actions.

| Case                       | Observed result                                                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dropdown pointer alignment | Settled option center versus cursor tip: x error −0.0000122px, y error +0.0000032px. Previously about 5.3px/2.3px due to Radix scale animation; fixed.                        |
| Workspace transition       | Switcher disabled immediately; progress bar visible; Candidates remained during loading; then Prospects showed Daniel/Sofia. Switching back restored the designer candidates. |
| CRM uninterrupted result   | Scene 9 showed Interviewing selected, count 2, Isabelle in the list and Sourced count 2. No player error.                                                                     |
| Real composer              | Typed and sent a local message; it appeared in the shared message list and the editor cleared.                                                                                |
| Editing during playback    | After more than six seconds, state remained `interactive` and the draft was intact.                                                                                           |
| Idle resume                | After leaving the editor, playback returned to `playing`. Article scroll position remained 1318px across the observed continuation.                                           |
| Selecting another person   | From an open conversation, selecting Chloe returned to Chloe's profile, without carrying over Isabelle's nested conversation.                                                 |
| Keyboard seeking           | Home, End, ArrowLeft and ArrowRight move between correct scene checkpoints; seeking pauses playback.                                                                          |
| Fullscreen / Escape        | App state preserved; body scrolling locked; Escape inside the iframe exited and restored focus to Expand demo and the body's previous overflow.                               |
| Controls                   | Hidden outside hover; visible on hover and keyboard focus; compact shared icons and blur checked visually.                                                                    |
| Reduced motion             | Browser media emulation confirmed preference=true, player paused, synthetic cursor opacity=0, and no automatic scene advance.                                                 |
| Narrow layout              | 320px: document scrollWidth=320, demo 288×162. 390px: scrollWidth=390, demo 358×201.375.                                                                                      |
| Landscape                  | 844px document and scrollWidth matched; embedded demo 720×405.                                                                                                                |
| Mobile fullscreen          | 390×219.375, centered vertically, body overflow hidden.                                                                                                                       |
| Captions                   | 20px height (one line) at 320, 390 and 844px widths.                                                                                                                          |
| Themes                     | Light development and dark production presentations inspected.                                                                                                                |

### Limits

- This is local demo QA. The built-in browser was signed out of the authenticated
  app; live X/LinkedIn sending, provider authentication and network-backed workspace
  data were not exercised. The shared live-component extraction was typechecked,
  diff-reviewed and covered by the existing conversation/composer regression suite.
- These are Chromium viewport checks, not physical iPhone/Safari tests. The tool
  rejected touch injection; the touch reveal path is implemented but not certified
  by that attempted test.
- The browser tool did not reliably apply blocked-iframe network overrides. A
  blocked-frame timeout/recovery end-to-end test is therefore not counted as passed.
- Local text sending was exercised. File attachment sending was source-reviewed
  but has not yet been exercised through a native file picker in this QA pass.
- No claim that every possible state, all browsers, or 100% live-app parity is proved.

## CodeRabbit

First review completed with six reports covering three unique state issues. All
three were verified and fixed: mixed-workspace initialization, restoring profile
scroll after nested views, and clearing nested views when selecting another person.
The selection regression was exercised in the browser.

The first review's file list omitted untracked files. The second review uses a
separate temporary Git index with intent-to-add entries so new player files are
included without altering the user's real index.

Rejected suggestions so far:

- Lowercase `currentColor` for a supposed Stylelint rule: this project has no such
  configured check; Prettier preserves this spelling and formatting passes.
- Synchronize every scene's presentation into app state: contradicts the required
  actual-action playback model and would restore the disconnected snapshot flow.

## Git baseline and preservation

Remote fetched before editing. HEAD and origin/codex/reacherx-blog were both
`8ea26628`; branch was one commit ahead of origin/main, with no missing main commits.
Pre-existing modified and untracked blog work was preserved. Pre-task source copies
are in `/tmp/reacherx-demo-before`, including the retired export script.

Docs consulted: [Motion values](https://motion.dev/docs/react-motion-value),
[reduced motion](https://motion.dev/docs/react-use-reduced-motion),
[Radix Select](https://www.radix-ui.com/primitives/docs/components/select), and
[Radix Dropdown Menu](https://www.radix-ui.com/primitives/docs/components/dropdown-menu).

Second CodeRabbit review completed and explicitly included all new player files.
It raised three reports: the two rejected suggestions above and a valid missing
semantic group role on the playback controls. The group role was added. Across
both reviews, four unique valid issues were fixed, two suggestions rejected, and
three duplicate reports deduplicated. No confirmed CodeRabbit issue remains.

The final production hiring observation captured scenes 0 → 1 → 2 → 3 → 4 → 5 → 0.
Relevant activity became selected in scene 4, Overview and the outreach plan were
visible in scene 5, and the loop reset cleanly. ScrollY stayed exactly 1099.5px
throughout the 30-second observation, with no player error.

Final workspace playback observation captured scenes 0 → 1 → 2 → 3 → 4 → 5 → 0.
Candidates became Prospects and returned to Candidates. ScrollY stayed 1039.5px.
Final CRM playback captured all ten scenes and replay: the conversation opened,
closed, the status changed, Interviewing showed count 2 and Isabelle, and replay
restored the initial count. ScrollY stayed 1495.5px. Neither run showed an error.

Keyboard caveat: seeking a menu checkpoint lets the actual Radix menu receive
focus. Refocus Demo progress to continue seeking. An attempted focus-restoration
change closed Radix menus, so it was reverted to preserve correct menu behavior.
The observed rapid-key test also needed to wait for `data-demo-ready=true`.

The native attachment attempt timed out in the browser tool's filechooser support;
raw CDP file injection was also unsupported. No successful file-send result is claimed.

Final Git check: HEAD remains `8ea26628`, HEAD versus origin/codex/reacherx-blog is
0/0, and the real index has no staged changes. No commit or push was made.

The retained final production preview runs at http://localhost:3123. Earlier
temporary previews on ports 3118–3122 were stopped; the original development and
preview processes were left running. Browser emulation/network overrides were cleared.

Final route smoke check: all three article/iframe pairs returned 200 and the named
playback-controls group rendered. An unknown demo URL renders the noindex not-found
UI without a demo. Its status is streamed HTTP 200 under the existing root Suspense,
not HTTP 404; the initial stricter assertion failed. This existing behavior is
recorded rather than changing unrelated authentication/proxy routing.

## Wide framing and click timing follow-up — September 11, 2026

- [x] Check local/remote Git state and preserve the existing blog worktree.
- [x] Add full-app opening/closing shots to all three recordings, including mobile framing.
- [x] Activate clicks 50ms after the existing 1050ms pointer travel; preserve the 1150ms camera animation.
- [x] Separate the hiring evidence reading hold from the return-to-Overview click.
- [x] Restore muted captions with `hsl(var(--muted-foreground))`; the previous raw HSL channels were invalid CSS and inherited the primary text color.
- [x] Add framing/timing regression coverage; all 49 blog tests pass. TypeScript, scoped Oxlint, Prettier, and `git diff --check` pass.
- [x] Verify the production build and all three recordings in the built-in browser.
- [x] Review with CodeRabbit and resolve confirmed issues.

Follow-up verification:

- Production build passed, including Next.js TypeScript checking and asset validation.
- Built-in browser observed complete hiring (0–8), CRM (0–11), and workspace (0–6) journeys and loops. Hiring opens a profile and reviews evidence/plan; CRM opens/closes DMs, marks Interviewing, and shows count 2; workspaces switches Candidates → Prospects → Candidates on the people page. No player errors appeared. Article scroll stayed constant during each uninterrupted run.
- Both endpoints of all three recordings were measured at desktop and 390px mobile width. Every app edge stays inside the player with background visible: desktop gaps approximately 91.65px horizontally / 24.30px vertically; mobile gaps 45.57px / 12.08px. The expanded workspace ending also fits, with positive gaps on all four sides.
- Live pointer/click sampling observed approximately 111ms from the final unchanged cursor transform to the first menu/click indicator, at roughly 50ms sampling resolution. The authored schedule activates at 1100ms, 50ms after the existing pointer animation ends. Camera duration/easing are unchanged.
- Caption computed color is rgb(163, 163, 163) in dark mode and rgb(115, 115, 115) in light mode, distinct from body text. Theme was restored to System.
- Seeking, replay, expanded mode, and offscreen pause/resume were exercised. A browser run initially stayed at scene 0 because the player was above the viewport after reloading from the footer; scrolling it into view resumed the complete journey. Mobile checks use viewport emulation, not a physical phone.
- CodeRabbit completed with four issues. Fixed the valid unbounded target-stability wait by applying a shared 3-second deadline to missing/moving-target preparation. Rejected the reported missing UseCaseDemoApp export (present in UseCaseDemo.tsx), missing blog stylesheet import (present in the blog layout), and currentColor casing request (no corresponding Stylelint configuration). The final build and workspace dropdown journey were rerun after the fix.
- No backend/auth changes. Local preview logs still include existing Vercel analytics asset/AuthKit errors and an unavailable publicSocial Convex function; these are outside this player change. This verification does not claim deployment/authentication coverage or fault injection of continuously moving targets.
- Preview: http://localhost:3124. HEAD remains 8ea26628, remote branch comparison is 0/0, and the real index is empty. No commit or push.

## Persistent cursor and close-up framing follow-up

- [x] Fetch remote Git state; preserve existing branch/worktree and dirty files.
- [x] Shorten normal post-click holds to 400ms, retaining 900ms for workspace switching. Shorten reading holds to 2.6–4 seconds.
- [x] Keep the demo cursor visible between shots and while paused, with its rendered position clamped inside the player during camera movement.
- [x] Add the outer container border using `hsl(var(--border))`.
- [x] Give cropped app edges deliberate wallpaper gutters instead of flush rounded-corner slivers. Preserve wide opening/closing shots.
- [x] Add regressions for cursor bounds, framing gutters, and maximum post-click holds.
- [x] Verify production playback, cursor targeting, desktop/mobile framing, and border color.
- [x] Complete CodeRabbit review and resolve confirmed issues.

Verification for the persistent cursor follow-up:

- All 50 blog tests pass, including the new cursor-boundary test and upper bounds on post-click holds. Scoped Oxlint, Prettier, and diff whitespace checks pass.
- Built-in browser observed all three complete journeys and loops at the shorter timings. The cursor remained visible in every 500ms sample (36 workspace, 52 CRM, 47 hiring samples), including reading beats and camera motion. No demo error appeared. CRM still finished on Interviewing with count 2.
- Workspace close-up now has 24px content gutters at its top and left (25px including the container border), versus flush rounded corners previously. At 390px mobile width those margins measured about 15.24px including the border. Wide framing remained intact; hiring's mobile ending and expanded ending both had positive background gaps on all four sides.
- The cursor hotspot matched the workspace selector center within 0.001px on desktop after settling. The cursor is rendered above the app window and tracks measured app coordinates through Motion transforms, clamped to remain inside the player.
- Outer border resolves to 1px solid rgb(38, 38, 38) in dark mode and rgb(229, 229, 229) in light mode, matching `--border`. Theme restored to System and device emulation cleared.
- CodeRabbit completed with two issues. Fixed scenario reuse by keying the player session by scenario, resetting timeline/iframe/cursor state together when the story changes. Rejected the repeated currentColor casing suggestion because no matching Stylelint rule is configured. No other CodeRabbit issue remains from this review.
- Motion's useTransform documentation was consulted: https://motion.dev/docs/react-use-transform . Shared app components, local mock state, real control activation, and measured target coordinates continue to power playback; no video recording or backend writes are involved in the scripted flows.
- No commit or push; same branch/worktree and preserved pre-existing changes.

## Dismissed-menu playback regression

- [x] Reproduce the exact reported overlay in the built-in browser before editing: seek to CRM step 6, play, pause as the profile menu opens, resume. The menu closed and step 7 displayed `Could not show “Mark Interviewing”`.
- [x] Restore the step checkpoint when resuming from Pause or a seek, so parent controls cannot leave a stale dismissed-menu target.
- [x] Defer failed preparation during manual interaction/paused playback; retry a transient failure once and bound persistent failures.
- [x] Count preparation timeout budgets in active frame time rather than wall-clock time across tab suspension.
- [x] Remove the large error overlay and its styles. Preserve diagnostic state/logs and the existing Play/Replay controls for retry.
- [x] Add regression coverage for recovery decisions and suspended preparation budgets. All 52 blog tests pass.
- [x] Repeat the original failure sequence against the production build, including CRM and workspace menus.
- [x] Complete CodeRabbit review and check formatting/build.

Dismissed-menu regression verification (production preview at port 3124):

- Repeated the exact CRM step 7 case: menu open → Pause closes it → wait 4 seconds → Play. The menu reopened, Mark Interviewing executed, and the list reached Interviewing count 2 without an error overlay or persistent diagnostic error.
- Repeated the same interruption on workspace step 2. Resume completed Candidates → Prospects → Candidates and looped normally.
- Expanding the CRM player during step 7 dismissed its menu while playback remained active. The automatic recovery reopened the menu and completed the status update.
- Dismissed the menu a second time by exiting expanded mode during that retry. The player paused after its bounded retry, with diagnostic error state but no overlay. Pressing Play cleared the error and restarted successfully.
- Observed the complete CRM recording after that restart: steps 0 through 11 and back to 0, with Interviewing count 2 at the end, no overlay, and no persistent error. Timeout behavior across suspended frames is covered by the new unit test; no claim of browser tab-suspension fault injection is made.
- Production build (including TypeScript), 52 blog tests, scoped Oxlint, Prettier, and `git diff --check` pass.
- CodeRabbit completed with two minor suggestions, both rejected: the repeated currentColor Stylelint request has no corresponding project rule; automatically starting playback whenever reduced-motion preference becomes false would override an intentionally paused state. Neither is a defect in the menu recovery fix.
- Same worktree/branch, HEAD 8ea26628, remote comparison 0/0, no staged changes, no commit or push.

## Prospect-card parity follow-up — September 11

The missing menu was a real implementation gap: both demo list pages explicitly
passed `showMenu={false}` to the production `ProspectCard`. Enabling it alone
would have mounted the live menu's provider and mutation dependencies against
fixture IDs.

### Follow-up checklist

- [x] Verify the existing blog worktree and fetch/compare the remote branch.
- [x] Reuse one production card-menu view with separate live and local effects.
- [x] Enable status, archive/unarchive, DM, Agent and share actions in demo cards.
- [x] Use actual local status data for Hires and Archives, with shared filter/sort panels.
- [x] Replace the generic posts fallback with the real X and LinkedIn profile panels.
- [x] Share the LinkedIn conversation menu and use platform-specific composer limits.
- [x] Scope shared use-case labels to the demo, including nested profile timelines.
- [x] Test filtering, all six sorts, date bounds, source immutability, and label isolation.
- [x] Run built-in-browser QA, build, formatting, lint, and regression checks.

### Implementation boundaries

`ProspectCardMenuView` contains the one menu tree used by the live app and demos.
`ProspectCardMenu` selects a live or local action adapter. Local handlers never
call prospect mutations. `DemoProspectPanel` composes the production profile,
conversation and platform panels once for all demo lists. Platform profile
adapters supply fixture data and local follow/connect effects; engagement queries
are skipped. `ScopedUseCaseLabelsProvider` changes labels inside the demo subtree
without changing the user's selected workspace or its persisted configuration.

The timeline driver now uses a stable `data-prospect-id` target instead of an
English accessibility label. Correct use-case labels therefore do not break
recorded interactions. Keyboard events originating in a card's menu button no
longer also activate the outer card.

### Verification performed for this follow-up

- Built-in Chromium, production preview on port 3124: card menu visible; Enter opens
  it without opening the profile; archive → Archives → unarchive → Candidates;
  Mark Hired → Hires; archived menu disables stage changes and Agent.
- X platform profile: real panel, Follow → Unfollow state, Replies tab, then DM.
- LinkedIn platform profile: real panel, Connect → Pending, About tab, then DM.
- Agent navigation uses the selected person (verified with Chloe, not the first fixture).
- Score filter 85–100 removes the lower-scoring candidate; reset restores it;
  lowest-fit sorting puts Ibrahim ahead of Chloe. A relative 24-hour filter uses
  the fixture clock. Opening filters replaces the profile rather than squeezing
  both panels into the list.
- A direct shared-profile URL opens Isabelle; nested timeline and status labels
  show Sourced / Interviewing / Hired. Share buttons were exercised, but clipboard
  contents were not independently read back.
- Sent a local message and observed its new timestamp, Sent status and cleared composer.
- CRM playback reached its final Interviewing list with Isabelle, count 2, and no
  `data-demo-error`; settled wide ending and visible cursor were visually checked.
- `pnpm test:blog`: 52 passed (`/tmp/reacherx-parity-blog-complete.log`).
- Shared component/hook tests: 83 passed in 18 files (`/tmp/reacherx-parity-shared-complete.log`).
- New list regressions: 4 passed (`/tmp/reacherx-parity-list-tests.log`).
- Production HTTP regressions: 13 passed (`/tmp/reacherx-parity-http.log`).
- TypeScript, production build, repository Oxlint and targeted Prettier checks passed.
  Final build: `/tmp/reacherx-parity-build-delivery.log`.
- React Doctor: 80/100 across 81 changed files, 17 warnings, no errors. This broad
  scan includes previous blog work and is not comparable to the earlier three-file
  scan. Warnings are recorded in `/tmp/reacherx-parity-doctor.log`; no demonstrated
  runtime regression was established by its complexity/style suggestions.

### What this does not prove

This verifies the local demo paths listed above, not every feature in the product.
The Agent page still has a separate local conversation/history adapter, and social
post engagement/reply threads are not a full offline replica. Profiles use fictional
content; some platform tabs intentionally have no additional fixture posts. Social
network delivery, live Convex mutations, authenticated production journeys, and
physical Safari/iPhone behavior were not exercised. Do not describe this work as
100% UI/UX parity or the entire dirty blog branch as certified merge-ready.

Git remains on `codex/reacherx-blog` at `8ea26628`, 0 ahead / 0 behind its fetched
remote. No staging, commits or pushes were performed.

### CodeRabbit review outcome

Completed review: 12 issues; five valid issues fixed. Full output:
`/tmp/reacherx-parity-review.log`. The final label-context tests and small LinkedIn
menu extraction were added during follow-up QA, after this review snapshot.

| Severity | Location / issue                                                     | Disposition                                                                                                                                                        |
| -------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Critical | `TwitterProfilePanel`: offline engagement queries                    | Already handled: the shared hook accepts `enabled` and skips both queries; covered by hook tests.                                                                  |
| Major    | `EvidencePostsList`: offline selection can push a live post panel    | Fixed at the caller: offline `EvidencePostsPanel` no longer supplies the live navigation callback. Explicit local callbacks remain supported by the reusable list. |
| Major    | `useDemoProspectList`: relative date filters drift                   | Fixed using `USE_CASE_DEMO_REFERENCE_TIME`; regression test added.                                                                                                 |
| Major    | `LinkedInProfilePanel`: purported unsupported hook argument          | False positive: `useLinkedInPostEngagementMerge` already accepts `enabled`; removing it would restore unwanted queries.                                            |
| Minor    | `ProspectProfileHeader`: synchronize preview menu state in an effect | Not applicable to checkpoint initialization: `BlogDemoApp` remounts with `request.resetKey`. Continuous synchronization would override manual menu state.          |
| Minor    | `WaitlistDrawer`: alleged expiring Discord link                      | No evidence that the invite expires; unrelated to this fix, and no verified replacement was supplied.                                                              |
| Minor    | `useDemoProspectActions`: job-seeker toast labels                    | Fixed: toast copy now uses the demo shell's labels.                                                                                                                |
| Minor    | `DemoConversationPanel`: sent message timestamp missing              | Fixed with the existing UTC timestamp utility; browser sending verified.                                                                                           |
| Minor    | `DemoProspectsPage`: hash can reopen a dismissed profile             | Fixed with a consumed-share ref, preserving valid delayed fixture lookup without repeated reopening.                                                               |
| Minor    | `DemoProspectStatusListPage`: filter-only empty state                | Retained real-app behavior: `archives/page.tsx` uses the same browse/empty-state condition. Changing only the demo would reduce parity.                            |
| Minor    | `blog-app-demo.css`: `currentColor` casing                           | No Stylelint configuration establishes the claimed rule; valid CSS and existing formatting retained.                                                               |
| Minor    | `FooterClient`: alleged expiring Discord link                        | Same unsupported invite-expiry claim; unchanged.                                                                                                                   |

Keyboard QA followed the existing Radix primitive's documented Enter/Escape
behavior: [Dropdown Menu documentation](https://www.radix-ui.com/primitives/docs/components/dropdown-menu).

Final production smoke check after the LinkedIn menu extraction: the CRM player
reached scene 11, `playing`, Interviewing count 2, with Isabelle and Ethan and no
`data-demo-error`. LinkedIn card → Message → Conversation menu → View LinkedIn
profile worked; the composer displayed the 8,000-character limit and Add file.
At a 390×844 emulated viewport, document width and scroll width both measured
390px; the embedded player measured 358×201.375px. Desktop metrics were restored.
The workspace player was observed showing People to try the app on the same people
page with Prospects labels and no player error.

The production server still logs the previously documented public AuthKit
`withAuth`/middleware errors. Those are outside this prospect-demo fix and are
another reason not to equate passing demo QA with a clean authenticated app audit.
