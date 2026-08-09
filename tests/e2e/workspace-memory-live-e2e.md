# Workspace memory live E2E evidence

Run on 2026-08-10 against `http://localhost:3000` and the configured Convex
development deployment. Workspace: `ReacherX (lead gen local)`. No production
data was changed.

## Save and Agent Ops readiness

- Save thread: `m5721f7q9k9fpathathymqkz0d8c4b78`
- Legacy/UI memory ID: `x9718ghznfqdvhz9ayfb9j3tcd8c4mrw`
- Exact value: `https://example.com/e2e-memory/pineglass-v1?token=RXM-20260810-A7C9`
- Observed: the Agent called the memory tool; Agent Ops showed the exact
  verbatim user instruction, `operator`, `active`, `ready`, and all six agent
  surfaces.
- Browser-discovered regression: the artifact link originally omitted
  `panel=memory`. Fixed by `buildAgentOpsMemoryHref` and preserved in
  `tests/agent-ops-memory-href.test.ts`.

## Duplicate save

- Duplicate thread: `m57559sr6ptqv3x5akwz0f28f58c41wg`
- Observed: the artifact resolved to the same memory ID
  `x9718ghznfqdvhz9ayfb9j3tcd8c4mrw`; Agent Ops still showed one saved row
  before the correction.

## New-task recall

- Recall thread: `m57f5qkfh3hnbph9xj2z4kgeys8c5e4d`
- Prompt: `What is the exact URL for the Pineglass handbook? Reply with only the URL.`
- Observed: exact byte-for-byte v1 URL returned without a memory-search tool
  request or repeated instruction.

## Correction and supersession

- Correction thread: `m570sjd5hkmqgad4ebrb3gg5kd8c5aqj`
- Corrected memory ID: `x97ekqta68skvxt395pdwb8mhn8c56c7`
- Corrected value: `https://example.com/e2e-memory/pineglass-v2?token=RXM-20260810-B4D2`
- Observed in Agent Ops: the v2 record was `active` and `ready`; opening the v1
  record showed `superseded` and `ready`.
- Post-correction recall thread: `m57dtxy09f51t8yh1gywxsjb2n8c561g`
- Observed: exact byte-for-byte v2 URL returned; v1 was not returned.

## Downstream prospect agent

- Prospect: Rahul, `p173d1sh3cdxez4775gbdhezrn89s848`
- Prospect-agent thread: `m57dtk50pyec9as5y24w27ymrx8c59fd`
- Observed: a fresh manual prospect-agent task returned the exact v2 URL
  without the instruction being repeated.

## Persistent automated coverage

- Canonical and dual-write idempotency, correction supersession, legacy
  fallback suppression, workspace isolation, surface/channel scoping, old
  exact recall, and operator precedence:
  `convex/workspaceMemory.integration.test.ts`
- Generic instruction compliance repair/fail-closed and setup/main scope:
  `convex/lib/workspaceMemoryCompliance.test.ts`
- Referential exact-source capture without unrelated-turn leakage:
  `tests/workspace-memory-capture.test.ts`
- All six delivery paths and compliance wiring:
  `tests/workspace-memory-delivery-wiring.test.ts`

Browser runs validate the live model/UI paths. Deterministic tests cover
workspace isolation and background generation paths that would mutate real
prospect plans if triggered through the live UI.
