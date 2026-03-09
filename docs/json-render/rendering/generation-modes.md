# Generation Modes

json-render supports two modes for AI-generated UI: **Generate mode** for standalone UI and **Chat mode** for inline UI within a conversation.

The mode controls how the AI formats its output and how your app processes the stream. The underlying JSONL patch format is the same in both modes.

<GenerationModesDiagram />

## Generate Mode (Standalone)

In generate mode, the AI outputs **only JSONL patches** — no prose, no markdown. The entire response is a UI spec.

This is the default mode and is ideal for:

- Playground and builder tools
- Form generators
- Dashboard builders
- Any UI where the generated interface is the whole response

### Setup

```typescript
// Generate mode is the default (no mode option needed)
const systemPrompt = catalog.prompt({
  customRules: [
    "Use Card as root for forms and small UIs.",
    "Use Grid for multi-column layouts.",
  ],
});

const result = streamText({
  model: "anthropic/claude-haiku-4.5",
  system: systemPrompt,
  prompt: userPrompt,
});
```

### Client

On the client, use `useUIStream` from `@json-render/react` or the lower-level `createSpecStreamCompiler` from `@json-render/core` to compile the JSONL stream into a spec:

```tsx
function Playground() {
  const { spec, isStreaming, send } = useUIStream({
    api: "/api/generate",
  });

  return <Renderer spec={spec} registry={registry} loading={isStreaming} />;
}
```

### Example output

The AI outputs only JSONL — one patch per line, no surrounding text:

```
{"op":"add","path":"/root","value":"card-1"}
{"op":"add","path":"/elements/card-1","value":{"type":"Card","props":{"title":"Sign In"},"children":["email","password","submit"]}}
{"op":"add","path":"/elements/email","value":{"type":"Input","props":{"label":"Email","name":"email","type":"email"}}}
{"op":"add","path":"/elements/password","value":{"type":"Input","props":{"label":"Password","name":"password","type":"password"}}}
{"op":"add","path":"/elements/submit","value":{"type":"Button","props":{"label":"Sign In"}}}
```

## Chat Mode (Inline)

In chat mode, the AI responds **conversationally first**, then outputs JSONL patches on their own lines. Text-only replies are allowed when no UI is needed (e.g. greetings, clarifying questions).

This is ideal for:

- AI chatbots with rich UI responses
- Copilot experiences
- Educational assistants
- Any conversational interface where generated UI is embedded in chat messages

### Setup

```typescript
// Enable chat mode
const systemPrompt = catalog.prompt({ mode: "chat" });

const result = streamText({
  model: yourModel,
  system: systemPrompt,
  messages,
});

// In your API route, pipe the stream through pipeJsonRender
// to separate text from JSONL patches
const stream = createUIMessageStream({
  execute: async ({ writer }) => {
    writer.merge(pipeJsonRender(result.toUIMessageStream()));
  },
});

return createUIMessageStreamResponse({ stream });
```

`pipeJsonRender` inspects each line of the AI's response. Lines that parse as JSONL patches are emitted as `data-spec` parts (which the renderer picks up). Everything else is passed through as text.

### Client

On the client, use `useJsonRenderMessage` from `@json-render/react` to extract the spec from a chat message's parts:

```tsx
function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();

  return (
    <div>
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      {/* input form */}
    </div>
  );
}

function ChatMessage({ message }) {
  const { spec } = useJsonRenderMessage(message.parts);

  return (
    <div>
      {/* Render text parts */}
      {message.parts
        .filter((p) => p.type === "text")
        .map((p, i) => (
          <p key={i}>{p.text}</p>
        ))}

      {/* Render the generated UI inline */}
      {spec && <Renderer spec={spec} registry={registry} />}
    </div>
  );
}
```

### Example output

The AI writes a brief explanation, then JSONL patches on their own lines:

```
Here's a dashboard showing the latest crypto prices:

{"op":"add","path":"/root","value":"dashboard"}
{"op":"add","path":"/state/prices","value":[{"name":"Bitcoin","price":98450},{"name":"Ethereum","price":3120}]}
{"op":"add","path":"/elements/dashboard","value":{"type":"Grid","props":{"columns":"2"},"children":["btc","eth"]}}
{"op":"add","path":"/elements/btc","value":{"type":"Metric","props":{"label":"Bitcoin","value":{"$state":"/prices/0/price"}}}}
{"op":"add","path":"/elements/eth","value":{"type":"Metric","props":{"label":"Ethereum","value":{"$state":"/prices/1/price"}}}}
```

If the user asks a simple question ("what does BTC stand for?"), the AI replies with text only — no JSONL.

## Quick Comparison

Both modes use the same JSONL patch format (RFC 6902) and the same catalog/registry system. The only difference is whether the AI is allowed to include prose alongside the patches.

## Next

- Learn about the [JSONL streaming format](/docs/streaming)
- See the [AI SDK integration](/docs/ai-sdk) for setup with the Vercel AI SDK
