# 🆁 ReacherX

Open-source △ Agent that helps anyone find the right people and reach them across X/Twitter and LinkedIn, with more channels and actions expanding over time.

<p align="left">
  <a href="https://reacherx.com"><img alt="live" src="https://img.shields.io/badge/live-reacherx.com-000000?style=flat-square"></a>
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-apache--2.0-white?style=flat-square&logo=apache&logoColor=black"></a>
  <a href="https://www.typescriptlang.org/"><img alt="typescript" src="https://img.shields.io/badge/typescript-000000?style=flat-square&logo=typescript&logoColor=white"></a>
  <a href="https://nextjs.org/"><img alt="next.js" src="https://img.shields.io/badge/next.js-16-white?style=flat-square&logo=next.js&logoColor=black"></a>
</p>

[Live site](https://reacherx.com) · [Contributing](./CONTRIBUTING.md) · [Roadmap](./ROADMAP.md) · [GitHub Issues](https://github.com/VecterAI/reacher-x/issues) · [Discord](https://discord.gg/76dF9NPH) · [Email Salman](mailto:creativecoder.crco@gmail.com)

## Video Demo

GitHub does not reliably render inline video players inside repository READMEs, so the demo is linked through a clickable preview instead.

<a href="https://nmx18xidmv.ufs.sh/f/uF4FhwZJse4NLqENOJiThnvNigGByTM95kYptFD4PjuRd82a" target="_blank" rel="noopener noreferrer">
  <img alt="Watch the ReacherX demo" src="https://nmx18xidmv.ufs.sh/f/uF4FhwZJse4NNJIluMPruyLnJjG9lqwfYk4Fm8T0ZCtMWNAp">
</a>

<a href="https://nmx18xidmv.ufs.sh/f/uF4FhwZJse4NLqENOJiThnvNigGByTM95kYptFD4PjuRd82a" target="_blank" rel="noopener noreferrer">Open the demo video directly</a>

## What ReacherX Does

ReacherX is built for anyone, not just specialists or teams with complex GTM setups. You describe who you need, ReacherX finds matching people, builds context around them, and helps you take action through the product UI or by asking the agent directly.

The goal is simple: make finding and reaching the right people feel accessible, useful, and powerful without requiring special knowledge or experience.

## How It Works

The product story here follows the same flow as the `/home` landing experience:

1. Describe who you need in plain English.
2. ReacherX turns that into search and discovery strategies.
3. The agent gathers context, signals, and proof behind each match.
4. ReacherX proposes next actions and drafts content.
5. You stay in control and approve important actions.
6. The system improves over time through feedback, memory, and evaluations.

## Why It Feels Different

- Real people, found from real activity instead of static lists.
- Human-in-the-loop by default for high-trust actions.
- Open-source and self-hostable.
- Built around an agent-first product experience, not just dashboards and forms.
- Designed so users can work manually in the UI or ask the agent to do the same work for them.

## Use Cases

- Customer prospecting: find and engage people already expressing the right need.
- Recruiting: source candidates from real conversations and platform activity.
- Partnerships: identify operators, founders, and companies worth reaching.
- Investor outreach: discover investors whose interests match your opportunity.
- User research: recruit participants who actually fit the problem space.
- Creator and community growth: find the right people to collaborate with or invite in.

## What Is Open Source

- The application code is public.
- Contributors can inspect how the product, core logic, and agent behaviors are built.
- Self-hosting is part of the intended value of the project.
- If you want to shape product direction, feature ideas, or implementation approach, contact Salman directly.
- Email: [creativecoder.crco@gmail.com](mailto:creativecoder.crco@gmail.com)
- Discord: [discord.gg/76dF9NPH](https://discord.gg/76dF9NPH)
- GitHub Issues: [github.com/VecterAI/reacher-x/issues](https://github.com/VecterAI/reacher-x/issues)

For feature ideas and bigger changes, please reach out first so we can brainstorm and align before you spend time building.

## Roadmap

The fuller roadmap lives in [ROADMAP.md](./ROADMAP.md). High-level priorities:

### Now

- Improve reliability across current X and LinkedIn workflows.
- Make contributor onboarding and local development much easier.
- Add stronger benchmarks and evaluations so agent performance is measurable.
- Harden the product and codebase with tooling such as React Doctor, Convex tooling, linting, audits, and better tests.

### Next

- Email integration: let users send emails directly from ReacherX through the UI or by asking the agent.
- Calendar integration: Google Calendar and Outlook Calendar support so users can book calls and meetings from the UI or by asking the agent.
- Cross-platform identity resolution: show the same person across multiple channels in the prospect profile panel.
- App-originated email delivery: send product emails, notifications, and workflow-driven messages to users.
- File and image uploads: give the agent richer inputs to reason over and act on.

### Later

- More platforms: Reddit, Bluesky, and Threads.
- Sub-agents and agent swarms for parallel task execution.
- Broader workflow automation across prospecting, outreach, research, and follow-up.

### Help Wanted

- Evaluations and benchmark design.
- Platform integrations and identity matching.
- Frontend polish, accessibility, and interaction quality.
- Local development experience and contributor docs.

## Getting Started

### Requirements

- Node.js 22+
- pnpm 11.x

### Install

```bash
git clone https://github.com/VecterAI/reacher-x.git
cd reacher-x
corepack enable pnpm
pnpm install
cp .env.example .env.local
```

If you do not use Corepack, install a pnpm 11 release before continuing.

### Run

```bash
pnpm exec convex dev
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Notes

The environment setup needs cleanup and is still evolving. Use `.env.example` as the current base, then check runtime usage in `app/` and `convex/` if you are working on a specific integration.

At a minimum for serious local development, expect to configure:

- Convex
- WorkOS
- AI provider keys
- X/Twitter keys for X workflows
- LinkdAPI and Unipile for LinkedIn workflows
- Resend and related email configuration for email flows

## Architecture At A Glance

- `app/`: Next.js routes and app entry points.
- `features/`: product UI and feature-specific logic.
- `shared/`: shared utilities, components, hooks, and types.
- `convex/agents/tools/`: thin agent-facing tool layer.
- `convex/workflows/`: orchestration and durable workflows.
- `convex/lib/`: core business logic and integrations.

## Contributing

If you want to contribute, start with [CONTRIBUTING.md](./CONTRIBUTING.md).

Repo health files:

- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security Policy](./SECURITY.md)

If you want to work on a new feature, roadmap item, or architectural change, please contact Salman first:

- Email: [creativecoder.crco@gmail.com](mailto:creativecoder.crco@gmail.com)
- Discord: [discord.gg/76dF9NPH](https://discord.gg/76dF9NPH)
- LinkedIn: [linkedin.com/in/noobships](https://www.linkedin.com/in/noobships)

That upfront conversation is important for this project because many contributions touch product direction, agent behavior, workflow design, and platform strategy.

## License

Apache-2.0. See [LICENSE](./LICENSE).
