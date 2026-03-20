# Your agents decide. We make it happen

- [COMPOSIOFOR YOU](https://rube.composio.dev/?utm_source=landing-page&utm_campaign=navbar)
- [PLATFORM](https://platform.composio.dev/?utm_source=landing-page&utm_campaign=navbar)
- [ENTERPRISE](/enterprise)
- [BLOG](/blogs)
- [DOCS](https://docs.composio.dev/?utm_source=landing-page&utm_campaign=navbar)

[](https://x.com/composio)[](https://www.linkedin.com/company/composiohq/)[](https://github.com/composiohq/composio/)[](https://dub.composio.dev/discord)[](https://www.youtube.com/@Composio)

# Your agent decides

what to do.

We handle the rest.

Just-in-time tool calls, secure delegated auth, sandboxed environments, and parallel execution across 1,000+ apps.

[START BUILDING TODAY](https://platform.composio.dev/?utm_source=landing-page&utm_campaign=hero-cta)

---

- ![agent.ai](/clients/logo-agentai.svg)
- ![Context](/clients/logo-context.svg)
- ![Zoom](/clients/logo-zoom.png)
- ![Letta](/clients/logo-letta.svg)
- ![Glean](/clients/logo-glean.svg)
- ![HubSpot](/clients/logo-hubspot.svg)
- ![Wabi](/clients/logo-wabi.svg)

- ![agent.ai](/clients/logo-agentai.svg)
- ![Context](/clients/logo-context.svg)
- ![Zoom](/clients/logo-zoom.png)
- ![Letta](/clients/logo-letta.svg)
- ![Glean](/clients/logo-glean.svg)
- ![HubSpot](/clients/logo-hubspot.svg)
- ![Wabi](/clients/logo-wabi.svg)

- ![agent.ai](/clients/logo-agentai.svg)
- ![Context](/clients/logo-context.svg)
- ![Zoom](/clients/logo-zoom.png)
- ![Letta](/clients/logo-letta.svg)
- ![Glean](/clients/logo-glean.svg)
- ![HubSpot](/clients/logo-hubspot.svg)
- ![Wabi](/clients/logo-wabi.svg)

## Watch Composio In Action

[ADD TO MY AGENT](https://docs.composio.dev/?utm_source=landing-page&utm_campaign=hero-add-to-agent)

![Claude](/images/clients/claude.svg)Claude Cowork

Summarize everything important from Slack in the last 48 hours and send a digest to #daily-digest

Reply...

Sonnet 4.6

composio_search_tools

search tools...

![gmail](https://logos.composio.dev/api/gmail)

GMAIL_SEND_EMAIL

Send an email via Gmail

![slack](https://logos.composio.dev/api/slack)

SLACK_LIST_CHANNELS

List channels in workspace

![github](https://logos.composio.dev/api/github)

GITHUB_CREATE_PR

Create a pull request

Plan

1Authenticate user

2Execute tool call

Warnings

!Check rate limits

!Verify permissions

composio_manage_connections

USER_ID: usr_9x2kLm7

![Slack](https://logos.composio.dev/api/slack)

SlackOAuth 2.0

—

composio_execute_tool

SESSION: —

![notion](https://logos.composio.dev/api/notion)NOTION_CREATE_PAGE

dbTasks

titleQ4 roadmap

200 OK · page created

AGENT_CONFIG

AGENTClaude Cowork

PROVIDERAnthropic

MODELclaude-sonnet-4-6

composio_sandbox

sandbox · python 3.11

instance-0

completed

data = run_composio_tool(
'NOTION_QUERY_DB',
database='Tasks'
)
results = invoke_llm(
f'Summarize {len(data)} items'
)

instance-1

completed

pages = run_composio_tool(
'NOTION_LIST_PAGES',
limit=50
)
for p in pages:
proxy_execute(p\['url'\])

WHY COMPOSIO

## Your agents are smart.

Their tools should be too.

01SMART TOOLS02CONSTANT EVOLUTION03END USER AUTH04DYNAMIC SANDBOX

01SMART TOOLS02CONSTANT EVOLUTION03END USER AUTH04DYNAMIC SANDBOX

list sentry errors and create linear issues3 found

![sentry](https://logos.composio.dev/api/sentry)

SENTRY_LIST_ISSUES

List unresolved issues in a project

match

![sentry](https://logos.composio.dev/api/sentry)

SENTRY_GET_EVENT

Get error event details and stack trace

match

![linear](https://logos.composio.dev/api/linear)

LINEAR_CREATE_ISSUE

Create a new issue in Linear

Plan

1Fetch all open Sentry issues

2Classify severity in sandbox

3Create Linear issues for P0s

Warnings

!Sentry project slug required

!Linear team ID must be configured

01

### Search that thinks

Save your agent's context for what matters. Only give it the right tools, at the right time.

Tools resolved by intent, not configuration

Proposed execution plans for complex workflows

Built-in guardrails so your agent gets it right the first time

![gmail](https://logos.composio.dev/api/gmail)GMAIL_SEND_EMAILv2.1.3

to:"john <john@acme.com>"

400Invalid recipient format: display name not allowed in "to" field

![composio](/logos/composio-white.svg)Auto-Fix Agent

Detected pattern: 12% of GMAIL_SEND_EMAIL calls fail on recipient format

Strip display names from recipient field before API callv2.1.4 published

![gmail](https://logos.composio.dev/api/gmail)GMAIL_SEND_EMAILv2.1.4

to:"john <john@acme.com>"

200Sent to john@acme.com · ID: 18f2a3b4c5d

02

### Tools that learn

Your tools get sharper every day. Real agent behavior at scale is what makes Composio tools the most accurate available.

Accuracy driven by millions of real-world tool calls

Account-level optimization for your usage patterns

API-stable, agent-optimized

Agent Chat

connected

You

List my open PRs on GitHub and summarize what needs review.

Agent

composio_manage_connectionsNot Connected

I need access to your GitHub account to fetch your PRs.

![github](https://logos.composio.dev/api/github)

GitHubscope: repo, read:org

Connect

Ask your agent something...

03

### Auth that works

Stop debugging auth flows. Composio handles OAuth end-to-end: on the fly, scoped to exactly what your agent needs.

Fully managed OAuth for every connector, out of the box

Inline auth triggered by user intent, not pre-configured

Granular permission scoping that tightens as you go

Fetch & triage errors

exit 0

issues = run_composio_tool(
'SENTRY_LIST_ISSUES',
project='api-prod',
status='unresolved'
)

for issue in issues:
issue\['trace'\] = run_composio_tool(
'SENTRY_GET_EVENT',
issue_id=issue\['id'\]
)

ranked = invoke_llm(
f'Classify these {len(issues)} errors.'
' Return P0/P1/P2 with reasoning.'
)

for error in ranked\['P0'\]:
run_composio_tool(
'LINEAR_CREATE_ISSUE',
title=error\['title'\],
team_id='ENG',
priority=1
)

47 errors triaged → 5 P0, 12 P1, 30 P2

✓ 5 Linear issues created (LIN-482 → LIN-486)

04

### Programatic execution

Remote sandboxed environments where tools run as code and results live in a navigable filesystem.

Compose tools as code. Multi-step workflows, sub-LLM invocations

Large responses stored on a remote filesystem your agent can browse

Secure, ephemeral sandboxes for every execution

ZERO CODE TO FULL CONTROL

## One product, every workflow

ComposioFOR YOU

Turn Claude Code, Cursor, or any MCP client into an agent that executes across all your apps. Go from asking questions to doing work.

Every tool comes production-ready — authenticated, optimized, and reliable. No setup required.

[LEARN MORE](https://rube.composio.dev/?utm_source=landing-page&utm_campaign=composio-for-you-card)

user — ✻ Claude Code — claude

██████╗██╗ █████╗ ██╗ ██╗██████╗ ███████╗ ██╔════╝██║ ██╔══██╗██║ ██║██╔══██╗██╔════╝ ██║ ██║ ███████║██║ ██║██║ ██║█████╗ ██║ ██║ ██╔══██║██║ ██║██║ ██║██╔══╝ ╚██████╗███████╗██║ ██║╚██████╔╝██████╔╝███████╗ ╚═════╝╚══════╝╚═╝ ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝ ██████╗ ██████╗ ██████╗ ███████╗ ██╔════╝██╔═══██╗██╔══██╗██╔════╝ ██║ ██║ ██║██║ ██║█████╗ ██║ ██║ ██║██║ ██║██╔══╝ ╚██████╗╚██████╔╝██████╔╝███████╗ ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝

v2.1.50

Opus 4.6 · Claude Max

/Users/dev/projects/app

❯try "fix lint errors"

? for shortcuts/ide for Cursor

![github](https://logos.composio.dev/api/github)![slack](https://logos.composio.dev/api/slack)

Create a PR and post to #engineering

![stripe](https://logos.composio.dev/api/stripe)

Generate an invoice from Stripe

![gmail](https://logos.composio.dev/api/gmail)

Draft replies to this week's emails

![stripe](https://logos.composio.dev/api/stripe)![slack](https://logos.composio.dev/api/slack)

Pull revenue data and send report

![sentry](https://logos.composio.dev/api/sentry)![slack](https://logos.composio.dev/api/slack)

Monitor uptime and alert on Slack

![slack](https://logos.composio.dev/api/slack)

Summarize unread messages

![hubspot](https://logos.composio.dev/api/hubspot)

Sync CRM contacts to spreadsheet

ComposioPLATFORM

Your agent has the intelligence. Now let it execute. Go from chatbot to general-purpose agent in five lines of code.

```
tools = session.tools()
agent = Agent(
  name="Assistant",
  tools=tools,
)
```

[LEARN MORE](https://platform.composio.dev/?utm_source=landing-page&utm_campaign=composio-platform-card)

Support Agent

![notion](https://logos.composio.dev/api/notion)![github](https://logos.composio.dev/api/github)![slack](https://logos.composio.dev/api/slack)

Resolved GH-482

Email Agent

![gmail](https://logos.composio.dev/api/gmail)![googlecalendar](https://logos.composio.dev/api/googlecalendar)

Archived 12 threads

Slack Agent

![slack](https://logos.composio.dev/api/slack)![googledocs](https://logos.composio.dev/api/googledocs)

Synced channel topic

SQL Agent

![supabase](https://logos.composio.dev/api/supabase)![googlesheets](https://logos.composio.dev/api/googlesheets)

Optimized slow query

Code Review Agent

![github](https://logos.composio.dev/api/github)![linear](https://logos.composio.dev/api/linear)

Approved PR #131

Research Agent

![firecrawl](https://logos.composio.dev/api/firecrawl)![notion](https://logos.composio.dev/api/notion)

Summarized findings

FOR DEVELOPERS

░█████╗░░█████╗░███╗░░░███╗██████╗░░█████╗░░██████╗██╗░█████╗░░░░░░░██████╗██████╗░██╗░░██╗

██╔══██╗██╔══██╗████╗░████║██╔══██╗██╔══██╗██╔════╝██║██╔══██╗░░░░░██╔════╝██╔══██╗██║░██╔╝

██║░░╚═╝██║░░██║██╔████╔██║██████╔╝██║░░██║╚█████╗░██║██║░░██║░░░░░╚█████╗░██║░░██║█████═╝░

██║░░██╗██║░░██║██║╚██╔╝██║██╔═══╝░██║░░██║░╚═══██╗██║██║░░██║░░░░░░╚═══██╗██║░░██║██╔═██╗░

╚█████╔╝╚█████╔╝██║░╚═╝░██║██║░░░░░╚█████╔╝██████╔╝██║╚█████╔╝░░░░░██████╔╝██████╔╝██║░╚██╗

░╚════╝░░╚════╝░╚═╝░░░░░╚═╝╚═╝░░░░░░╚════╝░╚═════╝░╚═╝░╚════╝░░░░░░╚═════╝░╚═════╝░╚═╝░░╚═╝

## The SDK your agents need

[TRY IT OUT](https://platform.composio.dev/?utm_source=landing-page&utm_campaign=sdk-section-cta)

### Managed Auth

OAuth, API keys, token refresh, lifecycle management. We handle all of it so you never think about auth again.

[LEARN MORE](https://docs.composio.dev/docs/authentication)

![Managed authentication illustration](/_next/image?url=%2Fimages%2Fsdk-features%2Fmanaged-auth-art.png&w=750&q=75)

### Triggers

Bidirectional communication with your apps to keep your agents informed.

[LEARN MORE](https://docs.composio.dev/docs/triggers)

![Triggers illustration](/_next/image?url=%2Fimages%2Fsdk-features%2Ftriggers-art.png&w=750&q=75)

### Context Aware Sessions

session.py

1session = composio.create(user_id\="user_123")

2tools = session.tools()

3connection = session.authorize("github")

Every session carries full context — sandbox state, files, progress. Your agent never starts from scratch.

[LEARN MORE](https://docs.composio.dev/docs/users-and-sessions)

### Model & Framework Agnostic

Mistral

No lock-in. Swap models based on cost, capability, or use case. Your tools and auth carry over, zero rework.

[LEARN MORE](https://docs.composio.dev/docs/providers)

SAFETY & SECURITY

## Protected from every angle with first-in-class security

![](/images/security/holographic-1.png)![](/images/security/holographic-2.png)

Team controls

-

Zero Day Log Retention

-

SOC2 & ISO 27001:2022

Enterprise-grade compliance certifications to meet your security requirements

−

Bring your own cloud

-

[LEARN MORE ABOUT OUR SECURITY](https://trust.composio.dev/?utm_source=landing-page&utm_campaign=security-section)

[LEARN MORE ABOUT OUR SECURITY](https://trust.composio.dev/?utm_source=landing-page&utm_campaign=security-section)

OUR COMMUNITY

## Top teamsAgents from Extra Thursdaychoose Composio

STORIES

Opennote→Deepgram→Extra Thursday→

[ALL COMMUNITY STORIES](/case-studies)

“As a solo builder, shipping fast is life or death. The only way I can outcompete incumbents is by outmanoeuvring them. Getting bogged down in managing agent auth would have been a death sentence”

![Extra Thursday logo](/_next/image?url=%2Fimages%2Fcommunity%2Fextra-thursday-logo.png&w=384&q=75)

![Ryan Yu](/_next/image?url=%2Fimages%2Fcommunity%2Fryan-yu.png&w=640&q=75)

Ryan YuFounder | Extra Thursday

[ALL COMMUNITY STORIES](/case-studies)

## Your agents are ready.

Are you?

[TRY COMPOSIO TODAY](https://platform.composio.dev/?utm_source=landing-page&utm_campaign=homepage-cta)
