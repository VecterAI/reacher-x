# AI Agents

## Building AI Agents with Convex[​](#building-ai-agents-with-convex "Direct link to Building AI Agents with Convex")

Convex provides powerful building blocks for building agentic AI applications, leveraging Components and existing Convex features.

With Convex, you can separate your long-running agentic workflows from your UI, without the user losing reactivity and interactivity. The message history with an LLM is persisted by default, live updating on every client, and easily composed with other Convex features using code rather than configuration.

## Agent Component[​](#agent-component "Direct link to Agent Component")

The Agent component is a core building block for building AI agents. It manages threads and messages, around which your Agents can cooperate in static or dynamic workflows.

[Agent Component YouTube Video](https://www.youtube.com/embed/tUKMPUlOCHY?si=ce-M8pt6EWDZ8tfd)

[Agent Component YouTube Video](https://www.youtube.com/embed/tUKMPUlOCHY?si=ce-M8pt6EWDZ8tfd)

### Core Concepts[​](#core-concepts "Direct link to Core Concepts")

- Agents organize LLM prompting with associated models, prompts, and [Tools](/agents/tools.md). They can generate and stream both text and objects.
- Agents can be used in any Convex action, letting you write your agentic code alongside your other business logic with all the abstraction benefits of using code rather than static configuration.
- [Threads](/agents/threads.md) persist [messages](/agents/messages.md) and can be shared by multiple users and agents (including [human agents](/agents/human-agents.md)).
- [Conversation context](/agents/context.md) is automatically included in each LLM call, including built-in hybrid vector/text search for messages.

### Advanced Features[​](#advanced-features "Direct link to Advanced Features")

- [Workflows](/agents/workflows.md) allow building multi-step operations that can span agents, users, durably and reliably.
- [RAG](/agents/rag.md) techniques are also supported for prompt augmentation either up front or as tool calls using the [RAG Component](https://www.convex.dev/components/rag).
- [Files](/agents/files.md) can be used in the chat history with automatic saving to [file storage](/file-storage.md).

### Debugging and Tracking[​](#debugging-and-tracking "Direct link to Debugging and Tracking")

- [Debugging](/agents/debugging.md) is supported, including the [agent playground](/agents/playground.md) where you can inspect all metadata and iterate on prompts and context settings.
- [Usage tracking](/agents/usage-tracking.md) enables usage billing for users and teams.
- [Rate limiting](/agents/rate-limiting.md) helps control the rate at which users can interact with agents and keep you from exceeding your LLM provider's limits.

## [Build your first Agent](/agents/getting-started.md)

Learn more about the motivation by reading: [AI Agents with Built-in Memory](https://stack.convex.dev/ai-agents).

Sample code:

```
import { Agent } from "@convex-dev/agents";
import { openai } from "@ai-sdk/openai";
import { components } from "./_generated/api";
import { action } from "./_generated/server";

// Define an agent
const supportAgent = new Agent(components.agent, {
  name: "Support Agent",
  chat: openai.chat("gpt-4o-mini"),
  instructions: "You are a helpful assistant.",
  tools: { accountLookup, fileTicket, sendEmail },
});

// Use the agent from within a normal action:
export const createThread = action({
  args: { prompt: v.string() },
  handler: async (ctx, { prompt }) => {
    const { threadId, thread } = await supportAgent.createThread(ctx);
    const result = await thread.generateText({ prompt });
    return { threadId, text: result.text };
  },
});

// Pick up where you left off, with the same or a different agent:
export const continueThread = action({
  args: { prompt: v.string(), threadId: v.string() },
  handler: async (ctx, { prompt, threadId }) => {
    // This includes previous message history from the thread automatically.
    const { thread } = await anotherAgent.continueThread(ctx, { threadId });
    const result = await thread.generateText({ prompt });
    return result.text;
  },
});
```
