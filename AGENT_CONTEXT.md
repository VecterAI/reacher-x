# AGENT_CONTEXT.txt - ReacherX v4
# Last Updated: January 19, 2026 (Added BEFORE YOU CODE section)

================================================================================
                         ⚠️ BEFORE YOU CODE - READ THIS FIRST ⚠️
================================================================================

**STOP. Before writing ANY code, you MUST search the codebase first.**

LLMs/Agents have a tendency to use common patterns (like `Date.now()`) without
checking if the project already has established utilities. This causes:
- Inconsistency across the codebase
- Duplicated logic that drifts over time
- Violations of project-specific standards

## The Golden Rule

| Step | Action |
|------|--------|
| 1. SEARCH | Look for existing utilities, helpers, or patterns in `shared/`, `convex/lib/`, etc. |
| 2. IF FOUND | Use the existing implementation. Do NOT create alternatives. |
| 3. IF NOT FOUND | Create it in the appropriate centralized location (see Naming Conventions below). |
| 4. NEVER | Create one-off inline implementations or duplicate existing logic. |

## Common Mistakes to Avoid

| ❌ DON'T | ✅ DO INSTEAD |
|----------|---------------|
| `Date.now()` | `getCurrentUTCTimestamp()` from `shared/lib/utils/time/timeUtils.ts` |
| `new Date(iso).getTime()` | `parseIsoToTimestamp(isoString)` from `shared/lib/utils/time/timeUtils.ts` |
| Inline validation logic | Check `convex/validators.ts` for existing validators |
| Custom type guards | Check `convex/lib/typeGuards.ts` for existing guards |
| Ad-hoc helper functions | Check `*Helpers.ts` files in the relevant domain |

## Where to Look First

| Need | Search Location |
|------|-----------------|
| Time/date utilities | `shared/lib/utils/time/timeUtils.ts` |
| Formatting utilities | `shared/lib/utils/encoding/format.ts` |
| Convex validators | `convex/validators.ts` |
| Type guards | `convex/lib/typeGuards.ts` |
| Domain helpers | `convex/lib/*Helpers.ts` (e.g., `planHelpers.ts`, `prospectingHelpers.ts`) |
| Core business logic | `convex/lib/*Core.ts` (e.g., `qualificationCore.ts`, `outreachCore.ts`) |
| UI components | `shared/ui/components/` or `features/*/ui/components/` |

**If you're about to write a utility function, STOP and search first!**

================================================================================
                         ARCHITECTURE PATTERNS & STANDARDS
================================================================================

## Three-Layer Architecture (MANDATORY)

All new development MUST follow this layered pattern:

| Layer | Location | Purpose | Rules |
|-------|----------|---------|-------|
| 1. Agent Tools | `convex/agents/tools/` | LLM interface | Thin wrappers ONLY. No business logic. |
| 2. Workflows | `convex/workflows/` | Orchestration | Multi-step flows, retries, scheduling. |
| 3. Core Logic | `convex/lib/*Core.ts` | Business logic | Pure functions, single source of truth. |

### Layer 1: Agent Tools
- Validate arguments from LLM
- Call Layer 2 (workflows) or Layer 3 (core logic)
- Format response for LLM consumption
- NEVER implement business logic inline

### Layer 2: Workflows
- Use `@convex-dev/workflow` for durable execution
- Handle multi-step operations with retries
- Delegate actual work to Layer 3 core functions

### Layer 3: Core Logic
- All reusable business logic lives here
- Implemented as pure functions or internal actions
- Single source of truth - no duplication allowed

---

## UI Component Patterns (MANDATORY)

### Composition Over Flags
Use separate skeleton components instead of `loading` props:

```tsx
// ❌ BAD - Loading flag inside component
<ProspectCard prospect={data} loading={true} />

// ✅ GOOD - Composition pattern
{loading ? <ProspectCardSkeleton /> : <ProspectCard prospect={p} />}
```

### Component Families
Group related components in directories (like Tweet family):
```
features/prospects/ui/components/prospect-card/
├── ProspectCard.tsx           # Main card
├── ProspectCardHeader.tsx     # Avatar + Name + Title
├── ProspectCardBody.tsx       # Summary text
├── ProspectCardFooter.tsx     # Badge row
├── ProspectCardMenu.tsx       # Dropdown menu
├── ProspectCardSkeleton.tsx   # Loading skeleton
└── index.ts                   # Barrel exports
```

