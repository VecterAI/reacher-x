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

| Step            | Action                                                                              |
| --------------- | ----------------------------------------------------------------------------------- |
| 1. SEARCH       | Look for existing utilities, helpers, or patterns in `shared/`, `convex/lib/`, etc. |
| 2. IF FOUND     | Use the existing implementation. Do NOT create alternatives.                        |
| 3. IF NOT FOUND | Create it in the appropriate centralized location (see Naming Conventions below).   |
| 4. NEVER        | Create one-off inline implementations or duplicate existing logic.                  |

## Common Mistakes to Avoid

| ❌ DON'T                  | ✅ DO INSTEAD                                                              |
| ------------------------- | -------------------------------------------------------------------------- |
| `Date.now()`              | `getCurrentUTCTimestamp()` from `shared/lib/utils/time/timeUtils.ts`       |
| `new Date(iso).getTime()` | `parseIsoToTimestamp(isoString)` from `shared/lib/utils/time/timeUtils.ts` |
| Inline validation logic   | Check `convex/validators.ts` for existing validators                       |
| Custom type guards        | Check `convex/lib/typeGuards.ts` for existing guards                       |
| Ad-hoc helper functions   | Check `*Helpers.ts` files in the relevant domain                           |

## Where to Look First

| Need                 | Search Location                                                            |
| -------------------- | -------------------------------------------------------------------------- |
| Time/date utilities  | `shared/lib/utils/time/timeUtils.ts`                                       |
| Formatting utilities | `shared/lib/utils/encoding/format.ts`                                      |
| Convex validators    | `convex/validators.ts`                                                     |
| Type guards          | `convex/lib/typeGuards.ts`                                                 |
| Domain helpers       | `convex/lib/*Helpers.ts` (e.g., `planHelpers.ts`, `prospectingHelpers.ts`) |
| Core business logic  | `convex/lib/*Core.ts` (e.g., `qualificationCore.ts`, `outreachCore.ts`)    |
| UI components        | `shared/ui/components/` or `features/*/ui/components/`                     |

**If you're about to write a utility function, STOP and search first!**

================================================================================
ARCHITECTURE PATTERNS & STANDARDS
================================================================================

## Three-Layer Architecture (MANDATORY)

All new development MUST follow this layered pattern:

| Layer          | Location               | Purpose        | Rules                                   |
| -------------- | ---------------------- | -------------- | --------------------------------------- |
| 1. Agent Tools | `convex/agents/tools/` | LLM interface  | Thin wrappers ONLY. No business logic.  |
| 2. Workflows   | `convex/workflows/`    | Orchestration  | Multi-step flows, retries, scheduling.  |
| 3. Core Logic  | `convex/lib/*Core.ts`  | Business logic | Pure functions, single source of truth. |

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
<ProspectCard prospect={data} loading={true} />;

// ✅ GOOD - Composition pattern
{
  loading ? <ProspectCardSkeleton /> : <ProspectCard prospect={p} />;
}
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

| Element                 | When to Use                    |
| ----------------------- | ------------------------------ |
| `<article>`             | Self-contained content (cards) |
| `<time dateTime="...">` | Dates and timestamps           |
| `<nav>`                 | Navigation sections            |
| `<aside>`               | Side panels                    |
| `<header>` / `<footer>` | Section headers/footers        |

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
const data = useQuery(api.prospects.getWorkspaceProspects, {
  workspaceId,
  limit: 100,
});
const filtered = data.filter((p) => p.status === "converted"); // Wasteful!

// ✅ GOOD - Server-side filtering with pagination
const [limit, setLimit] = useState(PROSPECTS_PER_PAGE); // 10
const data = useQuery(api.prospects.getWorkspaceProspects, {
  workspaceId,
  status: "converted",
  limit,
});
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

| Need            | Package                   | Example                                         |
| --------------- | ------------------------- | ----------------------------------------------- |
| URL state       | `nuqs`                    | `useQueryStates({ prospectId: parseAsString })` |
| Date formatting | `@/shared/lib/utils`      | `formatRelativeTime(isoString)`                 |
| Form validation | `react-hook-form` + `zod` | Already configured                              |
| Animations      | `tailwindcss-animate`     | Already configured                              |

---

## Naming Conventions (MANDATORY)

| Pattern         | Purpose                      | Example                    |
| --------------- | ---------------------------- | -------------------------- |
| `*Core.ts`      | Reusable business logic      | `qualificationCore.ts`     |
| `*Helpers.ts`   | Config, constants, utilities | `prospectingHelpers.ts`    |
| `*Pool.ts`      | Workpool instances           | `qualificationPool.ts`     |
| `*Skeleton.tsx` | Loading skeleton components  | `ProspectCardSkeleton.tsx` |

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
  v.literal("contacted")
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
  type: z.enum(["comment", "wait", "ask_human"]), // Match outreachTaskTypeValidator
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
import {
  extractProspectIdFromThread,
  extractProspectIdWithFallback,
} from "./helpers";

// Simple extraction (no fallback)
const prospectId = await extractProspectIdFromThread(ctx, "approveTask");

// With optional provided ID fallback
const prospectId = await extractProspectIdWithFallback(
  ctx,
  "getProspectPlan",
  args.prospectId
);
```

**Exported Helpers:**

- `extractProspectIdFromThread(ctx, moduleName)` - Extract from thread title
- `extractProspectIdWithFallback(ctx, moduleName, providedId?)` - With optional fallback
- `extractPlanIdFromThread(ctx, moduleName, query)` - Extract active plan ID
- `ToolContext` type - For tool handler context parameter

### Internal Queries for Context-Based ID Lookups

| Query                       | Purpose                                |
| --------------------------- | -------------------------------------- |
| `getPendingTaskForProspect` | Find pending task for approveTask tool |
| `getActivePlanForProspect`  | Find active plan for refinePlan tool   |

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
  return {
    success: false,
    error: "Prospect does not belong to this workspace",
  };
}
```

This prevents cross-workspace access even if the LLM provides a valid but
incorrect prospect ID from a different workspace.

================================================================================
END OF CONTEXT
================================================================================
