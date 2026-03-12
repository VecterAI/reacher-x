---

title: Chat - TypeScript SDK
subtitle: Chat method reference
headline: Chat | OpenRouter TypeScript SDK
canonical-url: '[https://openrouter.ai/docs/sdks/typescript/api-reference/chat](https://openrouter.ai/docs/sdks/typescript/api-reference/chat)'
'og:site_name': OpenRouter Documentation
'og:title': Chat | OpenRouter TypeScript SDK
'og:description': >-
Chat method documentation for the OpenRouter TypeScript SDK. Learn how to use
this API endpoint with code examples.
'og:image':
type: url
value: >-
[https://openrouter.ai/dynamic-og?title=Chat%20-%20TypeScript%20SDK\&description=Chat%20method%20reference](https://openrouter.ai/dynamic-og?title=Chat%20-%20TypeScript%20SDK&description=Chat%20method%20reference)
'og:image:width': 1200
'og:image:height': 630
'twitter:card': summary_large_image
'twitter:site': '@OpenRouter'
noindex: false
nofollow: false

---

{/_ banner:start _/}

<Warning>
  The TypeScript SDK and docs are currently in beta.
  Report issues on [GitHub](https://github.com/OpenRouterTeam/typescript-sdk/issues).
</Warning>

{/_ banner:end _/}

## Overview

### Available Operations

- [send](#send) - Create a chat completion

## send

Sends a request for a model response for the given chat conversation. Supports both streaming and non-streaming modes.

### Example Usage

{/_ UsageSnippet language="typescript" operationID="sendChatCompletionRequest" method="post" path="/chat/completions" _/}

```typescript
import { OpenRouter } from "@openrouter/sdk";

const openRouter = new OpenRouter({
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const result = await openRouter.chat.send({
    messages: [],
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { OpenRouterCore } from "@openrouter/sdk/core.js";
import { chatSend } from "@openrouter/sdk/funcs/chatSend.js";

// Use `OpenRouterCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const openRouter = new OpenRouterCore({
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const res = await chatSend(openRouter, {
    messages: [],
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("chatSend failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter              | Type                                                                                           | Required           | Description                                                                                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`              | [models.ChatGenerationParams](/docs/sdks/typescript/api-reference/models/chatgenerationparams) | :heavy_check_mark: | The request object to use for the request.                                                                                                                                     |
| `options`              | RequestOptions                                                                                 | :heavy_minus_sign: | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions` | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)        | :heavy_minus_sign: | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`      | [RetryConfig](/docs/sdks/typescript/api-reference/lib/retryconfig)                             | :heavy_minus_sign: | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.SendChatCompletionRequestResponse](/docs/sdks/typescript/api-reference/operations/sendchatcompletionrequestresponse)>**

### Errors

| Error Type                    | Status Code   | Content Type     |
| ----------------------------- | ------------- | ---------------- |
| errors.ChatError              | 400, 401, 429 | application/json |
| errors.ChatError              | 500           | application/json |
| errors.OpenRouterDefaultError | 4XX, 5XX      | \*/\*            |
