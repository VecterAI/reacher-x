# ReacherX Design System (`DESIGN.md`)

Design and build UI for ReacherX. This document is the design authority for all ReacherX product interfaces.

**Precedence rule:** When building or editing any UI, page, panel, or component in this repository, `DESIGN.md` takes precedence over generic design skills (including `frontend-design`) and model defaults. Do not invent a new visual style, palette, font pairing, or component layer.

---

## 1. Product & Brand Character

ReacherX is a networking and relationship platform built for everyday people, not a loud sales dashboard.

- **Feel:** Minimal, calm, high-craft, neutral, and fast.
- **Clarity over decoration:** Build hierarchy through typography, alignment, and spacing before reaching for borders, cards, badges, or color.
- **Simplicity that hides complexity:** Make the main user action or answer immediately obvious without crowding the screen.
- **Adaptive domain language:** Use workspace use-case labels (`useActiveUseCaseLabels`) on workspace-scoped UI instead of hardcoding sales terms like "leads" or "deals".

---

## 2. Priority Order

When trade-offs compete, protect them in this order:

1. Preserve real user flows, data accuracy, keyboard accessibility, and responsive layout on both desktop and mobile.
2. Reuse existing page shells, semantic tokens (`app/globals.css`), shared UI primitives (`shared/ui/components/`), and icons (`@/shared/ui/components/icons`).
3. Make the primary task, state, or evidence immediately scannable with the least clutter.
4. Match ReacherX's monochrome, border-defined, flat visual language in both light and dark themes.
5. Polish spacing, alignment, empty/loading/error states, and subtle motion without adding visual noise.

---

## 3. Think Before Coding (Composition Pass)

Before writing JSX or CSS, pause and privately settle the structure:

1. **Frame the user's job:** What is the single main action, question, or state the user came here for? What supporting context helps without competing? What belongs tucked into a menu, drawer, or secondary view instead of crowding the canvas?
2. **Reject the lazy default:** Name the generic SaaS layout this feature would normally default to (for example, a bulky intro banner + floating metric cards + redundant summary box). Reject it unless the material actually earns it.
3. **Commit to one focal object:** Every screen or panel needs one clear visual anchor (a conversation stream, a unified stat strip, a chart, a composer, a list). Make supporting elements quieter instead of giving every block equal weight.
4. **Run the squint test:** Mentally blur the text. Identity, grouping, and the primary action should still read at a glance. If everything looks equally heavy, adjust typography, spacing, and contrast rather than adding borders or boxes.
5. **Keep one gap owner:** Let the parent container (`space-y-*`, `gap-*`, grid) own spacing between siblings. Avoid patching layout rhythm with competing one-off child margins.

---

## 4. Color, Theme, and Surfaces

ReacherX is monochrome-first in both themes.

- **Pure canvases:** Light mode uses pure white (`--background: 0 0% 100%`), dark mode uses pure black (`--background: 0 0% 0%`). Cards and popovers match `--background` (`--card`, `--popover`), separated by crisp `1px` `border-border` lines rather than tinted gray boxes or drop shadows.
- **Semantic tokens only:** Never hardcode hex/RGB colors or arbitrary Tailwind palettes (`bg-slate-*`, `text-gray-*`, `bg-blue-*`) for surfaces, borders, or text. Use the tokens defined in `app/globals.css`:
  - Surfaces: `bg-background`, `bg-card`, `bg-popover`, `bg-muted`, `bg-secondary`, `bg-accent`
  - Text: `text-foreground`, `text-muted-foreground`, `text-primary-foreground`
  - Borders & focus: `border-border`, `border-input`, `ring-ring`
- **Flat surfaces by default:** Pass `className="shadow-none"` on `Card` for dashboard cards, metric strips, and inline panels (`Card` defaults to `shadow-xs`). Reserve subtle elevation only for floating layers (`Popover`, `DropdownMenu`, `Tooltip`, `Dialog`).
- **Color is earned only by real meaning:**
  - **Destructive / attention / error:** `destructive` tokens (`text-destructive`, `border-destructive bg-destructive/10`) or `text-red-500` for negative trends and attention counts.
  - **Positive trend:** `text-emerald-600`, always paired with a directional cue (`ArrowUpwardIcon`, `+` prefix), never color alone.
  - **Platform identity:** `--platform-twitter-badge` and `--platform-linkedin-badge` via `ProspectPlatformAvatar` or platform badge tokens.
  - **Charts:** Monochrome grayscale ramp (`hsl(var(--chart-1))` through `hsl(var(--chart-5))`).
