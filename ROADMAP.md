# ReacherX Roadmap

This roadmap is here to make product direction clearer for contributors.

If you want to work on any roadmap item, please contact Salman first so ideas, UX, and architecture can be aligned before implementation.

[Email Salman](mailto:creativecoder.crco@gmail.com) · [Discord](https://discord.gg/76dF9NPH) · [GitHub Issues](https://github.com/VecterAI/reacher-x/issues) · [LinkedIn](https://www.linkedin.com/in/noobships)

## Now

### Reliability And Quality

- Improve reliability across existing X and LinkedIn workflows.
- Reduce rough edges in onboarding, local setup, and developer experience.
- Add stronger coverage for tests, error states, fallbacks, and operational diagnostics.
- Use tools such as React Doctor, Convex tooling, linting, audits, and targeted tests to make the codebase more robust and reliable.

### Evaluations And Benchmarks

- Build benchmarks for discovery quality.
- Build benchmarks for qualification quality.
- Build benchmarks for enrichment usefulness.
- Build benchmarks for outreach and plan quality.
- Make agent performance measurable over time instead of relying on intuition.

## Next

### Email Integration

Let users send emails directly from ReacherX.

Desired product shape:

- Users can write and send emails manually in the UI.
- Users can ask the agent to draft and send emails for them.
- ReacherX should support agent-assisted email workflows in the same spirit as existing social actions.

### Calendar Integration

Integrate Google Calendar and Outlook Calendar so users can book calls and meetings from inside ReacherX.

Desired product shape:

- Show calendar capabilities in the UI.
- Let users manually schedule meetings through the product.
- Let users ask the agent to book calls and meetings for them.
- Treat calendar actions similarly to other ReacherX actions: clear UX, clear control, agent-assisted execution.

### Cross-Platform Identity Resolution

Find the same prospect across multiple channels and surface that clearly in the product.

Desired product shape:

- Detect when multiple accounts belong to the same person.
- Show which platforms that person is on inside the prospect profile panel.
- Make that cross-channel view useful for research, outreach planning, and action selection.

### App-Originated Email Delivery

- Send product emails to users.
- Support workflow-driven notifications and lifecycle emails.
- Improve delivery and reliability for important product communication.

### File And Image Uploads

- Let users upload files and images for the agent.
- Support richer context and better agent reasoning from uploaded artifacts.

## Later

### More Platforms

- Reddit
- Bluesky
- Threads

### Sub-Agents And Agent Swarms

- Spawn sub-agents in parallel.
- Let specialized agents complete different actions or research tasks at the same time.
- Explore swarm-style execution for bigger workflows.

## Help Wanted

These are especially good areas for contributors, after alignment:

- evaluations and benchmarks
- local-dev experience
- docs and contributor onboarding
- platform integrations
- identity resolution
- frontend polish and accessibility
- observability, robustness, and testing
