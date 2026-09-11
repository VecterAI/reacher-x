# Blog app demo pilot — historical QA record

> Superseded by [DEMO-PARITY-QA.md](./DEMO-PARITY-QA.md). The old snapshot
> player, fixed-timestamp export script, timings, centering assertions, and
> exported videos below do not describe the current action-driven player.
> The obsolete export script was removed; current verification uses actual playback.

Branch: `codex/reacherx-blog`. HEAD: `8ea266282d045c8d83764be86c561ef8010fa661`.
No commit, push, deployment, or Convex backend change.

## App-window corner correction

- [x] Restore the inner app window's `/home` frame radii (`radius-lg` below 768px, `radius-xl` above), independently of the outer media container's `radius-md`.
- [x] Compensate for the app's scale so zooming does not shrink the visible corners. Built-in browser measured a 30.7587px CSS radius at 0.390134 scale: 12px visible, with the outer media radius still 6px.
- [x] Prettier and `git diff --check` passed.

## Motion, centering, and caption revision

- [x] Keep the full app mathematically centered on both axes at every intermediate frame, including loop boundaries and interaction takeover.
- [x] Replace the abrupt ease-out motion with a 900ms quintic ease-in/out, with zero velocity and acceleration at both ends, without lengthening the scenes.
- [x] Remove early zoom saturation and the 16ms publication gate that could skip browser animation frames. Cursor movement uses a composited transform.
- [x] Hold the exact camera pose during user interaction so opening a menu does not snap the zoom.
- [x] Restore article-specific, visible figcaptions using the existing BlogImage caption classes; retain captions in Markdown output.
- [x] Verify production desktop/mobile centering (measured error below 0.000006px), captions below the frame, and unchanged transform when opening a profile menu.
- [x] Add regressions for intermediate-frame centering, loop continuity, gentle movement endpoints, zoom progression, and Markdown captions (10 demo tests total).

Current revision logs use `/tmp/reacherx-smooth-*`. Browser checks verify placement and behavior; no universal device frame-rate guarantee is claimed. The original 15–18-second flows, 16:9 framing, supplied SVG, and 4-second idle resume remain.

Final checks for this revision: all 65 tests passed (10 demo, 40 blog/auth, 2 offline engagement, 13 production HTTP), production build passed, and both regenerated 60 fps exports decoded completely (912 frames each). React Doctor remained at 82/100 with 13 warnings, with no score regression. CodeRabbit completed with three minor findings: two documentation corrections fixed, and its repeated unsupported Stylelint suggestion rejected. No remaining confirmed findings from this review.

## September 11 framing and pacing revision

- [x] Use the user's attached mountain-background SVG unchanged across all three demos (386,271 bytes; 137,509 bytes gzip). The Google Drive WebP was inaccessible, so no unsupported format-size comparison was made.
- [x] Use 16:9 for inline and expanded presentations on desktop and mobile, including landscape rotation.
- [x] Keep the full application inside the background at every camera position; use the same `--radius-md` (6px) as blog images.
- [x] Shorten shots to 1.5–3.2 seconds and sequences to 15.2–18 seconds; reduce camera motion to 900ms and idle resume to 4 seconds.
- [x] Add a visible click ring before scripted transitions and on real pointer clicks, without intercepting input.
- [x] Regenerate desktop/mobile MP4 and PNG exports in 16:9; decode both videos end to end (912 frames).
- [x] Verify actual mobile bounds: 358×201.375 inline, 390×219.375 expanded; full app inside both. Landscape expanded remains 16:9 with the full app visible.
- [x] Verify real click takeover shows a ring and opens Candidates, scripted rings appear before transitions, idle playback resumes, and the CRM final state still reaches Hires.

Revision checks: 10 timeline/layout/click/caption tests, 40 blog/auth regressions, production build including TypeScript, Prettier, Oxlint, and 13 production HTTP tests passed. CodeRabbit identified a scenario-change state issue; the route now keys the app by scenario so a previous scene index cannot leak into another demo. Its unsupported Stylelint comment remains rejected. Logs: `/tmp/reacherx-demo-revision-*`.

## To-do list

