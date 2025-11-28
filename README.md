# ReacherX - Customer Search Engine

[![ReacherX Logo](https://your-logo-image-url)](https://reacherx.com)

**ReacherX** — the search engine to find customers.

## Features

- Fast and accurate customer search
- Keyword-first search with filters (industry, location, size, etc.)
- Data-driven insights on potential customers
- Web app UI built with shadcn/ui and Tailwind CSS

## Tech stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Convex (backend & server functions)
- shadcn/ui + Tailwind CSS
- WorkOS AuthKit for authentication
- PostHog for analytics
- Resend for email

## Requirements

- **Node.js 22.x (LTS)** or newer
- **pnpm 9.x** (recommended) or npm 10+

## Installation

```bash
git clone [https://github.com/your-username/reacher-x.git](https://github.com/your-username/reacher-x.git)
cd reacher-x
pnpm install
```

## Usage

Development:

```bash
pnpm dev
```

Linting & type checks:

```bash
pnpm lint
```

Production build & start:

```bash
pnpm build  # Runs `next build`
pnpm start  # Runs `next start` (after a successful build)
```
