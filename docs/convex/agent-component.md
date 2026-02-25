# AI Agent

[](/)

[](/)

Product

[

RealtimeKeep your app up to date

](/realtime)[

AuthenticationOver 80+ OAuth integrations

](/auth)[

![Convex Components](/_next/image?url=%2F_next%2Fstatic%2Fmedia%2FcomponentsIcon.88c73aa0.svg&w=48&q=75)

ComponentsIndependent, modular, TypeScript building blocks for your backend.

](/components)[

Open sourceSelf host and develop locally

](/open-source)[

![](/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fsparkle.b34d0032.svg&w=48&q=75)

AI CodingGenerate high quality Convex code with AI

](/ai)

Compare

[

Convex vs. Firebase](/compare/firebase)[

Convex vs. Supabase](/compare/supabase)[

Convex vs. SQL](/compare/sql)

Developers

[

DocumentationGet started with your favorite frameworks

](https://docs.convex.dev)[

SearchSearch across Docs, Stack, and Discord

](https://search.convex.dev)[

TemplatesUse a recipe to get started quickly

](/templates)[

Convex for StartupsStart and scale your company with Convex

](/startups)[

Convex ChampionsAmbassadors that support our thriving community

](/champions)[

Convex CommunityShare ideas and ask for help in our community Discord

](/community)

