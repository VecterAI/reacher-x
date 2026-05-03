# PROJECT.md - ReacherX Codebase Navigator

> **Purpose**: Quick navigation guide for LLMs/Agents to find the right files and understand the codebase architecture.

---

## 🔍 Quick Reference

| What You Need    | Where To Look                                                |
| ---------------- | ------------------------------------------------------------ |
| Database schema  | `convex/schema.ts`                                           |
| API validators   | `convex/validators.ts`                                       |
| Agent context    | `AGENT_CONTEXT.txt` (**read BEFORE YOU CODE section first**) |
| Environment vars | `.env.example`                                               |
| Business logic   | `convex/lib/*Core.ts` files                                  |
| UI components    | `shared/ui/components/` (68 base components)                 |
| Feature modules  | `features/` directory                                        |

---

## 📁 Directory Structure

```
reacher-x/
├── app/                    # Next.js 16 App Router pages
│   ├── (webapp)/           # Main authenticated app routes
│   ├── api/                # API routes
│   ├── home/               # Landing pages
│   └── login/, logout/, callback/
├── convex/                 # Backend (Convex)
│   ├── agents/             # AI agents (setup + outreach)
│   ├── integrations/       # External APIs (Twitter, LinkedIn, Bishopi)
│   ├── lib/                # Core business logic
│   ├── workflows/          # Durable workflows
│   ├── schema.ts           # Database schema
│   └── validators.ts       # Shared validators (SINGLE SOURCE OF TRUTH)
├── features/               # Feature modules (UI + logic)
│   ├── agent/              # AI agent chat interface
│   ├── composer/           # Twitter compose/reply
│   ├── landing/            # Landing page components
│   ├── linked-accounts/    # OAuth account management
│   ├── prospects/          # Prospect cards, panels, tabs
│   ├── search/             # Search functionality
│   ├── threads/            # Twitter thread display
│   ├── waitlist/           # Waitlist signup
│   └── webapp/             # App shell, sidebar, header
├── shared/                 # Shared utilities & components
│   ├── ui/components/      # 68 shadcn/ui base components
│   ├── lib/                # Utility functions
│   ├── hooks/              # Shared React hooks
│   └── types/              # Shared TypeScript types
├── docs/                   # API Documentation (6 folders)
├── emails/                 # React Email templates
└── public/                 # Static assets
```

---

## 🗄️ Database Schema (`convex/schema.ts`)

### Core Tables

| Table            | Purpose                       | Key Indexes                     |
| ---------------- | ----------------------------- | ------------------------------- |
| `users`          | User accounts (WorkOS auth)   | `by_workos_user_id`             |
| `workspaces`     | User workspaces with ICP      | `by_user_id`, `by_user_default` |

### Prospect Tables

| Table       | Purpose                                          | Key Indexes                                |
| ----------- | ------------------------------------------------ | ------------------------------------------ |
| `prospects` | Found prospects                                  | `by_workspace`, `by_status`, `by_platform` |
| `keywords`  | Search keywords (seed, discovered, social_query) | `by_workspace_type`, `by_workspace_value`  |

### Outreach Tables

| Table                   | Purpose                                     | Key Indexes            |
| ----------------------- | ------------------------------------------- | ---------------------- |
| `outreachPlans`         | Engagement plans per prospect               | `by_prospect`          |
| `outreachTasks`         | Individual tasks (comment, wait, ask_human) | `by_plan`, `by_status` |
| `prospectActivityLog`   | Timeline entries                            | `by_prospect`          |
| `outreachNotifications` | Human-in-the-loop notifications             | `by_user_status`       |

### Monitoring Tables

| Table                 | Purpose                                   |
| --------------------- | ----------------------------------------- |
| `socialQueryMonitors` | SocialAPI monitors for keywords           |
| `prospectMonitors`    | SocialAPI monitors for prospect responses |

---

## 🤖 AI Agents (`convex/agents/`)

### Setup Agent (`convex/agents/index.ts`)

Tools in `convex/agents/tools/`:

| Tool                          | Purpose                            |
| ----------------------------- | ---------------------------------- |
| `analyzeUrl`                  | Extract product info from URL      |
| `generateImprovedDescription` | Create ICP from description        |
| `createWorkspace`             | Create new workspace               |
| `updateWorkspace`             | Update workspace settings          |
| `searchProspects`             | Start prospecting workflow         |
| `qualifyProspect`             | Trigger qualification workflow     |
| `enrichProspect`              | Trigger enrichment workflow        |
| `getUserStatus`               | Get user account status            |
| `convertToSocialQueries`      | Convert keywords to search queries |

