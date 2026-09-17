# Agent readability QA

Worktree: `codex/marketing-variants`, based on `bd7e624f` (PR #85).
The user approved committing and pushing to this branch for preview deployment.
Merging into main and promoting to production remain outside this authorization.

## To-do

- [x] Fetch origin; verify local branch equals remote, includes main, and starts clean.
- [x] Read Next.js/React guidance, CodeRabbit skill, is-agentic docs and Vercel guidance.
- [x] Read package/config and trace the existing auth/routing contract.
- [x] Retrieve production's stored is-agentic report (71/100, September 14).
- [x] Add public Markdown negotiation/discovery, shared content and structured data.
- [x] Make FAQ answers available without JavaScript and correct conflicting approval copy.
- [x] Run production builds, automated regression tests, lint, TypeScript and Prettier.
- [x] Verify HTML/Markdown coverage and adversarial HTTP cases.
- [x] Complete built-in browser desktop/mobile/no-JavaScript QA; document browser and auth limitations below.
- [x] Run CodeRabbit and resolve verified issues; both review suggestions were disproved by current source and HTTP evidence.
- [x] Record local evidence and remaining deployment checks.
- [ ] Push the reviewed change to PR #85 and verify the new preview.
- [ ] Run a fresh public is-agentic scan and inspect its findings.
- [ ] Verify deployed HTML/Markdown responses and cache behavior.

## Scope and constraints

Public HTML remains the primary content source. Markdown reuses existing plan prices,
use-case data, editorial copy, FAQs and the published-post loader. It never reads
workspaces, account data or unpublished posts. Authenticated `/` remains the app;
anonymous `/` retains its redirect to `/home`. Flight and server-action requests
must not become Markdown.

The user explicitly deferred Privacy policy and Terms of service. Their placeholder
links are a known existing limitation. Do not invent legal text, postal addresses,
reviews, public APIs or an MCP service to collect scoring points. `/about` remains
retired as established by the existing marketing branch.

The stored production report predates this worktree. Its missing-sitemap result is
not proof the branch lacks a sitemap. Local source/HTTP verification and a new public
scan after deployment are separate gates. A local pass cannot establish a new public
is-agentic score or validate live CDN/firewall behavior.

## Reproduce

```sh
pnpm test:agent-readiness
pnpm test:blog
pnpm exec tsx --test tests/marketing.test.ts
pnpm exec vitest run features/landing shared/lib/urls
pnpm exec tsc --noEmit
pnpm build
# Start production main and isolated demo apps with matching origin configuration.
AGENT_TEST_URL=http://127.0.0.1:3107 pnpm test:agent-readiness:http
BLOG_TEST_URL=http://127.0.0.1:3107 pnpm test:blog:http
MARKETING_TEST_URL=http://127.0.0.1:3107 pnpm exec tsx --test tests/marketing-http.test.ts
npx is-agentic@1.0.1 reacherx.com --json
```

The HTTP suite enumerates all published pages. It checks raw HTML with script
evaluation disabled, canonical URLs, Markdown alternates, direct/negotiated parity,
FAQ content, metadata, JSON-LD, sitemap coverage, Accept quality and exclusions,
HEAD, Flight, search, drafts, unknown routes, private-route auth, and root redirects.

## References

- https://vercel.com/kb/guide/make-your-site-readable-by-ai-agents
- https://is-agentic.com/docs
- https://is-agentic.com/methodology
- https://vercel.com/docs/caching/cdn-cache
- https://nextjs.org/docs/app/api-reference/functions/generate-metadata

## Verification results — September 17, 2026

The main production app was built from an isolated copy of the modified worktree
and served on `127.0.0.1:3107`, with its independently built demo app on port 3108.
The existing worktree servers on ports 3000 and 3001 were left running. Build and
runtime configuration used matching local demo/parent origins. No backend code,
Convex deployment, production data, PR, commit or remote branch was changed.

| Check                                              | Result                                                       |
| -------------------------------------------------- | ------------------------------------------------------------ |
| Main and demo production builds                    | Passed                                                       |
| Full Vitest suite                                  | 182 files, 1,079 tests passed                                |
| Final routing and FAQ regression rerun             | 43 tests passed                                              |
| Blog and auth Node tests                           | 53 passed                                                    |
| Marketing Node tests                               | 6 passed                                                     |
| Agent-readability Node tests                       | 6 passed                                                     |
| Demo runtime Node tests                            | 67 passed                                                    |
| Blog HTTP tests                                    | 14 passed                                                    |
| Agent-readability HTTP tests                       | 6 passed; enumerate 81 canonical pages                       |
| Marketing HTTP tests                               | 4 passed                                                     |
| TypeScript, repository lint, changed-file Prettier | Passed                                                       |
| React Doctor, changed files against HEAD           | 92/100; no errors; one existing non-component export warning |

Counts overlap where a focused rerun is also part of the full suite; they should
not be added together. The broad React Doctor comparison against `origin/main`
also includes the existing marketing PR and reports older issues; it is not the
result for this uncommitted change.

The 81-page sweep covers 12 marketing/use-case pages, the blog index, six populated
categories, and all 62 published articles. Each is requested as raw HTML, negotiated
Markdown, and the advertised direct Markdown URL. It validates canonical metadata,
status and content types, nonempty article content, direct/negotiated parity,
FAQ text, discovery headers, and exclusion of drafts/private routes. Additional
cases include Accept preferences and exclusions, wildcard requests, HEAD, RSC,
search queries/noindex, unknown categories, traversal-like/private/source paths,
root redirects, and the empty `/markdown` path.

Real bugs caught during QA:

- Next.js stripped the RSC header before proxy execution, so an RSC request with
  `Accept: text/markdown` could get Markdown. `skipProxyUrlNormalize` preserves
  the original header; production HTTP tests now require Flight responses.
- `/markdown` without a path returned a streamed soft 404. The optional catch-all
  now returns a real 404 directly from the route handler.
- The existing auth Suspense shell was blank with JavaScript disabled. A static
  `noscript` navigation now exposes the public readable documents and index.
- Marketing approval copy contradicted the existing accurate FAQ. Shared copy now
  states that sending approvals default on and can be changed in workspace settings.

### Built-in browser QA

Verified on the production build in the Codex in-app browser:

- Homepage and embedded fictional demo rendered normally.
- All nine homepage FAQs opened, displayed their answers, and kept one item open;
  the Enter key closed the selected disclosure. Pricing FAQ also opened correctly.
- With script execution disabled, the static fallback visibly displayed Home,
  Product, Pricing, Use cases, Blog and guides, and All public pages links.
- Monthly/yearly pricing switched the three signup labels to the correct annual
  prices: $99.90, $499.90 and $999.90.
- At 390px width, the mobile menu opened and navigated to the blog. Pricing and
  article document widths stayed at 390px with no horizontal overflow.
- Blog search returned zero results for a nonexistent query and three results for
  `replies`; opening the matching article displayed its content and demos.
- Demo pause changed to Play; expansion displayed the full demo; Exit fullscreen
  returned it to its embedded view.
- Console warnings/errors were empty on the checked pages.
- The anonymous homepage Reach now CTA traversed `/login`, WorkOS authorization,
  and AuthKit, then attempted the configured callback without an unload dialog.

Browser limits are not recorded as application passes: direct Markdown and plain
text navigation is blocked by the in-app browser with `net::ERR_BLOCKED_BY_CLIENT`.
The links and successful response bodies are verified by HTTP instead. The full
HTML experience still uses JavaScript; no-JavaScript users get a document-reading
fallback. Browser viewport and script-execution overrides were restored.

### Deployment checks and accepted limitations

1. **Authenticated end-to-end:** the environment's registered callback is
   `http://localhost:3000/callback`, while the isolated modified build runs at
   `127.0.0.1:3107`. The in-app browser blocked that callback navigation. The full
   CTA → callback → setup thread → first agent response flow has not been manually
   verified on this exact build. Existing automated auth/routing tests pass. The
   user explicitly permitted skipping sign-in if blocked; this is an optional
   regression check, not a requirement for public agent readability or scoring.
2. **Public deployment:** approval to push and create a preview is granted. Run the official is-agentic
   scanner and verify Vary/Accept behavior and crawler access through the live
   CDN/firewall. The stored 71/100 score is the September 14 production baseline,
   not a measured score for these local changes. No higher score is claimed.
3. **Deferred content:** Privacy/Terms and a verified postal business address are
   unavailable. The user deferred legal links; no facts were fabricated for scoring.

Local checks provide confidence in this implementation. Deployed response/cache
verification and a fresh public scan remain pending; the user accepted the
limitation on full authenticated end-to-end testing.
Raw test logs and review output are retained at `/tmp/reacherx-agent-readiness/`.

### CodeRabbit review

CodeRabbit CLI 0.7.6 completed two uncommitted reviews. The final command was
`coderabbit review --agent --uncommitted --include-untracked`, covering all 33
changed/new files, including the new route, helpers and tests. It raised one minor
issue in each review (two issues total); no critical or major issues were raised.

| Issue                                                                                                         | Disposition and evidence                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/blog/lib/blogMetadata.ts`: advertised `/markdown/blog` might return 404                             | False positive from the initial tracked-file-only review. The route is present in `app/markdown/[[...path]]/route.ts`; the production HTTP sweep requires a 200 and matching direct/negotiated content. The final review included this new file.                                                                                                                                             |
| `features/landing/lib/agentReadinessCore.ts`: canonical approval FAQ should describe the configurable setting | False positive. `features/landing/lib/faqs.ts` already states that approvals default on and that supported replies/DMs can send without another approval when disabled. Home/product Markdown and HTML reuse that FAQ; `llms.txt` inserts the same answer. Shared marketing copy also explicitly describes the configurable setting. HTTP tests assert the FAQ text appears in both formats. |

No unnecessary changes were made to satisfy either suggestion. Review transcripts:
`/tmp/reacherx-agent-readiness/coderabbit.ndjson` and
`/tmp/reacherx-agent-readiness/coderabbit-final.ndjson`.

Before commit approval, the final Git check fetched origin again; `HEAD` remained `bd7e624f`, exactly matching
`origin/codex/marketing-variants` (0 ahead / 0 behind). The index is empty. PR #85
and the separate PR #84 were not modified.
