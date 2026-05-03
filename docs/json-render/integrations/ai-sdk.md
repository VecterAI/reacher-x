# AI SDK Integration

Use json-render with the [Vercel AI SDK](https://sdk.vercel.ai) for seamless streaming. json-render supports two modes: **Generate** (standalone UI) and **Chat** (UI embedded in conversation). See [Generation Modes](/docs/generation-modes) for a detailed comparison.

## Installation

```bash
npm install ai @ai-sdk/react
```

## Generate Mode

In generate mode, the AI outputs only JSONL patches. The entire response is a UI spec with no prose. This is the default mode and is ideal for playgrounds, builders, and dashboard generators.

### API Route

```typescript
// app/api/generate/route.ts

  const { prompt, currentTree } = await req.json();

  const systemPrompt = catalog.prompt();

  // Optionally include current UI state for context
  const contextPrompt = currentTree
    ? `\n\nCurrent UI state:\n${JSON.stringify(currentTree, null, 2)}`
    : "";

  const result = streamText({
    model: yourModel,
    system: systemPrompt + contextPrompt,
    prompt,
  });

  return result.toTextStreamResponse();
}
```

### Client

Use `useUIStream` on the client to compile the JSONL stream into a spec:

```tsx
"use client";

function GenerativeUI() {
  const { spec, isStreaming, error, send } = useUIStream({
    api: "/api/generate",
  });

  return (
    <div>
      <button
        onClick={() => send("Create a dashboard with metrics")}
        disabled={isStreaming}
      >
        {isStreaming ? "Generating..." : "Generate"}
      </button>

      {error && <p className="text-red-500">{error.message}</p>}

      <Renderer spec={spec} registry={registry} loading={isStreaming} />
    </div>
  );
}
```

## Chat Mode

In chat mode, the AI responds conversationally and includes JSONL patches inline. Text-only replies are allowed when no UI is needed. This is ideal for chatbots, copilots, and educational assistants.

### API Route

Use `pipeJsonRender` to separate text from JSONL patches in the stream. Patches are emitted as data parts that the client can pick up.

```typescript
// app/api/chat/route.ts
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";

  const { messages } = await req.json();

  const result = streamText({
    model: yourModel,
    system: catalog.prompt({ mode: "chat" }),
    messages,
  });

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.merge(pipeJsonRender(result.toUIMessageStream()));
    },
  });

  return createUIMessageStreamResponse({ stream });
}
```

### Client

Use `useChat` from the AI SDK and `useJsonRenderMessage` from json-render to extract the spec from each message:

```tsx
"use client";

function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: "/api/chat",
  });

  return (
    <div>
      <div>
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask something..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}

function ChatMessage({
  message,
}: {
  message: { parts: Array<{ type: string; text?: string; data?: unknown }> };
}) {
  const { spec, text, hasSpec } = useJsonRenderMessage(message.parts);

  return (
    <div>
      {text && <p>{text}</p>}
      {hasSpec && spec && <Renderer spec={spec} registry={registry} />}
    </div>
  );
}
```

## Prompt Engineering

The `catalog.prompt()` method creates an optimized system prompt that:

- Lists all available components and their props
- Describes available actions
- Specifies the expected output format (JSONL-only or text + JSONL depending on mode)
- Includes examples for better generation

### Custom Rules

Pass custom rules to tailor AI behavior:

```typescript
const systemPrompt = catalog.prompt({
  customRules: [
    "Always use Card components for grouping related content",
    "Prefer horizontal layouts (Row) for metrics",
    'Use consistent spacing with padding="md"',
  ],
});
```

### Chat Mode Prompt

```typescript
const chatPrompt = catalog.prompt({ mode: "chat" });
```

In chat mode, the prompt instructs the AI to respond conversationally first, then include JSONL patches on their own lines when UI is needed. Text-only replies are allowed.

## Which Mode?

Learn more in the [Generation Modes](/docs/generation-modes) guide.

## Next

- Learn about [progressive streaming](/docs/streaming)
- See the [chat example](https://github.com/vercel-labs/json-render/tree/main/examples/chat) for a complete implementation