### Outreach Agent (`convex/agents/outreach/index.ts`)

Tools in `convex/agents/outreach/tools/`:

| Tool                    | Purpose                         | ID Source      |
| ----------------------- | ------------------------------- | -------------- |
| `getProspectContext`    | RAG + DB fetch                  | Thread context |
| `getProspectPlan`       | Cross-thread plan access        | Thread context |
| `generatePlan`          | Create outreach plan with tasks | Thread context |
| `refinePlan`            | Update plan based on feedback   | Thread context |
| `analyzeBestEngagement` | Find best tweet to engage with  | Thread context |
| `askHuman`              | Human-in-the-loop requests      | N/A            |
| `approveTask`           | Approve pending task            | Thread context |
| `displayPost`           | Generative UI for post cards    | Thread context |

**Context Injection**: All outreach tools extract `prospectId` from thread title (`outreach:{prospectId}`), NEVER from LLM input (prevents hallucination).

---

## ⚙️ Core Business Logic (`convex/lib/`)

| File                     | Purpose                                            |
| ------------------------ | -------------------------------------------------- |
| `ai.ts`                  | OpenRouter provider, `robustGenerateObject()`      |
| `qualificationCore.ts`   | LLM-based prospect qualification                   |
| `enrichmentCore.ts`      | Profile enrichment (Twitter/LinkedIn)              |
| `outreachCore.ts`        | Outreach plan creation, approval, activity logging |
| `planConstants.ts`       | Plan tier constants & types (breaks circular deps) |
| `planHelpers.ts`         | Plan formatting and utilities                      |
| `prospectingHelpers.ts`  | Tier limits, batch limits                          |
| `ragIndexing.ts`         | RAG document indexing                              |
| `typeGuards.ts`          | Runtime type guard utilities                       |
| `notificationHelpers.ts` | Notification state management                      |
| `retrier.ts`             | Action retry configuration                         |
| `workflow.ts`            | Workflow manager instance                          |

### Workpools

| Pool          | File                   | Parallelism |
| ------------- | ---------------------- | ----------- |
| Qualification | `qualificationPool.ts` | 10          |
| Enrichment    | `enrichmentPool.ts`    | 10          |
| Auto Plan Gen | `outreachPlanPool.ts`  | 5           |

---

## 🔁 Workflows (`convex/workflows/`)

| Workflow           | Purpose                                           |
| ------------------ | ------------------------------------------------- |
| `prospecting.ts`   | Main prospecting cycle (keyword → search → store) |
| `qualification.ts` | Per-prospect LLM qualification                    |
| `enrichment.ts`    | Per-prospect profile enrichment                   |
| `outreach.ts`      | Outreach plan execution with human-in-the-loop    |

**Pattern**: Workflows run in default Convex runtime; LLM calls use `step.runAction()` through internal action wrappers.

---

## 🔌 External Integrations (`convex/integrations/`)

### Twitter (`twitter/`)

| File                 | Purpose                          |
| -------------------- | -------------------------------- |
| `getProfile.ts`      | Fetch user profile               |
| `searchUserPosts.ts` | Search user's posts for keywords |
| `searchTweets.ts`    | General tweet search             |
| `twitterActions.ts`  | Twitter action request lifecycle |

### LinkedIn (`linkedin/`) - active with partial parity to X

| File                 | Purpose                   |
| -------------------- | ------------------------- |
| `getProfile.ts`      | Fetch LinkedIn profile    |
| `getCompany.ts`      | Fetch company info        |
| `searchPosts.ts`     | Search LinkedIn posts     |
| `getProfilePosts.ts` | Get user's LinkedIn posts |

### Bishopi (`bishopi.ts`)

Keyword discovery (replaced by synthetic posts in v4).

---

## 🖥️ App Routes (`app/`)

### Main Routes (`(webapp)/`)

| Route                    | File                  | Purpose                                                      |
| ------------------------ | --------------------- | ------------------------------------------------------------ |
| `/`                      | `page.tsx`            | Main workspace list (use-case-aware labels on fixed route)   |
| `/agent`                 | `agent/page.tsx`      | AI chat interface                                            |
| `/<success-slug>`        | `[slug]/page.tsx`     | Use-case-aware success list (`/converts`, `/hires`, etc.)    |
| `/archives`              | `archives/page.tsx`   | Archived prospects                                           |
| `/notifications`         | `notifications/page.tsx` | Notifications center                                      |
| `/settings`              | `settings/`           | Settings pages                                               |
| `/workspace`             | `workspace/`          | Workspace management                                         |
| `/<entity-slug>/[id]`    | `[slug]/[id]/page.tsx` | Use-case-aware detail route (`/prospects/[id]`, `/candidates/[id]`, etc.) |
| `/post/[id]`             | `post/[id]/page.tsx` | Tweet detail                                                 |

