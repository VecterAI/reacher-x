# 🆁 ReacherX

Open-source `△` Agentic platform and infrastructure that works 24/7 across X/Twitter and LinkedIn to find, qualify, enrich, and help you reach the right people. Apollo and Clay alternative for founders and teams who want to close fast without requiring specific sales tool knowledge and expertise.

<div align="left">

[![Live site](https://img.shields.io/badge/Live-reacherx.com-000000?style=for-the-badge&logo=googlechrome&logoColor=white)](https://reacherx.com)
[![Interactive demo](https://img.shields.io/badge/Interactive_demo-reacherx--demos.vercel.app-000000?style=for-the-badge&logo=v&logoColor=white)](https://reacherx-demos.vercel.app/)
[![License](https://img.shields.io/badge/License-AGPL--3.0-000000?style=for-the-badge&logo=gnu&logoColor=white)](./LICENSE)

[![TypeScript](https://img.shields.io/badge/TypeScript-000000?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Convex](https://img.shields.io/badge/Convex-000000?style=for-the-badge&logo=convex&logoColor=white)](https://convex.link/coss)

</div>

[Configuration](./docs/configuration.md) · [Contributing](./CONTRIBUTING.md) · [Roadmap](./ROADMAP.md) · [GitHub Issues](https://github.com/VecterAI/reacher-x/issues) · [Discord](https://discord.gg/BQttyr8jY) · [X/Twitter](https://x.com/ReacherXfounder)

## Built with Convex

ReacherX is part of the [Convex for Open Source](https://www.convex.dev/open-source-program) program and runs on [Convex](https://convex.link/coss).

<p align="left">
  <a href="https://convex.link/coss">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://static.convex.dev/logo/convex-logo-light.svg">
      <img alt="Powered by Convex" src="https://static.convex.dev/logo/convex-logo.svg" width="140">
    </picture>
  </a>
</p>

## Demo

<a href="https://www.youtube.com/watch?v=xlyUWC-Uwr8" target="_blank" rel="noopener noreferrer">
  <img alt="Watch the ReacherX demo" src="https://nmx18xidmv.ufs.sh/f/uF4FhwZJse4NQHHwCka4qAIrfoSx2BgCKNLtujOXE63PUeG1">
</a>

[Watch the demo on YouTube](https://www.youtube.com/watch?v=xlyUWC-Uwr8)

There is also an [interactive demo](https://reacherx-demos.vercel.app/). It is a dashboard prepopulated with fictional data, so you can click around and get a general understanding of the product. It is not a walkthrough, and nothing sends from it.

## Deploy your own instance

Skip the setup steps and put your own copy live. One click copies the repository into your GitHub account and creates a Vercel project:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FVecterAI%2Freacher-x&env=CONVEX_DEPLOY_KEY,WORKOS_CLIENT_ID,WORKOS_API_KEY,WORKOS_COOKIE_PASSWORD,NEXT_PUBLIC_WORKOS_REDIRECT_URI,NEXT_PUBLIC_SITE_URL,NEXT_PUBLIC_CONVEX_URL,NEXT_PUBLIC_BLOG_DEMO_ORIGIN,NEXT_PUBLIC_POSTHOG_KEY,NEXT_PUBLIC_POSTHOG_HOST&project-name=reacher-x&repository-name=reacher-x)

The button copies the repository into your GitHub account and prompts you for the settings it needs. That copy is for running your own instance, not for contributing. To contribute code, start with a fork as shown in [Contribute in minutes](#contribute-in-minutes).

Before your instance goes live, set the build command to `npx convex deploy --cmd 'npm run build'` so the Convex backend deploys with the build, and add your service keys. What the button does and does not do is explained in [docs/development-setup.md](./docs/development-setup.md#deploy-your-own-instance).

## Who it is for

Anyone who needs to find a specific kind of person on X/Twitter or LinkedIn. Customers, candidates, investors, partners, community members. Basically any network of people. Describe the people you need in plain words, and ReacherX starts looking.

You do not need a sales background or a GTM playbook. If you can say who you need, you can use it.

### How it works

1. Describe who you need in plain English.
2. ReacherX turns that into search and discovery strategies.
3. The agent gathers context and proof behind each match.
4. It proposes next actions and drafts messages, with image, GIF, and video attachments when useful.
5. You review and approve anything that sends.
6. Feedback, memory, and evaluations improve results over time.

What makes it different from a contact database:

- Matches come from real platform activity, not scraped lists.
- You can work in the UI yourself or ask the agent to do the same work.
- You can run your own instance with your own provider accounts, or use the hosted app.

## Why it is open source

I started ReacherX in 2023 to solve a problem I had myself: finding and reaching the right people was harder than it should have been. Three years in, it became a full product, and I opened the code.

Developers solve problems. If ReacherX does not do what you need, change it. Fork it, extend it, build on it, improve it. If you adapt it for a problem you know well, your work helps everyone else with that problem. The AGPL license keeps those improvements open.

More on that:

- [Why I open-sourced ReacherX](https://reacherx.com/blog/why-i-open-sourced-reacherx), the story behind the decision
- [Think in networks, not funnels](https://reacherx.com/blog/think-in-networks), the idea the product is built on
- [A developer's guide to the ReacherX codebase](https://reacherx.com/blog/how-reacherx-agent-works), where to start in the code
- [Help build ReacherX](https://reacherx.com/blog/help-build-reacherx), what help is needed right now

## Support the project

I went full time on ReacherX in 2026 and I am funding it myself. If the project is useful to you, Patreon is a way to help it keep going.

<div align="left">

[![Patreon](https://img.shields.io/badge/Patreon-Support_the_project-000000?style=for-the-badge&logo=patreon&logoColor=white)](https://www.patreon.com/cw/ReacherX)
[![Discord](https://img.shields.io/badge/Discord-Join_the_community-000000?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/BQttyr8jY)
[![X/Twitter](https://img.shields.io/badge/X/Twitter-DM_@ReacherXfounder-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/ReacherXfounder)

</div>

Fastest way to reach me is a DM on [X/Twitter](https://x.com/ReacherXfounder) or a message in the [Discord](https://discord.gg/BQttyr8jY).

## Contributing

Start with [CONTRIBUTING.md](./CONTRIBUTING.md). For features, roadmap items, or architectural changes, talk to me first. Most contributions here touch product direction, agent behavior, or workflow design, and a short conversation saves rework.

The complete setup guide for humans and coding agents is [docs/development-setup.md](./docs/development-setup.md). It covers services and keys, dev vs production environments, MCP servers, and deploying your own instance.

- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security Policy](./SECURITY.md)

## Contribute in minutes

Fork the repository on GitHub first. You have no push access to the main repo, so the flow starts with your fork:

```bash
# Fork https://github.com/VecterAI/reacher-x on GitHub, then clone your fork
git clone https://github.com/YOUR-USERNAME/reacher-x.git
cd reacher-x
git remote add upstream https://github.com/VecterAI/reacher-x.git
git fetch upstream
corepack enable pnpm
pnpm install
cp .env.example .env.local
npx convex dev --once
```

Create a branch, work on one focused change, run the checks, and open a pull request against `VecterAI/reacher-x:main`. The full flow is in [CONTRIBUTING.md](./CONTRIBUTING.md#submitting-changes) and [docs/development-setup.md](./docs/development-setup.md).

### Hand this prompt to a coding agent

Paste this into Claude Code, Codex, Cursor, Antigravity, or any coding agent. It follows the repository rules and does the setup the standard way:

```text
Set up ReacherX for local development and open a pull request.

My change: <describe the fix or feature>

Follow CONTRIBUTING.md, docs/development-setup.md, and agents.md. Summary:

1. Check before starting: search the open issues and pull requests at github.com/VecterAI/reacher-x for anything about my change. If an issue covers it, note the number and reference it in the PR. If an open PR already fixes it, stop and tell me. If nothing covers it and the change is bigger than a small fix, ask me whether to open an issue first.
2. Requirements: Node.js 22+ and pnpm 11. The repo pins pnpm via package.json, so run corepack enable pnpm.
3. I have no push access to VecterAI/reacher-x, so fork it on GitHub before cloning.
4. Clone my fork, add the upstream remote, and update main from upstream:
   git remote add upstream https://github.com/VecterAI/reacher-x.git
   git fetch upstream
5. Create a branch for one focused change: git switch -c fix/short-description
6. Install dependencies with pnpm install, then copy .env.example to .env.local.
7. Install agent tooling for this repo: the Convex plugin for Claude Code, Codex, or Cursor (or npx -y convex@latest mcp start), the Vercel MCP with vercel mcp, and npx convex ai-files install for repo AI files. The repo already ships Convex skills under skills/.
8. Read docs/configuration.md. Configure only the services for my change area and ask me for missing keys. Special cases: SocialAPI.me access comes from the maintainer, and Renidly signup needs a work email address.
9. Select a dev Convex deployment with npx convex dev --once. Set backend-only values with npx convex env set. Never commit .env.local and never upload it to Convex.
10. Run npx convex dev and pnpm dev in separate terminals. The site is at http://localhost:3000.
11. Before committing, run: pnpm exec tsc --noEmit, pnpm lint:strict, pnpm test:convex, and pnpm exec prettier --check on changed files.
12. Push to my fork and open a PR against VecterAI/reacher-x:main, referencing the issue from step 1 when there is one. For review bot comments (CodeRabbit), verify each suggestion before acting on it and ignore false positives with a short justification. Ask me before building anything bigger than a focused fix.
```

## Roadmap

Full roadmap in [ROADMAP.md](./ROADMAP.md). Reliability and evaluations now, email and calendar integrations next, more platforms and agent swarms later.

## Self-hosting

Requirements: Node.js 22+ and pnpm 11.x.

Prefer one click? The [Deploy your own instance](#deploy-your-own-instance) section covers what the button imports and what stays manual.

```bash
git clone https://github.com/VecterAI/reacher-x.git
cd reacher-x
corepack enable pnpm
pnpm install
cp .env.example .env.local
npx convex dev --once
```

Then run the backend and frontend in separate terminals:

```bash
npx convex dev
```

```bash
pnpm dev
```

For the marketing and blog interactive demos, run `cp demos/app/.env.example demos/app/.env.local` and `pnpm dev:demo`. The demo app runs at `http://localhost:3001`. See [interactive demo configuration](./docs/configuration.md#interactive-demos) for production demo hosting.

### Environment notes

Next.js reads local values from `.env.local`. Convex secrets are set per deployment with `npx convex env set`. Copying `.env.example` does not configure the Convex backend. [docs/configuration.md](./docs/configuration.md) has the full variable groups, model routing, and provider limits. Production builds of the main app also need `NEXT_PUBLIC_BLOG_DEMO_ORIGIN` set.

Full functionality needs external provider accounts: Convex, WorkOS, AI providers, X/Twitter, LinkdAPI and Unipile (LinkedIn), Polar (billing), and Resend (email). You only need credentials for the area you work on.

## Project structure

- `app/`: Next.js routes and entry points.
- `features/`: product UI and feature logic.
- `shared/`: shared utilities, components, hooks, and types.
- `convex/agents/tools/`: thin agent-facing tool layer.
- `convex/workflows/`: orchestration and durable workflows.
- `convex/lib/`: core business logic and integrations.

## License

Released under the [GNU Affero General Public License v3](./LICENSE) (AGPL-3.0-only). You can use, modify, and self-host ReacherX, including for commercial work. If you offer a modified version to users over a network, you must make the modified source available under the same license.
