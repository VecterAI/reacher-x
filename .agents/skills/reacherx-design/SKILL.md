---
name: reacherx-design
description: "Authoritative design and UI guidelines for ReacherX. Always use when designing, building, styling, or modifying any ReacherX page, panel, modal, drawer, chart, table, form, or React UI component. Takes precedence over generic design skills (including frontend-design) for all ReacherX product UI."
---

# ReacherX UI & Design Workflow

`DESIGN.md` at the repository root is the single source of truth for all ReacherX UI and UX. For any UI work in this repository, `DESIGN.md` overrides generic design skills (including `frontend-design`) and model defaults.

## Mandatory Steps

1. **Read `DESIGN.md` first** before designing or editing any UI component, page, or stylesheet.
2. **Run the pre-code composition pass** (Section 3 of `DESIGN.md`) and inspect the closest golden reference file (for example, `StatsOverview.tsx` / `ChartCard.tsx` for data views, `DmConversationHeader.tsx` / `ConversationMessageItem.tsx` for messaging views, `PageLayout.tsx` / `PageHeader.tsx` for page shells).
3. **Reuse existing mechanics:**
   - Semantic CSS tokens from `app/globals.css` (never hardcode hex or arbitrary Tailwind color palettes).
   - Shared UI primitives from `shared/ui/components/`.
   - Filled SVG icons from `@/shared/ui/components/icons` (never import `lucide-react`).
   - Workspace use-case labels from `useActiveUseCaseLabels` where applicable.
4. **Render, inspect, and revise privately** (Section 11 of `DESIGN.md`): render in a browser when available, verify desktop + mobile reflow, light + dark theme parity, subtraction of unnecessary chrome, plain normie-friendly copy (no em dashes, no technical jargon), and loading/empty/error states before handoff.
