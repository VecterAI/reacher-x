# Architecture

How ReacherX actually works, for humans and coding agents. The blog series explains each step in prose; this document is the accurate map.

The product watches X/Twitter and LinkedIn around the clock, finds people who fit what a workspace is looking for, builds context around them, and helps the user reach out. An agent can do all of it through conversation.

## The pipeline

Every workspace runs the same pipeline.

```text
workspace -> discovery -> qualification -> enrichment -> planning -> outreach
```

- Discovery turns the workspace's audience description into searches on X/Twitter and LinkedIn, and saves the people it finds.
- Qualification checks each person's evidence against structured criteria.
- Enrichment builds a fuller profile for the people who pass.
- Planning prepares an approach: research, drafts, and the steps to take.
- Outreach runs the plan with waits, approvals, and reactions to replies.

Not every person follows the whole path. Manual additions and setup previews can enter later, and records carry a `discoverySource` field that says how someone arrived.

## Where the code lives

ReacherX is a Next.js and React app with Convex for backend functions and data. Convex functions follow a three-layer rule.

- `convex/agents/tools/` are thin agent-facing wrappers. They resolve context and call shared operations. No business rules here.
- `convex/workflows/` orchestrate. Multi-step logic, waits, retries, and state checks live in files like `convex/workflows/prospecting.ts`, `qualification.ts`, `enrichment.ts`, `outreach.ts`, and `memory.ts`.
- `convex/lib/` holds core business logic. Names ending in `Core.ts` carry the rules: `qualificationCore.ts`, `qualificationScoringCore.ts`, `enrichmentCore.ts`, `outreachCore.ts`, `memoryCore.ts`, and so on.

When a fix applies to more than one caller, it belongs in the core, not in a tool or a workflow.

## The prospecting cycle

`convex/workflows/prospecting.ts` runs one complete cycle per workspace, then schedules the next run. Each cycle:

1. Checks the prospect limit against the plan.
2. Generates seed keywords with AI.
3. Sends them to Bishopi for keyword discovery.
4. Converts the results into social queries with AI.
5. Searches X/Twitter with performance-based query reuse.
6. Searches LinkedIn posts and people.
7. Saves prospects.
8. Qualifies the new prospects.
9. Schedules the next run through the completion handler.

Query quality is learned. `convex/lib/queryPrioritizationCore.ts` sorts queries into new, proven, learning, and cold groups based on recorded performance, so a query that keeps producing nothing stops consuming attention.

## Qualification

The evaluator works with structured criteria. Each criterion is required, preferred, or an exclusion, and each verdict must point at sources.

Scoring happens in plain TypeScript in `convex/lib/qualificationScoringCore.ts`. Four components build the score: profile fit 30, signal quality 30, intent strength 25, recency 15. The score ranks people. It is not a probability of a reply.

Two rules protect the result. A score only counts when it clears the threshold with no hard failure present. And a criterion that demands activity evidence is downgraded to `unknown` when the model claims a match without a source. Confident answers with no evidence do not count.

## Enrichment

`convex/workflows/enrichment.ts` runs `convex/lib/enrichmentCore.ts` inside Node actions for the platform APIs. The result carries profile fields, contact fields with their sources, and evidence posts.

Status is explicit: `enriched`, `partial`, or `failed`, with `pending` for skipped runs. Contact discovery goes through `convex/lib/contactDiscoveryCore.ts`, and profile links go through shared URL helpers rather than raw model output.

## Planning and outreach

Planning turns research into an approach. `convex/lib/autoPlanCore.ts` builds a grounded prompt, parses the answer, and validates every action against real people, posts, and channels. `convex/lib/outreachCore.ts` owns `createOutreachPlan`, which enforces one active plan per person and decides the starting status. Review is the default. An autonomous workspace auto-approves only when every account platform is ready.

`convex/workflows/outreach.ts` executes approved plans as durable work with waits, approvals, and retries. `convex/lib/adaptiveOutreachCore.ts` handles replies and reactions after a message goes out.

## Memory

Memory lets the agent improve over time. `convex/lib/memoryCore.ts` and `convex/lib/agentMemoryCore.ts` store instructions and lessons at the right scope, from a single prospect thread to the whole workspace. `convex/workflows/memory.ts` queues the work per workspace, and `convex/lib/memoryEvaluatorCore.ts` evaluates candidates and promotes the strong ones into durable lessons. Retrieval is bounded so old lessons cannot flood a conversation.

## Reporting

`convex/workspaceReporting.ts` and the read models turn recorded events into dashboards. Events carry UTC timestamps so ordering stays consistent everywhere, and each workspace's reporting time zone decides what "today" means on screen.

## Start here as a contributor

Read [development-setup.md](./development-setup.md) to get the app running, then pick one step of the pipeline and read its blog walkthrough. Every walkthrough links the exact files, and the same three-layer rule applies everywhere.
