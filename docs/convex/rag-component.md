# RAG

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

GitHub17,461 stars

](https://github.com/get-convex/convex-backend)[Log in](/login)[Start building](/start)

[Back to Components](/components)

# RAG

[![get-convex's avatar](/_next/image?url=https%3A%2F%2Favatars.githubusercontent.com%2Fu%2F81530787%3Fv%3D4&w=96&q=75)

get-convex/rag

View repo

](https://github.com/get-convex/rag)[![GitHub logo](/\_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fnpm.bd053a67.svg&w=48&q=75)View package](https://www.npmjs.com/package/@convex-dev/rag)

### Category

[AI](/components#ai 'Show all components in "AI" category')

![RAG hero image](/_next/image?url=%2F_next%2Fstatic%2Fmedia%2FRAG.193924e6.png&w=1536&q=75)

```bash
npm install @convex-dev/rag
```

A component for semantic search, usually used to look up context for LLMs. Use with an Agent for Retrieval-Augmented Generation (RAG).

[![Use AI to search HUGE amounts of text with the RAG Component](https://thumbs.video-to-markdown.com/1ff18153.jpg)](https://youtu.be/dGmtAmdAaFs)

## ✨ Key Features[#](#-key-features)

- **Add Content**: Add or replace content with text chunks and embeddings.
- **Semantic Search**: Vector-based search using configurable embedding models
- **Namespaces**: Organize content into namespaces for per-user search.
- **Custom Filtering**: Filter content with custom indexed fields.
- **Importance Weighting**: Weight content by providing a 0 to 1 "importance".
- **Chunk Context**: Get surrounding chunks for better context.
- **Graceful Migrations**: Migrate content or whole namespaces without disruption.

Found a bug? Feature request? [File it here](https://github.com/get-convex/rag/issues).

## Installation[#](#installation)

Create a `convex.config.ts` file in your app's `convex/` folder and install the component by calling `use`:

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import rag from "@convex-dev/rag/convex.config.js";

const app = defineApp();
app.use(rag);

export default app;
```

Run `npx convex codegen` if `npx convex dev` isn't already running.

## Basic Setup[#](#basic-setup)

```ts
// convex/example.ts
import { components } from "./_generated/api";
import { RAG } from "@convex-dev/rag";
// Any AI SDK model that supports embeddings will work.
import { openai } from "@ai-sdk/openai";

const rag = new RAG(components.rag, {
  textEmbeddingModel: openai.embedding("text-embedding-3-small"),
  embeddingDimension: 1536, // Needs to match your embedding model
});
```

## Add context to RAG[#](#add-context-to-rag)

Add content with text chunks. Each call to `add` will create a new **entry**. It will embed the chunks automatically if you don't provide them.

```ts
export const add = action({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    // Add the text to a namespace shared by all users.
    await rag.add(ctx, {
      namespace: "all-users",
      text,
    });
  },
});
```

See below for how to chunk the text yourself or add content asynchronously, e.g. to handle large files.

## Semantic Search[#](#semantic-search)

Search across content with vector similarity

- `text` is a string with the full content of the results, for convenience. It is in order of the entries, with titles at each entry boundary, and separators between non-sequential chunks. See below for more details.
- `results` is an array of matching chunks with scores and more metadata.
- `entries` is an array of the entries that matched the query. Each result has a `entryId` referencing one of these source entries.
- `usage` contains embedding token usage information. Will be `{ tokens: 0 }` if no embedding was performed (e.g. when passing pre-computed embeddings).

```ts
export const search = action({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const { results, text, entries, usage } = await rag.search(ctx, {
      namespace: "global",
      query: args.query,
      limit: 10,
      vectorScoreThreshold: 0.5, // Only return results with a score >= 0.5
    });

    return { results, text, entries, usage };
  },
});
```

## Generate a response based on RAG context[#](#generate-a-response-based-on-rag-context)

Once you have searched for the context, you can use it with an LLM.

Generally you'll already be using something to make LLM requests, e.g. the [Agent Component](https://www.convex.dev/components/agent), which tracks the message history for you. See the [Agent Component docs](https://docs.convex.dev/agents) for more details on doing RAG with the Agent Component.

However, if you just want a one-off response, you can use the `generateText` function as a convenience.

This will automatically search for relevant entries and use them as context for the LLM, using default formatting.

The arguments to `generateText` are compatible with all arguments to `generateText` from the AI SDK.

```ts
export const askQuestion = action({
  args: {
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const { text, context } = await rag.generateText(ctx, {
      search: { namespace: userId, limit: 10 },
      prompt: args.prompt,
      model: openai.chat("gpt-4o-mini"),
    });
    return { answer: text, context };
  },
```

Note: You can specify any of the search options available on `rag.search`.

## Filtered Search[#](#filtered-search)

You can provide filters when adding content and use them to search. To do this, you'll need to give the RAG component a list of the filter names. You can optionally provide a type parameter for type safety (no runtime validation).

Note: these filters can be OR'd together when searching. In order to get an AND, you provide a filter with a more complex value, such as `categoryAndType` below.

```ts
// convex/example.ts
import { components } from "./_generated/api";
import { RAG } from "@convex-dev/rag";
// Any AI SDK model that supports embeddings will work.
import { openai } from "@ai-sdk/openai";

// Optional: Add type safety to your filters.
type FilterTypes = {
  category: string;
  contentType: string;
  categoryAndType: { category: string; contentType: string };
};

const rag = new RAG<FilterTypes>(components.rag, {
  textEmbeddingModel: openai.embedding("text-embedding-3-small"),
  embeddingDimension: 1536, // Needs to match your embedding model
  filterNames: ["category", "contentType", "categoryAndType"],
});
```

Adding content with filters:

```ts
await rag.add(ctx, {
  namespace: "global",
  text,
  filterValues: [
    { name: "category", value: "news" },
    { name: "contentType", value: "article" },
    {
      name: "categoryAndType",
      value: { category: "news", contentType: "article" },
    },
  ],
});
```

Search with metadata filters:

```ts
export const searchForNewsOrSports = action({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const results = await rag.search(ctx, {
      namespace: userId,
      query: args.query,
      filters: [
        { name: "category", value: "news" },
        { name: "category", value: "sports" },
      ],
      limit: 10,
    });

    return results;
  },
});
```

### Add surrounding chunks to results for context[#](#add-surrounding-chunks-to-results-for-context)

Instead of getting just the single matching chunk, you can request surrounding chunks so there's more context to the result.

Note: If there are results that have overlapping ranges, it will not return duplicate chunks, but instead give priority to adding the "before" context to each chunk. For example if you requested 2 before and 1 after, and your results were for the same entryId indexes 1, 4, and 7, the results would be:

```ts
[
  // Only one before chunk available, and leaves chunk2 for the next result.
  { order: 1, content: [chunk0, chunk1], startOrder: 0, ... },
  // 2 before chunks available, but leaves chunk5 for the next result.
  { order: 4, content: [chunk2, chunk3, chunk4], startOrder: 2, ... },
  // 2 before chunks available, and includes one after chunk.
  { order: 7, content: [chunk5, chunk6, chunk7, chunk8], startOrder: 5, ... },
]
```

```ts
export const searchWithContext = action({
  args: {
    query: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { results, text, entries, usage } = await rag.search(ctx, {
      namespace: args.userId,
      query: args.query,
      chunkContext: { before: 2, after: 1 }, // Include 2 chunks before, 1 after
      limit: 5,
    });

    return { results, text, entries, usage };
  },
});
```

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

![](https://t.co/1/i/adsct?bci=4&dv=Asia%2FKarachi%26en-US%2Cen%26Google%20Inc.%26MacIntel%26127%261512%26982%2610%2630%261512%26944%260%26na&eci=3&event=%7B%7D&event_id=28ea9f73-5872-40b1-991a-702178d359c6&integration=advertiser&p_id=Twitter&p_user_id=0&pl_id=34ee5017-0be9-49a8-85b7-a7c14a9d251b&pt=RAG&tw_document_href=https%3A%2F%2Fwww.convex.dev%2Fcomponents%2Frag&tw_iframe_status=0&txn_id=omuhs&type=javascript&version=2.3.35)![](https://analytics.twitter.com/1/i/adsct?bci=4&dv=Asia%2FKarachi%26en-US%2Cen%26Google%20Inc.%26MacIntel%26127%261512%26982%2610%2630%261512%26944%260%26na&eci=3&event=%7B%7D&event_id=28ea9f73-5872-40b1-991a-702178d359c6&integration=advertiser&p_id=Twitter&p_user_id=0&pl_id=34ee5017-0be9-49a8-85b7-a7c14a9d251b&pt=RAG&tw_document_href=https%3A%2F%2Fwww.convex.dev%2Fcomponents%2Frag&tw_iframe_status=0&txn_id=omuhs&type=javascript&version=2.3.35)
