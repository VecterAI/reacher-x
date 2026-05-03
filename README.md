# 🆁 ReacherX

<div align="left">

**An AI-powered prospecting and outreach platform to find and engage potential customers.**

[![Live Site](https://img.shields.io/badge/🚀_Live_Site-reacherx.com-000000?style=for-the-badge)](https://reacherx.com)
[![MIT License](https://img.shields.io/badge/License-MIT-white?style=for-the-badge&logo=opensourceinitiative&logoColor=black)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-000000?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)

</div>

> **Version 3.0** (stable) - Core prospecting features. Available on the [`main`](https://github.com/noobships/reacher-x/tree/main) branch.
>
> **Version 4.0** (beta) - Full agentic outreach capabilities. In active development on the [`v4`](https://github.com/noobships/reacher-x/tree/v4) branch. Includes AI SDK 5.0, Next.js 16, Zod 4, React 19.2, and an intelligent outreach agent.

## What is ReacherX?

ReacherX is an AI-powered prospecting and outreach platform that helps you find potential customers on X (Twitter) and LinkedIn, then intelligently engage them with personalized outreach. Instead of spending money on ads, you can directly reach people who need your product or service right now.

### Core Capabilities

- **AI-powered prospecting** - Describe your ICP, get intelligent search queries and find matching prospects
- **Multi-platform search** - Search X (Twitter) and LinkedIn simultaneously
- **Automated qualification** - AI evaluates ICP fit, engagement quality, and authenticity
- **Prospect enrichment** - Extract pain points, financial signals, and professional context
- **Agentic outreach** - AI agent generates personalized engagement plans and executes approved actions
- **Pipeline management** - Track prospects through stages: New → Contacted → In Progress → Converted
- **Human-in-the-loop** - Review and approve agent actions before execution
- **Real-time notifications** - Stay updated on prospect responses and required approvals

**[Try it live →](https://reacherx.com)**

## Screenshots

**ReacherX Home Page**

<div align="center">

![ReacherX Interface](https://nmx18xidmv.ufs.sh/f/uF4FhwZJse4Nkgrvs3NxE9WriXHDjQLzqTo0xyb7Fgu3PsaO)

</div>

## Why This Matters

| **Traditional Approach**                                                                                                                                     | **ReacherX Approach**                                                                                                                                                                                |
| :----------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `1.` Create ad campaigns<br>`2.` Set targeting parameters<br>`3.` Pay for impressions/clicks<br>`4.` Hope people see and engage<br>`5.` Wait for conversions | `1.` Describe what you offer<br>`2.` Get AI-generated search queries<br>`3.` Find people actively expressing need<br>`4.` Reply directly with solutions<br>`5.` Build relationships, not just clicks |

## Requirements

- **Node.js**: 20.0.0 or higher
- **Package Manager**: pnpm 9.15.4 or higher (npm and yarn not supported)

## Tech Stack

- **Next.js 16** with TypeScript (v3 uses Next.js 15)
- **Convex** (reactive database)
- **WorkOS AuthKit** for authentication
- **shadcn/ui** + **Tailwind CSS** for UI
- **Twitter API v2** + **LinkedIn API** for social search
- **OpenAI, xAI** (configurable AI providers)

> **Note**: Version 4.0 is in active development on the [`v4`](https://github.com/noobships/reacher-x/tree/v4) branch with upgraded dependencies and full agentic outreach capabilities. Version 3.0 (stable) is available on the [`main`](https://github.com/noobships/reacher-x/tree/main) branch.

## Getting Started

**⚠️ This project requires pnpm as the package manager. npm and yarn are not supported.**

```bash
git clone https://github.com/noobships/reacher-x.git
cd reacher-x
pnpm install
```

### Configuration

1. Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

2. Edit `.env.local` and add your API keys:
   - **Required**: Convex URL, WorkOS Client ID, X (Twitter) OAuth credentials, Exa API key, Resend API key, Encryption password
   - **Recommended**: At least one AI provider (OpenAI or xAI) for keyword generation
   - **Optional**: LinkedIn API, SocialAPI, PostHog analytics

3. Set up Convex:

```bash
npx convex dev
```

4. Start the development server:

```bash
pnpm dev
```

Open `http://localhost:3000` to see the app.

## Development

### Available Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Check for linting issues
```

## Contributing

This is an open source project and contributions are welcome! Whether you:

| **Find bugs**              | **Have feature ideas** | **Want to contribute code** | **Know about AI/ML** |
| :------------------------- | :--------------------- | :-------------------------- | :------------------- |
| Report issues you discover | Suggest new features   | Submit pull requests        | Share AI expertise   |

**All skill levels welcome.**

## Current Status (v4)

| **Status** | **Feature**                               |
| :--------: | :---------------------------------------- |
|    `✓`     | AI-powered prospect discovery             |
|    `✓`     | X (Twitter) search and monitoring         |
|    `✓`     | LinkedIn search support                   |
|    `✓`     | AI qualification (ICP fit, bot detection) |
|    `✓`     | AI enrichment (pain points, finance)      |
|    `✓`     | Agentic outreach with plan generation     |
|    `✓`     | Human-in-the-loop task approval           |
|    `✓`     | Real-time Twitter engagement execution    |
|    `✓`     | Prospect pipeline management              |
|    `✓`     | In-app notifications system               |
|    `✓`     | Workspace management                      |
|    `✓`     | Production deployment on Vercel           |
|    `○`     | Full LinkedIn parity with X (planned)     |
|    `○`     | Additional social platforms (planned)     |

## Contact

Built by **[@noobships](https://github.com/noobships)**

[![Email](https://img.shields.io/badge/Email-creativecoder.crco@gmail.com-000000?style=for-the-badge&logo=gmail&logoColor=white)](mailto:creativecoder.crco@gmail.com)
[![Issues](https://img.shields.io/badge/Feedback-Open_an_Issue-white?style=for-the-badge&logo=github&logoColor=black)](https://github.com/noobships/reacher-x/issues)

## License

MIT License - use it however you want.

---

**Like this project? Give it a ⭐**
