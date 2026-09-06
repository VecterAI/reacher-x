# Synthetic onboarding implementation and verification

Base: origin/main 8d6a3029. Branch: codex/synthetic-onboarding.
Isolated worktree: a local worktree outside the main checkout.
Implementation and QA were initially authorized without commits or pushes. The user subsequently authorized committing, pushing, and opening a PR; merging requires separate approval.

- [x] Fetch remote, inspect dirty checkout, preserve unrelated work, synchronize local main, create isolated branch.
- [x] Copy only approved onboarding UI/reference changes into isolated worktree.
- [x] Trace production setup, targeting edits, workflow gates, and legacy migration requirements.
- [x] Implement atomic persona profiles and platform-specific synthetic examples using existing Sol generation.
- [x] Update production onboarding frontend and chat; keep UI preview as reference only.
- [x] Update description/profile mutation paths and downstream targeting context.
- [x] Remove obsolete preview paths safely; document any required compatibility.
- [x] Add and run lifecycle, authorization, revision, retry, and workflow regression tests.
- [x] Run type checks, lint, Prettier, full tests, build and real backend verification. The original Node run had three pre-existing failures; see the exact results and baseline comparison in [QA evidence](./synthetic-setup-qa.md).
- [x] Perform browser QA of production onboarding, including failure/recovery and responsive states.
- [x] Run CodeRabbit; verify and fix legitimate issues; rerun affected checks.
- [x] Audit final diff for isolation and report evidence and remaining limitations.

## Evidence

Git: local main and origin/main synchronized at 8d6a3029. Original dirty checkout preserved on codex/preserved-local-work-before-onboarding. No unrelated local backend changes copied.

Documentation: https://docs.convex.dev/testing/convex-test and https://www.convex.dev/components/workflow. Mock tests do not replace real-backend/browser checks.

Verification: 733 Vitest tests passed; 504 Node tests passed with three failures reproduced on untouched origin/main. TypeScript, lint, Prettier, production build, and git diff whitespace checks passed. Three CodeRabbit reviews completed, including the user-QA follow-up. See [QA evidence and limits](./synthetic-setup-qa.md).

## Follow-up corrections from user QA

- [x] Recheck isolated branch and fetch origin/main. No commits or pushes.
- [x] Correct audience inference and realistic profile/post generation.
- [x] Restore persisted approval acknowledgement and saved-ICP answers.
- [x] Use available inline card width and actionable provider configuration status.
- [x] Copy authorized development discovery/enrichment credentials into local backend.
- [x] Verify real generation quality and discovery → qualification → enrichment in the browser.
- [x] Test revision, retry, ownership, configuration, and approval edge cases.
- [x] Run Prettier, type checks, lint, suites, build, and CodeRabbit; resolve valid issues.
- [x] Record final QA evidence and remaining limits.

Follow-up evidence: 411 live discoveries across both platforms, two qualified and enriched prospects, persisted approval, saved-ICP answers, realistic generation, and restricted-audience revision. The QA workspace is paused. Shared-queue latency under background load remains documented as a staging performance check.
