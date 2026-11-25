# ReacherX Agent Instructions

Read and follow `agents.md` before editing this repository. Its mandatory
authentication and routing contract applies to every change touching AuthKit,
the proxy, `/`, `/agent`, `/agent/setup`, workspace setup, or thread URLs.

When designing, building, or editing any UI, page, layout, or component,
**always read `DESIGN.md` first**. It is the design authority for ReacherX and
overrides generic design skills (including `frontend-design`) and model
defaults.

Never treat a loading auth state as anonymous, and never make `/` plus a
client-side skeleton redirect the normal post-signup path. Acquisition signup
flows must carry their validated destination through WorkOS `returnTo` state.
All landing login/signup/acquisition touchpoints must use `LandingAuthLink`;
never add a raw landing `Link` or router navigation to those auth routes, and
never delay auth navigation while waiting for Convex requests.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