### Semantic HTML
Use semantic elements for accessibility - no unnecessary div/span wrappers:

| Element | When to Use |
|---------|-------------|
| `<article>` | Self-contained content (cards) |
| `<time dateTime="...">` | Dates and timestamps |
| `<nav>` | Navigation sections |
| `<aside>` | Side panels |
| `<header>` / `<footer>` | Section headers/footers |

```tsx
// ❌ BAD - Generic elements
<div className="card">...</div>
<span>{formatRelativeTime(new Date(timestamp).toISOString())}</span>

// ✅ GOOD - Semantic elements
<article className="card">...</article>
<time dateTime={new Date(timestamp).toISOString()}>
  {formatRelativeTime(new Date(timestamp).toISOString())}
</time>
```

### Skeleton UI Consistency
Keep chrome (tabs, search, filters) visible during loading. Only replace content with skeletons:

```tsx
// ❌ BAD - Hides everything during loading
{isLoading ? <AllSkeletons /> : <TabsAndContent />}

// ✅ GOOD - Follows "/" page pattern
<ProspectsToolbar ... />  {/* Always rendered */}
{isLoading ? <ProspectCardSkeleton /> : <ProspectList />}
```

### Server-Side Filtering & Pagination (MANDATORY)
Always use server-side filtering when database indexes exist. Never fetch all and filter client-side.

```tsx
// ❌ BAD - Client-side filtering
const data = useQuery(api.prospects.getWorkspaceProspects, { workspaceId, limit: 100 });
const filtered = data.filter(p => p.status === "converted");  // Wasteful!

// ✅ GOOD - Server-side filtering with pagination
const [limit, setLimit] = useState(PROSPECTS_PER_PAGE);  // 10
const data = useQuery(api.prospects.getWorkspaceProspects, 
  { workspaceId, status: "converted", limit }
);
// Use data.hasMore to show "Load More" button
```

### Parallel Queries for Tabs
When a page has tabs showing different status filters, use parallel queries:

```tsx
// ✅ GOOD - Parallel queries (Option C from Jan 11 audit)
const newData = useQuery(..., { status: "new", limit: newLimit });
const contactedData = useQuery(..., { status: "contacted", limit: contactedLimit });
const inProgressData = useQuery(..., { status: "in_progress", limit: inProgressLimit });
```

Benefits: Instant tab switching, independent pagination per tab, Convex caches each query.

---

## Use Established Packages (MANDATORY)

Prefer established packages over custom implementations. See package.json for full list.

| Need | Package | Example |
|------|---------|---------|
| URL state | `nuqs` | `useQueryStates({ prospectId: parseAsString })` |
| Date formatting | `@/shared/lib/utils` | `formatRelativeTime(isoString)` |
| Form validation | `react-hook-form` + `zod` | Already configured |
| Animations | `tailwindcss-animate` | Already configured |

---

## Naming Conventions (MANDATORY)

| Pattern | Purpose | Example |
|---------|---------|---------|
| `*Core.ts` | Reusable business logic | `qualificationCore.ts` |
| `*Helpers.ts` | Config, constants, utilities | `prospectingHelpers.ts` |
| `*Pool.ts` | Workpool instances | `qualificationPool.ts` |
| `*Skeleton.tsx` | Loading skeleton components | `ProspectCardSkeleton.tsx` |

---

## Logging Standard (MANDATORY)

Use `console.log`, `console.warn`, `console.error` ONLY.
No custom logging functions (logAI was removed).

Format: `[ModuleName] Message with context`

---

## Type Safety Standards (MANDATORY)

When accessing nested optional properties, use runtime type guards from `convex/lib/typeGuards.ts`:

```typescript
// ❌ BAD - Unsafe casting
const screenName = (prospectData.user as Record<string, string>)?.screen_name;

// ✅ GOOD - Use type guard utilities
import { getNestedRecord, getStringProperty } from "../lib/typeGuards";

const user = getNestedRecord(prospectData, "user");
const screenName = getStringProperty(user, "screen_name") || null;
```

