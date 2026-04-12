# LinkedIn End-to-End Integration Plan

## Summary
- Implement LinkedIn as a first-class platform using `LinkdAPI` for read/search/enrichment and `Unipile` for connected-account auth, messaging, invitations, reactions, comments, and post actions.
- Mirror the existing X/Twitter architecture instead of inventing a separate LinkedIn stack: reuse the same approval-first action model, panel stack, message rendering, profile shell, account connection surface, and agent artifact flow.
- Keep the current design language intact. LinkedIn should feel like “LinkedIn rendered through ReacherX”, not a separate product. Existing button sizes, shell spacing, avatar sizes, font sizes, and radii already used in the X/profile surfaces stay the baseline.
- Remove all current “LinkedIn disabled” branches and read-only placeholders once the new flow is in place, so the repo ends up cleaner than it is now.

## Implementation Changes
### 1. Core backend shape
- Keep the current split: `LinkdAPI = read plane`, `Unipile = write/auth plane`.
- Standardize LinkedIn identity around `linkedinUrn` as the canonical person key. Secondary identifiers are `publicIdentifier/username` and public profile URL. This is required because LinkdAPI returns URN-centric read data and Unipile returns provider/public identifiers on the write side.
- Introduce a small LinkedIn provider layer instead of scattering direct fetches:
  - `convex/integrations/linkedin/read/*` for LinkdAPI-backed reads.
  - `convex/integrations/linkedin/write/*` for Unipile-backed auth/actions.
  - `convex/integrations/linkedin/mappers/*` for ID normalization between LinkdAPI URN, Unipile provider_id/public_identifier, and app prospect records.
- Replace Twitter-only validators with platform-aware validators where the model is already shared:
  - `platformConversationPlatformValidator` must include `"linkedin"` instead of remaining Twitter-only.
  - `agentActionRequests.provider` must stop being `twitterActionProviderValidator` only; replace with a social action provider validator that includes Unipile/LinkedIn.
  - Keep Convex built-ins untouched; only add app-specific fields and avoid redefining `_id`, `_creationTime`, or any built-in Convex metadata.
- Extend `platformConversations` and `platformConversationMessages` for LinkedIn, not by duplicating new tables. Add only LinkedIn-specific optional fields where truly needed:
  - conversation/account capability state
  - LinkedIn participant headline/title
  - LinkedIn account/source ids needed for Unipile chat resolution
  - attachment/message type metadata for file/video/voice messages
- Add a small `linkedAccounts`/LinkedIn account status persistence layer only if the current X account table is too X-specific; otherwise generalize the existing connected-account model so both X and LinkedIn fit the same pattern.

### 2. Read plane: LinkdAPI
- Keep existing read adapters as the starting point instead of rewriting from scratch: [searchPosts.ts](/Users/salman/personal-local/reacher-x/development/reacher-x/convex/integrations/linkedin/searchPosts.ts), [getProfile.ts](/Users/salman/personal-local/reacher-x/development/reacher-x/convex/integrations/linkedin/getProfile.ts), [getCompany.ts](/Users/salman/personal-local/reacher-x/development/reacher-x/convex/integrations/linkedin/getCompany.ts), plus user-posts/comments endpoints already scaffolded.
- Wrap LinkdAPI behind one typed client. Default plan: use the new `linkdapi` npm package if it is a thin typed wrapper over the same REST endpoints; otherwise keep direct HTTP fetches behind one internal module so the rest of the code never depends on transport details.
- Use these LinkdAPI endpoints for v1:
  - Discovery/evidence search: `/api/v1/search/posts`
  - Profile enrichment: `/api/v1/profile/full`
  - Username -> URN normalization: `/api/v1/profile/username-to-urn`
  - Company panel data: `/api/v1/companies/company/info`
  - Prospect activity feed: `/api/v1/posts/all`
  - Post comment hydration: `/api/v1/posts/comments`
  - User comment history if needed for interactions/evidence: `/api/v1/comments/all`
- Re-enable LinkedIn prospecting and qualification by removing the current disabled branches in [prospecting.ts](/Users/salman/personal-local/reacher-x/development/reacher-x/convex/workflows/prospecting.ts), [enrichment.ts](/Users/salman/personal-local/reacher-x/development/reacher-x/convex/workflows/enrichment.ts), and [qualifyProspect.ts](/Users/salman/personal-local/reacher-x/development/reacher-x/convex/agents/tools/qualifyProspect.ts).
- Add configurable LinkdAPI rate control at the provider client boundary, not across random call sites. It should support:
  - manual RPM override in env/config
  - optional auto-tier mode if LinkdAPI exposes plan/tier lookup
  - queue/backoff so parallel workflows do not burst past the configured RPM