### Public Routes

| Route               | Purpose        |
| ------------------- | -------------- |
| `/home`             | Landing pages  |
| `/login`, `/logout` | Authentication |
| `/callback`         | OAuth callback |

---

## 🧩 Feature Modules (`features/`)

### prospects/ (Main Feature)

```
features/prospects/
├── contexts/
│   ├── ProspectProfileContext.tsx   # Prospect data loading
│   └── PanelStackContext.tsx        # Panel navigation
├── ui/
│   └── components/
│       ├── prospect-card/           # ProspectCard family
│       │   ├── ProspectCard.tsx
│       │   ├── ProspectCardHeader.tsx
│       │   ├── ProspectCardBody.tsx
│       │   ├── ProspectCardFooter.tsx
│       │   ├── ProspectCardMenu.tsx
│       │   └── ProspectCardSkeleton.tsx
│       ├── ProspectProfilePanel.tsx # Detail panel
│       ├── OutreachPlanSection.tsx  # Plan display
│       ├── outreach-plan/           # Outreach plan components
│       │   ├── OutreachPlanCard.tsx
│       │   ├── TaskItem.tsx
│       │   └── index.ts
│       └── tabs/                    # Tab components
│           ├── OverviewTab.tsx
│           ├── ActivityLogTab.tsx
│           ├── RelevantActivityTab.tsx
│           └── YourInteractionsTab.tsx
└── lib/
    └── mockData.ts                  # Development mock data
```

### agent/

AI chat interface with streaming support.

- `hooks/useAgentChat.ts` - Chat hook
- `ui/components/HistoryPanel.tsx` - Thread history with vector search

### webapp/

App shell components.

- `ui/components/sidebar/` - Sidebar with tier-based header
- `ui/components/Header.tsx` - App header with workspace switching

### composer/

Twitter reply composer with media support.

### threads/

Twitter thread display components.

---

## 🧰 Shared Components (`shared/`)

### UI Components (`shared/ui/components/`)

68 shadcn/ui-based components including:

- Accordion, Alert, AlertDialog, Avatar
- Badge, Button, Card, Carousel
- Dialog, Dropdown, Form, Input
- Modal, Popover, Progress, Select
- Sheet, Skeleton, Slider, Tabs
- Toast, Toggle, Tooltip

### Utilities (`shared/lib/`)

| Directory    | Purpose                                                                             |
| ------------ | ----------------------------------------------------------------------------------- |
| `utils/`     | 29 utility functions (includes `time/timeUtils.ts` - **always use for timestamps**) |
| `platforms/` | Platform-specific helpers                                                           |
| `schemas/`   | Zod schemas                                                                         |
| `urls/`      | URL utilities                                                                       |

### Hooks (`shared/hooks/`)

Common React hooks for the application.

---

## 📚 Documentation (`docs/`)

### ai-sdk/

- `generative-user-interfaces.md` - How to render UI in agent responses

### convex/ (22 files)

| File                        | Topic                       |
| --------------------------- | --------------------------- |
| `agent-component.md`        | Agent component API         |
| `agent-usage.md`            | Using agents in Convex      |
| `agents-overview.md`        | Agent architecture overview |
| `ai-agents-with-memory.md`  | Memory persistence          |
| `ai-agents.md`              | General AI agents guide     |
| `debugging.md`              | Debugging agents            |
| `files.md`                  | File handling               |
| `getting-started.md`        | Quick start                 |
| `human-agents.md`           | Human-in-the-loop patterns  |
| `llm-context.md`            | LLM context management      |
| `messages.md`               | Message handling            |
| `polar-component.md`        | Polar component API         |
| `rag-component.md`          | RAG component API           |
| `rag.md`                    | RAG overview                |
| `rate-limiter-component.md` | Rate limiting               |
| `rate-limiting.md`          | Rate limit strategies       |
| `streaming.md`              | Streaming responses         |
| `threads.md`                | Thread management           |
| `tools.md`                  | Tool definitions            |
| `usage-tracking.md`         | Usage monitoring            |
| `workflow-component.md`     | Workflow component API      |
| `workflows.md`              | Durable workflows           |