**Available Type Guards:**
- `isRecord(value)` - Check if value is a Record
- `getNestedRecord(obj, key)` - Safely extract nested object
- `getStringProperty(obj, key)` - Safely extract string property
- `getNumberProperty(obj, key)` - Safely extract number property

---

## Validator Standards (MANDATORY)

**Single Source of Truth:** `convex/validators.ts`

All validators MUST be defined once in `validators.ts` and imported elsewhere:

```typescript
// ❌ BAD - Local validator in schema.ts
const prospectStatusValidator = v.union(
  v.literal("new"),
  v.literal("contacted"),
  // ...
);

// ✅ GOOD - Import from validators.ts
import { prospectStatusValidator } from "./validators";
```

**TypeScript Types:** Use `Infer<>` instead of duplicating validator values:

```typescript
// ❌ BAD - Manual type duplicating validator
interface Task {
  type: "comment" | "wait" | "ask_human";
}

// ✅ GOOD - Infer from validator
import { Infer } from "convex/values";
interface Task {
  type: Infer<typeof outreachTaskTypeValidator>;
}
```

### Zod Schema Exception (@convex-dev/agent)

Agent tools use `@convex-dev/agent` which requires **Zod** for argument validation,
while Convex uses its own validator system. This creates intentional duplication.

**Approach:** Keep Zod schemas in agent tools, but align values with validators.ts:

```typescript
// convex/agents/outreach/tools/refinePlan.ts
/**
 * NOTE: These Zod schemas duplicate the Convex validators in validators.ts.
 * This is intentional because @convex-dev/agent requires Zod for tool args.
 * Values are aligned with validators.ts - if you add/remove values there,
 * update these schemas too.
 */
const taskSchema = z.object({
  type: z.enum(["comment", "wait", "ask_human"]),  // Match outreachTaskTypeValidator
  // ...
});
```

---

## Agent Tool ID Extraction (MANDATORY)

**NEVER accept Convex document IDs from LLM input.** LLMs hallucinate fake IDs.

```typescript
// ❌ BAD - LLM provides ID (will be hallucinated)
args: z.object({
  taskId: z.string().describe("The task ID to approve"),
}),
handler: async (ctx, args) => {
  await ctx.runMutation(internal.outreach.approveTaskInternal, {
    taskId: args.taskId as Id<"outreachTasks">,  // UNSAFE CAST!
  });
}

// ✅ GOOD - Extract ID from thread context
args: z.object({}),  // No ID args!
handler: async (ctx) => {
  const prospectId = await extractProspectIdFromThread(ctx);
  const task = await ctx.runQuery(internal.outreach.getPendingTaskForProspect, {
    prospectId,
  });
  await ctx.runMutation(internal.outreach.approveTaskInternal, {
    taskId: task._id,  // Real ID from database query
  });
}
```

### ID Extraction Helper Pattern

All outreach tools use shared helpers from `convex/agents/outreach/tools/helpers.ts`:

```typescript
import { extractProspectIdFromThread, extractProspectIdWithFallback } from "./helpers";

// Simple extraction (no fallback)
const prospectId = await extractProspectIdFromThread(ctx, "approveTask");

// With optional provided ID fallback
const prospectId = await extractProspectIdWithFallback(ctx, "getProspectPlan", args.prospectId);
```

**Exported Helpers:**
- `extractProspectIdFromThread(ctx, moduleName)` - Extract from thread title
- `extractProspectIdWithFallback(ctx, moduleName, providedId?)` - With optional fallback
- `extractPlanIdFromThread(ctx, moduleName, query)` - Extract active plan ID
- `ToolContext` type - For tool handler context parameter

### Internal Queries for Context-Based ID Lookups

| Query | Purpose |
|-------|---------|
| `getPendingTaskForProspect` | Find pending task for approveTask tool |
| `getActivePlanForProspect` | Find active plan for refinePlan tool |

---

## Workspace-Scoped Validation (Setup Agent Tools)

For setup agent tools that accept `prospectId` and `workspaceId` arguments
(e.g., `enrichProspect`, `qualifyProspect`), always validate that the prospect
belongs to the specified workspace:

