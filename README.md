# 🆁 ReacherX

<div align="left">

**An AI-powered search engine to find potential customers on the web.**

[![Live Site](https://img.shields.io/badge/🚀_Live_Site-reacherx.com-000000?style=for-the-badge)](https://reacherx.com)
[![MIT License](https://img.shields.io/badge/License-MIT-white?style=for-the-badge&logo=opensourceinitiative&logoColor=black)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-000000?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js_15-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)

</div>

> **Version 3.0** - A better, faster, and cheaper solution than ads to reach your audience.

## What is ReacherX?

ReacherX is an AI-powered search engine that helps you find potential customers on X (Twitter) and LinkedIn. Instead of spending money on ads, you can directly reach people who need your product or service right now.

Right now, you can:

- **AI keyword suggestions** - Describe what you offer, get intelligent search queries
- **Multi-platform search** - Search X (Twitter) and LinkedIn simultaneously
- **Direct outreach** - Reply directly to potential customers from the platform
- **Smart filtering** - AI-powered filtering to surface high-intent opportunities
- **Workspace management** - Organize searches for different products/services
- **Learning system** - Upvote/downvote results to improve suggestions over time

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

- **Next.js 15** with TypeScript
- **Convex** (reactive database)
- **WorkOS AuthKit** for authentication
- **shadcn/ui** + **Tailwind CSS** for UI
- **Twitter API v2** + **LinkedIn API** for social search
- **OpenAI, xAI** (configurable AI providers)

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

## Current Status

| **Status** | **Feature**                           |
| :--------: | :------------------------------------ |
|    `✓`     | AI keyword generation working         |
|    `✓`     | X (Twitter) search and filtering      |
|    `✓`     | LinkedIn search support               |
|    `✓`     | Direct reply functionality            |
|    `✓`     | Workspace management                  |
|    `✓`     | AI-powered result filtering           |
|    `✓`     | Keyword pinning and reuse             |
|    `✓`     | Production deployment on Vercel       |
|    `○`     | Enhanced LinkedIn features (planned)  |
|    `○`     | Additional social platforms (planned) |

## Contact

Built by **[@noobships](https://github.com/noobships)**

[![Email](https://img.shields.io/badge/Email-creativecoder.crco@gmail.com-000000?style=for-the-badge&logo=gmail&logoColor=white)](mailto:creativecoder.crco@gmail.com)
[![Issues](https://img.shields.io/badge/Feedback-Open_an_Issue-white?style=for-the-badge&logo=github&logoColor=black)](https://github.com/noobships/reacher-x/issues)

## License

MIT License - use it however you want.

---

**Like this project? Give it a ⭐**