- **Light and dark parity:** Every new view must have clean contrast and hierarchy in both light and dark themes without custom theme hacks.

---

## 5. Typography & Rhythm

Fonts are configured in `app/fonts.ts` and `app/globals.css`.

- **`Geist Sans` (default):** All UI copy, headings, labels, controls, metrics, counts, percentages, dates, and tables.
- **`Geist Mono` (`font-mono`):** Only for code, commands, IDs, keyboard shortcuts, numeric tooltip values, and `Badge` `outline-strong` micro-tags. Never set normal sentences or paragraphs in Mono.
- **`Geist Pixel Square` (`font-pixel-square`):** Reserved strictly for intentional brand/marketing moments, never standard webapp UI chrome.
- **Heading tracking:** `h1` through `h6` inherit `letter-spacing: -0.04em` from `globals.css`. Use sentence case for page titles, section titles, tabs, buttons, and labels.
- **Standard type roles:**
  - Sticky header title (`PageHeader`): `text-sm font-medium truncate`
  - Section / card title (e.g. `ChartCard`): `text-lg font-medium`
  - Primary metric / KPI value: `text-3xl font-semibold tracking-tight tabular-nums`
  - Body, message bubbles, composer input: `text-sm` (`leading-[1.45]` in bubbles, `leading-5` in inputs, `leading-6` in error/empty copy)
  - Metadata, timestamps, chart ticks, helper text: `text-xs text-muted-foreground`
- **Numeric alignment:** Always add `tabular-nums` to metrics, percentages, counts, deltas, timers, and table columns. Use `AnimatedNumber` where live counts update.
- **Readability floor:** Never shrink readable UI copy below `text-xs` to make a dense layout fit. Reflow or simplify instead.

---

## 6. Layout, Shells, and Spacing

Use the shared webapp shell from `features/webapp/ui/components/page/` for every route and side panel:

- **`PageLayout`:** Standard contained column (`h-full w-full max-w-lg min-w-0 border-x-0`), or `flex max-w-none flex-col overflow-hidden border-none` for wide dashboards like `/analytics`.
- **`PageHeader`:** Sticky `min-h-10` bar (`bg-background sticky top-0 z-10 border-b px-4 py-1`) with optional `onBack`, `titleLeading` (e.g. avatar), `title`, `titleSuffix`, and right-aligned `actions`.
- **`PageScrollArea` / `PageContent`:** Full-width vertical scroll owner (`scroll-fade min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain`) with `p-4` outer padding and `space-y-4` vertical rhythm.
- **Side panel borders:** Panels rendered beside primary content must use `DESKTOP_PANEL_BORDER_CLASS_NAME` (`border-x-0 md:border-border md:border-l md:border-r-0`) so mobile stays edge-to-edge.
- **Unified strips over scattered boxes:** Group peer KPIs or related summary metrics into one flat `Card` separated by `1px` `bg-border` dividers (as in `StatsOverview.tsx`) instead of floating separate cards.
- **Spacing scale:**
  - `p-4` for page content and card interiors (`ChartCard`, `StatsOverview`, inline alerts)
  - `p-2` for compact bordered frames (such as `DmComposer`)
  - `gap-4` / `mt-4` / `space-y-4` between sibling cards, sections, and grid rows
  - `gap-2` or `gap-1.5` inside compact headers, button groups, and toolbars
- **Overflow safety:** Put `min-w-0` on flex and grid children that contain text, inputs, charts, or scroll areas. Truncate long header titles (`truncate`) rather than letting them push action buttons off-screen.
- **Responsive reflow:** Build mobile-first (`grid-cols-1`) and step up cleanly (`sm:grid-cols-2`, `lg:grid-cols-2`, `lg:grid-cols-4`). Mobile views must never require horizontal page scrolling or clip actions.

