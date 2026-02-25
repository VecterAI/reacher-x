# AI Agents with Built-in Memory

![Ian Macartney's avatar](/_next/image?url=https%3A%2F%2Fcdn.sanity.io%2Fimages%2Fts10onj4%2Fproduction%2F077753b63476b77fb111ba06d1bb538517033a54-3500x3500.jpg&w=3840&q=75)

[Ian Macartney](/author/ian-macartney)

8 months ago

# AI Agents with Built-in Memory

![Manage agent workflows with ease](/_next/image?url=https%3A%2F%2Fcdn.sanity.io%2Fimages%2Fts10onj4%2Fproduction%2F568550a3c5a9f2a771a957271e1c537d0a45bc63-2400x1260.png&w=3840&q=75)

Are you trying to build an Agent? An Agentic Workflow? An AI ChatBot? One of the challenges of building multi-step flows is managing the persistent state (e.g. chat messages) through a web of steps with different agents, and intelligently retrieve them for prompt context in the future. The new Agent component allows you to rapidly define and build agents, and incorporate them into complex workflows.

Some of the things [Agent component](https://www.convex.dev/components/agent) makes easy for you:

- Automatically store messages in user-specific threads that be handed off between agents.
- Search messages via hybrid text and vector search and inject them as context (opt-in and configurable).
- Define and use tool calling that support real-time, reactive queries so clients can see progress of asynchronously-executing workflows.

### [Check out the docs here](https://docs.convex.dev/agents)[](#check-out-the-docs-here)

## What’s an agentic workflow[](#whats-an-agentic-workflow)

There’s been a lot of interest recently in making asynchronous agentic workflows with memory.

Here’s what I mean by those terms:

- **Asynchronous:** Long-lived operations that either happen from a user-initiated action, like asking a question in a support chat, or a trigger: a web hook, cron, or previously scheduled function.
- **Agentic:** Conceptual units of responsibility that are “responsible” for something specific and have a set of actions (tools) available to them. Most often these look like calling an LLM.
- **Workflow**: A set of functions that get called, passing context from one to another. The simplest version of this is a single function that calls agents (functions) and eventually returns a result. A fancy version of this looks like the [Workflow component](https://www.convex.dev/components/workflow) with Inngest-inspired syntax that runs durably (more on that below).
- **Memory:** Contextual data that is saved and retrieved, for the use of informing future chats. This could be previous chat messages, use-case-specific data, or in the case of [AI Town](https://www.convex.dev/ai-town), reflections on conversations and previous memories.

#### Is this a new concept?[](#is-this-a-new-concept)

If you’re familiar with RAG, tool-calling, mixture of experts, dynamic dispatch, and durable functions, this should all be familiar. If not, don’t sweat it; fancy words are often simple concepts. The “tricks” involved are:

- Break down a given task into pieces accomplished by specific LLMs models with domain-specific prompting.
- Provide context to the LLM by using some combination of vector, text, and recency searches.
- Allow the LLM to decide to “call out” to a “tool” when it needs more information or wants to take action. A good example of this is reading/writing code in a GitHub repo.
- Run the workflow “durably” - allowing each unreliable step to have some retry behavior, and allow the overall function to recover after server crashes, always running to completion. [Read more about why I’m excited about that here](https://stack.convex.dev/durable-workflows-and-strong-guarantees).

## What does it look like[](#what-does-it-look-like)

To get concrete, let’s look at defining an agent using my new [Agent component](https://www.convex.dev/components/agent)

### Defining an agent[](#defining-an-agent)

```tsx
1import { Agent } from "@convex-dev/agent";
2import { components, internal } from "./_generated/api";
3import { openai } from "@ai-sdk/openai";
4
5const supportAgent = new Agent(components.agent, {
6  chat: openai.chat("gpt-4o-mini"),
7  textEmbedding: openai.embedding("text-embedding-3-small"),
8  instructions: "You are a helpful assistant.",
9});
10
```

### Starting a conversation[](#starting-a-conversation)

```tsx
1export const createThread = action({
2  args: { prompt: v.string() },
3  handler: async (ctx, { prompt }) => {
4+   const { threadId, thread } = await supportAgent.createThread(ctx, {});
5+   const result = await thread.generateText({ prompt });
6    return { threadId, text: result.text };
7  },
8});
9
```

### Continuing a conversation[](#continuing-a-conversation)

```tsx
1export const continueThread = action({
2  args: { prompt: v.string(), threadId: v.string() },
3  handler: async (ctx, { prompt, threadId }) => {
4    // This includes previous message history from the thread automatically.
5+   const { thread } = await supportAgent.continueThread(ctx, { threadId });
6+   const result = await thread.generateText({ prompt });
7    return result.text;
8  },
9});
10
```

### Using tools[](#using-tools)

Tools are functions that the LLM can call. We use the [AI SDK Tool](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling) syntax

Configuring tools:

```tsx
1const supportAgent = new Agent(components.agent, {
2  chat: openai.chat("gpt-4o-mini"),
3  textEmbedding: openai.embedding("text-embedding-3-small"),
4  instructions: "You are a helpful assistant.",
5+ tools: { accountLookup, fileTicket, sendEmail },
6});
7//...
8  // or per-invocation in an action
9  await thread.generateText({
10    prompt,
11+   tools: { accountLookup, fileTicket, sendEmail },
12  });
13
```

Defining Convex tools that have access to the function’s context, including `userId`, `threadId`, `messageId`, and the action `ctx` object which you can use to call queries, mutations, or actions:

```tsx
1export const ideaSearch = createTool({
2  description: "Search for ideas by space-delimited keywords",
3  args: z.object({ search: z.string().describe("What you seek") }),
4+ handler: async (ctx, { search }): Promise<Doc<"ideas">[]> =>
5+    ctx.runQuery(api.ideas.searchIdeas, { search }),
6});
7
```

### Incorporating into a durable workflow[](#incorporating-into-a-durable-workflow)

```tsx
1import { components, internal } from "./_generated/api";
2import { WorkflowManager } from "@convex-dev/workflow";
3
4const workflow = new WorkflowManager(components.workflow);
5
6export const weatherAgentWorkflow = workflow.define({
7  args: { location: v.string(), userId: v.id("users") },
8  handler: async (step, { location, userId }): Promise<Outfit> => {
9+   const { threadId } = await step.runMutation(
10+     internal.example.createThread,
11+     { userId },
12+   );
13+   await step.runAction(
14+     internal.example.getForecast,
15+     { prompt: `What is the weather in ${location}?`, threadId },
16+     { retry: true },
17+   );
18+   const { object } = await step.runAction(
19+     internal.example.getFashionAdvice,
20+     { prompt: `What should I wear based on the weather?`, threadId },
21+     { runAfter: 2 * SECOND },
22+   );
23  },
24});
25
```

### Subscribing to asynchronously-generated messages[](#subscribing-to-asynchronously-generated-messages)

This will fetch the thread’s messages, and re-run whenever new messages are created (within the query range). React clients can subscribe to the results with `useQuery`.

```tsx
1export const listMessages = query({
2  args: {
3    threadId: v.string(),
4    paginationOpts: paginationOptsValidator,
5  },
6  handler: async (ctx, args) => {
7    const { threadId, paginationOpts } = args;
8    await authorizeThreadAccess(ctx, threadId);
9+   const msgs = await agent.listMessages(ctx, {
10+     threadId,
11+     paginationOpts,
12+   });
13    // Here you could add more fields to the messages, like the user's name.
14    return msgs;
15  },
16});
17
```

### Using a user’s previous conversations as context manually[](#using-a-users-previous-conversations-as-context-manually)

The agent will automatically pull in context based on the `contextOptions` parameter. If you don’t want the automatic behavior, you can provide messages yourself. You can also use the Agent's API to query for messages in the same way it would internally:

```ts
1const messages = await weatherAgent.fetchContextMessages(ctx, {
2	userId,
3	threadId,
4	messages: [{ role: "user", content: text }],
5	contextOptions: {
6		searchOtherThreads: true,
7		recentMessages: 10,
8		searchOptions: {
9			textSearch: true,
10			vectorSearch: true,
11			messageRange: { before: 1, after: 1 },
12			limit: 10,
13		},
14	},
15});
16// do customization and add a final prompt message
17const result = await thread.generateText({
18  messages,
19	{ prompt }, // either provide a prompt here or as the last message
20	saveMessages: "none",
21	// don't automatically fetch any context
22  contextOptions: {
23	  recentMessages: 0,
24		searchOptions: { limit: 0 },
25  },
26});
27
```

### Retrying pesky LLMs who mean well but frequently goof up[](#retrying-pesky-llms-who-mean-well-but-frequently-goof-up)

Per-agent call retries (immediate, accounting for LLM blips):

```tsx
1const supportAgent = new Agent(components.agent, {
2  chat: openai.chat("gpt-4o-mini"),
3  textEmbedding: openai.embedding("text-embedding-3-small"),
4  instructions: "You are a helpful assistant.",
5  maxRetries: 3,
6});
7
```

Retrying the whole action if the server restarts or the API provider is having issues by using the Workpool or Workflow components. This will use backoff and jitter to avoid thundering herds.

Workpool:

```tsx
1const workpool = new Workpool(components.workpool, {
2  maxParallelism: 10,
3  retryActionsByDefault: true,
4  defaultRetryBehavior: {
5    maxAttempts: 5,
6    initialBackoffMs: 1000,
7    base: 2,
8  },
9});
10
```

Workflow:

```tsx
1const workflow = new WorkflowManager(components.workflow, {
2  workpoolOptions: {
3    maxParallelism: 10,
4    retryActionsByDefault: true,
5    defaultRetryBehavior: {
6      maxAttempts: 5,
7      initialBackoffMs: 1000,
8      base: 2,
9    },
10  },
11});
12
```

### Other capabiliities[](#other-capabiliities)

Some other handy features:

- Per-user usage tracking for tokens.
- Dashboard playground UI to inspect threads, messages, and tool calls, as well as iterate on prompts, context and search options.
- Automatic (or explicit) storage of files & images passed in, stored in Convex file storage and passed as URLs.

New features are being added continuously, so check out the [Component page](https://www.convex.dev/components/agent).

## How does it work[](#how-does-it-work)

Under the hood, it stores threads, messages, and stream deltas. Messages include the core LLM messages, as well as metadata about its generation and nest steps under the target message.

When you make a call from the thread-specific functions, it saves the input prompt (or the last message if you pass in an array of message[1](#user-content-fn-1)), and as it executes, it saves intermediate steps as it goes. It marks it all as pending until it’s done. If it fails and you call it again, it will mark the previous pending steps as failed.

The messages are query-able by thread, statuses, and whether they’re tool calls so you can subscribe to only what you need, avoiding excessive database bandwidth and function calls.

If you provide a text embedder, it will generate embeddings for each message to power vector search of previous messages per-thread, as well as optionally search across messages from all of the user's threads by passing `searchOtherThreads: true`.

### Using bits and pieces[](#using-bits-and-pieces)

With any framework or abstraction, it provides value by being opinionated. It makes it easy to get going quickly and leverage ongoing improvements and new capabilities.

However, sometimes those opinions can get in the way. For istance, many apps abandon LangChain once they want more control over the prompting and internals. Michal [wrote up a good piece about this](https://stack.convex.dev/are-vector-databases-dead#langchain) a year ago after implementing RAG three ways.

Ideally a library or framework like this makes it easy to compose with other systems and use the pieces that work for you.

- You can call the agents directly from Convex HTTP endpoints or serverless functions. You don’t have to use the fancy Workflow component.
- You can generate or stream text synchronously in an action from clients, or asynchronously produce results that users can subscribe to via [queries](https://docs.convex.dev/tutorial/).
- You can pass in custom context (messages) and not have it do any automatic context injection. This is useful if you’re pulling data from your own database tables or third-party resources.
- You can do message search without calling an LLM, if you want to leverage its memory and modify it before making the call to generate anything.
- You can save messages explicitly, instead of having it save them by default.
- You can use any third-party tool that works with the AI SDK and can run in a serverless function (think: AWS lambda Node environment, with some limits on bundle and memory size).
- You can create, paginate, modify, and delete the underlying embeddings. This is useful if you want to re-embed everything with a new model. By default, embeddings are isolated by model and embedding size, so you’ll never get results matching a different model’s embedding.
- You can wrap tools with your own code, to add custom logic, validation, guardrails or transformations.

#### Goals[](#goals)

Specific things this component aims to do to avoid common pitfalls of other libraries:

1.  Be clear about what it will and won’t do, with a clear mental model of how it works internally. Use existing language, concepts, and syntax, unless there’s an important reason to invent a new concept. For instance, while there are arguably better APIs for LLMs than OpenAI’s `{ role: "user", content: prompt }`, it’s become a de-facto standard and a reasonable enough API. And the AI SDK is good enough to start.
2.  Expose enough knobs and dials so users can tune the prompt to their use-case, with escape hatches for full control.
3.  Build composable pieces, e.g. separating the Workflow, Agent, and RAG components, so you can use what makes sense.
4.  Allowing writing “just code” instead of Domain-Specific Languages (DSLs) that struggle to balance expressivity and simplicity. Code ends up being more readable, maintainable and composable via abstractions. DSLs are great for many use-cases, but when you want more control, you'll reach for code.

To stay up to date with all the developments, join the `#agents` channel in [Discord](https://convex.dev/community) and open [a GitHub issue](https://github.com/get-convex/agent/issues) for feature requests and feedback! 🙏

## Summary[](#summary)

With agents you can organize and orchestrate complex workflows. With the new Agent component, you can store and retrieve message history automatically.

As always, let me know what you think [in Discord](https://convex.dev/community), on [🦋](https://bsky.app/profile/ianmacartney.bsky.social)  or on [𝕏](https://x.com/ianmacartney)

### Footnotes[](#footnote-label)

1.  If you pass `saveMessages: "all"` it will save all of the messages automatically. The default is to only save the prompt / final input message and output messages since it’s common to pass in a lot of custom context that should not be saved, followed by a final user prompt. [↩](#user-content-fnref-1)

Build in minutes, scale forever.

Convex is the backend platform with everything you need to build your full-stack AI project. Cloud functions, a database, file storage, scheduling, workflow, vector search, and realtime updates fit together seamlessly.

Get started
