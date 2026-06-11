# 🆁 ReacherX

<div align="left">

**Open-source △ Agent that works 24/7 across X/Twitter and LinkedIn to find, qualify, enrich, and help you reach the right people. Think Cursor for finding and reaching your audience.**

[![Live Site](https://img.shields.io/badge/🚀_Live_Site-reacherx.com-000000?style=for-the-badge)](https://reacherx.com)
[![MIT License](https://img.shields.io/badge/License-MIT-white?style=for-the-badge&logo=opensourceinitiative&logoColor=black)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-000000?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)

</div>

## ▪️ What is ReacherX?

ReacherX is an AI agent that finds people on X (Twitter) and LinkedIn, qualifies them against your criteria, enriches their profiles, learns your writing voice, and helps you engage with personalized outreach — all from a chat interface. You describe who you're looking for, and the agent handles discovery, qualification, enrichment, plan generation, and execution.

It adapts to whatever "reaching the right people" means for you:

| Use Case                     | Who You Find                                          | Success Looks Like     |
| :--------------------------- | :---------------------------------------------------- | :--------------------- |
| **Customer Prospecting**     | People actively expressing a need your product solves | Converts               |
| **Recruiting**               | Candidates matching your open roles                   | Hires                  |
| **Partnership Outreach**     | Companies or operators for strategic partnerships     | Active partners        |
| **Investor Outreach**        | Investors whose thesis fits your opportunity          | Committed investors    |
| **User Research**            | Participants who can give useful product feedback     | Confirmed participants |
| **Creator Outreach**         | Creators who match your audience or brand             | Collaborators          |
| **Community Growth**         | People likely to join and participate                 | Members                |
| **Podcast Speaker Sourcing** | Guests with the right expertise and voice             | Booked guests          |

Each use case shapes the entire experience — search queries, qualification criteria, pipeline stages, outreach tone, UI labels, and analytics are all tailored.

**[Try it live →](https://reacherx.com)**

## ▪️ Screenshots

**Prospect Discovery & Outreach Pipeline**

<div align="center">

![ReacherX — Prospect discovery, qualification, and outreach pipeline](https://nmx18xidmv.ufs.sh/f/uF4FhwZJse4NNJIluMPruyLnJjG9lqwfYk4Fm8T0ZCtMWNAp)

</div>

**AI Agent Chat**

<div align="center">

![ReacherX — AI agent generating outreach plans via chat](https://nmx18xidmv.ufs.sh/f/uF4FhwZJse4NZaOgt0JHl2yQbBUrAWzCo69X38FLTNe0Jm45)

</div>

**Analytics Dashboard**

<div align="center">

![ReacherX — Analytics overview with funnel, response rate, and prospect trends](https://nmx18xidmv.ufs.sh/f/uF4FhwZJse4N48LN9LyE6FodfBJNQgebGjuAYVnrCW0wMHD3)

![ReacherX — Qualification breakdown, platform distribution, and fit score distribution](https://nmx18xidmv.ufs.sh/f/uF4FhwZJse4NQHTQAsE4qAIrfoSx2BgCKNLtujOXE63PUeG1)

</div>

## ▪️ How It Works

```
You describe who you're looking for (via chat)
        │
        ▼
   Agent generates search queries tailored to X and LinkedIn
        │
        ▼
   Finds matching people across both platforms
        │
        ▼
   Qualifies each person (ICP fit, engagement quality, authenticity)
        │
        ▼
   Enriches profiles (pain points, financial signals, professional context)
        │
        ▼
   Agent generates a personalized outreach plan
        │
        ▼
   You review and approve → agent executes (replies, likes, DMs, invites)
        │
        ▼
   Agent learns from outcomes and improves over time
```

## ▪️ Features

### Two-Agent System

ReacherX runs two specialized agents:

**Setup Agent** — Handles onboarding and workspace creation. Analyzes your URL, generates your ICP, converts keywords into social search queries, and kicks off discovery.

**Outreach Agent** — Takes over once prospects are found. Fetches social context, generates engagement plans, drafts replies/DMs in your voice, and executes approved actions.

Both agents work through a chat interface with streaming responses, tool execution visualization, and inline cards for approvals, previews, and plan display.

### Inline Autocomplete

Tab-complete for your replies and DMs — similar to Cursor's tab completion. The autocomplete is context-aware:

- Knows who you're replying to and what they said
- Respects character limits (X post weighted length vs raw)
- Matches your writing style when a style profile exists
- Adapts to workspace context and prospect information
- Shows as ghost text, accept with Tab

### Writing Style Learning

The agent learns how you write by analyzing your posts on X and LinkedIn. It distills your vocabulary, sentence structure, humor, formality, emoji usage, opening/closing patterns, strengths, and weaknesses into a writing style profile. This profile is automatically applied when the agent drafts replies, DMs, and outreach content — so everything sounds like you, not a bot.

Style profiles are stored per-workspace and per-platform (Twitter vs LinkedIn).

### Memory System

The agent builds workspace-level memory across 8 categories:

- **Qualification win patterns** — Signals that predict a good fit
- **Qualification false positive patterns** — Signals to avoid
- **Enrichment signal patterns** — Useful bio/post/financial indicators
- **Enrichment role patterns** — Recurring personas that matter
- **Outreach winning patterns** — Approaches that work
- **Outreach objection patterns** — Approaches to avoid
- **Writing style profiles** — Your voice on Twitter and LinkedIn

Memory is backed by vector search (RAG) for semantic retrieval. The agent queries relevant memories before generating plans or drafting content, and writes new memories as it learns from outcomes.

### Social Actions (Human-in-the-Loop)

The agent can execute actions on both platforms with a risk-based approval policy:

**X (Twitter):**

- Low-risk (immediate): Like, unlike, bookmark
- Medium-risk (approval required): Retweet, follow, unfollow
- High-risk (approval required): Reply, create post, send DM

**LinkedIn:**

- All approval required: Send message, invite, react, comment

Every medium and high-risk action goes through approval — the agent stages the draft, you review it, then it executes.

### Agent Ops Dashboard

A full operations dashboard with 5 tabs to monitor how the agent is performing:

- **Overview** — Health score, quality score, funnel metrics, best/weakest queries
- **Discovery** — Query inventory with performance scores, monitor health, novelty yield
- **Quality** — Qualification precision, enrichment usefulness, outreach effectiveness, correction trends
- **Memory** — Stored memories, confidence scores, impact scores, recent promotions
- **Activity** — Event feed, running/failed workflows, pending evaluations

### Discovery & Monitoring

- AI-generated search queries from your ICP description
- Real-time monitoring via SocialAPI webhooks — new results trigger automatic processing
- Query candidate tracking with performance scoring (prospects found, qualified, converted, reply rate)
- Conversation seed monitors that detect when prospects reply to your engagement
- Discovery trace that tracks how each prospect was found (which query, which platform, which monitor)

### Pipeline Management

Track people through stages adapted to your use case:

- Customer Prospecting: New → Contacted → In Progress → Converted
- Recruiting: Sourced → Contacted → Interviewing → Hired
- Partnership Outreach: Identified → Contacted → Negotiating → Partnered
- _(each use case has its own stage labels)_

### Multi-Platform Support

**X (Twitter)** — Full support: search, profile lookup, thread analysis, replies, likes, retweets, DMs, real-time monitoring, conversation tracking.

**LinkedIn** — Search, profile enrichment, post analysis, messages, invitations, reactions, comments via Unipile and LinkdAPI.

### Other Features

- **Prospect enrichment** — Type detection, pain point extraction, solution matching, financial signals
- **AI qualification** — ICP fit scoring (0-100), bot detection, engagement quality assessment
- **Analytics dashboard** — Discovery metrics, outreach metrics, engagement tracking, funnel visualization
- **Notifications** — Prospect found, outreach sent, approval requests, response alerts
- **Billing** — Subscription management via Polar with plan limits
- **Workspace management** — Multiple workspaces, each with its own use case, ICP, and pipeline

## ▪️ Why This Matters

| **Traditional Approach**        | **ReacherX Approach**                                  |
| :------------------------------ | :----------------------------------------------------- |
| `1.` Create ad campaigns        | `1.` Describe who you're looking for                   |
| `2.` Set targeting parameters   | `2.` Agent generates search queries                    |
| `3.` Pay for impressions/clicks | `3.` Finds people actively expressing need             |
| `4.` Hope people see and engage | `4.` Agent drafts personalized outreach in your voice  |
| `5.` Wait for conversions       | `5.` You approve, agent executes, learns from outcomes |

## ▪️ Getting Started

### Requirements

- **Node.js** 20.0.0+
- **pnpm** 9.15.4+ (npm and yarn are not supported)

### Setup

```bash
git clone https://github.com/VecterAI/reacher-x.git
cd reacher-x
pnpm install
```

### Configuration

Copy the environment template and fill in your API keys:

```bash
cp .env.example .env.local
```

#### Required

| Variable                 | Service                                       | What It Does                                                              |
| :----------------------- | :-------------------------------------------- | :------------------------------------------------------------------------ |
| `NEXT_PUBLIC_CONVEX_URL` | [Convex](https://convex.dev)                  | Database and backend                                                      |
| `WORKOS_CLIENT_ID`       | [WorkOS](https://workos.com)                  | Authentication                                                            |
| `OPENROUTER_API_KEY`     | [OpenRouter](https://openrouter.ai)           | AI provider (agents, qualification, enrichment, autocomplete, embeddings) |
| `X_API_CLIENT_ID`        | [X Developer Portal](https://developer.x.com) | X OAuth                                                                   |
| `X_API_CLIENT_SECRET`    | X Developer Portal                            | X OAuth                                                                   |
| `X_API_BEARER_TOKEN`     | X Developer Portal                            | X Activity API                                                            |
| `X_CONSUMER_SECRET`      | X Developer Portal                            | Webhook CRC signatures                                                    |
| `X_TOKEN_ENCRYPTION_KEY` | (generate a secret)                           | Encrypts stored X tokens                                                  |
| `RESEND_API_KEY`         | [Resend](https://resend.com)                  | Transactional email                                                       |
| `CONVEX_SITE_URL`        | (your Convex HTTP URL)                        | Webhook URL construction                                                  |

#### Required for LinkedIn

| Variable                 | Service                          | What It Does                     |
| :----------------------- | :------------------------------- | :------------------------------- |
| `UNIPILE_API_KEY`        | [Unipile](https://unipile.com)   | LinkedIn messaging, actions      |
| `UNIPILE_BASE_URL`       | Unipile                          | API endpoint                     |
| `UNIPILE_WEBHOOK_SECRET` | Unipile                          | Webhook signature validation     |
| `LINKDAPI_API_KEY`       | [LinkdAPI](https://linkdapi.com) | LinkedIn search and profile data |

#### Required for Twitter Monitoring

| Variable            | Service                           | What It Does                                            |
| :------------------ | :-------------------------------- | :------------------------------------------------------ |
| `SOCIALAPI_API_KEY` | [SocialAPI](https://socialapi.io) | Twitter search, profile hydration, real-time monitoring |

#### Required for Billing

| Variable                     | Service                   | What It Does                 |
| :--------------------------- | :------------------------ | :--------------------------- |
| `POLAR_ORGANIZATION_TOKEN`   | [Polar](https://polar.sh) | Subscription management      |
| `POLAR_PRODUCT_BASE_MONTHLY` | Polar                     | Base tier monthly product ID |
| `POLAR_PRODUCT_BASE_YEARLY`  | Polar                     | Base tier yearly product ID  |
| `POLAR_PRODUCT_PRO_MONTHLY`  | Polar                     | Pro tier monthly product ID  |
| `POLAR_PRODUCT_PRO_YEARLY`   | Polar                     | Pro tier yearly product ID   |

#### Optional

| Variable                  | Service                               | What It Does                                        |
| :------------------------ | :------------------------------------ | :-------------------------------------------------- |
| `OPENAI_API_KEY`          | [OpenAI](https://platform.openai.com) | Fallback for embeddings if OpenRouter is down       |
| `EXA_API_KEY`             | [Exa](https://exa.ai)                 | URL content extraction (falls back to HTML parsing) |
| `BISHOPI_API_KEY`         | Bishopi                               | Keyword discovery from seed terms                   |
| `NEXT_PUBLIC_POSTHOG_KEY` | [PostHog](https://posthog.com)        | Product analytics                                   |
| `NEXT_PUBLIC_SITE_URL`    | —                                     | Custom domain (defaults to localhost:3000)          |

### Run

```bash
npx convex dev   # terminal 1 — starts Convex backend
pnpm dev         # terminal 2 — starts Next.js dev server
```

Open `http://localhost:3000`.

## ▪️ Tech Stack

| Layer           | Technology                                                                              |
| :-------------- | :-------------------------------------------------------------------------------------- |
| **Framework**   | Next.js 16 (App Router, PPR, React 19.2)                                                |
| **Database**    | Convex (reactive real-time sync, workflows, workpools)                                  |
| **AI**          | AI SDK 5.0 via OpenRouter (Gemini 3, Kimi K2, Claude Haiku 4.5, GPT-5.4 Nano, and more) |
| **Agents**      | @convex-dev/agent with streaming, tool calling, and thread management                   |
| **RAG**         | @convex-dev/rag with OpenRouter embeddings (text-embedding-3-small)                     |
| **Auth**        | WorkOS AuthKit                                                                          |
| **UI**          | shadcn/ui + Tailwind CSS 4                                                              |
| **X (Twitter)** | X API v2 (xdk) + SocialAPI (search, monitoring, hydration)                              |
| **LinkedIn**    | LinkdAPI (search, profiles) + Unipile (messaging, actions)                              |
| **Rich Text**   | Lexical (composer with inline autocomplete)                                             |
| **Billing**     | Polar                                                                                   |
| **Email**       | Resend + React Email                                                                    |

## ▪️ Development

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Check for linting issues
```

## ▪️ Current Status

| Status | Feature                                                            |
| :----: | :----------------------------------------------------------------- |
|  `✓`   | AI-powered discovery across X and LinkedIn                         |
|  `✓`   | 8 use-case templates with adapted UI, prompts, and pipeline stages |
|  `✓`   | Two-agent system (Setup + Outreach) with chat interface            |
|  `✓`   | Inline autocomplete (tab-complete) for replies and DMs             |
|  `✓`   | Writing style learning from your social profiles                   |
|  `✓`   | Workspace-level memory with RAG-backed retrieval                   |
|  `✓`   | AI qualification (ICP fit scoring, bot detection)                  |
|  `✓`   | AI enrichment (pain points, financial signals, role detection)     |
|  `✓`   | Agentic outreach with plan generation                              |
|  `✓`   | Human-in-the-loop approval for all social actions                  |
|  `✓`   | X engagement execution (replies, DMs, likes, retweets, follows)    |
|  `✓`   | LinkedIn actions (messages, invites, reactions, comments)          |
|  `✓`   | Real-time monitoring and conversation seed detection               |
|  `✓`   | Agent Ops dashboard (discovery, quality, memory, activity)         |
|  `✓`   | Discovery trace and query performance tracking                     |
|  `✓`   | Pipeline management per use case                                   |
|  `✓`   | Analytics dashboard                                                |
|  `✓`   | Notifications and approval request alerts                          |
|  `✓`   | Billing and subscription management                                |
|  `○`   | Full LinkedIn parity with X                                        |
|  `○`   | Additional social platforms                                        |

## ▪️ Contributing

Contributions are welcome. Whether you find bugs, have feature ideas, want to submit PRs, or have AI/ML expertise to share — all skill levels welcome.

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and guidelines.

## ▪️ Contact

Built by **[@noobships](https://github.com/noobships)**

[![Email](https://img.shields.io/badge/Email-creativecoder.crco@gmail.com-000000?style=for-the-badge&logo=gmail&logoColor=white)](mailto:creativecoder.crco@gmail.com)
[![Issues](https://img.shields.io/badge/Feedback-Open_an_Issue-white?style=for-the-badge&logo=github&logoColor=black)](https://github.com/VecterAI/reacher-x/issues)

## ▪️ License

MIT License — use it however you want.

---

**Like this project? Give it a star.**