---

## 7. Components, Icons, and Key Surface Patterns

Always check `shared/ui/components/` before creating a new component.

### Shared Primitives

- **Actions & navigation:** `Button` (`default`, `outline`, `secondary`, `ghost`, `destructive`, `link`; sizes `xs`, `sm`, `default`, `lg`, `xsIcon`, `icon`), `Tabs` (`default` segmented list or `underline`; sizes `xs`, `sm`, `default`), `DropdownMenu`, `Command`, `Breadcrumb`.
- **Overlays & containers:** `Card`, `Dialog`, `AlertDialog`, `Drawer`, `Sheet`, `Popover`, `HoverCard`, `Tooltip`, `Separator`, `ScrollArea`.
- **Forms & feedback:** `Input`, `TextArea`, `Select`, `Checkbox`, `Switch`, `Form`, `FormField`, `Label`, `Badge`, `Alert`, `AppErrorState`, `Skeleton`, `Spinner`, `Sonner`.
- **Data & messaging:** `chart` (`ChartContainer`, `ChartTooltip`, `ChartTooltipContent`), `AnimatedNumber`, `Table`, `MessageBubble`, `Avatar`, `AvatarStack`, `ProspectPlatformAvatar`, `Timeline`.

### Icons

- Import icons exclusively from `@/shared/ui/components/icons` (`shared/ui/components/icons/index.tsx`).
- Do **not** import `lucide-react` (it is not installed) or add third-party icon kits.
- Apply `className="fill-current"` so icons inherit foreground/muted colors cleanly. Standard sizes: `size-4` in buttons and card headers, `size-3.5` in inline indicators, `size-3` in compact badges.

### Analytics & Data Surfaces

- Wrap charts in `ChartCard` (`shadow-none`, `p-4` header/content, `text-lg font-medium` title, `min-w-0` container).
- Strip chart chrome: set `tickLine={false}` and `axisLine={false}`, use monochrome `--chart-1..5` fills, subtle hover cursor (`hsl(var(--muted))`), and `ChartTooltipContent` with `font-mono tabular-nums` figures.
- Prefer zero-jump loading: render the full layout with zero/default values and let `AnimatedNumber` and charts transition smoothly when data arrives instead of replacing the screen with noisy skeletons.

### DM & Conversation Surfaces

- Use `DmConversationHeader` (`PageHeader` + `ProspectPlatformAvatar` with `size-7 ring-1 ring-border` avatar + subtle verification mark).
- Use `MessageBubble`: sent messages use high-contrast inverted `bg-foreground text-background`; received messages use `bg-muted text-foreground`. Use grouped corner radii (`first`, `middle`, `last`, `none`) with tighter vertical spacing inside a message group (`mb-1`) and looser spacing after metadata (`mb-3.5`).
- Separate days with `ConversationDaySeparator` (hairline `border-t` + centered `text-xs font-medium text-muted-foreground` label).
- Keep per-message actions quiet and anchored beside the bubble (`ConversationMessageActions`), and keep composer frames compact (`p-2`, `text-sm leading-5`).

---

## 8. Copy, States, and Motion

- **Plain normie-friendly copy:** Write short, direct sentences anyone can understand. Never expose technical or backend terms (Convex, mutation, action, schema, payload, webhook, HTTP status codes) in user-facing labels or error messages.
- **No em dashes:** Never use em dashes in in-app copy.
- **Complete states:** Every data-backed view must handle loading, empty, and error states cleanly:
  - Full-view failures: use `AppErrorState` with a clear title, plain description, and `Try again` action.
  - Inline section failures: use `border-destructive bg-destructive/10 rounded-lg border p-4` with `text-destructive text-sm font-medium` title, plain message, and a compact `Button variant="outline" size="sm"` retry action.
- **Restrained motion:** Motion should confirm state changes or keep continuity (`AnimatedNumber`, subtle fade-ins). Never add bounce, parallax, decorative pulsing, scroll-triggered reveals, or animation that delays reading. Always respect `prefers-reduced-motion`.