```typescript
// ✅ GOOD - Validate workspace ownership
const prospect = await ctx.runQuery(api.prospects.getProspect, {
  prospectId: args.prospectId as Id<"prospects">,
});

if (!prospect) {
  return { success: false, error: "Prospect not found" };
}

// Prevent cross-workspace access
if (prospect.workspaceId !== args.workspaceId) {
  return { success: false, error: "Prospect does not belong to this workspace" };
}
```

This prevents cross-workspace access even if the LLM provides a valid but
incorrect prospect ID from a different workspace.

================================================================================
                              CURRENT SYSTEM STATE
================================================================================

## Active Features
- ✅ Twitter prospecting (via SocialAPI monitors)
- ✅ AI bot detection on every prospect
- ✅ Streaming qualification via Workpool
- ✅ Streaming enrichment via Workpool
- ✅ Synthetic posts keyword generation
- ✅ ProspectCard component (list view)
- ✅ ProspectProfilePanel component (detail view)
- ✅ Outreach Agent with tools (getProspectContext, generatePlan, refinePlan, analyzeBestEngagement, askHuman)
- ✅ Real Twitter comment execution via twitter-api-v2
- ✅ Prospect response detection via User Tweets Monitors
- ✅ Auto-status update to "in_progress" when prospect responds (via `onProspectResponse`)
- ✅ Auto outreach plan generation for high-match prospects (score >= 90) via Workpool

## Disabled Features
- ⏸️ LinkedIn search (rate limits)
- ⏸️ LinkedIn qualification (returns 'pending' status)
- ⏸️ Bishopi keyword discovery (replaced by synthetic posts)

## Development Mode

Mock data files remain available for reference in `features/prospects/lib/mockData.ts`.
All mock toggles have been removed - the application now uses real data only.

================================================================================
                         PROSPECT UI COMPONENTS (NEW)
================================================================================

## ProspectCard (List View)
Location: `features/prospects/ui/components/prospect-card/`

| Component | Purpose |
|-----------|---------|
| ProspectCard | Main card, takes Convex `Doc<"prospects">` directly |
| ProspectCardHeader | Avatar + name + time + title (click → detail page) |
| ProspectCardBody | Post text with keyword highlighting |
| ProspectCardFooter | Scrollable badges (match score, finance, location) |
| ProspectCardMenu | Dropdown with status marking, share, archive (optimistic updates) |
| ProspectCardSkeleton | Loading skeleton (composition pattern) |

## ProspectProfilePanel (Detail View)
Location: `features/prospects/ui/components/`

| Component | Purpose |
|-----------|---------|
| ProspectProfilePanel | Full profile with tabs |
| ProspectProfileHeader | Large avatar + name + Chat button |
| PipelineTimeline | Visual pipeline stage indicator |
| ProspectDetailsCard | Company, email, finance info |
| PainSolutionGrid | Pain points with solutions |
| SocialProfileLinks | Twitter/LinkedIn profile buttons |
| EvidencePostsPanel | Sub-panel for evidence posts |

## Context Providers
- `ProspectProfileProvider` - Wraps app, manages prospect loading
- `PanelStackProvider` - Panel navigation stack for sub-panels
- `useProspectProfile()` - Hook to access prospect data and open/close

================================================================================
                         PENDING WORK / TODO
================================================================================

## High Priority
- [x] Implement "Relevant activity" tab in ProspectProfilePanel → `RelevantActivityTab.tsx`
- [x] Implement "Your interactions" tab in ProspectProfilePanel → `YourInteractionsTab.tsx`
- [x] Implement "Activity log" tab in ProspectProfilePanel → `features/prospects/ui/components/tabs/ActivityLogTab.tsx`
- [x] Transform raw interactions to full tweet data → `fetchProspectInteractions` action in `outreachActions.ts`
- [ ] Wire up Filter/Sort buttons on prospects page
- [ ] Implement workspace creation flow (`/workspace/new`)
- [x] Implement vector search in HistoryPanel → `searchProspectMessages` action in `chat.ts`
- [ ] Implement workspace switching in `Header.tsx` (currently logs to console.info)
- [ ] Replace hardcoded notification count with real query
- [ ] Implement tier-based workspace limits in `Header.tsx` (currently hardcoded to `true`)
- [ ] Implement notification dismiss in `notifications/page.tsx`

