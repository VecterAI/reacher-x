# Synthetic onboarding

Implemented in the production setup flow. `/agent/setup-preview` remains a UI reference and does not run the backend.

## Flow

1. The user describes their audience or provides a URL. The existing structured classifier validates the input and selects use-case terminology.
2. GPT-5.6 Sol creates one ideal profile per distinct persona, search signals, targeting rules, and two synthetic examples per profile: one X/Twitter example and one LinkedIn example. The internal profile limit is 1–12; there is no minimum-persona quota.
3. The existing prospect cards show plausible names, titles, and platform-appropriate bios. The panel explains that Agent generated the examples to guide targeting. Ideal profiles are not a separate review step; Agent can explain the actual saved profiles and criteria when asked.
4. Users request changes in the normal composer or approve the displayed revision. Panel approval saves a user acknowledgement in chat atomically. Approval cannot race a pending chat turn, approve an older revision, or start work twice.
5. Existing account connection and paid-plan gates apply. Accounts may be connected later. An existing paid user skips plan selection. Payment confirmation is checked on the backend; selecting a tier or changing a return URL does not grant access.
6. After the gates, one transaction provisions the workspace and schedules the real prospecting workflow. The inline onboarding progress card shows live status and counts. “View prospects”, “View candidates”, etc. opens the app even before results arrive.

The composer is enabled for initial input, review, generation failure, and normal use after setup. It is disabled during generation and the connection/plan gates. On mobile, the review panel occupies the content area; Back returns to chat.

Example: “Find solo software founders and SDR managers” produces **2 ideal profiles and 4 examples**. Removing SDR managers leaves **1 ideal profile and 2 examples**. The two platforms are examples of the same persona, not two additional ideal profiles.

## Persistence and updates

Examples are embedded in their owning ideal profile, never inserted into the prospects table. They have no real prospect IDs, external URLs, contact actions, qualification evidence, or reporting counts. Qualification context groups examples under the owning ICP, labels them fictional, and omits invented names. Discovery uses the user description, ICP search signals, and targeting specification; fictional biographies are not appended to search context.

Setup revisions preserve the user's original request. Failure retains the latest revision feedback and URL context for Retry. A retry increments the revision; late callbacks from earlier attempts are ignored. Review snapshots remain in conversation history but only the current revision is actionable.

For workspace profile edits, the saved profile change invalidates affected examples and search signals. Unchanged profiles keep their examples; deletion removes the linked examples. Active prospecting stops while replacements are generated. The targeting specification is rebuilt against the current persona set while preserving applicable requirements and exclusions. Rules and generated signals publish together only if the input fingerprint still matches. A paused Agent stays paused; repeated edits preserve an earlier request to resume. Generation failure leaves refresh required, without publishing partial generated output. Existing real prospects and outreach history are retained.

Description regeneration uses the existing workspace settings action. Generated profiles are rebuilt and manual profiles retained; manual profiles receive refreshed examples/signals for the new description. Stale results cannot overwrite newer settings. This does not add automatic conflict resolution for contradictory manual profiles.

## Cleanup and compatibility

Removed the live setup-preview orchestration, candidate polling/promotion and preview enrichment entry points; setup-only workspace creation/update tools; obsolete preview input/waiting components and helpers; unused preview graph-query generators; and obsolete tests for those removed UI paths. Reused shared cards, connection content, plan UI, and status copy.

The remaining preview cancellation callbacks, legacy status/schema fields, preview provenance fences, and registered pools are compatibility code for previously scheduled jobs and persisted records. Unfinished old setup sessions upgrade to the synthetic flow and require fresh approval. Completed workspaces remain completed. Removing the remaining compatibility schema/component registrations requires confirming old jobs have drained and migrating old records; doing so in this change would risk existing deployments.

See [verification evidence](synthetic-setup-qa.md) and [checklist](synthetic-setup-checklist.md).