- [x] Inspect local changes and fetch remote; preserve pre-existing blog work.
- [x] Remove the rejected simplified demo.
- [x] Inspect the actual `/home` demo and the three article briefs.
- [x] Reuse its shell, cards, profiles, workspace forms, plans, evidence, and composer.
- [x] Author three contextual flows on an SVG background image.
- [x] Verify desktop and mobile with the built-in browser.
- [x] Export desktop/mobile MP4s and PNG stills from the same presentation.
- [x] Run Prettier, lint, tests, and production build.
- [x] Run CodeRabbit and fix confirmed issues.
- [x] Finish production HTTP/browser verification and record final results.

## Article context

| Article                       | Demonstrated flow                                                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `find-candidates`             | Frontend accessibility hiring brief → candidates → Isabelle's profile and outreach plan → her keyboard-navigation evidence post. |
| `manage-people-with-reacherx` | Candidate profile → outreach plan → local conversation → Interviewing → Hired and the Hires list.                                |
| `workspaces-explained`        | Hire a designer → workspace instructions and profiles → People to try the app → customer instructions and prospects.             |

Only these three placeholders were replaced. There are no added chapter cards, instruction banners, or invented app chrome. The small overlay contains ordinary playback controls. Fixtures are fictional; the actual product components render them.

## Built-in browser QA

Desktop and 390×844 mobile viewport, anonymous visitor, light/dark presentation inspected during implementation. Viewport emulation is not a physical iPhone/Safari test.

- Click a real candidate card during autoplay: first click opens Profile and pauses the clock. Desktop takeover reveals the full app after the click lands, preserving access to controls outside the cinematic crop.
- Recruiting profile menu uses Contacted / Interviewing / Hired labels. A local stage change updates the menu and list. The scripted final CRM state shows the person in Hires.
- Open the real conversation panel and send a local test message. The message appears in its thread. Conversation state is keyed by person; the hiring exchange is supplied only to its matching fixture.
- Type a draft during autoplay: state becomes interactive; draft remains after more than the 4-second idle interval while the editor remains focused.
- Interact with a menu and stop: playback resumes after the idle interval. Explicit Pause remains paused. Scrubbing and Replay reset the scripted state.
- Switch between hiring and customer workspaces: names, candidate/prospect labels, instructions, and results change with the selected project.
- Edit and save a workspace name locally. The fixture supplies three audience profiles so unrelated validation does not block saving.
- Open evidence posts anonymously: supplied posts render without hydration or engagement requests. This uncovered and fixed live-request leakage in existing preview components.
- Expand / Escape: app state is preserved. Background becomes inert with body scrolling locked; closing restores both (99 inert siblings during expansion, zero after close in the inspected article).
- Mobile article width: document clientWidth and scrollWidth both 390; no horizontal page overflow. The demo itself stays at scrollTop 0 while its camera changes. Full-app framing and 16:9 expansion are available.
- Reduced-motion emulation starts playback paused.
- Existing `/home`: switch to Analytics, then change Customers → Candidates; Analytics stays selected. Returning to Candidates displays the original candidate dataset.
- Dev playback network observation: no OpenRouter, social API, Convex action, or mutation calls during the observed hiring loop. Existing site analytics and image requests still occur; this is not a claim that the entire page makes zero network requests.

Production preview: `http://localhost:3116`. Repeated workspace editing/saving with a mouse after fixing the crop, switched project instructions and lists, verified a draft survives more than 4 seconds and sends locally, verified the final Hires state, and checked the mobile evidence tab and 390px document width. Offscreen progress stayed exactly `12058.199999999997` across separate observations. No demo requests/actions/mutations appeared in the observed production interaction capture.

## Automated verification

- `BLOG_TEST_URL=http://127.0.0.1:3116 pnpm test:blog:http`: 13 passed against the final production build (all articles, metadata/images, content negotiation, discovery, 404s, and protected routes).
- `pnpm test:blog`: 40 passed, including blog editorial and authentication-route regressions.
- `pnpm exec tsx --test tests/blog-demo.test.ts`: 10 passed. Every shot boundary/loop, invalid timestamps, continuous camera targets, scenario allowlist, fixture isolation, article context, and CRM outcome.
- `pnpm exec vitest run shared/hooks/__tests__/demoOfflineEngagement.test.ts`: 2 passed. Preview engagement subscriptions skip all three queries; default live behavior is retained.
- Targeted Oxlint: passed on pilot TypeScript/TSX/script files.
- Prettier: applied to the pilot manifest; SVG is a manually formatted XML asset (Prettier has no built-in SVG parser).
- `git diff --check`: passed.
- Production build includes TypeScript and blog asset validation.

