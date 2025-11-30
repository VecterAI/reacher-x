# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
[4.0.0-beta.1]: https://github.com/noobships/reacher-x/releases/tag/v4.0.0-beta.1
[3.0.0-beta]: https://github.com/noobships/reacher-x/releases/tag/v3.0.0-beta