- Match current X behavior for shared budgets: one app-level/provider-level limiter with workspace/user attribution, not per-screen ad hoc throttling.

### 3. Write/auth plane: Unipile
- Implement LinkedIn hosted auth via `POST /api/v1/hosted/accounts/link` and make it the only in-product connect flow.
- Use Unipile capability-aware auth:
  - request LinkedIn with the features enabled by default
  - do not disable `linkedin_sales_navigator` or `linkedin_recruiter`
  - only hide related UI when the connected account or subscription lacks those capabilities
- Persist Unipile account state from `GET /api/v1/accounts` and account-status webhooks. The app must treat LinkedIn account health as dynamic and surface:
  - connected
  - reconnect required
  - credentials/action required
  - disconnected/restricted
- Use these Unipile endpoints for v1 actions:
  - hosted auth/reconnect: `/api/v1/hosted/accounts/link`
  - account sync/status: `/api/v1/accounts`, `/api/v1/accounts/{id}`, `/api/v1/accounts/{account_id}/sync`
  - profile/capability fetch from connected account: `/api/v1/users/{identifier}`
  - LinkedIn search from connected account for Sales Nav/Recruiter-specific flows: `/api/v1/linkedin/search`
  - list/read chats: `/api/v1/chats`, `/api/v1/chats/{chat_id}/messages`
  - send message, file/image/video/voice attachments: `POST /api/v1/chats/{chat_id}/messages`
  - invitation send/status: `POST /api/v1/users/invite`, `GET /api/v1/users/invite/sent`, `GET /api/v1/users/invite/received`
  - react to post/comment: `POST /api/v1/posts/reaction`
  - comment/reply on post: `POST /api/v1/posts/{post_id}/comments`
  - post creation if surfaced in product/agent flows: `POST /api/v1/posts`
  - webhook registration: `POST /api/v1/webhooks`
- Register three webhook groups in Convex HTTP routes:
  - `messaging` for `message_received`, `message_read`, `message_reaction`, `message_edited`, `message_deleted`, `message_delivered`
  - `users` for `new_relation`
  - `account_status` for `creation_success`, `creation_fail`, `reconnected`, `sync_success`, `stopped`, `ok`, `connecting`, `error`, `credentials`, `permissions`
- Build webhook ingestion into the existing [http.ts](/Users/salman/personal-local/reacher-x/development/reacher-x/convex/http.ts) router and fan into internal mutations that update `platformConversations`, message rows, account status, and notifications.
- Treat Unipile failures as first-class UX states. Specifically handle `expired_credentials`, `disconnected_account`, `feature_not_subscribed`, `subscription_required`, `action_required`, `multiple_sessions`, `too_many_requests`, and `comments_disabled`.

### 4. Action approval model
- Do not create a separate “LinkedIn actions” product pattern. Generalize the current X action system in [twitterActions.ts](/Users/salman/personal-local/reacher-x/development/reacher-x/convex/twitterActions.ts) and its executors into a platform-agnostic social action request system.
- Every LinkedIn write action follows the same lifecycle as X:
  - agent/manual intent creates `agentActionRequest`
  - user sees inline approval/edit surface
  - request is approved, edited, cancelled, executed, completed, or failed
  - notifications and panel context update off the same durable request record
- Initial LinkedIn action keys should include:
  - `linkedin_send_message`
  - `linkedin_send_message_existing_conversation`
  - `linkedin_invite_user`
  - `linkedin_react_to_post`
  - `linkedin_comment_on_post`
- Reuse the same draft-sync pattern currently used for X DM approvals so LinkedIn drafts stay durable across refreshes and agent edits.
- Keep repost disabled in v1. Render the button, show tooltip, and never create an action request for it.

### 5. UI/component plan
- Reuse these shells directly:
  - account connection list: [ConnectedAccountsList.tsx](/Users/salman/personal-local/reacher-x/development/reacher-x/features/linked-accounts/ui/components/ConnectedAccountsList.tsx)
  - profile panel shell: [ProspectProfilePanel.tsx](/Users/salman/personal-local/reacher-x/development/reacher-x/features/prospects/ui/components/ProspectProfilePanel.tsx)
  - X chat reference: [XConversationPanel.tsx](/Users/salman/personal-local/reacher-x/development/reacher-x/features/prospects/ui/components/XConversationPanel.tsx)
  - LinkedIn post primitives: [LinkedInPostCard.tsx](/Users/salman/personal-local/reacher-x/development/reacher-x/features/webapp/ui/components/linkedin/LinkedInPostCard.tsx) and [LinkedInFooter.tsx](/Users/salman/personal-local/reacher-x/development/reacher-x/features/webapp/ui/components/linkedin/LinkedInFooter.tsx)
