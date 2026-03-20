# Linkedin MCP Integration for AI Agents | Composio

[Home](https://composio.dev)

[All Toolkits](/toolkits)

Linkedin

# Linkedin Integration for AI Agents

Securely connect your AI agents and chatbots (Claude, ChatGPT, Cursor, etc) with Linkedin MCP or direct API to search profiles, post updates, manage messages, and analyze connections through natural language.

[GET STARTED FOR FREE](https://platform.composio.dev/auth?utm_source=toolkits&utm_medium=hero&utm_campaign=get_started&utm_content=%2Ftoolkits%2Flinkedin)

![Linkedin Logo](https://logos.composio.dev/api/linkedin)

![Gradient Top](/toolkits/_next/image?url=%2Ftoolkits%2Fgraphics%2Fgradient_3.png&w=3840&q=75)

![Gradient Middle](/toolkits/_next/image?url=%2Ftoolkits%2Fgraphics%2Fgradient_2.png&w=3840&q=75)

![Gradient Bottom](/toolkits/_next/image?url=%2Ftoolkits%2Fgraphics%2Fgradient_1.png&w=3840&q=75)

![divider](/toolkits/_next/image?url=%2Ftoolkits%2Fgraphics%2Fdivider.png&w=3840&q=75)

![Linkedin](https://logos.composio.dev/api/linkedin)

LinkedIn is a professional networking platform for connecting, sharing content, and engaging with business opportunities. It's the go-to place for building your professional brand and unlocking new career connections.

Category[

marketing & social media

](/toolkits/category/marketing-social-media)

4 TOOLS

oauth2

Managed by![Composio](/toolkits/_next/image?url=%2Ftoolkits%2Flogo.svg&w=256&q=75)

### Connect Linkedin without Auth hassles

We manage OAuth, API Key, token refresh, and scopes, you just build.

[Try for Free](https://platform.composio.dev/auth?next_page=%2Ftool-router%3Ftoolkits%3Dlinkedin&utm_source=toolkits&utm_medium=sidebar_cta&utm_campaign=tool_router&utm_content=%2Ftoolkits%2Flinkedin)

## Try Linkedin now

Enter a prompt below to test the integration in our Tool Router playground. You'll be redirected to sign in and try it live.

Fetch company pages I can manage

Share a new post about our product launchDelete my last published LinkedIn postFetch company pages I can manageGet my LinkedIn profile headline

## Supported Tools

Tools

Create a LinkedIn postCreates a new post on linkedin for the authenticated user or an organization they manage; ensure the user has necessary permissions if posting for an organization.

Delete LinkedIn PostDeletes a specific linkedin post (share) by its unique \`share id\`, which must correspond to an existing share.

Get company infoRetrieves organizations where the authenticated user has specific roles (acls), to determine their management or content posting capabilities for linkedin company pages.

Get my infoFetches the authenticated linkedin user's profile, notably including the 'author id' required for attributing content such as posts or articles.

## Connect Linkedin MCP Tool with your Agent

Python

TypeScript

1

#### Install Composio

typescript

Copy

```
npm install @composio/core ai @ai-sdk/openai @ai-sdk/mcp
```

Install the Composio SDK and Claude Agent SDK

2

#### Create Tool Router Session

typescript

Copy

```
import { Composio } from '@composio/core';

const composio = new Composio({ apiKey: 'your-api-key' });

console.log("Creating Tool Router session...");
const { mcp } = await composio.create('your-user-id');
console.log(`Tool Router session created: ${mcp.url}`);
```

Initialize the Composio client and create a Tool Router session

3

#### Connect to AI Agent

typescript

Copy

```
import { openai } from '@ai-sdk/openai';
import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp';
import { generateText, stepCountIs } from 'ai';

const client = await createMCPClient({
  transport: {
    type: 'http',
    url: mcp.url,
    headers: { 'x-api-key': 'your-composio-api-key' }
  }
});

const tools = await client.tools();

const { text } = await generateText({
  model: openai('gpt-4o'),
  tools,
  messages: [{ role: 'user', content: 'Create a LinkedIn post announcing our product launch' }],
  stopWhen: stepCountIs( 5 )
});

console.log(`Agent: ${text}`);
```

Use the MCP server with your AI agent

## Connect Linkedin API Tool with your Agent

## Why Use Composio?

1

#### AI Native Linkedin Integration

- Supports both Linkedin MCP and direct API based integrations
- Structured, LLM-friendly schemas for reliable tool execution
- Rich coverage for reading, writing, and querying your Linkedin data

2

#### Managed Auth

- Built-in OAuth handling with automatic token refresh and rotation
- Central place to manage, scope, and revoke Linkedin access
- Per user and per environment credentials instead of hard-coded keys

3

#### Agent Optimized Design

- Tools are tuned using real error and success rates to improve reliability over time
- Comprehensive execution logs so you always know what ran, when, and on whose behalf

4

#### Enterprise Grade Security

- Fine-grained RBAC so you control which agents and users can access Linkedin
- Scoped, least privilege access to Linkedin resources
- Full audit trail of agent actions to support review and compliance

## Use Linkedin with any AI Agent Framework

Choose a Framework you want to connect Linkedin with

[

![OpenAI Agents SDK](/toolkits/_next/image?url=https%3A%2F%2Fimg.logo.dev%2Fname%2Fopenai%3Ftoken%3Dpk_UP7d_UulRqeTXQ30RpyZ5Q&w=256&q=75)

### OpenAI Agents SDK

Use Linkedin MCP with OpenAI Agents SDK

](/toolkits/linkedin/framework/open-ai-agents-sdk)[

![Claude Agents SDK](/toolkits/_next/image?url=https%3A%2F%2Fimg.logo.dev%2Fname%2Fclaude%3Ftoken%3Dpk_UP7d_UulRqeTXQ30RpyZ5Q&w=256&q=75)

### Claude Agents SDK

Use Linkedin MCP with Claude Agents SDK

](/toolkits/linkedin/framework/claude-agents-sdk)[

![Claude Code](/toolkits/_next/image?url=https%3A%2F%2Fimg.logo.dev%2Fname%2Fclaude%3Ftoken%3Dpk_UP7d_UulRqeTXQ30RpyZ5Q&w=256&q=75)

### Claude Code

Use Linkedin MCP with Claude Code

](/toolkits/linkedin/framework/claude-code)[

![Codex](/toolkits/_next/image?url=https%3A%2F%2Fimg.logo.dev%2Fname%2Fopenai%3Ftoken%3Dpk_UP7d_UulRqeTXQ30RpyZ5Q&w=256&q=75)

### Codex

Use Linkedin MCP with Codex

](/toolkits/linkedin/framework/codex)[

![OpenClaw](/toolkits/_next/image?url=%2Ftoolkits%2Fopenclaw%2Fopenclaw-logo.png&w=256&q=75)

### OpenClaw

Use Linkedin MCP with OpenClaw

](/toolkits/linkedin/framework/openclaw)[

![Google ADK](/toolkits/_next/image?url=https%3A%2F%2Fimg.logo.dev%2Fname%2Fgoogle%3Ftoken%3Dpk_UP7d_UulRqeTXQ30RpyZ5Q&w=256&q=75)

### Google ADK

Use Linkedin MCP with Google ADK

](/toolkits/linkedin/framework/google-adk)[

![Langchain](/toolkits/_next/image?url=%2Ftoolkits%2Flogos%2Fhero%2Flangchain.svg&w=256&q=75)

### Langchain

Use Linkedin MCP with Langchain

](/toolkits/linkedin/framework/langchain)[

![AI SDK](/toolkits/_next/image?url=https%3A%2F%2Fimg.logo.dev%2Fname%2Fvercel%3Ftoken%3Dpk_UP7d_UulRqeTXQ30RpyZ5Q&w=256&q=75)

### AI SDK

Use Linkedin MCP with AI SDK

](/toolkits/linkedin/framework/ai-sdk)[

![Mastra AI](/toolkits/_next/image?url=https%3A%2F%2Fimg.logo.dev%2Fname%2Fmastra%3Ftoken%3Dpk_UP7d_UulRqeTXQ30RpyZ5Q&w=256&q=75)

### Mastra AI

Use Linkedin MCP with Mastra AI

](/toolkits/linkedin/framework/mastra-ai)[

![LlamaIndex](/toolkits/_next/image?url=https%3A%2F%2Fimg.logo.dev%2Fname%2Fllamaindex%3Ftoken%3Dpk_UP7d_UulRqeTXQ30RpyZ5Q&w=256&q=75)

### LlamaIndex

Use Linkedin MCP with LlamaIndex

](/toolkits/linkedin/framework/llama-index)[

![CrewAI](/toolkits/_next/image?url=https%3A%2F%2Fimg.logo.dev%2Fname%2Fcrewai%3Ftoken%3Dpk_UP7d_UulRqeTXQ30RpyZ5Q&w=256&q=75)

### CrewAI

Use Linkedin MCP with CrewAI

](/toolkits/linkedin/framework/crew-ai)[

![Pydantic AI](/toolkits/_next/image?url=https%3A%2F%2Fimg.logo.dev%2Fname%2Fpydantic%3Ftoken%3Dpk_UP7d_UulRqeTXQ30RpyZ5Q&w=256&q=75)

### Pydantic AI

Use Linkedin MCP with Pydantic AI

](/toolkits/linkedin/framework/pydantic-ai)[

![Autogen](/toolkits/_next/image?url=https%3A%2F%2Fimg.logo.dev%2Fname%2Fautogenai%3Ftoken%3Dpk_UP7d_UulRqeTXQ30RpyZ5Q&w=256&q=75)

### Autogen

Use Linkedin MCP with Autogen

](/toolkits/linkedin/framework/autogen)

## Explore Other Toolkits

[

![Active campaign](https://composio.dev/toolkits/_next/image?url=https%3A%2F%2Flogos.composio.dev%2Fapi%2Factive_campaign&w=96&q=75)

### Active campaign

API Key

ActiveCampaign is a marketing automation and CRM platform for managing email campaigns, sales pipelines, and customer segmentation. It helps businesses engage customers and drive growth through smart automation and targeted outreach.

](/toolkits/active_campaign)[

![ActiveTrail](https://composio.dev/toolkits/_next/image?url=https%3A%2F%2Flogos.composio.dev%2Fapi%2Factive_trail&w=96&q=75)

### ActiveTrail

Api Key

ActiveTrail is a user-friendly email marketing and automation platform. It helps you reach subscribers and automate campaigns with ease.

](/toolkits/active_trail)[

![Ahrefs](https://composio.dev/toolkits/_next/image?url=https%3A%2F%2Flogos.composio.dev%2Fapi%2Fahrefs&w=96&q=75)

### Ahrefs

API Key

Ahrefs is an SEO and marketing platform for site audits, keyword research, and competitor insights. It helps you improve search rankings and drive organic traffic.

](/toolkits/ahrefs)Load More[TOOLKIT MARKETPLACE](/toolkits)

## Frequently Asked Questions

### Do I need my own developer credentials to use Linkedin with Composio?

No, you can get started immediately using Composio's built-in Linkedin app. For production, we recommend configuring your own OAuth credentials.

### Can I use multiple toolkits together?

Yes! Composio's Tool Router enables agents to use multiple toolkits. [Learn more](https://docs.composio.dev/tool-router/overview).

### Is Composio secure?

Composio is SOC 2 and ISO 27001 compliant with all data encrypted in transit and at rest. [Learn more](https://trust.composio.dev).

### What if the API changes?

Composio maintains and updates all toolkit integrations automatically, so your agents always work with the latest API versions.

![](/toolkits/_next/image?url=%2Ftoolkits%2Fgraphics%2Fprefooter.png&w=3840&q=100)

### Used by agents from

![Context](/toolkits/logos/context.svg)

![Letta](/toolkits/logos/letta.svg)

![glean](/toolkits/logos/glean.svg)

![HubSpot](/toolkits/logos/hubspot.svg)

![Agent.ai](/toolkits/logos/agent-ai.svg)

![Altera](/toolkits/logos/altera.png)

![DataStax](/toolkits/logos/datastax.svg)

![Entelligence](/toolkits/logos/entelligence.svg)

![Rolai](/toolkits/logos/rolai.svg)

![Context](/toolkits/logos/context.svg)

![Letta](/toolkits/logos/letta.svg)

![glean](/toolkits/logos/glean.svg)

![HubSpot](/toolkits/logos/hubspot.svg)

![Agent.ai](/toolkits/logos/agent-ai.svg)

![Altera](/toolkits/logos/altera.png)

![DataStax](/toolkits/logos/datastax.svg)

![Entelligence](/toolkits/logos/entelligence.svg)

![Rolai](/toolkits/logos/rolai.svg)

![Context](/toolkits/logos/context.svg)

![Letta](/toolkits/logos/letta.svg)

![glean](/toolkits/logos/glean.svg)

![HubSpot](/toolkits/logos/hubspot.svg)

![Agent.ai](/toolkits/logos/agent-ai.svg)

![Altera](/toolkits/logos/altera.png)

![DataStax](/toolkits/logos/datastax.svg)

![Entelligence](/toolkits/logos/entelligence.svg)

![Rolai](/toolkits/logos/rolai.svg)

## Never worry about agent reliability

We handle tool reliability, observability, and security so you never have to second-guess an agent action.

[Book a call↗](https://calendly.com/thomas-composio/composio-enterprise-setup)[Get started for free](https://platform.composio.dev/auth?utm_source=toolkits&utm_medium=prefooter&utm_campaign=get_started&utm_content=%2Ftoolkits%2Flinkedin)

[

![Harsha Gaddipati](https://framerusercontent.com/images/ksfmhdIvvsrIYpFxJGE6n4jxn4.jpeg?scale-down-to=512&width=800&height=800)

Harsha GaddipatiCo-founder, Slashy

Karan skipped his own birthday party to fix our critical issue. It was 10 pm and he diverted his Waymo to help us instead. This really sets the bar, shows you the commitment you need to have when users rely on your software.

](https://composio.dev/case-study/slashy)

[

![Abhi Arya](https://framerusercontent.com/images/v3e0DD6Dv0K1MpmtfaZB8uiaPM.jpeg?width=460&height=415)

Abhi AryaCo-founder, Opennote

A lot of students tell us that the moment their connected tools start talking to each other inside Opennote feels almost magical. The agent just knows them, and it has immensely helped in keeping new users on the platform.

](https://composio.dev/case-study/opennote)

[

![Nirman Dave](https://framerusercontent.com/images/NZtGsbyju0w9cTEQwzVx61rp0.jpeg?width=135&height=126)

Nirman DaveCEO, Zams

We chose Composio over Pipedream because it delivered depth where it mattered. It supported niche tools and tricky edge cases that other platforms simply ignored. Giving us confidence to scale without compromising.

](https://composio.dev/case-study/zams)

[

![Ryan Yu](https://framerusercontent.com/images/FVkqAhM0PmgE9Raa6PiL4SZXg5M.png?width=400&height=400)

Ryan YuFounder, Extra Thursday

As a solo builder, shipping fast is life or death. The only way I can outcompete incumbents is by outmanoeuvring them. Getting bogged down in the complexities of managing agent auth would have been a death sentence for Extra Thursday.

](https://composio.dev/case-study/extra-thursday-case-study)

[

![Tomisin Jenrola](https://framerusercontent.com/images/exP379yyvCbyCr13jaxXRbTalQ.jpg?scale-down-to=512&width=720&height=576)

Tomisin JenrolaFounder & CEO, SwarmZero

Before partnering with Composio, adding tool integrations was a slow, resource-intensive process. Each integration could take weeks or months of engineering time, and maintaining them meant constantly keeping up with API changes.

](https://composio.dev/case-study/swarmzero-case-study)

[

![Jerome Leclanche](https://framerusercontent.com/images/H0SflKVCqiXBqwUqkeik9QUhFo.webp?width=300&height=400)

Jerome LeclancheCo-Founder, Ingram Technologies

With hands-on help from their founder, we integrated Gmail and Google Drive in just 30 minutes. This level of personal support and commitment is exactly what startups should strive for.

](https://composio.dev/case-study/ingram-case-study)

[

![Harsha Gaddipati](https://framerusercontent.com/images/ksfmhdIvvsrIYpFxJGE6n4jxn4.jpeg?scale-down-to=512&width=800&height=800)

Harsha GaddipatiCo-founder, Slashy

Karan skipped his own birthday party to fix our critical issue. It was 10 pm and he diverted his Waymo to help us instead. This really sets the bar, shows you the commitment you need to have when users rely on your software.

](https://composio.dev/case-study/slashy)

[

![Abhi Arya](https://framerusercontent.com/images/v3e0DD6Dv0K1MpmtfaZB8uiaPM.jpeg?width=460&height=415)

Abhi AryaCo-founder, Opennote

A lot of students tell us that the moment their connected tools start talking to each other inside Opennote feels almost magical. The agent just knows them, and it has immensely helped in keeping new users on the platform.

](https://composio.dev/case-study/opennote)

[

![Nirman Dave](https://framerusercontent.com/images/NZtGsbyju0w9cTEQwzVx61rp0.jpeg?width=135&height=126)

Nirman DaveCEO, Zams

We chose Composio over Pipedream because it delivered depth where it mattered. It supported niche tools and tricky edge cases that other platforms simply ignored. Giving us confidence to scale without compromising.

](https://composio.dev/case-study/zams)

[

![Ryan Yu](https://framerusercontent.com/images/FVkqAhM0PmgE9Raa6PiL4SZXg5M.png?width=400&height=400)

Ryan YuFounder, Extra Thursday

As a solo builder, shipping fast is life or death. The only way I can outcompete incumbents is by outmanoeuvring them. Getting bogged down in the complexities of managing agent auth would have been a death sentence for Extra Thursday.

](https://composio.dev/case-study/extra-thursday-case-study)

[

![Tomisin Jenrola](https://framerusercontent.com/images/exP379yyvCbyCr13jaxXRbTalQ.jpg?scale-down-to=512&width=720&height=576)

Tomisin JenrolaFounder & CEO, SwarmZero

Before partnering with Composio, adding tool integrations was a slow, resource-intensive process. Each integration could take weeks or months of engineering time, and maintaining them meant constantly keeping up with API changes.

](https://composio.dev/case-study/swarmzero-case-study)

[

![Jerome Leclanche](https://framerusercontent.com/images/H0SflKVCqiXBqwUqkeik9QUhFo.webp?width=300&height=400)

Jerome LeclancheCo-Founder, Ingram Technologies

With hands-on help from their founder, we integrated Gmail and Google Drive in just 30 minutes. This level of personal support and commitment is exactly what startups should strive for.

](https://composio.dev/case-study/ingram-case-study)

[

![Harsha Gaddipati](https://framerusercontent.com/images/ksfmhdIvvsrIYpFxJGE6n4jxn4.jpeg?scale-down-to=512&width=800&height=800)

Harsha GaddipatiCo-founder, Slashy

Karan skipped his own birthday party to fix our critical issue. It was 10 pm and he diverted his Waymo to help us instead. This really sets the bar, shows you the commitment you need to have when users rely on your software.

](https://composio.dev/case-study/slashy)

[

![Abhi Arya](https://framerusercontent.com/images/v3e0DD6Dv0K1MpmtfaZB8uiaPM.jpeg?width=460&height=415)

Abhi AryaCo-founder, Opennote

A lot of students tell us that the moment their connected tools start talking to each other inside Opennote feels almost magical. The agent just knows them, and it has immensely helped in keeping new users on the platform.

](https://composio.dev/case-study/opennote)

[

![Nirman Dave](https://framerusercontent.com/images/NZtGsbyju0w9cTEQwzVx61rp0.jpeg?width=135&height=126)

Nirman DaveCEO, Zams

We chose Composio over Pipedream because it delivered depth where it mattered. It supported niche tools and tricky edge cases that other platforms simply ignored. Giving us confidence to scale without compromising.

](https://composio.dev/case-study/zams)

[

![Ryan Yu](https://framerusercontent.com/images/FVkqAhM0PmgE9Raa6PiL4SZXg5M.png?width=400&height=400)

Ryan YuFounder, Extra Thursday

As a solo builder, shipping fast is life or death. The only way I can outcompete incumbents is by outmanoeuvring them. Getting bogged down in the complexities of managing agent auth would have been a death sentence for Extra Thursday.

](https://composio.dev/case-study/extra-thursday-case-study)

[

![Tomisin Jenrola](https://framerusercontent.com/images/exP379yyvCbyCr13jaxXRbTalQ.jpg?scale-down-to=512&width=720&height=576)

Tomisin JenrolaFounder & CEO, SwarmZero

Before partnering with Composio, adding tool integrations was a slow, resource-intensive process. Each integration could take weeks or months of engineering time, and maintaining them meant constantly keeping up with API changes.

](https://composio.dev/case-study/swarmzero-case-study)

[

![Jerome Leclanche](https://framerusercontent.com/images/H0SflKVCqiXBqwUqkeik9QUhFo.webp?width=300&height=400)

Jerome LeclancheCo-Founder, Ingram Technologies

With hands-on help from their founder, we integrated Gmail and Google Drive in just 30 minutes. This level of personal support and commitment is exactly what startups should strive for.

](https://composio.dev/case-study/ingram-case-study)
