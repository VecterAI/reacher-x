# Twitter MCP Integration for AI Agents | Composio

[Home](https://composio.dev)

[All Toolkits](/toolkits)

Twitter

# Twitter Integration for AI Agents

Securely connect your AI agents and chatbots (Claude, ChatGPT, Cursor, etc) with Twitter MCP or direct API to post tweets, read timelines, manage DMs, and analyze user engagement through natural language.

[GET STARTED FOR FREE](https://platform.composio.dev/auth?utm_source=toolkits&utm_medium=hero&utm_campaign=get_started&utm_content=%2Ftoolkits%2Ftwitter)

![Twitter Logo](https://logos.composio.dev/api/twitter)

![Gradient Top](/toolkits/_next/image?url=%2Ftoolkits%2Fgraphics%2Fgradient_3.png&w=3840&q=75)

![Gradient Middle](/toolkits/_next/image?url=%2Ftoolkits%2Fgraphics%2Fgradient_2.png&w=3840&q=75)

![Gradient Bottom](/toolkits/_next/image?url=%2Ftoolkits%2Fgraphics%2Fgradient_1.png&w=3840&q=75)

![divider](/toolkits/_next/image?url=%2Ftoolkits%2Fgraphics%2Fdivider.png&w=3840&q=75)

![Twitter](https://logos.composio.dev/api/twitter)

Twitter is a social media platform for sharing real-time updates, conversations, and news. Stay connected, informed, and engaged with communities worldwide.

Category[

social media

](/toolkits/category/social-media)

72 TOOLS

oauth2bearer token

Managed by![Composio](/toolkits/_next/image?url=%2Ftoolkits%2Flogo.svg&w=256&q=75)

### Connect Twitter without Auth hassles

We manage OAuth, API Key, token refresh, and scopes, you just build.

[Try for Free](https://platform.composio.dev/auth?next_page=%2Ftool-router%3Ftoolkits%3Dtwitter&utm_source=toolkits&utm_medium=sidebar_cta&utm_campaign=tool_router&utm_content=%2Ftoolkits%2Ftwitter)

## Try Twitter now

Enter a prompt below to test the integration in our Tool Router playground. You'll be redirected to sign in and try it live.

Start a group DM with collaborators

Post a tweet with latest blog linkAdd user to my conference listRetrieve my most recent bookmarked tweetsStart a group DM with collaborators

## Supported Tools

Tools

Add a list memberAdds a user to a specified twitter list; the list must be owned by the authenticated user.

Add post to bookmarksAdds a specified, existing, and accessible tweet to a user's bookmarks, with success indicated by the 'bookmarked' field in the response.

Get bookmarks by userRetrieves tweets bookmarked by the authenticated user, where the provided user id must match the authenticated user's id.

Create group DM conversationCreates a new group direct message (dm) conversation on twitter with specified participant ids and an initial message, which can include text and media attachments.

Create compliance jobCreates a new compliance job to check the status of tweet or user ids; upload ids as a plain text file (one id per line) to the \`upload url\` received in the response.

Create a listCreates a new, empty list on x (formerly twitter), for which the provided name must be unique for the authenticated user; accounts are added separately.

Create a postCreates a tweet on twitter; \`text\` is required unless \`card uri\`, \`media media ids\`, \`poll options\`, or \`quote tweet id\` is provided.

Delete direct messagePermanently deletes a specific twitter direct message (dm) event using its \`event id\` if the authenticated user sent it; this action is irreversible and does not delete entire conversations.

Delete listPermanently deletes a specified twitter list using its id, which must be owned by the authenticated user; this action is irreversible and the list must already exist.

Fetch list members by idFetches members of a specific twitter list, identified by its unique id.

Fetch space ticket buyers listRetrieves a list of users who purchased tickets for a specific, valid, and ticketed twitter space.

Follow a listAllows the authenticated user (\`id\`) to follow a specific twitter list (\`list id\`) they are permitted to access, subscribing them to the list's timeline; this does not automatically follow individual list members.

Get followers by user idRetrieves a list of users who follow a specified public twitter user id.

Get following by user IDRetrieves users followed by a specific twitter user, allowing pagination and customization of returned user and tweet data fields via expansions.

Follow a userAllows an authenticated user (path \`id\`) to follow another user (\`target user id\`), which results in a pending request if the target user's tweets are protected.

Search full archive of tweetsSearches the full archive of public tweets from march 2006 onwards; use 'start time' and 'end time' together for a defined time window.

Get full archive search countsReturns a count of tweets from the full archive that match a specified query, aggregated by day, hour, or minute; \`start time\` must be before \`end time\` if both are provided, and \`since id\`/\`until id\` cannot be used with \`start time\`/\`end time\`.

Get a user's list membershipsRetrieves all twitter lists a specified user is a member of, including public lists and private lists the authenticated user is authorized to view.

Get a user's owned listsCall this action to retrieve lists created (owned) by a specific twitter user, not lists they follow or are subscribed to.

Get a user's pinned listsRetrieves the lists a specific, existing twitter user has pinned to their profile to highlight them.

Get users blocked by user IDRetrieves user objects for accounts blocked by the specified user id; this is a read-only view of a user's block list.

Get DM events by IDFetches a specific direct message (dm) event by its unique id, allowing optional expansion of related data like users or tweets; ensure the \`event id\` refers to an existing dm event accessible to the authenticated user.

Get DM events for a DM conversationFetches direct message (dm) events for a one-on-one conversation with a specified participant id, ordered chronologically newest to oldest; does not support group dms.

Get list followersFetches a list of users who follow a specific twitter list, identified by its id; ensure the authenticated user has access if the list is private.

Get muted usersReturns user objects muted by the x user identified by the \`id\` path parameter.

Get post retweetersRetrieves users who publicly retweeted a specified public post id, excluding quote tweets and retweets from private accounts.

Get recent direct message eventsReturns recent direct message events for the authenticated user, such as new messages or changes in conversation participants.

Get user's followed listsReturns metadata (not tweets) for lists a specific twitter user follows, optionally including expanded owner details.

Set reply visibilityHides or unhides an existing reply tweet.

Lookup list by IDReturns metadata for a specific twitter list, identified by its id; does not return list members but can expand the owner's user object via the \`expansions\` parameter.

List post likersRetrieves users who have liked the post (tweet) identified by the provided id.

List posts timeline by list IDFetches the most recent tweets posted by members of a specified twitter list.

Mute user by IDMutes a target user on behalf of an authenticated user, preventing the target's tweets and retweets from appearing in the authenticated user's home timeline without notifying the target.

Pin a listPins a specified list to the authenticated user's profile, provided the list exists, the user has access rights, and the pin limit (typically 5 lists) is not exceeded.

Delete tweetIrreversibly deletes a specific tweet by its id; the tweet may persist in third-party caches after deletion.

Look up post by idFetches comprehensive details for a single tweet by its unique id, provided the tweet exists and is accessible.

Get tweets by IDsRetrieves detailed information for one or more posts (tweets) identified by their unique ids, allowing selection of specific fields and expansions.

Get tweets label streamEstablishes a persistent stream of real-time events for when tweet labels are applied or removed, offering insights into content categorization.

Fetch tweet usage dataFetches tweet usage statistics for a project (e.

Search recent tweetsSearches tweets from the last 7 days matching a query (using x's search syntax), ideal for real-time analysis, trend monitoring, or retrieving posts from specific users (e.

Fetch recent tweet countsRetrieves the count of tweets matching a specified search query within the last 7 days, aggregated by 'minute', 'hour', or 'day'.

Remove a bookmarked postRemoves a tweet, specified by \`tweet id\`, from the authenticated user's bookmarks; the tweet must have been previously bookmarked by the user for the action to have an effect.

Remove a list memberRemoves a user from a twitter list; the response \`is member\` field will be \`false\` if removal was successful or the user was not a member, and the updated list of members is not returned.

Retrieve compliance job by idRetrieves status, download/upload urls, and other details for an existing twitter compliance job specified by its unique id.

Retrieve compliance jobsReturns a list of recent compliance jobs, filtered by type (tweets or users) and optionally by status.

Retrieve DM conversation eventsRetrieves direct message (dm) events for a specific conversation id on twitter, useful for analyzing messages and participant activities.

Retrieve posts from a spaceRetrieves tweets from a specified twitter space id; the space must be accessible and results are batched (not streamed).

Retrieve posts that quote a postRetrieves tweets that quote a specified tweet, requiring a valid tweet id.

Retrieve retweets of a postRetrieves tweets that retweeted a specified public or authenticated-user-accessible tweet id, optionally customizing the response with fields and expansions.

Retrieve liked tweets by user IDRetrieves tweets liked by a specified twitter user, provided their liked tweets are public or accessible.

Fetch OpenAPI specificationFetches the openapi specification (json) for twitter's api v2, used to programmatically understand the api's structure for developing client libraries or tools.

Retweet postRetweets a tweet (\`tweet id\`) for a given user (\`id\`), provided the tweet is public (or user follows if protected), not already retweeted by the user, and its author has not blocked the user.

Search for spacesSearches for twitter spaces by a textual query, optionally filtering by state (live, scheduled, all) to discover audio conversations.

Send a new message to a DM conversationSends a message, with optional text and/or media attachments (using pre-uploaded \`media id\`s), to a specified twitter direct message conversation.

Send a new message to a userSends a new direct message with text and/or media (media id for attachments must be pre-uploaded) to a specified twitter user; this creates a new dm and does not modify existing messages.

Look up space by IDRetrieves details for a twitter space by its id, allowing for customization and expansion of related data, provided the space id is valid and accessible.

Get spaces by creator IDsRetrieves twitter spaces created by a list of specified user ids, with options to customize returned data fields.

Get space information by IDsFetches detailed information for one or more twitter spaces (live, scheduled, or ended) by their unique ids; at least one space id must be provided.

Unfollow a listEnables a user (via \`id\`) to unfollow a specific twitter list (via \`list id\`), which removes its tweets from their timeline and stops related notifications; the action reports \`following: false\` on success, even if the user was not initially following the list.

Unfollow userAllows the authenticated \`source user id\` to unfollow an existing twitter user (\`target user id\`), which removes the follow relationship.

Unlike postAllows an authenticated user (\`id\`) to remove their like from a specific post (\`tweet id\`); the action is idempotent and completes successfully even if the post was not liked.

Unmute a user by user IDUnmutes a \`target user id\` for the \`source user id\` (authenticated user), allowing the source user to see tweets and notifications from the target user again.

Unpin a listUnpins a list (specified by list id) from a user's profile (specified by id), provided the list is currently pinned by that user.

Unretweet postRemoves a user's retweet of a specified post, if the user had previously retweeted it.

Update list attributesUpdates an existing twitter list's name, description, or privacy status, requiring the list id and at least one mutable property.

Get user reverse chronological timelineRetrieves the home timeline/feed for a specified twitter user, showing tweets from accounts they follow - not their own posts - in reverse chronological order; useful for displaying their personalized feed without algorithmic sorting.

Like a tweetAllows the authenticated user (\`id\`) to like a specific, accessible tweet (\`tweet id\`), provided neither user has blocked the other and the authenticated user is not restricted from liking.

Look up user by IDRetrieves detailed public information for a twitter user by their id, optionally expanding related data (e.

Look up users by IDsRetrieves detailed information for specified x (formerly twitter) user ids, optionally customizing returned fields and expanding related entities.

Look up user by usernameFetches public profile information for a valid and existing twitter user by their username, optionally expanding related data like pinned tweets; results may be limited for protected profiles not followed by the authenticated user.

Look up users by usernameRetrieves detailed information for 1 to 100 twitter users by their usernames (each 1-15 alphanumeric characters/underscores), allowing customizable user/tweet fields and expansion of related data like pinned tweets.

Get authenticated userReturns profile information for the currently authenticated x user, customizable via request fields.

## Connect Twitter MCP Tool with your Agent

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
  messages: [{ role: 'user', content: 'Create a post about our product launch' }],
  stopWhen: stepCountIs( 5 )
});

console.log(`Agent: ${text}`);
```

Use the MCP server with your AI agent

## Connect Twitter API Tool with your Agent

## Why Use Composio?

1

#### AI Native Twitter Integration

- Supports both Twitter MCP and direct API based integrations
- Structured, LLM-friendly schemas for reliable tool execution
- Rich coverage for reading, writing, and querying your Twitter data

2

#### Managed Auth

- Built-in OAuth handling with automatic token refresh and rotation
- Central place to manage, scope, and revoke Twitter access
- Per user and per environment credentials instead of hard-coded keys

3

#### Agent Optimized Design

- Tools are tuned using real error and success rates to improve reliability over time
- Comprehensive execution logs so you always know what ran, when, and on whose behalf

4

#### Enterprise Grade Security

- Fine-grained RBAC so you control which agents and users can access Twitter
- Scoped, least privilege access to Twitter resources
- Full audit trail of agent actions to support review and compliance

## Use Twitter with any AI Agent Framework

Choose a Framework you want to connect Twitter with

[

![OpenAI Agents SDK](/toolkits/_next/image?url=https%3A%2F%2Fimg.logo.dev%2Fname%2Fopenai%3Ftoken%3Dpk_UP7d_UulRqeTXQ30RpyZ5Q&w=256&q=75)

### OpenAI Agents SDK

Use Twitter MCP with OpenAI Agents SDK

](/toolkits/twitter/framework/open-ai-agents-sdk)[

![Claude Agents SDK](/toolkits/_next/image?url=https%3A%2F%2Fimg.logo.dev%2Fname%2Fclaude%3Ftoken%3Dpk_UP7d_UulRqeTXQ30RpyZ5Q&w=256&q=75)

### Claude Agents SDK

Use Twitter MCP with Claude Agents SDK

](/toolkits/twitter/framework/claude-agents-sdk)[

![Claude Code](/toolkits/_next/image?url=https%3A%2F%2Fimg.logo.dev%2Fname%2Fclaude%3Ftoken%3Dpk_UP7d_UulRqeTXQ30RpyZ5Q&w=256&q=75)

### Claude Code

Use Twitter MCP with Claude Code

](/toolkits/twitter/framework/claude-code)[

![Codex](/toolkits/_next/image?url=https%3A%2F%2Fimg.logo.dev%2Fname%2Fopenai%3Ftoken%3Dpk_UP7d_UulRqeTXQ30RpyZ5Q&w=256&q=75)

### Codex

Use Twitter MCP with Codex

](/toolkits/twitter/framework/codex)[

![OpenClaw](/toolkits/_next/image?url=%2Ftoolkits%2Fopenclaw%2Fopenclaw-logo.png&w=256&q=75)

### OpenClaw

Use Twitter MCP with OpenClaw

](/toolkits/twitter/framework/openclaw)[

![Google ADK](/toolkits/_next/image?url=https%3A%2F%2Fimg.logo.dev%2Fname%2Fgoogle%3Ftoken%3Dpk_UP7d_UulRqeTXQ30RpyZ5Q&w=256&q=75)

### Google ADK

Use Twitter MCP with Google ADK

](/toolkits/twitter/framework/google-adk)[

![Langchain](/toolkits/_next/image?url=%2Ftoolkits%2Flogos%2Fhero%2Flangchain.svg&w=256&q=75)

### Langchain

Use Twitter MCP with Langchain

](/toolkits/twitter/framework/langchain)[

![AI SDK](/toolkits/_next/image?url=https%3A%2F%2Fimg.logo.dev%2Fname%2Fvercel%3Ftoken%3Dpk_UP7d_UulRqeTXQ30RpyZ5Q&w=256&q=75)

### AI SDK

Use Twitter MCP with AI SDK

](/toolkits/twitter/framework/ai-sdk)[

![Mastra AI](/toolkits/_next/image?url=https%3A%2F%2Fimg.logo.dev%2Fname%2Fmastra%3Ftoken%3Dpk_UP7d_UulRqeTXQ30RpyZ5Q&w=256&q=75)

### Mastra AI

Use Twitter MCP with Mastra AI

](/toolkits/twitter/framework/mastra-ai)[

![LlamaIndex](/toolkits/_next/image?url=https%3A%2F%2Fimg.logo.dev%2Fname%2Fllamaindex%3Ftoken%3Dpk_UP7d_UulRqeTXQ30RpyZ5Q&w=256&q=75)

### LlamaIndex

Use Twitter MCP with LlamaIndex

](/toolkits/twitter/framework/llama-index)[

![CrewAI](/toolkits/_next/image?url=https%3A%2F%2Fimg.logo.dev%2Fname%2Fcrewai%3Ftoken%3Dpk_UP7d_UulRqeTXQ30RpyZ5Q&w=256&q=75)

### CrewAI

Use Twitter MCP with CrewAI

](/toolkits/twitter/framework/crew-ai)[

![Pydantic AI](/toolkits/_next/image?url=https%3A%2F%2Fimg.logo.dev%2Fname%2Fpydantic%3Ftoken%3Dpk_UP7d_UulRqeTXQ30RpyZ5Q&w=256&q=75)

### Pydantic AI

Use Twitter MCP with Pydantic AI

](/toolkits/twitter/framework/pydantic-ai)[

![Autogen](/toolkits/_next/image?url=https%3A%2F%2Fimg.logo.dev%2Fname%2Fautogenai%3Ftoken%3Dpk_UP7d_UulRqeTXQ30RpyZ5Q&w=256&q=75)

### Autogen

Use Twitter MCP with Autogen

](/toolkits/twitter/framework/autogen)

## Explore Other Toolkits

[

![Ayrshare](https://composio.dev/toolkits/_next/image?url=https%3A%2F%2Fcdn.jsdelivr.net%2Fgh%2FComposioHQ%2Fopen-logos%40master%2Ficons%2Fayrshare_mega_20250722.png&w=96&q=75)

### Ayrshare

API Key

Ayrshare is a Social Media API for managing, automating, and analyzing posts across multiple platforms. It helps you streamline social media workflows and centralize analytics.

](/toolkits/ayrshare)[

![Dotsimple](https://composio.dev/toolkits/_next/image?url=https%3A%2F%2Flogos.composio.dev%2Fapi%2Fdotsimple&w=96&q=75)

### Dotsimple

API Key

Dotsimple is a social media management platform for planning, creating, and publishing content. It helps teams boost their reach with AI-powered content generation and actionable analytics.

](/toolkits/dotsimple)[

![Instagram](https://composio.dev/toolkits/_next/image?url=https%3A%2F%2Flogos.composio.dev%2Fapi%2Finstagram&w=96&q=75)

### Instagram

OAuth2Bearer Token

Instagram is a social platform for sharing photos, videos, and stories with your audience. It helps brands and creators engage, grow, and analyze their online presence.

](/toolkits/instagram)Load More[TOOLKIT MARKETPLACE](/toolkits)

## Frequently Asked Questions

### Do I need my own developer credentials to use Twitter with Composio?

No, you can get started immediately using Composio's built-in Twitter app. For production, we recommend configuring your own OAuth credentials.

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

[Book a call↗](https://calendly.com/thomas-composio/composio-enterprise-setup)[Get started for free](https://platform.composio.dev/auth?utm_source=toolkits&utm_medium=prefooter&utm_campaign=get_started&utm_content=%2Ftoolkits%2Ftwitter)

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