## Medium Priority
- [ ] Create dedicated ProspectCard for mobile (drawer behavior)
- [ ] Add swipe actions on ProspectCard (archive, contact, etc.)
- [x] Implement prospect status updates from UI (ProspectCardMenu, ProspectProfileHeader)
- [x] Implement Archive/Unarchive toggle in dropdown menus (ProspectCardMenu, ProspectProfileHeader)

## Low Priority / Future
- [ ] Refactor Tweet component to use composition pattern for loading
- [ ] Refactor LinkedInPostCard to use composition pattern
- [ ] Implement best time calculation in `workflows/outreach.ts`
- [ ] Implement stream abort in `useAgentChat.ts` when supported

================================================================================
                         KNOWN ISSUES
================================================================================

No known issues at this time. All previously documented issues have been fixed.

================================================================================
                         QUALIFICATION SYSTEM
================================================================================

## Single Source of Truth
All qualification logic is in: `convex/lib/qualificationCore.ts`

## LLM-Based Qualification (v2)
Uses Gemini 3 Flash for holistic prospect evaluation in a single call.
The LLM evaluates: ICP fit, engagement quality, authenticity, and recency.

## Functions Exported
- `qualifyProspectCore()` - Main LLM-based qualification (single entry point)

## Consumers
1. `convex/workflows/qualification.ts` - Automated per-prospect qualification
2. `convex/agents/tools/qualifyProspect.ts` - Agent-triggered qualification

## Scoring (LLM-determined)
| Score Range | Meaning |
|-------------|---------|
| 80-100 | Strong ICP fit, pursue immediately |
| 70-79 | Good fit, worth pursuing |
| 50-69 | Moderate fit, needs review |
| 0-49 | Poor fit or bot, skip |
| **Threshold** | 70+ AND not a bot = qualified |

## Bot Detection
Integrated into the main LLM call (not separate).
Checks: account age, follower ratio, bio quality, posting patterns, engagement farming.

================================================================================
                         ENRICHMENT SYSTEM
================================================================================

## Single Source of Truth
All enrichment logic is in: `convex/lib/enrichmentCore.ts`

## Functions Exported
- `enrichTwitterProfile()` - Extract data from Twitter profile + posts
- `enrichLinkedInProfile()` - Extract data from LinkedIn profile + posts
- Single unified LLM call for all extraction (type, title, pain points, finance)

## Consumers
1. `convex/workflows/enrichment.ts` - Automated post-qualification enrichment
2. `convex/agents/tools/enrichProspect.ts` - Thin wrapper, triggers workflow

## IMPORTANT: Workflow Runtime Architecture
Workflow handlers run in **default Convex runtime** (NOT Node.js).
LLM calls require Node.js for `process.env` access.

**Pattern:** Core functions are called via `step.runAction()` through internalAction wrappers:

| Wrapper (in enrichment.ts) | Calls |
|----------------------------|-------|
| `runTwitterEnrichmentCore` | `enrichTwitterProfile()` from enrichmentCore.ts |
| `runLinkedInEnrichmentCore` | `enrichLinkedInProfile()` from enrichmentCore.ts |

This matches the pattern in `qualification.ts` with `runQualificationCore`.

## Enrichment Fields
| Field | Source |
|-------|--------|
| prospectType | LLM detection (individual/organization) |
| title | LLM generation (e.g., "Solo SaaS Founder") |
| painPoints | LLM extraction from posts + ICP solution matching |
| finance | LinkedIn fundingData OR LLM extraction from posts |


## Finance Post Search
During enrichment, parallel search for finance keywords:
`MRR, ARR, revenue, raised, funding, Series A/B, profit, valuation`

Timeout: 30 seconds (configurable in `convex/integrations/twitter/searchUserPosts.ts`)

================================================================================
                         OUTREACH SYSTEM
================================================================================

## Overview
Intelligent outreach system that generates personalized engagement plans,
executes tasks via durable workflows, and handles human-in-the-loop approvals.

