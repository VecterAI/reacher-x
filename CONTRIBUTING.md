# Contributing to ReacherX

Thanks for your interest in ReacherX! This is an open-source AI agent for finding and reaching people across X (Twitter) and LinkedIn, and your contributions are genuinely appreciated.

## ▪️ What is ReacherX?

ReacherX is an AI agent that finds people on social platforms, qualifies them against your criteria, enriches their profiles, learns your writing voice, and helps you engage with personalized outreach. It supports 8 use cases — customer prospecting, recruiting, partnerships, investor outreach, user research, creator outreach, community growth, and podcast speaker sourcing. See the [README](README.md) for the full breakdown.

## ▪️ Getting Started

### Prerequisites

- **Node.js**: 20.0.0 or higher
- **Package Manager**: pnpm 9.15.4 or higher (npm and yarn not supported)
- **Git**
- Some React/TypeScript knowledge (beginner-friendly!)

### Setup

```bash
# Fork the repo and clone your fork
git clone https://github.com/VecterAI/reacher-x.git
cd reacher-x

# Install dependencies
pnpm install

# Copy environment variables template
cp .env.example .env.local

# Edit .env.local and add your API keys (see README for full details)
# At minimum, you'll need:
# - NEXT_PUBLIC_CONVEX_URL (run `npx convex dev` to get this)
# - WORKOS_CLIENT_ID
# - OPENROUTER_API_KEY (primary AI provider — powers agents, qualification, enrichment, autocomplete)
# - X_API_CLIENT_ID, X_API_CLIENT_SECRET, X_API_BEARER_TOKEN, X_CONSUMER_SECRET, X_TOKEN_ENCRYPTION_KEY
# - RESEND_API_KEY
# - CONVEX_SITE_URL

# Set up Convex
npx convex dev

# Start development server (in a separate terminal)
pnpm dev

# Visit http://localhost:3000
```

## ▪️ How You Can Help

**Any help is appreciated** - no contribution is too small!

### Found a Bug?

