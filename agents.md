## Introduction

I'm Salman. You're my agent. We will be working together a lot, so I thought it would be worth introducing myself.

I'm a designer turned developer. I love building tasteful, high-quality applications.

I love to build. I focus on building complex things as simply as possible. I love to find ways to reduce complexity when solving problems.

I wanted to share some of my preferences here so we can be more aligned as we work together.

## Coding preferences - general

- Keep things simple. Channel "yagni" energy unless told otherwise.
- Type safety is useful; take advantage of it.
- Don't be scared to propose bold ideas if they can meaningfully benefit our work.
- Be careful with destructive actions that are not explicitly requested by the user.
- Tests are good! Endless smoke tests, "regression tests" for feature deletions, etc., are much less good. Tests should be focused, not slop.
- Comments are a great way to clarify functionality and how code is used. Don't comment every line, but feel free to describe (concisely) how functions are used above function definitions, classes, etc.
- Keep comments up to date! When making changes, it's important to keep things in sync.

## Coding preferences (TypeScript focused)

- `any` is the enemy. Inferred types are our friend. Our systems should adapt to changes, instead of requiring changes everywhere.
- If your TS code looks like a Python dev wrote it, it is bad TS code.
- Avoid one-line functions that are just casting wrappers.
- Write TypeScript in ways that Matt Pocock and Theo would be proud.

## Questions are read-only

- A question is a request for an answer, not for changes. If the message opens with "how hard would it be", "what are your thoughts", "why does", "should we", "is it possible", "can X do Y", or otherwise asks rather than instructs: answer it, and do not edit files.
- If the answer is obvious and the change is trivial, still answer first and offer the change. Ask before making it.

## Match ceremony to the task

- Do not spawn subagents or a multi-agent panel for work a single agent finishes in one pass. Delegation is for breadth or adversarial review, not for ordinary tasks.
- When several agents do work in parallel, state file ownership up front so they do not collide.

## Project

I am building **ReacherX**, open-source software for finding the right network of people. It's being designed and built for normies like me, who are not sales or marketing professionals. We just want a tool that just works.

The pitch deck description:

> The first platform to unify prospect discovery, CRM, outreach, and social in one system. No more stitching together Clay, Apollo, and a CRM.
>
> Not a sales tool: a networking and relationship platform, for sales and non-sales people alike.

- The primary use case is to find customers easily for products or services. This is not a sales tool, quote-unquote, but a networking and relationship tool. We are making a versatile/dynamic platform that adapts to the user's use case. If a user needs to find creators, our platform adapts to that use case. If a recruiter comes to find candidates, our platform adapts. **Adaptability and versatility are a big thing.**
- We are building the best tool: powerful yet so simple that anybody can use it easily without having to learn anything or have special knowledge/expertise. **Simplicity that hides all the complexity behind it.**
- **Performance is a key factor.** Everything must be performant. Fast load times, snappy and buttery-smooth UX.
- The app design language is **minimal, high-quality, and mostly neutral**.

## Communication

- Always use easy-to-understand language when responding and explaining. No AI slop language. Be short, concise, and straight to the point.
- **No em dashes, please.**
- For in-app copy, match our existing language, tone, and style. Ensure user-facing copy is clear.
- User-facing messages like errors must not include technical terms. We are making our app for normies, so it should be simple and clear.

## Git workflow

- Before jumping into implementation, always use git to check the status of the project.
- If there's WIP in a branch/worktree and you are about to do some work, call it out so I can guide you.
- I prefer scoping work in an isolated branch/worktree.
- Keep our local main up to date with origin/main.

## Docs and dependencies

- Use skills when required; always use and refer to the docs. Search online for docs for up-to-date information.
- Read `package.json`, `next.config.mjs`, and other config and important files so you know what configuration and dependencies are used at which version.
- If something is missing in the current version but exists in the latest version of a dependency (a fix for an issue, etc.), tell me about it so I can keep packages up to date. This also helps with better security.
- Keep dev dependencies and dev utilities up to date for the highest code quality and security (lint rules, etc.).

## Verification and commits

- Always ensure code is properly verified (type-checked, formatted, etc.) before committing and pushing to GitHub. During in-progress turns you don't have to do this each time, but before committing and pushing, you must.
- Do a CodeRabbit code review using the CLI before you commit and push. Watch out for false positives; don't trust it blindly. Verify first, and fix only if it's legit.

## Keep the codebase clean

- **Do not create markdown reports** for any work or analysis. I hate those. Whatever you do, mention it in your response. Those markdown files always bloat the codebase.
- Whenever a cleanup or removal happens, ensure proper cleanup (remove unwanted files, code, folders, dependencies, etc.). The codebase should be clean, minimal, and bloat-free.

## Frontend

- When doing frontend work, test properly for all devices, desktop and mobile. Something can look good on desktop but cause issues on mobile.

## Think big

- Think outside the box. Don't be afraid to think big. Bold ideas are welcome.

## Think ahead

- Always think ahead like a real engineer. If something we are going to do affects multiple parts of the system and has a risk of breaking or causing regressions, map it out and call it out.

## Cost optimization

- Always follow best practices and recommend ways to keep costs as low as possible while maintaining the highest quality bar.
- Follow the cost optimization practices documented by the providers/tech stack we use, like Convex, Next.js, etc.
- If anything requires an expensive migration or backfilling, call it out first so I can decide whether it's worth doing based on the budget.

## Scalability

- This is an infra- and backend-heavy project. Always think about scalability when doing core backend infra work, or anything that could become a bottleneck at scale (database scalability, etc.).

## Research

- Don't be afraid to do proper research with online searches to find tools, packages, or resources (blog articles from well-known teams/orgs like Vercel, React, etc.) so I have a reference, inspiration, and examples that make me feel confident.

## Open source

- This is an open-source project, so keep docs up to date (dev resources/files like env and configuration, etc.).
- Make it easy for devs and their AI agents to quickly start working on or contributing to this project.

## DRY

- Always follow the DRY (Don't Repeat Yourself) principle. Before creating anything, check if it already exists. If not, build it so it's easily reusable.
