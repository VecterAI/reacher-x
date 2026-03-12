---

title: Analytics - TypeScript SDK
subtitle: Analytics method reference
headline: Analytics | OpenRouter TypeScript SDK
canonical-url: '[https://openrouter.ai/docs/sdks/typescript/api-reference/analytics](https://openrouter.ai/docs/sdks/typescript/api-reference/analytics)'
'og:site_name': OpenRouter Documentation
'og:title': Analytics | OpenRouter TypeScript SDK
'og:description': >-
Analytics method documentation for the OpenRouter TypeScript SDK. Learn how to
use this API endpoint with code examples.
'og:image':
type: url
value: >-
[https://openrouter.ai/dynamic-og?title=Analytics%20-%20TypeScript%20SDK\&description=Analytics%20method%20reference](https://openrouter.ai/dynamic-og?title=Analytics%20-%20TypeScript%20SDK&description=Analytics%20method%20reference)
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

Analytics and usage endpoints

### Available Operations

- [getUserActivity](#getuseractivity) - Get user activity grouped by endpoint

## getUserActivity

Returns user activity data grouped by endpoint for the last 30 (completed) UTC days. [Provisioning key](/docs/guides/overview/auth/provisioning-api-keys) required.

### Example Usage

{/_ UsageSnippet language="typescript" operationID="getUserActivity" method="get" path="/activity" _/}

```typescript
import { OpenRouter } from "@openrouter/sdk";

const openRouter = new OpenRouter({
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const result = await openRouter.analytics.getUserActivity();

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { OpenRouterCore } from "@openrouter/sdk/core.js";
import { analyticsGetUserActivity } from "@openrouter/sdk/funcs/analyticsGetUserActivity.js";

// Use `OpenRouterCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const openRouter = new OpenRouterCore({
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const res = await analyticsGetUserActivity(openRouter);
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("analyticsGetUserActivity failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter              | Type                                                                                                       | Required           | Description                                                                                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`              | [operations.GetUserActivityRequest](/docs/sdks/typescript/api-reference/operations/getuseractivityrequest) | :heavy_check_mark: | The request object to use for the request.                                                                                                                                     |
| `options`              | RequestOptions                                                                                             | :heavy_minus_sign: | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions` | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                    | :heavy_minus_sign: | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`      | [RetryConfig](/docs/sdks/typescript/api-reference/lib/retryconfig)                                         | :heavy_minus_sign: | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.GetUserActivityResponse](/docs/sdks/typescript/api-reference/operations/getuseractivityresponse)>**

### Errors

| Error Type                         | Status Code | Content Type     |
| ---------------------------------- | ----------- | ---------------- |
| errors.BadRequestResponseError     | 400         | application/json |
| errors.UnauthorizedResponseError   | 401         | application/json |
| errors.ForbiddenResponseError      | 403         | application/json |
| errors.InternalServerResponseError | 500         | application/json |
| errors.OpenRouterDefaultError      | 4XX, 5XX    | \*/\*            |