Full spec: See OUTREACH_PLAN.txt for detailed flows and UI designs.

## Single Source of Truth
All outreach core logic is in: `convex/lib/outreachCore.ts`

## Functions Exported
- `createOutreachPlan()` - Create new plan with tasks
- `refinePlan()` - Update plan based on user feedback
- `approvePlan()` - Approve for execution
- `getProspectActivePlan()` - Get current plan for prospect
- `getProspectActivityLog()` - Get timeline entries
- `logProspectActivity()` - Add activity entry
- `createNotification()` - Create notification
- `AUTO_PLAN_GENERATION_THRESHOLD` - Score threshold for auto-generation (90)

## Consumers
1. `convex/workflows/outreach.ts` - Durable workflow for plan execution
2. `convex/agents/outreach/tools/generatePlan.ts` - Agent tool to create plans
3. `convex/outreach.ts` - Public/internal mutations and queries

## Schema Tables
| Table | Purpose |
|-------|---------|
| `outreachPlans` | Plan status, strategy, linked prospect |
| `outreachTasks` | Individual tasks with timing/status |
| `prospectActivityLog` | Timeline entries (found, contacted, etc.) |
| `outreachNotifications` | Human-in-the-loop notifications |

## Outreach Agent
Location: `convex/agents/outreach/index.ts`

| Tool | Purpose | ID Source |
|------|---------|-----------|
| `getProspectContext` | RAG search + DB fetch | Thread context |
| `getProspectPlan` | Cross-thread plan access | Thread context |
| `generatePlan` | Creates plan with tasks | Thread context |
| `refinePlan` | Update plan based on feedback | Thread context (via `getActivePlanForProspect`) |
| `analyzeBestEngagement` | Find best tweet to engage with | Thread context |
| `askHuman` | Human-in-the-loop requests | N/A (no IDs) |
| `approveTask` | Approve pending task | Thread context (via `getPendingTaskForProspect`) |
| `displayPost` | Generative UI - renders post cards | Thread context |

## Context Injection Pattern (CRITICAL)
The outreach agent uses `contextHandler` to inject prospect data automatically:
- Extracts `prospectId` from thread title (format: `outreach:{prospectId}`)
- **ALL tools extract IDs from thread context, NEVER from LLM** (prevents hallucination)
- Use `extractProspectIdFromThread()` helper for consistency
- This means ANY thread for a prospect has full context

## Unified Agent Action Pattern
Agent actions from buttons/notifications:
1. User clicks button/notification → Route to `/agent` with params
2. Relevant actions auto-prompt; others show existing thread for manual input
3. Agent handles action in existing thread with full context

Supported actions:
| Action Param | Trigger | Behavior |
|--------------|---------|----------|
| `generatePlan` | "Generate Plan" button | Auto-creates thread with plan generation prompt |
| (none) | Task approval notification | Routes to thread; user types approval manually |

**NOTE:** Task approvals do NOT auto-prompt. User must type "approved", "go ahead", etc.
This prevents unwanted agent prompting when viewing notifications.

## Task Status for Approval (IMPORTANT)
When workflow awaits human approval, task status is `"executing"` (not "pending").
The `getPendingTaskForProspect` query includes all of:
- `"pending"` - Task not yet started
- `"executing"` - Task awaiting human approval via `awaitEvent`
- `"waiting_response"` - Task waiting for prospect response

## RAG Integration
Location: `convex/agents/outreach/rag.ts`
- Uses OpenRouter `text-embedding-3-small` model
- Namespace: `prospect:{prospectId}`
- Filters: `contentType` (evidence_post, recent_tweet, pain_point)

## Workflow Pattern
Uses `@convex-dev/workflow` with:
- `step.runAction(..., { runAfter: ms })` - Delayed execution
- `step.awaitEvent({ name: "..." })` - Human-in-the-loop pause
- `workflow.sendEvent(...)` - Resume after human input

