# Contributing to ReacherX

Thanks for wanting to contribute.

ReacherX is an open-source agent product focused on finding the right people, building context around them, and helping users take action through the UI or through the agent itself. If you want to improve the product, fix something broken, or help shape the roadmap, you are in the right place.

[README](./README.md) · [Roadmap](./ROADMAP.md) · [GitHub Issues](https://github.com/VecterAI/reacher-x/issues) · [Discord](https://discord.gg/76dF9NPH) · [Email Salman](mailto:creativecoder.crco@gmail.com)

## Before You Start

Please contact Salman before working on:

- new features
- roadmap items
- major UX changes
- agent behavior changes
- architecture changes
- integration work

That is important here because feature work usually benefits from brainstorming first.

Reach out here:

- Email: [creativecoder.crco@gmail.com](mailto:creativecoder.crco@gmail.com)
- Discord: [discord.gg/76dF9NPH](https://discord.gg/76dF9NPH)
- LinkedIn: [linkedin.com/in/noobships](https://www.linkedin.com/in/noobships)
- GitHub Issues: [github.com/VecterAI/reacher-x/issues](https://github.com/VecterAI/reacher-x/issues)

Small bug fixes, typo fixes, and focused polish PRs are fine without a long pre-discussion.

## Fastest Ways To Help

- Fix docs that are unclear or outdated.
- Improve accessibility and responsive behavior.
- Tighten loading states, empty states, and error states.
- Add or improve tests.
- Improve local setup and contributor onboarding.
- Work on a roadmap item after checking in first.

## Local Setup

```bash
git clone https://github.com/VecterAI/reacher-x.git
cd reacher-x
pnpm install
cp .env.example .env.local
npx convex dev
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Expectations

The environment story is still being tightened up.

Use `.env.example` as the base. Depending on what you work on, you may also need:

- Convex configuration
- WorkOS configuration
- AI provider keys
- X/Twitter credentials
- LinkedIn provider credentials
- Email provider configuration
- Billing configuration

If you want to work on a feature area and are not sure what env vars are needed, ask first and we can point you to the minimum setup.

## How The Codebase Is Organized

- `app/`: route structure and page-level entry points.
- `features/`: product features and UI modules.
- `shared/`: shared UI, hooks, types, and utilities.
- `convex/agents/tools/`: thin tool wrappers exposed to agents.
- `convex/workflows/`: orchestration, retries, durable flows.
- `convex/lib/`: core business logic and reusable backend helpers.

## Core Repo Rules

Read `AGENTS.md` before making architectural assumptions.

Important rules:

- Search for existing helpers before adding new ones.
- Reuse shared utilities instead of creating one-off logic.
- Follow the 3-layer Convex architecture.
- `convex/agents/tools/` for thin tool wrappers
- `convex/workflows/` for orchestration
- `convex/lib/*Core.ts` for business logic
- Keep agent tools thin.
- Use the existing validators, type guards, and helper patterns when available.

## Best Contribution Paths

### Frontend

- loading states
- accessibility
- responsive behavior
- profile panel improvements
- composer experience
- discoverability and clarity in the UI

### Backend

- workflow reliability
- platform integrations
- queueing and retry behavior
- data contracts
- webhook robustness

### Agent and AI

- prompt and tool UX improvements
- evaluations and benchmark coverage
- memory quality
- plan quality
- guardrails and review flows

### Product Infrastructure

- local-dev ergonomics
- docs quality
- email delivery flows
- observability and diagnostics

## Roadmap And Help Wanted

The active roadmap lives in [ROADMAP.md](./ROADMAP.md).

Especially valuable areas:

- Email integration so users can send emails directly from ReacherX through the UI or through the agent.
- Calendar integration for Google Calendar and Outlook Calendar so users can book meetings manually in the UI or by asking the agent.
- Cross-platform identity resolution so a single prospect can be seen across multiple social channels in the profile panel.
- Additional platforms such as Reddit, Bluesky, and Threads.
- Evaluations, benchmarks, and performance measurement for agent quality.
- Sub-agents and agent swarms for parallel task execution.
- File and image uploads for richer agent workflows.
- Reliability and optimization work using tools such as React Doctor, Convex tooling, linting, audits, and stronger automated testing.

If you want to work on any of the items above, please contact Salman first so you can align on approach and product intent.

## How To Propose Work

### Small Changes

For typo fixes, targeted bug fixes, and small polish improvements:

- open a PR directly, or
- open a quick issue first if you want feedback before implementing

### Bigger Changes

For features, roadmap items, integrations, or architectural work:

- open an issue, and
- message Salman directly by email or Discord so you can brainstorm together before implementation

## PR Checklist

Before opening a PR:

- explain what changed
- explain why it changed
- mention any env var, schema, or integration impact
- include screenshots for UI changes
- run the checks that apply

Useful commands:

```bash
pnpm lint
pnpm build
pnpm test:targeted
```

## Where To Ask Questions

- GitHub Issues: [github.com/VecterAI/reacher-x/issues](https://github.com/VecterAI/reacher-x/issues)
- Discord: [discord.gg/76dF9NPH](https://discord.gg/76dF9NPH)
- Email Salman directly: [creativecoder.crco@gmail.com](mailto:creativecoder.crco@gmail.com)

For anything roadmap-related, feature-related, or exploratory, direct contact is preferred.