---

## 9. Reject AI Slop (Do Not Ship)

Never ship any of these patterns in ReacherX:

- Cards nested inside cards, or extra borders added to rescue weak hierarchy.
- Drop shadows on dashboard cards, stat strips, or inline panels.
- Decorative gradients, glows, mesh backgrounds, glass effects, noise textures, or colored accent side rails.
- Hardcoded hex/RGB values or non-semantic Tailwind colors (`bg-gray-50`, `text-slate-600`, `bg-indigo-500`) where CSS tokens exist.
- All-caps wide-tracked eyebrows/kickers above headings.
- Decorative icons placed inside colored square or circle tiles.
- Pills or badges used for ordinary metadata or plain text labels.
- Generic centered hero blocks followed by a 3-column feature card grid inside the webapp.
- Importing `lucide-react`, inline ad-hoc SVG icons that already exist in `@/shared/ui/components/icons`, or mixing icon styles.
- Em dashes, technical jargon in error messages, or hardcoded sales jargon on workspace views.
- Desktop-only grids, un-truncated header titles, or horizontal overflow on mobile screens.

---

## 10. Golden Reference Files

Before building a new surface, inspect the closest reference file and match its spacing, typography, tokens, and structure:

- **Tokens & fonts:** `app/globals.css`, `app/fonts.ts`
- **Page shell:** `features/webapp/ui/components/page/PageLayout.tsx`, `features/webapp/ui/components/page/PageHeader.tsx`, `features/webapp/ui/components/page/PageContent.tsx`, `features/webapp/ui/components/page/PageScrollArea.tsx`
- **Analytics & data UI:** `app/(webapp)/analytics/page.tsx`, `features/analytics/ui/AnalyticsDashboard.tsx`, `features/analytics/ui/components/StatsOverview.tsx`, `features/analytics/ui/components/ChartCard.tsx`, `features/analytics/ui/components/DateRangeSelector.tsx`, `features/analytics/ui/components/PipelineFunnelChart.tsx`
- **DM conversation & messaging UI:** `features/prospects/ui/components/DmConversationHeader.tsx`, `features/prospects/ui/components/conversation-message/ConversationMessageItem.tsx`, `features/prospects/ui/components/conversation-message/ConversationDaySeparator.tsx`, `shared/ui/components/MessageBubble.tsx`, `features/composer/ui/dmComposerClasses.ts`
- **Core primitives & error states:** `shared/ui/components/AppErrorState.tsx`, `shared/ui/components/Button.tsx`, `shared/ui/components/Card.tsx`, `shared/ui/components/Tabs.tsx`, `shared/ui/components/Badge.tsx`, `shared/ui/components/icons/index.tsx`

---

## 11. Render, Inspect, and Revise Privately

Do not judge a UI only by reading JSX. When browser tooling is available, render the actual result and inspect it in **desktop + mobile** viewports and **light (`#fff`) + dark (`#000`)** themes.

Review in this order:

1. **First read & squint test:** Is the primary action or information obvious immediately? Does one focal object lead while supporting elements recede?
2. **Reuse:** Did I use `PageLayout`/`PageHeader`, `shared/ui/components/`, `@/shared/ui/components/icons`, and semantic tokens from `app/globals.css`?
3. **Subtraction:** Can any card, border, shadow, badge, icon, wrapper, or line of copy be removed without losing clarity? If yes, remove it.
4. **Hierarchy & spacing ownership:** Are font roles, weights, `tabular-nums`, spacing (`p-4`, `gap-4`), and dividers aligned with the golden references, with one gap owner per container?
5. **Themes & responsive reflow:** Is contrast clean (WCAG AA) in both light and dark mode? Does mobile reflow cleanly with `min-w-0` safety and zero horizontal overflow or clipped actions?
6. **Copy & states:** Is all copy plain, concise, free of em dashes and technical jargon, with clean loading, empty, and error states?

Fix the highest-impact visual or usability defect, re-render, and repeat privately until no material issue remains. Deliver the clean implementation, not a self-critique log.