## Chat Functions
Location: `convex/chat.ts`
- `createProspectThread` - New thread for prospect
- `getProspectThread` - Get existing thread (query, doesn't create)
- `createProspectThreadWithPrompt` - Create thread with initial message
- `listProspectThreads` - Filter by prospect
- `archiveThread` - Soft delete
- `sendProspectMessage` - Stream to outreach agent

## UI Components (New)
| Component | Location |
|-----------|----------|
| `OverviewTab` | `features/prospects/ui/components/tabs/OverviewTab.tsx` |
| `ActivityLogTab` | `features/prospects/ui/components/tabs/ActivityLogTab.tsx` |
| `OutreachPlanSection` | `features/prospects/ui/components/OutreachPlanSection.tsx` |
| `TaskItem` | `features/prospects/ui/components/outreach-plan/TaskItem.tsx` |

## Implementation Status: COMPLETE ✅
- ✅ Schema, validators, RAG, agent tools, chat functions, workflow, UI components
- ✅ SocialAPI monitors → `convex/prospectMonitors.ts`
- ✅ NotificationsPage → `app/(webapp)/notifications/page.tsx`
- ✅ Thread History Panel → `features/agent/ui/components/HistoryPanel.tsx`
- ✅ RAG indexing → `convex/lib/ragIndexing.ts`
- ✅ askHuman spontaneous support → `convex/chat.ts` (lines 345-815)
- ✅ Vector search in HistoryPanel → `searchProspectMessages` action + `ThreadCardSkeleton` + `ThreadSearchResult` type
- ✅ Unified agent action pattern → `action=approveTask` with auto-prompt

================================================================================
                         KEY FILES REFERENCE
================================================================================

## Core Logic
- `convex/lib/ai.ts` - OpenRouter provider, robustGenerateObject
- `convex/lib/qualificationCore.ts` - All qualification logic
- `convex/lib/enrichmentCore.ts` - All enrichment logic
- `convex/lib/outreachCore.ts` - All outreach logic (AUTO_PLAN_GENERATION_THRESHOLD = 90)
- `convex/lib/prospectingHelpers.ts` - Tier limits, batch limits
- `convex/lib/qualificationPool.ts` - Workpool (maxParallelism: 10)
- `convex/lib/enrichmentPool.ts` - Workpool (maxParallelism: 10)
- `convex/lib/outreachPlanPool.ts` - Workpool (maxParallelism: 5, for auto plan generation)
- `convex/lib/workflow.ts` - Workflow manager instance
- `convex/lib/typeGuards.ts` - Runtime type guard utilities (isRecord, getNestedRecord, etc.)
- `convex/lib/notificationHelpers.ts` - Notification state + prospect display field extraction

## Workflows
- `convex/workflows/prospecting.ts` - Main prospecting workflow
- `convex/workflows/qualification.ts` - Per-prospect qualification
- `convex/workflows/enrichment.ts` - Per-prospect enrichment
- `convex/workflows/outreach.ts` - Outreach plan execution (NEW)

## Prospect UI
- `features/prospects/ui/components/prospect-card/` - ProspectCard family
- `features/prospects/ui/components/ProspectProfilePanel.tsx` - Detail panel
- `features/prospects/ui/components/OutreachPlanSection.tsx` - Plan display (NEW)
- `features/prospects/ui/components/outreach-plan/TaskItem.tsx` - Task item (NEW)
- `features/prospects/ui/components/tabs/` - Tab components (NEW)
- `features/prospects/contexts/ProspectProfileContext.tsx` - Data loading
- `features/prospects/contexts/PanelStackContext.tsx` - Panel navigation
- `features/prospects/lib/mockData.ts` - Development mock data

## Sidebar & Pages
- `features/webapp/ui/components/sidebar/SidebarHeader.tsx` - Tier-based header
- `features/webapp/ui/components/sidebar/SidebarNavigation.tsx` - Nav groups (Prospects, Converts, Archives)
- `app/(webapp)/page.tsx` - Main prospects page (tabs: new/contacted/in_progress, parallel queries, pagination)
- `app/(webapp)/converts/page.tsx` - Converted prospects (server-side filter, pagination)
- `app/(webapp)/archives/page.tsx` - Archived prospects (server-side filter, pagination)
- `app/(webapp)/analytics/page.tsx` - Analytics (placeholder)
- `app/(webapp)/settings/connected-accounts/page.tsx` - OAuth accounts

## Integrations
- `convex/integrations/twitter/getProfile.ts` - Twitter profile fetch
- `convex/integrations/linkedin/getProfile.ts` - LinkedIn profile fetch
- `convex/integrations/linkedin/getCompany.ts` - LinkedIn company fetch

## Agent Tools
- `convex/agents/tools/searchProspects.ts` - Starts prospecting workflow
- `convex/agents/tools/qualifyProspect.ts` - Triggers qualification
- `convex/agents/tools/enrichProspect.ts` - Triggers enrichment (thin wrapper)
- `convex/agents/tools/analyzeUrl.ts` - URL content extraction
- `convex/agents/tools/generateImprovedDescription.ts` - ICP generation
- `convex/agents/outreach/tools/` - Outreach tools
  - `helpers.ts` - Shared ID extraction helpers (single source of truth)
  - `getProspectContext.ts` - RAG + DB fetch
  - `getProspectPlan.ts` - Cross-thread plan access
  - `generatePlan.ts` - Create plan with tasks
  - `refinePlan.ts` - Update plan (extracts planId from context)
  - `analyzeBestEngagement.ts` - Find best tweet to engage with
  - `askHuman.ts` - Human-in-the-loop approval requests
  - `approveTask.ts` - Approve pending task (extracts taskId from context)
  - `displayPost.ts` - Generative UI for post cards

## Outreach Internal Queries (for ID extraction)
- `getPendingTaskForProspect` - Find pending task for approveTask tool
- `getActivePlanForProspect` - Find active plan for refinePlan tool

## Outreach
- `convex/agents/outreach/index.ts` - Outreach agent definition
- `convex/agents/outreach/rag.ts` - RAG instance for prospect context
- `convex/outreach.ts` - Public/internal queries and mutations

================================================================================
                              TECH STACK
================================================================================

## Convex Components
- @convex-dev/agent - AI agent framework
- @convex-dev/workflow - Durable workflow execution
- @convex-dev/action-retrier - API retry with exponential backoff
- @convex-dev/workpool - Concurrent execution throttling
- @convex-dev/rag - Retrieval-Augmented Generation (NEW)

## AI Provider
- OpenRouter (@openrouter/ai-sdk-provider)
- Qualification: google/gemini-3-flash-preview (document analysis)
- Agents: moonshotai/kimi-k2-thinking (agentic conversations)
- Fallbacks: gemini-2.5-flash-lite → claude-haiku-4.5 → gpt-oss-120b

## External APIs
- SocialAPI.me - Twitter search + monitors
- LinkdAPI.com - LinkedIn (⏸️ DISABLED)
- Exa SDK - URL analysis

## Package Manager
- pnpm (specified in package.json)

================================================================================
                              API REFERENCE
================================================================================

## Twitter Search (SocialAPI)
GET https://api.socialapi.me/twitter/search?query={query}&type=Latest

**User Post Query Format:**
- Use: `from:username keyword` (simple, space-separated)
- NOT: `from:user_id (kw1 OR kw2)` ← Parentheses break the from: filter
- `from:` requires screen_name, NOT numeric id_str

**Pagination:** Uses `next_cursor` in response.

## LinkedIn (LinkdAPI) - ⏸️ DISABLED
GET https://linkdapi.com/api/v1/search/posts?keyword={keyword}

================================================================================
                              BATCH LIMITS
================================================================================

| Operation | Limit | Reason |
|-----------|-------|--------|
| Prospecting keywords/cycle | 10-15 | AI cost control |
| Social queries per cycle | 15 | AI cost control |
| Twitter search batch | 5 | Rate limits |
| Qualification concurrency | 10 | Workpool limit |
| Enrichment concurrency | 10 | Workpool limit |
| Auto plan generation concurrency | 5 | Workpool limit (lower due to LLM cost) |
| Prospect list pagination | 10 | UX consistency (matches RelevantActivityTab) |

================================================================================
                              ENVIRONMENT VARIABLES
================================================================================

Required in Convex dashboard:
- OPENROUTER_API_KEY
- NEXT_PUBLIC_CONVEX_URL
- EXA_API_KEY
- SOCIALAPI_API_KEY
- LINKDAPI_API_KEY

================================================================================
                              END OF CONTEXT
================================================================================