[

![Stack](/_next/image?url=%2F_next%2Fstatic%2Fmedia%2FstackColor.52088746.svg&w=32&q=75)

Stack

Stack is the Convex developer portal and blog, sharing bright ideas and techniques for building with Convex.

Explore Stack

](https://stack.convex.dev/)

[Blog](https://stack.convex.dev)[Docs](https://docs.convex.dev)[Pricing](/pricing)

[

GitHub17,507 stars

](https://github.com/get-convex/convex-backend)[Log in](/login)[Start building](/start)

[Back to Components](/components)

# AI Agent

[![get-convex's avatar](/_next/image?url=https%3A%2F%2Favatars.githubusercontent.com%2Fu%2F81530787%3Fv%3D4&w=96&q=75)

get-convex/agent

View repo

](https://github.com/get-convex/agent)[![GitHub logo](/\_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fnpm.bd053a67.svg&w=48&q=75)View package](https://www.npmjs.com/package/@convex-dev/agent)

### Category

[AI](/components#ai 'Show all components in "AI" category')

![AI Agent hero image](/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fagent.d9d5c243.png&w=1536&q=75)

```bash
npm install @convex-dev/agent
```

AI Agents, built on Convex. [Check out the docs here](https://docs.convex.dev/agents).

The Agent component is a core building block for building AI agents. It manages threads and messages, around which you Agents can cooperate in static or dynamic workflows.

- [Agents](https://docs.convex.dev/agents/agent-usage) provide an abstraction for using LLMs to represent units of use-case-specific prompting with associated models, prompts, [Tool Calls](https://docs.convex.dev/agents/tools), and behavior in relation to other Agents, functions, APIs, and more.
- [Threads](https://docs.convex.dev/agents/threads) persist [messages](https://docs.convex.dev/agents/messages) and can be shared by multiple users and agents (including [human agents](https://docs.convex.dev/agents/human-agents)).
- Streaming text and objects using deltas over websockets so all clients stay in sync efficiently, without http streaming. Enables streaming from async functions.
- [Conversation context](https://docs.convex.dev/agents/context) is automatically included in each LLM call, including built-in hybrid vector/text search for messages in the thread and opt-in search for messages from other threads (for the same specified user).
- [RAG](https://docs.convex.dev/agents/rag) techniques are supported for prompt augmentation from other sources, either up front in the prompt or as tool calls. Integrates with the [RAG Component](https://www.convex.dev/components/rag), or DIY.
- [Workflows](https://docs.convex.dev/agents/workflows) allow building multi-step operations that can span agents, users, durably and reliably.
- [Files](https://docs.convex.dev/agents/files) are supported in thread history with automatic saving to [file storage](https://docs.convex.dev/file-storage) and ref-counting.
- [Debugging](https://docs.convex.dev/agents/debugging) is enabled by callbacks, the [agent playground](https://docs.convex.dev/agents/playground) where you can inspect all metadata and iterate on prompts and context settings, and inspection in the dashboard.
- [Usage tracking](https://docs.convex.dev/agents/usage-tracking) is easy to set up, enabling usage attribution per-provider, per-model, per-user, per-agent, for billing & more.
- [Rate limiting](https://docs.convex.dev/agents/rate-limiting), powered by the [Rate Limiter Component](https://www.convex.dev/components/rate-limiter), helps control the rate at which users can interact with agents and keep you from exceeding your LLM provider's limits.

[Read the associated Stack post here](https://stack.convex.dev/ai-agents).

[![Powerful AI Apps Made Easy with the Agent Component](https://thumbs.video-to-markdown.com/b323ac24.jpg)](https://youtu.be/tUKMPUlOCHY) **Read the [docs](https://docs.convex.dev/agents) for more details.**

Play with the example:

```ts
git clone https://github.com/get-convex/agent.git
cd agent
npm run setup
npm run dev
```

Found a bug? Feature request? [File it here](https://github.com/get-convex/agent/issues).

Get your app up and running in minutes

[Start building](/start)

![](/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fpixel-cruiser.9b0dabcf.svg&w=256&q=75)![](/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fpixel-frame.c16770b0.svg&w=256&q=75)![](/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fpixel-kernel.48322c09.svg&w=256&q=75)![](/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fpixel-portal.4d4967d3.svg&w=256&q=75)![](/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fpixel-burst.811fff05.svg&w=256&q=75)

[![Convex logo](/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Flogo.46ec36bd.svg&w=256&q=75)](/)

Product[Sync](/sync)[Realtime](/realtime)[Auth](/auth)[Open source](/open-source)[AI coding](/ai)[Chef](https://chef.convex.dev)[FAQ](/faq)[Pricing](/pricing)

Developers[Docs](https://docs.convex.dev)[Blog](https://stack.convex.dev)[Components](/components)[Templates](/templates)[Startups](/startups)[Champions](/champions)[Changelog](/releases)[Podcast](/podcast)[LLMs.txt](https://docs.convex.dev/llms.txt)

Company[About us](/about-us)[Brand](/brand)[Investors](/investors)[Become a partner](/partners/apply)[Jobs](/jobs)[News](https://news.convex.dev)[Events](/events)[Terms of service](/legal/tos)[Privacy policy](/legal/privacy)[Security](/security)

Social[![](/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Ftwitter.3de2e5aa.svg&w=48&q=75)Twitter](https://x.com/convex)[![](/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fdiscord.ef0a3bd8.svg&w=48&q=75)Discord](/community)[![](/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fyoutube.c04dcde7.svg&w=48&q=75)YouTube](https://www.youtube.com/@convex-dev)[![](/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fluma.7e8c0688.svg&w=48&q=75)Luma](https://lu.ma/convex)[![](/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Flinkedin.8e8bbdc2.svg&w=48&q=75)LinkedIn](https://www.linkedin.com/company/convex-dev)[![](/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fgithub.d634168b.svg&w=48&q=75)GitHub](https://github.com/get-convex)

A Trusted Solution

- ![](/_next/image?url=%2F_next%2Fstatic%2Fmedia%2FtrustCheck.d411e2c8.svg&w=48&q=75)**SOC 2** Type II Compliant
- ![](/_next/image?url=%2F_next%2Fstatic%2Fmedia%2FtrustCheck.d411e2c8.svg&w=48&q=75)**HIPAA** Compliant
- ![](/_next/image?url=%2F_next%2Fstatic%2Fmedia%2FtrustCheck.d411e2c8.svg&w=48&q=75)**GDPR** Verified

©2025 Convex, Inc.

![](https://t.co/1/i/adsct?bci=4&dv=Asia%2FKarachi%26en-US%2Cen%26Google%20Inc.%26MacIntel%26127%261512%26982%2610%2630%261512%26944%260%26na&eci=3&event=%7B%7D&event_id=209f9fe7-d7d2-467a-9d7c-168fe027b3d0&integration=advertiser&p_id=Twitter&p_user_id=0&pl_id=bf5e5267-79a2-4840-beb7-e93df57ddf0e&pt=AI%20Agent&tw_document_href=https%3A%2F%2Fwww.convex.dev%2Fcomponents%2Fagent&tw_iframe_status=0&txn_id=omuhs&type=javascript&version=2.3.35)![](https://analytics.twitter.com/1/i/adsct?bci=4&dv=Asia%2FKarachi%26en-US%2Cen%26Google%20Inc.%26MacIntel%26127%261512%26982%2610%2630%261512%26944%260%26na&eci=3&event=%7B%7D&event_id=209f9fe7-d7d2-467a-9d7c-168fe027b3d0&integration=advertiser&p_id=Twitter&p_user_id=0&pl_id=bf5e5267-79a2-4840-beb7-e93df57ddf0e&pt=AI%20Agent&tw_document_href=https%3A%2F%2Fwww.convex.dev%2Fcomponents%2Fagent&tw_iframe_status=0&txn_id=omuhs&type=javascript&version=2.3.35)