### bishopi/

- `keyword-ideas.md` - Keyword discovery API

### linkdapi/ (8 files)

LinkedIn API documentation:

- `full-profile.md`, `company-details.md`, `company-posts.md`
- `search-posts.md`, `similar-companies.md`
- `profile-interests.md`, `contact-info.md`, `urn.md`

### openrouter/

- `ai-sdk-provider-readme.md` - OpenRouter AI SDK integration

### socialapi/ (18 files)

Twitter API (SocialAPI.me) documentation:

- `search.md` - Tweet search
- `monitor-and-operators.md` - Real-time monitoring (68KB, most important)
- `user-profile.md`, `user-followers.md`, `user-followings.md`
- `user-mentions.md`, `user-highlights.md`, `user-lists.md`
- `thread.md` - Thread fetching
- `verify-user-commented.md`, `verify-user-retweeted.md`, `verify-user-is-following.md`
- `similar-profiles.md`, `multiple-user-profiles.md`
- `rate-limits.md`

---

## 🏗️ Architecture Patterns (from AGENT_CONTEXT.txt)

### Three-Layer Architecture (MANDATORY)

| Layer          | Location               | Purpose                       |
| -------------- | ---------------------- | ----------------------------- |
| 1. Agent Tools | `convex/agents/tools/` | LLM interface (thin wrappers) |
| 2. Workflows   | `convex/workflows/`    | Orchestration, retries        |
| 3. Core Logic  | `convex/lib/*Core.ts`  | Business logic                |

### UI Patterns

1. **Composition over flags**: Use `*Skeleton.tsx` components, not `loading` props
2. **Component families**: Group related components in directories
3. **Semantic HTML**: Use `<article>`, `<time>`, `<nav>`, `<aside>`
4. **Server-side filtering**: Always use database indexes, never client-side filtering
5. **Parallel queries**: Use separate queries per tab for instant switching

### Naming Conventions

| Pattern         | Purpose                      |
| --------------- | ---------------------------- |
| `*Core.ts`      | Reusable business logic      |
| `*Helpers.ts`   | Config, constants, utilities |
| `*Pool.ts`      | Workpool instances           |
| `*Skeleton.tsx` | Loading skeleton components  |

---

## 📦 Tech Stack

| Category     | Technology                     |
| ------------ | ------------------------------ |
| Framework    | Next.js 16, React 19.2         |
| Database     | Convex (reactive)              |
| Auth         | WorkOS AuthKit                 |
| AI           | OpenRouter (Gemini 3, Kimi K2) |
| AI SDK       | Vercel AI SDK 5.0              |
| Agents       | @convex-dev/agent              |
| Workflows    | @convex-dev/workflow           |
| RAG          | @convex-dev/rag                |
| Styling      | Tailwind CSS 4, shadcn/ui      |
| Twitter API  | Composio, SocialAPI            |
| LinkedIn API | LinkdAPI.com, Unipile          |

---

## 🔑 Environment Variables

See `.env.example` for full list. Key variables:

| Variable                 | Purpose               |
| ------------------------ | --------------------- |
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL |
| `OPENROUTER_API_KEY`     | AI provider           |
| `SOCIALAPI_API_KEY`      | Twitter API           |
| `LINKDAPI_API_KEY`       | LinkedIn API          |
| `EXA_API_KEY`            | URL analysis          |
| `WORKOS_CLIENT_ID`       | Authentication        |

---

## 📝 Key Files Quick Reference

### Must-Read Files

1. `AGENT_CONTEXT.txt` - Architecture patterns, standards, current state
2. `convex/schema.ts` - All database tables
3. `convex/validators.ts` - All validators (single source of truth)

### Core Logic Entry Points

- `convex/lib/qualificationCore.ts` - Qualification logic
- `convex/lib/enrichmentCore.ts` - Enrichment logic
- `convex/lib/outreachCore.ts` - Outreach logic
- `convex/lib/ai.ts` - AI provider configuration

### Main UI Entry Points

- `app/(webapp)/page.tsx` - Main prospects page
- `features/prospects/ui/components/ProspectProfilePanel.tsx` - Detail view
- `features/agent/ui/` - AI chat interface
- `features/webapp/ui/components/sidebar/` - App sidebar

### Chat & Agents

- `convex/chat.ts` - Thread and message management
- `convex/agents/index.ts` - Setup agent
- `convex/agents/outreach/index.ts` - Outreach agent