Logs are retained locally under `/tmp/reacherx-demo-*`.

## Review findings

CodeRabbit reviewed a full repository snapshot containing only the pilot changes, to avoid attributing the separate in-progress blog work to this demo task. No commits were created for the snapshot.

First review: six issues; five confirmed and fixed (conversation fixture scope, conversation state isolation, valid editable audience fixtures, empty workspace fallback, and range-input focus trapping). The remaining empty-placeholder-caption comment concerned pre-existing code outside this pilot and was left unchanged.

Second review: three issues; two confirmed and fixed (publish frame metadata after React commit; initialize status from the selected dataset's first real fixture ID). Its Stylelint suggestion was rejected: there is no project Stylelint configuration, the declaration is already lowercase, and Prettier accepts the file.

Third review, including the final click-takeover fix: one issue, the same unsupported Stylelint warning. No remaining confirmed CodeRabbit issues.

React Doctor: 82/100, 13 warnings; the earlier narrower changed-file scan was 86/100. Remaining warnings include existing large/complex components newly brought into the diff, an existing form-reset effect, intentional initial scene state, and unrelated blog code. No configuration suppressions or unrelated rewrites were used to inflate the score. This is not a clean React Doctor result.

## Exports and reproduction

Ignored local output directory: `.codex-tmp/blog-demo-media/`.

- `find-candidates.mp4`: 1600×900, 60 fps, 15.2 seconds, H.264 / yuv420p, fast-start MP4.
- `find-candidates-mobile.mp4`: 768×432 (384×216 at 2×), same timeline and encoding.
- `find-candidates.png` and `find-candidates-mobile.png`: stills of the evidence scene.

Both videos were decoded end to end with FFmpeg (912 frames each); exported frames were visually inspected. MP4/PNG exports are passive media. Interactivity remains in the web component.

Run the existing dev server on port 3111, then:

```sh
node scripts/render-blog-demo.mjs find-candidates
node scripts/render-blog-demo.mjs find-candidates --mobile
node scripts/render-blog-demo.mjs find-candidates --still
```

The renderer uses Playwright and `ffmpeg-static` from `DEMO_RENDER_TOOLS` (default `/tmp/reacherx-demo-render`); it does not add dependencies to the application. `DEMO_RENDER_ORIGIN`, `DEMO_RENDER_OUTPUT`, and `CHROME_PATH` override local paths. The exact-time capture hook is development-only. API/analytics calls are blocked in the export renderer.

## Scope and confidence limits

This is a local fictional demonstration, not a live agent run: messages and edits stay in component state and reset when replay resumes or the page reloads. No real sends, paid AI searches, backend migrations, or signed-in account flows were performed. Browser QA covers Chromium through the built-in browser; physical touch devices, Safari, and Firefox have not been verified. Existing site auth/analytics providers still load around the isolated demo route.

Additional observations: the unknown internal URL `/home/demo/not-a-demo` renders Next's noindex not-found result with HTTP 200 after streaming (a soft 404). The three allowed demo routes return 200 and noindex; ordinary invalid blog URLs return actual HTTP 404. No demo runs for an unknown scenario. This internal-route status limitation was documented rather than expanding the change into auth/proxy routing.

The local production server logs errors for unavailable Vercel `/_vercel/*/script.js` endpoints passing through the existing not-found/AuthKit shell. The built-in browser also logged a MutationObserver error traced via its script source to the injected Electron/Codex annotation layer (`codex_desktop:browser-sidebar-runtime-message`), not application code. Neither was represented as a passing clean-console check or changed in this pilot.

Motion documentation: [MDN requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).

Documentation consulted: [MDN postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) for source/origin validation, [MDN inert](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert) for modal isolation, and the repository frontend, React, video-rendering, Convex, and CodeRabbit skills.
