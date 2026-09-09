# Publishing on the ReacherX blog

Posts live in `content/blog/<slug>.mdx`. Use lowercase words separated by hyphens for the filename. Each file has YAML frontmatter between `---` lines, followed by MDX content. Start from `content/blog/authoring-example.mdx`.

```mdx
---
title: Your title
description: A short, specific summary.
category: tutorials
date: "2026-09-08"
tags: [getting started]
draft: true
featured: false
---

Introduce the topic.

## First section

Write the article here.
```

## Workflow

1. Create or edit the file with Codex or your editor. Dates must be quoted YYYY-MM-DD strings. Choose `tutorials`, `engineering`, `announcements`, or `perspectives`.
2. Run `pnpm dev` and open `/blog`. To preview a draft locally, temporarily set `draft` to `false` and use a date no later than today. Restore `draft: true` before sharing the branch if it should stay unpublished. There is deliberately no public draft-preview bypass.
3. Run `pnpm test:blog`, Prettier, and `pnpm build`. Invalid metadata or missing published cover/social assets fail the build. Asset checks run before compilation, rather than during public requests. For HTTP checks, start `pnpm start --port 3107` in another terminal, then run `BLOG_TEST_URL=http://127.0.0.1:3107 pnpm test:blog:http`.
4. To publish, set `draft` to `false`, review the post, and use the existing Git/deployment workflow. A future date excludes a post; it is not a scheduling service. Deploy on or after that date.

No publishing credentials or new database are needed. Never put secrets in content, including drafts: files are part of the repository and server build. Only compile trusted, reviewed MDX; MDX can execute JavaScript.

## Metadata and artwork

Every post automatically gets a canonical URL, title/description, author metadata, article JSON-LD, RSS entry, and a branded 1200 × 630 social image at `/blog/<slug>/opengraph-image`.

- `updated`: optional date, on or after `date`.
- `image` and `imageAlt`: optional article cover, stored under `public/`. Both are required together.
- `ogImage`: optional custom social image under `public/`; use a 1200 × 630 PNG/JPEG/WebP/AVIF. It overrides the generated social image in metadata.
- `featured`: reserved metadata; all listing cards currently use the same layout. Posts sort newest first, then by slug for equal dates.
- The author is configured once in `features/blog/lib/blogHelpers.ts`.

The cover and social image are independent. Listing and related cards display a cover when one is provided and a neutral placeholder when it is absent. The generated social PNG is a separate, fixed dark image for link previews.

## Content blocks

Use `##` and `###` headings. The page supplies the only H1. Heading links and the table of contents are automatic. Use fenced code blocks with a language and optional `title="example.ts"` filename; highlighting happens on the server and code has copy controls. Unrecognized languages render as plain text. Markdown tables, lists, links, and quotes work normally.

Use `BlogImage` for images, with `src`, `alt`, actual `width`/`height`, and optional `caption`. Local images go in `public/`. Remote image hosts must be explicitly configured in `next.config.mjs`.

Use `BlogVideo` with `src`, `poster`, `title`, actual `width`/`height`, and optional `caption`. Videos reuse the application’s Media Chrome controls and `preload="none"`. For speech, add a local WebVTT `captions` path and a written transcript. The permanent `/blog/examples/content` page demonstrates original local media, captions, and a written transcript. It is noindex and excluded from published listings and feeds. It does not expose arbitrary drafts. The adapted release uses original MP4s in `public/blog-media/reacherx-v3`; see `MEDIA.md` for provenance. Video storage/delivery uses the hosting provider’s quotas. Verify actual browser playback when adding remote media: a successful HEAD response does not prove a CDN permits embedding.

Use `BlogGif` with `src`, `poster`, `alt`, `width`, `height`, and optional `caption`. Animation starts only when the reader presses Play and swaps back to the still poster offscreen. Use meaningful alt text for every image.

Use `BlogCallout` with an optional `title` and Markdown children. Leave blank lines around Markdown inside JSX.

## Discovery

Published content appears in `/sitemap.xml`, `/blog/feed.xml`, `/blog/sitemap.md`, and `/llms.txt`. `/blog/<slug>/markdown` supplies plain Markdown. A request to the article with `Accept: text/markdown` also returns Markdown; both formats share a canonical URL. Search-result URLs are marked `noindex, follow` in response headers.

Custom MDX components need a readable equivalent in `blogBodyMarkdown` if they communicate information beyond their children. Images, videos, and callout contents already have equivalents. Search matches titles, descriptions, and tags, not full article bodies.

The public page links remain available in server-rendered HTML. Live filtering uses only the small local post summary list; it never queries or downloads all records from Convex. The listing appends nine posts at a time using the application's shared infinite-scroll trigger, with its stock pending spinner and keyboard fallback. The `page` query parameter records how many batches are visible, so returning from an article restores the expanded list. Search and category changes start at the first batch.

Tables preserve readable text columns and scroll horizontally inside the article when needed. Use Markdown's right-aligned columns (`---:`) for numeric data; these stay compact and use the site's monospace numbers. Headers stay together, while prose cells wrap. Footnotes remain inside the article margins with native reference and return links.