- LinkedIn connected account row:
  - same row component as Google/X
  - same `Button variant="outline" size="xs"` actions
  - states: `Connect`, `Reconnect`, `Disconnect`
  - right-side status copy mirrors X: connected relative timestamp, reconnect hint, or not connected
- LinkedIn chat panel:
  - clone XConversationPanel structure into a LinkedIn-specific panel, but keep the same page shell, skeletons, bubble renderer, and spacing rhythm
  - header shows LinkedIn avatar + name, with title/headline beneath when needed
  - menu contains LinkedIn-specific actions: view LinkedIn profile, open CRM profile, reconnect account if needed, copy profile URL
  - empty state shows avatar `size-12`, display name, title/headline, and `View LinkedIn profile`
  - composer reuses `BaseComposer`, but removes rich-text controls and uses attachment order `image`, `video`, `file`, `emoji`
  - message bubbles stay identical to X for visual consistency
- LinkedIn profile panel:
  - stay inside `ProspectProfilePanel` and `ProspectProfileHeader`; do not create a totally separate profile shell
  - enrich the LinkedIn branch so “View LinkedIn profile” opens an in-app LinkedIn-focused panel instead of only opening a new tab
  - render LinkedIn-specific header/body details from existing profile layout: headline, location, company/current role, about/summary, experience, education, skills, social/profile links, relevant activity, interactions
  - buttons and sizing stay aligned with current profile panel:
    - header avatar stays `size-12`
    - title and metadata stay `text-sm`
    - action buttons stay existing shared `Button` sizes, especially `xs` and `outline/ghost`
    - shell radii stay the current panel/message pattern such as `rounded-[20px]` and `rounded-[24px]`
- LinkedIn post card actions:
  - keep current post card/header/body/menu components
  - replace footer read-only links with real action buttons
  - enabled: react, comment
  - disabled with tooltip: repost, DM-from-post
  - keep `Button variant="ghost"` with current `xs/xsIcon` sizing and mono metric style so the card still matches the existing design system
- Image handling:
  - update [next.config.mjs](/Users/salman/personal-local/reacher-x/development/reacher-x/next.config.mjs) to allow LinkedIn CDN hosts such as `media.licdn.com`

### 6. End-user UX after implementation
- User with no LinkedIn account:
  - sees LinkedIn in Connected Accounts
  - clicks `Connect`
  - app requests a fresh Unipile hosted-auth link and redirects
  - after success, returns to the app and LinkedIn row becomes connected
- User with connected LinkedIn account:
  - can open a LinkedIn prospect profile that looks like a native ReacherX profile panel but uses LinkedIn-specific content and actions
  - can open LinkedIn chat from the profile header
  - can send LinkedIn messages with file/image/video attachments
  - can react/comment on LinkedIn posts from evidence/activity cards
  - can send invitations where allowed
- Agent/manual action UX:
  - when the system wants to DM/comment/react/invite, it creates the same approval surface style already used for X
  - the user can approve, edit, or cancel
  - once approved, execution runs through Unipile and the panel/notification state updates in place
- Capability-aware UX:
  - Sales Navigator / Recruiter-specific data or actions appear only when the connected account supports them
  - unsupported features show a precise disabled reason instead of disappearing silently
  - reconnect/account-health issues surface as actionable banners or row states, not cryptic failures

### 7. Cleanup and minimalism
- Remove current LinkedIn “disabled” branches and TODO blocks after the new path is live.
- Remove duplicated Twitter-only abstractions where the model is already shared and replace them with social/platform-agnostic helpers.
- Keep only one LinkedIn read client and one Unipile write client; no duplicate fetch wrappers.
- Keep LinkedIn post card logic in the existing LinkedIn component folder; avoid introducing parallel “v2” components unless a primitive truly needs splitting.
- Do not add new tables if the current conversation/action tables can be generalized safely.

## Verification and acceptance criteria
- Implementation is not complete until all of these pass with zero unresolved errors:
  - `pnpm exec tsc --noEmit`
  - `pnpm lint:strict`
  - editor/LSP diagnostics are clean for touched files
- Required behavioral tests:
  - LinkdAPI search returns LinkedIn evidence posts and saves prospects again after re-enabling workflow branches
  - LinkedIn enrichment resolves `linkedinUrn`, full profile, company, and posts without breaking existing X enrichment
  - Unipile hosted auth connect and reconnect flows update account state correctly
  - webhook ingestion creates/updates LinkedIn conversations and message rows
  - LinkedIn DM send works for existing conversation and new conversation flows where provider permits
  - attachment sending works for image, video, file, and unsupported media errors are surfaced cleanly
  - react and comment actions create approval requests, execute through Unipile, and update UI state
  - disabled repost and DM-from-post buttons always show tooltips and never execute
  - profile panel, chat panel, and LinkedIn post card render with no Next image host errors