Just [open an issue](https://github.com/VecterAI/reacher-x/issues/new) with:

- What you were doing
- What went wrong
- Screenshots if helpful
- Steps to reproduce

No need for formal templates - just tell me what broke!

### Have an Idea?

I'm very open to suggestions! [Create an issue](https://github.com/VecterAI/reacher-x/issues/new) and let's discuss it. Whether it's a new feature, UI improvement, or performance optimization, I'd love to hear about it.

### Want to Code?

**Perfect!** Here's what would help most right now:

| **Difficulty**                                         | **Tasks**                                                                                                                                                                                                                                                                       |
| :----------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Easy Wins**<br>_(Great for First-Time Contributors)_ | `□` Fix UI responsiveness issues<br>`□` Improve error messages and user feedback<br>`□` Add loading states and skeletons<br>`□` Improve accessibility (ARIA labels, keyboard navigation)<br>`□` Add tooltips and help text<br>`□` Fix typos and improve documentation           |
| **Medium Difficulty**                                  | `□` Improve prospect filtering and sorting<br>`□` Add keyboard shortcuts<br>`□` Enhance composer experience<br>`□` Better error handling for API failures<br>`□` Add unit tests for utility functions<br>`□` Improve TypeScript types                                          |
| **Advanced**<br>_(If You're Feeling Ambitious)_        | `□` Improve LinkedIn feature parity with X<br>`□` Add support for additional social platforms<br>`□` Enhance agent memory and learning patterns<br>`□` Improve outreach plan generation quality<br>`□` Optimize qualification/enrichment workflows<br>`□` Performance optimizations |

## ▪️ Development Workflow

### Development Steps

| **Step** | **Action**                                              | **Notes**                          |
| :------- | :------------------------------------------------------ | :--------------------------------- |
| `1.`     | **Fork the repo**                                       | -                                  |
| `2.`     | **Create a branch**: `git checkout -b fix/your-feature` | Use descriptive branch names       |
| `3.`     | **Make changes**                                        | Follow code style guidelines below |
| `4.`     | **Test locally**: Run the app and verify it works       | `pnpm dev`                         |
| `5.`     | **Check code quality**: Run linting                     | `pnpm lint`                        |
| `6.`     | **Commit and push**                                     | Write clear commit messages        |
| `7.`     | **Create PR**                                           | Fill out the PR template           |

### Local Development

**Always run these before committing:**

```bash
# Start development server
pnpm dev

# Check for linting issues
pnpm lint

# Build to ensure everything compiles
pnpm build
```

**If you have linting issues, try:**

```bash
# Auto-fix linting issues (if possible)
pnpm lint:fix
```

### Code Style

- **oxlint** handles linting (configured via CLI flags in `package.json`)
- **Prettier** handles formatting (configured in `.prettierrc`)
- **ESLint** as a secondary check (configured in `eslint.config.mjs`)
- **TypeScript** for type safety — strict mode

**General guidelines:**

- Use TypeScript for all new code
- Follow React best practices (hooks, functional components)
- Keep components small and focused
- Add comments for complex logic
- Use meaningful variable and function names

## ▪️ What Happens When You Submit a PR

1. **Code review** - I'll review your changes for logic, style, and best practices
2. **Testing** - Make sure your changes work as expected
3. **Merge** - Once approved, your PR will be merged!

### PR Guidelines

- **Keep PRs focused** - One feature or fix per PR
- **Write clear descriptions** - Explain what you changed and why
- **Link related issues** - Reference any issues your PR addresses
- **Test your changes** - Make sure everything works locally

## ▪️ Contribution Ideas

Not sure where to start? Try these:

| **Category**      | **Ideas**                                                                                                                                            |
| :---------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Documentation** | Improve this CONTRIBUTING.md<br>Add code comments<br>Create usage examples<br>Write better error messages<br>Improve README sections                 |
| **Testing**       | Test on different browsers<br>Try edge cases and report issues<br>Test accessibility features<br>Test with different API configurations              |
| **Features**      | Look at the [GitHub issues](https://github.com/VecterAI/reacher-x/issues)<br>Pick something marked "good first issue"<br>Or suggest something new! |
| **UI/UX**         | Improve composer experience<br>Enhance agent chat interface<br>Better mobile responsiveness<br>Add helpful tooltips and guidance                     |

## ▪️ Current Focus

Right now I'm focusing on:

| **Priority** | **Focus Area**                                                                       |
| :----------: | :----------------------------------------------------------------------------------- |
|     `1.`     | **LinkedIn parity** - Bringing LinkedIn actions and monitoring to full X parity       |
|     `2.`     | **Agent quality** - Improving outreach plan generation and memory learning            |
|     `3.`     | **Additional platforms** - Expanding beyond X and LinkedIn                            |
|     `4.`     | **Community growth** - Getting feedback and contributors                              |

## ▪️ Project Structure

```
reacher-x/
├── app/                       # Next.js 16 App Router
│   ├── (webapp)/              # Main application (auth required)
│   │   ├── agent/             # AI chat interface
│   │   ├── agent-ops/         # Agent operations dashboard
│   │   ├── [slug]/[id]/       # Use-case-aware detail routes
│   │   ├── analytics/         # Analytics dashboard
│   │   ├── archives/          # Archived prospects
│   │   ├── notifications/     # Notification center
│   │   ├── plans/             # Billing plans
│   │   ├── settings/          # Account & workspace settings
│   │   ├── success/           # Use-case success pages
│   │   └── workspace/         # Workspace management
│   ├── api/                   # API routes
│   ├── home/                  # Public landing page
│   └── login/, callback/      # Auth flow
│
├── convex/                    # Backend (Convex)
│   ├── agents/                # AI agents
│   │   ├── index.ts           # Setup agent definition + tools
│   │   ├── outreach/          # Outreach agent + tools
│   │   │   └── tools/         # socialAction, generatePlan, getSocialContext, etc.
│   │   ├── tools/             # Shared agent tools (search, qualify, enrich, memory)
│   │   └── prompts.ts         # System prompts for both agents
│   ├── workflows/             # Durable workflows
│   │   ├── prospecting.ts     # Discovery pipeline
│   │   ├── qualification.ts   # Prospect qualification
│   │   ├── enrichment.ts      # Profile enrichment
│   │   ├── outreach.ts        # Plan execution
│   │   ├── memory.ts          # Memory evaluation
│   │   └── setup.ts           # Workspace setup
│   ├── integrations/          # External API clients
│   │   ├── twitter/           # SocialAPI + X API clients
│   │   ├── linkedin/          # LinkdAPI client
│   │   └── bishopi.ts         # Keyword discovery
│   ├── lib/                   # Core business logic
│   │   ├── *Core.ts           # Qualification, enrichment, outreach logic
│   │   ├── *Helpers.ts        # Constants, formatting, utilities
│   │   ├── *Pool.ts           # Workpool instances
│   │   ├── ai.ts              # OpenRouter provider + model config
│   │   └── unipileClient.ts   # LinkedIn messaging client
│   ├── schema.ts              # Database schema
│   └── validators.ts          # Zod validators
│
├── features/                  # Feature modules (UI + logic)
│   ├── agent/                 # Chat interface, onboarding, inline cards
│   ├── agent-ops/             # Operations dashboard (5 tabs)
│   ├── analytics/             # Analytics charts and metrics
│   ├── billing/               # Subscription UI
│   ├── composer/              # Reply/DM composer with inline autocomplete
│   ├── landing/               # Landing page components
│   ├── linked-accounts/       # OAuth account management
│   ├── prospects/             # Prospect cards, panels, pipeline
│   ├── search/                # Search UI
│   ├── threads/               # Tweet/post thread display
│   └── webapp/                # App shell, sidebar, header
│
├── shared/                    # Shared utilities & components
│   ├── ui/components/         # shadcn/ui components
│   ├── lib/
│   │   ├── workspaceUseCases.ts  # 8 use-case definitions
│   │   ├── autocomplete/      # Inline autocomplete logic
│   │   ├── twitter/           # X post limits, contracts
│   │   └── utils/             # Time, encoding, validation
│   ├── hooks/                 # Custom React hooks
│   └── types/                 # TypeScript types
│
├── emails/                    # React Email templates
├── docs/                      # API documentation
└── public/                    # Static assets
```

## ▪️ Troubleshooting

### Common Issues

**"pnpm install fails"**

- Ensure you're using Node.js 20.0.0+ and pnpm 9.15.4+
- Try `pnpm install --force` to refresh dependencies
- Clear node_modules and reinstall: `rm -rf node_modules pnpm-lock.yaml && pnpm install`

**"Convex connection fails"**

- Make sure you've run `npx convex dev` and have `NEXT_PUBLIC_CONVEX_URL` in your `.env.local`
- Check that your Convex deployment is active

**"API errors"**

- Verify all required API keys are set in `.env.local`
- `OPENROUTER_API_KEY` is the primary AI provider — most AI features won't work without it
- Check that API keys are valid and have proper permissions
- See the [README](README.md#configuration) for the full env var reference

**"Build fails"**

- Run `pnpm lint` to check for linting issues
- Ensure TypeScript types are correct: check for type errors in your editor
- Try `pnpm build` to see specific error messages

**"Can't find module"**

- Make sure you've run `pnpm install`
- Check that you're using the correct import paths
- Verify the file exists in the expected location

## ▪️ Questions?

I'm pretty responsive! You can:

[![Open Issue](https://img.shields.io/badge/Questions-Open_an_Issue-000000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/VecterAI/reacher-x/issues/new)

[![Email](https://img.shields.io/badge/Email-creativecoder.crco@gmail.com-000000?style=for-the-badge&logo=gmail&logoColor=white)](mailto:creativecoder.crco@gmail.com)

Check existing issues and discussions for common questions.

## ▪️ License

By contributing, you agree your contributions will be under the same MIT License as the project.

---

**Thanks for considering contributing! Even small improvements make a huge difference for an open-source project like this.**

**Remember: Don't hesitate to ask questions or reach out if you need help getting started!**
