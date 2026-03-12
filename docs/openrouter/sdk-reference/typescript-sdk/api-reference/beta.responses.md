---

title: Beta.Responses - TypeScript SDK
subtitle: Beta.Responses method reference
headline: Beta.Responses | OpenRouter TypeScript SDK
canonical-url: '[https://openrouter.ai/docs/sdks/typescript/api-reference/responses](https://openrouter.ai/docs/sdks/typescript/api-reference/responses)'
'og:site_name': OpenRouter Documentation
'og:title': Beta.Responses | OpenRouter TypeScript SDK
'og:description': >-
Beta.Responses method documentation for the OpenRouter TypeScript SDK. Learn
how to use this API endpoint with code examples.
'og:image':
type: url
value: >-
[https://openrouter.ai/dynamic-og?title=Beta.Responses%20-%20TypeScript%20SDK\&description=Beta.Responses%20method%20reference](https://openrouter.ai/dynamic-og?title=Beta.Responses%20-%20TypeScript%20SDK&description=Beta.Responses%20method%20reference)
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

beta.responses endpoints

### Available Operations

- [send](#send) - Create a response

## send

Creates a streaming or non-streaming response using OpenResponses API format

### Example Usage

{/_ UsageSnippet language="typescript" operationID="createResponses" method="post" path="/responses" _/}

```typescript
import { OpenRouter } from "@openrouter/sdk";

const openRouter = new OpenRouter({
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const result = await openRouter.beta.responses.send({});

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { OpenRouterCore } from "@openrouter/sdk/core.js";
import { betaResponsesSend } from "@openrouter/sdk/funcs/betaResponsesSend.js";

// Use `OpenRouterCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const openRouter = new OpenRouterCore({
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const res = await betaResponsesSend(openRouter, {});
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("betaResponsesSend failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter              | Type                                                                                           | Required           | Description                                                                                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`              | [models.OpenResponsesRequest](/docs/sdks/typescript/api-reference/models/openresponsesrequest) | :heavy_check_mark: | The request object to use for the request.                                                                                                                                     |
| `options`              | RequestOptions                                                                                 | :heavy_minus_sign: | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions` | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)        | :heavy_minus_sign: | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`      | [RetryConfig](/docs/sdks/typescript/api-reference/lib/retryconfig)                             | :heavy_minus_sign: | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.CreateResponsesResponse](/docs/sdks/typescript/api-reference/operations/createresponsesresponse)>**

### Errors

| Error Type                              | Status Code | Content Type     |
| --------------------------------------- | ----------- | ---------------- |
| errors.BadRequestResponseError          | 400         | application/json |
| errors.UnauthorizedResponseError        | 401         | application/json |
| errors.PaymentRequiredResponseError     | 402         | application/json |
| errors.NotFoundResponseError            | 404         | application/json |
| errors.RequestTimeoutResponseError      | 408         | application/json |
| errors.PayloadTooLargeResponseError     | 413         | application/json |
| errors.UnprocessableEntityResponseError | 422         | application/json |
| errors.TooManyRequestsResponseError     | 429         | application/json |
| errors.InternalServerResponseError      | 500         | application/json |
| errors.BadGatewayResponseError          | 502         | application/json |
| errors.ServiceUnavailableResponseError  | 503         | application/json |
| errors.EdgeNetworkTimeoutResponseError  | 524         | application/json |
| errors.ProviderOverloadedResponseError  | 529         | application/json |
| errors.OpenRouterDefaultError           | 4XX, 5XX    | \*/\*            |