- Regression checks:
  - X/Twitter account connection, DM panel, approvals, and artifact rendering remain unchanged
  - shared panel stack and prospect profile flows still work for both platforms

## Assumptions and defaults
- Default implementation choice is to use the `linkdapi` npm package if it is thin, typed, and does not hide rate control from us; otherwise retain raw REST behind a single local client abstraction.
- There are currently no connected Unipile LinkedIn accounts and no webhooks configured; the implementation must provision the in-app flow from that starting state.
- Monitoring/firehose-style public LinkedIn watch is out of scope for v1 because the chosen read provider does not provide a monitor equivalent to current X SocialAPI monitoring.
- Organization posting/commenting/reaction should be capability-aware and only surface when Unipile returns organization-level action support.
- LinkedIn chat/profile/post surfaces must inherit the existing ReacherX design tokens instead of introducing a new token set.

## References used
- Repo code:
  - [features/prospects/ui/components/XConversationPanel.tsx](/Users/salman/personal-local/reacher-x/development/reacher-x/features/prospects/ui/components/XConversationPanel.tsx)
  - [features/prospects/ui/components/ProspectProfilePanel.tsx](/Users/salman/personal-local/reacher-x/development/reacher-x/features/prospects/ui/components/ProspectProfilePanel.tsx)
  - [features/webapp/ui/components/linkedin/LinkedInPostCard.tsx](/Users/salman/personal-local/reacher-x/development/reacher-x/features/webapp/ui/components/linkedin/LinkedInPostCard.tsx)
  - [features/webapp/ui/components/linkedin/LinkedInFooter.tsx](/Users/salman/personal-local/reacher-x/development/reacher-x/features/webapp/ui/components/linkedin/LinkedInFooter.tsx)
  - [features/linked-accounts/ui/components/ConnectedAccountsList.tsx](/Users/salman/personal-local/reacher-x/development/reacher-x/features/linked-accounts/ui/components/ConnectedAccountsList.tsx)
  - [convex/platformConversations.ts](/Users/salman/personal-local/reacher-x/development/reacher-x/convex/platformConversations.ts)
  - [convex/twitterActions.ts](/Users/salman/personal-local/reacher-x/development/reacher-x/convex/twitterActions.ts)
  - [convex/schema.ts](/Users/salman/personal-local/reacher-x/development/reacher-x/convex/schema.ts)
  - [next.config.mjs](/Users/salman/personal-local/reacher-x/development/reacher-x/next.config.mjs)
- Local LinkdAPI docs:
  - [docs/linkdapi/navigation/introduction.md](/Users/salman/personal-local/reacher-x/development/reacher-x/docs/linkdapi/navigation/introduction.md)
  - [docs/linkdapi/navigation/endpoints-cost.md](/Users/salman/personal-local/reacher-x/development/reacher-x/docs/linkdapi/navigation/endpoints-cost.md)
  - [docs/linkdapi/api-endpoints/search/posts.md](/Users/salman/personal-local/reacher-x/development/reacher-x/docs/linkdapi/api-endpoints/search/posts.md)
  - [docs/linkdapi/api-endpoints/profile/get-full-profile.md](/Users/salman/personal-local/reacher-x/development/reacher-x/docs/linkdapi/api-endpoints/profile/get-full-profile.md)
  - [docs/linkdapi/api-endpoints/posts/all-posts.md](/Users/salman/personal-local/reacher-x/development/reacher-x/docs/linkdapi/api-endpoints/posts/all-posts.md)
  - [docs/linkdapi/api-endpoints/posts/post-comments.md](/Users/salman/personal-local/reacher-x/development/reacher-x/docs/linkdapi/api-endpoints/posts/post-comments.md)
- Unipile MCP/official API schema:
  - `POST /api/v1/hosted/accounts/link`
  - `GET /api/v1/users/{identifier}`
  - `POST /api/v1/linkedin/search`
  - `POST /api/v1/chats/{chat_id}/messages`
  - `POST /api/v1/users/invite`
  - `POST /api/v1/posts/reaction`
  - `POST /api/v1/posts/{post_id}/comments`
  - `POST /api/v1/webhooks`
- Skills used:
  - `.cursor/skills/frontend-design/SKILL.md`
  - `.cursor/skills/vercel-react-best-practices/SKILL.md`
