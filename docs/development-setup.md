# Development Setup

The one guide for contributors and coding agents. It covers the full path from zero to an open pull request: fork the repository, set up services with the right environment, accelerate your coding agent with tools, and ship.

Read [VISION.md](../VISION.md) first to understand what the product is for and why it is built the way it is.

The ready-made agent prompt referenced below is shown in the [README](../README.md#hand-this-prompt-to-a-coding-agent). Copy it from there into Claude Code, Codex, Cursor, Antigravity, or any coding agent.

For a complete variable reference, see [configuration.md](./configuration.md). This page explains how to get started; that page documents every variable in detail.

## What you need

- Node.js 22+ and pnpm 11.x. The repository pins pnpm in `package.json`, so `corepack enable pnpm` keeps you aligned.
- A GitHub account.
- Accounts for the services in the area you work on. The code is free; the services are not bundled.

## Fork first, then clone

You have no push access to `VecterAI/reacher-x`, so the flow starts on GitHub:

1. Fork `VecterAI/reacher-x` on GitHub.
2. Clone your fork and add the main repository as `upstream` so you can stay in sync:

```bash
git clone https://github.com/YOUR-USERNAME/reacher-x.git
cd reacher-x
git remote add upstream https://github.com/VecterAI/reacher-x.git
git fetch upstream
```

3. Create a branch for one focused change:

```bash
git switch -c fix/short-description
```

Never commit on `main`. See [CONTRIBUTING.md](../CONTRIBUTING.md#submitting-changes) for the full branch, sync, and PR workflow.

## Install and run

```bash
corepack enable pnpm
pnpm install
cp .env.example .env.local
npx convex dev --once
```

`npx convex dev --once` selects a development deployment and validates the backend. It writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` to `.env.local`. Missing provider variables are expected at this point; set them and run the command again.

Then keep two terminals running:

```bash
# Terminal 1: Convex backend watcher
npx convex dev
```

```bash
# Terminal 2: Next.js frontend
pnpm dev
```

Open `http://localhost:3000`.

## Environments: dev vs production

Most services in this stack separate development from production. Match them consciously:

| Service | Development                                                                                     | Production                                                                                                 |
| ------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Convex  | `npx convex dev` targets your dev deployment. `npx convex env set` changes dev values.          | `npx convex env set --prod`, or deploy with `npx convex deploy`. Variables are independent per deployment. |
| WorkOS  | Sandbox environment in the dashboard. `localhost` redirect URIs work there.                     | Production environment with its own keys and allow-listed redirect URI.                                    |
| Polar   | `POLAR_SERVER=sandbox` (the default). Products must exist in the matching sandbox organization. | Set `POLAR_SERVER=production` and use production products and webhooks.                                    |
| Vercel  | Preview variables are separate from Production. Set both explicitly.                            | See the two-project setup in [configuration.md](./configuration.md#vercel-setup).                          |

A value set for one environment does not leak into another. The Convex CLI prints which deployment it targets; read it before running commands.

## Services and where their keys go

The frontend reads `.env.local`. Convex functions do not: backend values are set per deployment with `npx convex env set`. Never commit `.env.local` and never bulk-upload it to Convex.

| Service                     | Powers                                          | How to get access                                                                                                        | Key goes in                                                                                                                                       |
| --------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Convex                      | Backend functions, database, crons              | Create a project at `dashboard.convex.dev`                                                                               | The deployment itself; deploy keys only for hosting (`CONVEX_DEPLOY_KEY`)                                                                         |
| WorkOS AuthKit              | Sign-in and sessions                            | Free dev environment at `dashboard.workos.com`                                                                           | `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD`, `NEXT_PUBLIC_WORKOS_REDIRECT_URI` in `.env.local`; `WORKOS_CLIENT_ID` in both `.env.local` and Convex |
| OpenRouter                  | AI models for the agent                         | API key at `openrouter.ai/keys`                                                                                          | Convex: `OPENROUTER_API_KEY`                                                                                                                      |
| X API                       | Official X OAuth, webhooks, reads               | Developer app at `developer.x.com`                                                                                       | Convex: `X_API_CLIENT_ID`, `X_API_CLIENT_SECRET`, `X_API_BEARER_TOKEN`, `X_CONSUMER_SECRET`, `X_TOKEN_ENCRYPTION_KEY`                             |
| SocialAPI                   | X search, hydration, style analysis, monitoring | Invite only. Ask the maintainer on [Discord](https://discord.gg/BQttyr8jY) or [X/Twitter](https://x.com/ReacherXfounder) | Convex: `SOCIALAPI_API_KEY`                                                                                                                       |
| Renidly (formerly LinkdAPI) | LinkedIn people, company, and post reads        | Sign up at `renidly.com`. Registration requires a work email address                                                     | Convex: `LINKDAPI_API_KEY`                                                                                                                        |
| Unipile                     | LinkedIn connected accounts, messaging, actions | `unipile.com`                                                                                                            | Convex: `UNIPILE_API_KEY`, `UNIPILE_BASE_URL`, `UNIPILE_WEBHOOK_SECRET`                                                                           |
| Polar                       | Billing                                         | `polar.sh`; sandbox organization first                                                                                   | Convex: `POLAR_ORGANIZATION_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_PRODUCT_*`                                                                     |
| Resend                      | Email                                           | `resend.com`                                                                                                             | Convex: `RESEND_API_KEY`                                                                                                                          |
| PostHog                     | Product analytics (optional)                    | `posthog.com`                                                                                                            | `.env.local`: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`                                                                               |

Optional helpers (Exa, Bishopi, GitHub token) are listed in [configuration.md](./configuration.md#optional-product-services). You only need credentials for the area you work on.

## The system in one picture

The full architecture walkthrough with the pipeline details lives in [docs/architecture.md](./architecture.md).

```text
              your browser
                   │
            Next.js app            .env.local
       (app/, features/, shared/) ──────┐
                   │                    │ WorkOS AuthKit values,
          Convex backend ◄──────────────┘ Convex CLI deployment
           (convex/)                     selection
                   │
    ┌──────────────┼───────────────────────────────┐
    │              │                               │
  OpenRouter     X/Twitter                     LinkedIn
  (AI models)    X API + SocialAPI             Renidly (reads)
                 (search, DMs, monitors)       Unipile (messaging)
    │
  Polar (billing)   Resend (email)   Exa, Bishopi, GitHub (optional)
```

Convex functions follow a three-layer rule: `convex/agents/tools/` are thin agent-facing wrappers, `convex/workflows/` orchestrate, and `convex/lib/` holds core business logic. Details in [CONTRIBUTING.md](../CONTRIBUTING.md#how-the-codebase-is-organized).

## Tools for coding agents

The repository ships agent skills under `skills/` (managed by `npx skills`, locked in `skills-lock.json`) and `agents.md` as the entry point for coding agents.

- **Convex plugin**: recommended for Claude Code, Codex, and Cursor. It installs tools, hooks, skills, and the Convex MCP server. See [docs.convex.dev/ai](https://docs.convex.dev/ai).
- **Convex MCP server**: `npx -y convex@latest mcp start`, or read the [server guide](https://docs.convex.dev/ai/convex-mcp-server). It gives agents safe access to your dev deployment for data, logs, insights, and env vars.
- **Convex AI files**: `npx convex ai-files install` refreshes managed sections in `AGENTS.md`/`CLAUDE.md`.
- **Vercel MCP**: run `vercel mcp` to wire the official server at `https://mcp.vercel.com` into Claude Code, Cursor, or VS Code. It manages projects, deployments, and logs.
- **These docs are agent readable**: every public page and blog post serves Markdown, and `/llms.txt` is the index.

## Submit your change

Commit on your branch, run the checks, push to your fork, and open a PR against `VecterAI/reacher-x:main`:

```bash
pnpm exec tsc --noEmit
pnpm lint:strict
pnpm exec prettier --check path/to/changed-file
pnpm test:convex
```

CI runs the same checks on your PR. Review bots such as CodeRabbit comment on every PR: verify each comment before acting on it. Review bots produce false positives, so never apply suggestions blindly. Reply with a short justification when a comment is wrong, and fix only what is real.

## Deploy your own instance

The README deploy button copies this repository into your own GitHub account and creates a Vercel project. That copy is for running your own instance, not for contributing: to contribute code, start with a proper fork as shown in the README's [Contribute in minutes](../README.md#contribute-in-minutes) section. The button also prompts you for the listed environment variables and gets the app built and running; it does not fill in your service keys.

After the import, per [configuration.md](./configuration.md#vercel-setup):

- Set the build command to `npx convex deploy --cmd 'npm run build'` and add `CONVEX_DEPLOY_KEY` as a hosting secret so backend functions deploy with the build.
- Set the Convex backend variables with `npx convex env set --prod` on your own production deployment.
- Allow your new callback URL (`https://your-domain/callback`) in the WorkOS dashboard and set it as `NEXT_PUBLIC_WORKOS_REDIRECT_URI`. Set `NEXT_PUBLIC_SITE_URL` to the bare origin.
- Set `NEXT_PUBLIC_BLOG_DEMO_ORIGIN` to the HTTPS origin of your deployed demo app (see [Interactive Demos](./configuration.md#interactive-demos)).

Your copy then runs live on Vercel and your own Convex deployment, under the AGPL-3.0 license.
