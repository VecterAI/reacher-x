# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0-beta.7] - 2025-01-XX

### Added

- New agent system built on `@convex-dev/agent` with streaming support and thread management
- Comprehensive chat UI components (ChatContainer, Message, Markdown, CodeBlock, Tool, Reasoning, ChainOfThought, etc.)
- Agent tools for workspace setup: `analyzeUrl`, `createWorkspace`, `generateImprovedDescription`, `updateWorkspace`, `getUserStatus`
- LinkedIn and Twitter search integrations for prospect discovery
- Streaming chat interface with real-time message updates using `useUIMessages` hook
- Chat thread management with `convex/chat.ts` supporting streaming responses
- New shared UI components for enhanced chat experience (PromptInput, PromptSuggestion, ResponseStream, ScrollButton, etc.)
- Workspace schema enhancements with `seedDescription`, `improvedDescription`, and `icps` fields
- Thinking indicators and tool call visualization for better UX during agent processing
- Dynamic prompt suggestions based on conversation state and tool calls

### Changed

- Refactored agent system from legacy structure to `@convex-dev/agent` architecture
- Updated AI library (`convex/lib/ai.ts`) to use OpenRouter provider with enhanced error handling
- Improved workspace schema to support multi-stage description generation (seed → improved → approved)
- Enhanced webapp Header and Sidebar components with better navigation and user experience
- Updated home page layout and thread views for better content presentation
- Improved TypeScript configuration with updated path mappings

### Removed

- Legacy onboarding route (`app/(webapp)/onboarding/`) and related components
- Old agent implementation (`convex/agent/` directory with index.ts, retrier.ts, keywordGeneration.ts)
- Deprecated `convex/agentThreads.ts` in favor of `@convex-dev/agent` thread management
- Removed `app/api/describe-url/route.ts` (functionality moved to agent tools)
- Cleaned up unused validation schemas and legacy code

### Fixed

- Improved markdown rendering in chat messages with proper list formatting
- Enhanced avatar display with user profile images from WorkOS authentication
- Better contrast and legibility for avatar initials in light/dark mode
- Fixed chat UI styling with proper message bubbles and spacing
- Improved mobile responsiveness for chat interface

## [4.0.0-beta.6] - 2025-01-XX

### Added

- AI-powered agent system with keyword generation tool for prospect discovery
- Agent threads management system for onboarding and workflow orchestration
- Keywords management system with workspace-level keyword tracking and discovery
- Prospects management system with platform-specific filtering and status tracking
- Plans and subscription system with tier-based usage limits and upgrade functionality
- Bishopi integration for keyword data and search metrics
- Plan helpers for usage tracking, limits enforcement, and plan upgrades
- Comprehensive validators for agent threads, keywords, prospects, and plans
- Convex configuration for agent workflows and retry mechanisms

### Changed

- Updated schema to support agent threads, keywords, prospects, and plans
- Enhanced validators with type-safe argument validation for new features
- Updated generated API types for new Convex functions

## [4.0.0-beta.5] - 2025-12-02

### Added

- New marketing-focused home page sections with product videos and clearer positioning for ReacherX
- Public threads directory and per-thread detail pages with Convex-powered content and author sidebars

### Changed

- Improved recent threads fetching to work smoothly with Next.js 16 cacheComponents and normalized tweet entities for safer rendering
- Updated sitemap generation to include individual thread URLs for better SEO coverage
- Refined the global footer with social links, support contact, scroll-to-top control, and clearer structure for legal links

### Fixed

- More robust media handling in thread views, including deduplicated galleries and better video playback behavior
- Structured logging utilities for consistent browser vs. server logging with JSON output on the server

## [4.0.0-beta.4] - 2025-12-01

### Changed

- Upgraded design system to **Tailwind CSS 4** with the new `@tailwindcss/postcss` pipeline
- Updated `prettier-plugin-tailwindcss` and related tooling for Tailwind 4 compatibility
- Refined shared UI components (buttons, badges, inputs, tabs, tooltips, etc.) to match the updated design tokens
- Tweaked home, threads, and profile pages for better layout, spacing, and responsiveness

