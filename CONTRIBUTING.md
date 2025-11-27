# Contributing to ReacherX

Thanks for your interest in ReacherX! This is an open-source project helping people find potential customers through AI-powered search, and your contributions are genuinely appreciated.

## ▪️ What is ReacherX?

ReacherX is an AI-powered search engine that helps you find potential customers on X (Twitter) and LinkedIn. Instead of spending money on ads, you can directly reach people who need your product or service right now.

## ▪️ Getting Started

### Prerequisites

- **Node.js**: 20.0.0 or higher
- **Package Manager**: pnpm 9.15.4 or higher (npm and yarn not supported)
- **Git**
- Some React/TypeScript knowledge (beginner-friendly!)

### Setup

```bash
# Fork the repo and clone your fork
git clone https://github.com/yourusername/reacher-x.git
cd reacher-x

# Install dependencies
pnpm install

# Copy environment variables template
cp .env.example .env.local

# Edit .env.local and add your API keys (see README for details)
# At minimum, you'll need:
# - NEXT_PUBLIC_CONVEX_URL (run `npx convex dev` to get this)
# - WORKOS_CLIENT_ID
# - X_CLIENT_ID and X_CLIENT_SECRET
# - EXA_API_KEY
# - RESEND_API_KEY
# - ENCRYPTION_PASSWORD
# - At least one AI provider (OPENAI_API_KEY or XAI_API_KEY)

# Set up Convex
npx convex dev

# Start development server
pnpm dev

# Visit http://localhost:3000
```

## ▪️ How You Can Help

**Any help is appreciated** - no contribution is too small!

### Found a Bug?

Just [open an issue](https://github.com/noobships/reacher-x/issues/new) with:

- What you were doing
- What went wrong
- Screenshots if helpful
- Steps to reproduce

No need for formal templates - just tell me what broke!

### Have an Idea?

I'm very open to suggestions! [Create an issue](https://github.com/noobships/reacher-x/issues/new) and let's discuss it. Whether it's a new feature, UI improvement, or performance optimization, I'd love to hear about it.

### Want to Code?

**Perfect!** Here's what would help most right now:

| **Difficulty**                                         | **Tasks**                                                                                                                                                                                                                                                             |
| :----------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Easy Wins**<br>_(Great for First-Time Contributors)_ | `□` Fix UI responsiveness issues<br>`□` Improve error messages and user feedback<br>`□` Add loading states and skeletons<br>`□` Improve accessibility (ARIA labels, keyboard navigation)<br>`□` Add tooltips and help text<br>`□` Fix typos and improve documentation |
| **Medium Difficulty**                                  | `□` Improve search result filtering UI<br>`□` Add keyboard shortcuts<br>`□` Enhance workspace management features<br>`□` Better error handling for API failures<br>`□` Add unit tests for utility functions<br>`□` Improve TypeScript types                           |
| **Advanced**<br>_(If You're Feeling Ambitious)_        | `□` Optimize AI keyword generation performance<br>`□` Add support for additional social platforms<br>`□` Implement advanced filtering options<br>`□` Improve LinkedIn search integration<br>`□` Add analytics and monitoring<br>`□` Performance optimizations         |

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
pnpm lint --fix
```

### Code Style

- **Prettier** handles formatting (configured in `.prettierrc`)
- **ESLint** with TypeScript support catches issues (configured in `eslint.config.mjs`)
- **TypeScript** for type safety
- Follow existing code patterns and conventions

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

| **Category**      | **Ideas**                                                                                                                                           |
| :---------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Documentation** | Improve this CONTRIBUTING.md<br>Add code comments<br>Create usage examples<br>Write better error messages<br>Improve README sections                |
| **Testing**       | Test on different browsers<br>Try edge cases and report issues<br>Test accessibility features<br>Test with different API configurations             |
| **Features**      | Look at the [GitHub issues](https://github.com/noobships/reacher-x/issues)<br>Pick something marked "good first issue"<br>Or suggest something new! |
| **UI/UX**         | Improve search interface<br>Enhance workspace management UI<br>Better mobile responsiveness<br>Add helpful tooltips and guidance                    |

## ▪️ Current Focus

Right now I'm focusing on:

| **Priority** | **Focus Area**                                                 |
| :----------: | :------------------------------------------------------------- |
|     `1.`     | **Core functionality** - Making search and outreach rock-solid |
|     `2.`     | **Enhanced LinkedIn features** - Better LinkedIn integration   |
|     `3.`     | **Additional platforms** - Expanding to more social platforms  |
|     `4.`     | **Community growth** - Getting feedback and contributors       |

## ▪️ Project Structure

```
reacher-x/
├── app/              # Next.js app router pages
│   ├── (webapp)/     # Main application routes
│   ├── api/          # API routes
│   └── home/         # Landing page
├── convex/           # Convex backend functions
│   ├── lib/          # Shared utilities
│   └── *.ts          # Convex queries, mutations, actions
├── features/         # Feature-based modules
│   ├── composer/     # Post/reply composer
│   ├── keywords/     # Keyword management
│   ├── search/       # Search functionality
│   ├── threads/      # Thread management
│   └── webapp/       # Web app components
├── shared/           # Shared utilities and components
│   ├── hooks/        # React hooks
│   ├── lib/          # Utility functions
│   └── ui/           # UI components
└── public/           # Static assets
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
- Check that API keys are valid and have proper permissions
- See `.env.example` for all required variables

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

[![Open Issue](https://img.shields.io/badge/Questions-Open_an_Issue-000000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/noobships/reacher-x/issues/new)

[![Email](https://img.shields.io/badge/Email-creativecoder.crco@gmail.com-000000?style=for-the-badge&logo=gmail&logoColor=white)](mailto:creativecoder.crco@gmail.com)

Check existing issues and discussions for common questions.

## ▪️ License

By contributing, you agree your contributions will be under the same MIT License as the project.

---

**Thanks for considering contributing! Even small improvements make a huge difference for an open-source project like this.**

**Remember: Don't hesitate to ask questions or reach out if you need help getting started!**