### Fixed

- Improved thread and post detail views (Twitter and LinkedIn) for more consistent media and gallery behavior
- Polished sitemap and Open Graph preview behavior for shared links

## [4.0.0-beta.3] - 2025-12-01

### Added

- New Twitter profile context and panel components
- New search filter and sort components for Twitter and LinkedIn
- New module index files for `linkedin`, `page`, `sidebar`, and `tweet` webapp UI sections
- New structured utility modules under `shared/lib/utils/*` (core, encoding, opengraph, storage, text, time, url, validation)

### Changed

- Consolidated shared utilities into a clearer folder structure
- Refined webapp layout and sidebar components
- Updated composer, threads, waitlist, and shared UI components for v4 compatibility

### Removed

- Legacy LinkedIn and tweet webapp components duplicated in the old flat structure
- Deprecated utility helpers (`featureFlags`, `performance`, `tokenValidation`, and related old helpers)

## [4.0.0-beta.2] - Unreleased

### Added

- Module index files for better code organization
- New hooks: `useOgPreview`, `useUrlDescription`, `useWorkspace`
- X (Twitter) post route structure

### Changed

- Major codebase cleanup and refactoring
- Updated components for v4 compatibility
- Improved component exports and organization
- Enhanced type safety across components

### Removed

- Deprecated keyword generation system
- Legacy search and onboarding features
- Unused hooks, utilities, and legacy pages
- Old search contexts and components

## [4.0.0-beta.1] - 2024-11-29

### Added

- Support for AI SDK 5.0
- Next.js 16 compatibility
- Zod 4.0 support
- React 19.2 support

### Changed

- Upgraded `@ai-sdk/openai` from ^1.3.22 to ^2.0.74
- Upgraded `ai` package from ^4.3.16 to ^5.0.0
- Upgraded `next` from 15.3.1 to ^16.0.3
- Upgraded `react` and `react-dom` from ^19.1.0 to ^19.2.0
- Upgraded `convex` from ^1.27.3 to ^1.29.3
- Upgraded `zod` from ^3.24.4 to ^4.1.8
- Upgraded `@workos-inc/authkit-nextjs` from ^2.9.0 to ^2.11.1
- Refactored middleware to `proxy.ts`
- Updated AI SDK API calls: `maxTokens` → `maxOutputTokens`
- Added type assertions for AI SDK 5.0 compatibility

### Breaking Changes

- AI SDK 5.0 requires `maxOutputTokens` instead of `maxTokens`
- Type assertions required for AI SDK response objects
- Next.js 16 may have breaking changes (see [Next.js 16 migration guide](https://nextjs.org/docs/app/building-your-application/upgrading/version-16))

## [3.0.0-beta] - 2024-12-XX

### Added

- Initial open source release
- AI-powered keyword generation
- Multi-platform search (X/Twitter and LinkedIn)
- Direct outreach functionality
- Workspace management
- AI-powered result filtering
- Keyword pinning and reuse

> **Note**: Version 3.0 is currently in beta. Available on the `main` branch.

---

[4.0.0-beta.2]: https://github.com/noobships/reacher-x/compare/v4.0.0-beta.1...v4.0.0-beta.2
[4.0.0-beta.3]: https://github.com/noobships/reacher-x/compare/v4.0.0-beta.2...v4.0.0-beta.3
[4.0.0-beta.4]: https://github.com/noobships/reacher-x/compare/v4.0.0-beta.3...v4.0.0-beta.4
[4.0.0-beta.5]: https://github.com/noobships/reacher-x/compare/v4.0.0-beta.4...v4.0.0-beta.5
[4.0.0-beta.6]: https://github.com/noobships/reacher-x/compare/v4.0.0-beta.5...v4.0.0-beta.6
[4.0.0-beta.7]: https://github.com/noobships/reacher-x/compare/v4.0.0-beta.6...v4.0.0-beta.7
[4.0.0-beta.1]: https://github.com/noobships/reacher-x/releases/tag/v4.0.0-beta.1
[3.0.0-beta]: https://github.com/noobships/reacher-x/releases/tag/v3.0.0-beta
