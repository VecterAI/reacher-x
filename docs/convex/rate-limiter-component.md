# Rate Limiter

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

# Rate Limiter

[![get-convex's avatar](/_next/image?url=https%3A%2F%2Favatars.githubusercontent.com%2Fu%2F81530787%3Fv%3D4&w=96&q=75)

get-convex/rate-limiter

View repo

](https://github.com/get-convex/rate-limiter)[![GitHub logo](/\_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fnpm.bd053a67.svg&w=48&q=75)View package](https://www.npmjs.com/package/@convex-dev/rate-limiter)

### Category

[Backend](/components#backend 'Show all components in "Backend" category')

![Rate Limiter hero image](/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Frate-limiter.5b83ec72.png&w=1536&q=75)

```bash
npm install @convex-dev/rate-limiter
```

This component provides application-level rate limiting.

Teaser:

```ts
const rateLimiter = new RateLimiter(components.rateLimiter, {
  freeTrialSignUp: { kind: "fixed window", rate: 100, period: HOUR },
  sendMessage: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 3 },
});

// Restrict how fast free users can sign up to deter bots
const status = await rateLimiter.limit(ctx, "freeTrialSignUp");

// Limit how fast a user can send messages
const status = await rateLimiter.limit(ctx, "sendMessage", { key: userId });

// Use the React hook to check the rate limit
const { status, check } = useRateLimit(api.example.getRateLimit, { count });
```

See below for more details on usage.

**What is rate limiting?**

Rate limiting is the technique of controlling how often actions can be performed, typically on a server. There are a host of options for achieving this, most of which operate at the network layer.

**What is application-layer rate limiting?**

Application-layer rate limiting happens in your app's code where you are handling authentication, authorization, and other business logic. It allows you to define nuanced rules, and enforce policies more fairly. It is not the first line of defense for a sophisticated DDOS attack (which thankfully are extremely rare), but will serve most real-world use cases.

**What differentiates this approach?**

- Type-safe usage: you won't accidentally misspell a rate limit name.
- Configurable for fixed window or token bucket algorithms.
- Efficient storage and compute: storage is not proportional to requests.
- Configurable sharding for scalability.
- Transactional evaluation: all rate limit changes will roll back if your mutation fails.
- Fairness guarantees via credit "reservation": save yourself from exponential backoff.
- Opt-in "rollover" or "burst" allowance via a configurable `capacity`.
- Fails closed, not open: avoid cascading failure when traffic overwhelms your rate limits.

See the associated [Stack post](https://stack.convex.dev/rate-limiting) for more details and background.

## Pre-requisite: Convex[#](#pre-requisite-convex)

You'll need an existing Convex project to use the component. Convex is a hosted backend platform, including a database, serverless functions, and a ton more you can learn about [here](https://docs.convex.dev/get-started).

Run `npm create convex` or follow any of the [quickstarts](https://docs.convex.dev/home) to set one up.

## Installation[#](#installation)

Install the component package:

```ts
npm install @convex-dev/rate-limiter
```

Create a `convex.config.ts` file in your app's `convex/` folder and install the component by calling `use`:

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";

const app = defineApp();
app.use(rateLimiter);

export default app;
```

## Define your rate limits:[#](#define-your-rate-limits)

```ts
import { RateLimiter, MINUTE, HOUR } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

const rateLimiter = new RateLimiter(components.rateLimiter, {
  // One global / singleton rate limit, using a "fixed window" algorithm.
  freeTrialSignUp: { kind: "fixed window", rate: 100, period: HOUR },
  // A per-user limit, allowing one every ~6 seconds.
  // Allows up to 3 in quick succession if they haven't sent many recently.
  sendMessage: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 3 },
  failedLogins: { kind: "token bucket", rate: 10, period: HOUR },
  // Use sharding to increase throughput without compromising on correctness.
  llmTokens: { kind: "token bucket", rate: 40000, period: MINUTE, shards: 10 },
  llmRequests: { kind: "fixed window", rate: 1000, period: MINUTE, shards: 10 },
});
```

- You can safely generate multiple instances if you want to define different rates in separate places, provided the keys don't overlap.
- The units for `period` are milliseconds. `MINUTE` above is `60000`.

### Strategies:[#](#strategies)

The **`token bucket`** approach provides guarantees for overall consumption via the `rate` per `period` at which tokens are added, while also allowing unused tokens to accumulate (like "rollover" minutes) up to some `capacity` value. So if you could normally send 10 per minute, with a capacity of 20, then every two minutes you could send 20, or if in the last two minutes you only sent 5, you can send 15 now.

The **`fixed window`** approach differs in that the tokens are granted all at once, every `period` milliseconds. It similarly allows accumulating "rollover" tokens up to a `capacity` (defaults to the `rate` for both rate limit strategies). You can specify a custom `start` time if e.g. you want the period to reset at a specific time of day. By default it will be random to help space out requests that are retrying.

## Usage[#](#usage)

### Using a simple global rate limit:[#](#using-a-simple-global-rate-limit)

```ts
const { ok, retryAfter } = await rateLimiter.limit(ctx, "freeTrialSignUp");
```

- `ok` is whether it successfully consumed the resource
- `retryAfter` is when it would have succeeded in the future.

**Note**: If you have many clients using the `retryAfter` to decide when to retry, defend against a [thundering herd](https://en.wikipedia.org/wiki/Thundering_herd_problem) by adding some [jitter](#adding-jitter). Or use the `reserve` functionality discussed [below](#reserving-capacity).

### Per-user rate limit:[#](#per-user-rate-limit)

Use `key` to use a rate limit specific to some user / team / session ID / etc.

```ts
const status = await rateLimiter.limit(ctx, "sendMessage", { key: userId });
```

### Consume a custom count[#](#consume-a-custom-count)

By default, each call to `limit` counts as one unit. Pass `count` to customize.

```ts
// Consume multiple in one request to prevent rate limits on an LLM API.
const status = await rateLimiter.limit(ctx, "llmTokens", { count: tokens });
```

### Throw automatically[#](#throw-automatically)

By default it will return `{ ok, retryAfter }`. To have it throw automatically when the limit is exceeded, use `throws`. It throws a `ConvexError` with `RateLimitError` data (`data: {kind, name, retryAfter}`) instead of returning when `ok` is false.

```ts
// Automatically throw an error if the rate limit is hit
await rateLimiter.limit(ctx, "failedLogins", { key: userId, throws: true });
```

### Check a rate limit without consuming it[#](#check-a-rate-limit-without-consuming-it)

```ts
const status = await rateLimiter.check(ctx, "failedLogins", { key: userId });
```

### Reset a rate limit[#](#reset-a-rate-limit)

```ts
// Reset a rate limit on successful login
await rateLimiter.reset(ctx, "failedLogins", { key: userId });
```

### Define a rate limit inline / dynamically[#](#define-a-rate-limit-inline--dynamically)

```ts
// Use a one-off rate limit config (when not named on initialization)
const config = { kind: "fixed window", rate: 1, period: SECOND };
const status = await rateLimiter.limit(ctx, "oneOffName", { config });
```

### Using the React hook[#](#using-the-react-hook)

You can use the React hook to check the rate limit in your browser code.

First, define the server API to get the rate limit value:

```ts
// In convex/example.ts
export const { getRateLimit, getServerTime } = rateLimiter.hookAPI(
  "sendMessage",
  {
    // Optionally provide a key function to get the key for the rate limit
    key: async (ctx) => await getUserId(ctx),
    // To allow the client to provide the key, pass a function that takes the key from the client
    key: async (ctx, keyFromClient) => {
      await ensureUserCanUseKey(ctx, keyFromClient);
      return keyFromClient;
    },
  }
);
```

Then, use the React hook to check the rate limit:

```ts
function App() {
  const { status: { ok, retryAt }, check } = useRateLimit(api.example.getRateLimit, {
    // [recommended] Allows the hook to sync the browser and server clocks
    getServerTimeMutation: getServerTime,
    // [optional] The number of tokens to wait on
    count: 1,
  });

  // If you want to check at specific times and get the concrete value:
  const { value, ts, config, ok, retryAt } = check(Date.now(), count);
```

### Fetching the current value directly[#](#fetching-the-current-value-directly)

You can fetch the current value of a rate limit directly, if you want to know the concrete value and timestamp it was last updated.

```ts
const { config, value, ts } = await rateLimiter.getValue(ctx, "sendMessage", {
  key: userId,
});
```

And you can use `calculateRateLimit` to calculate the value at a given timestamp:

```ts
import { calculateRateLimit } from "@convex-dev/rate-limiter";

const { config, value, ts } = calculateRateLimit(
  { value, ts },
  config,
  Date.now(),
  count || 0
);
```

### Scaling rate limiting with shards[#](#scaling-rate-limiting-with-shards)

When many requests are happening at once, they can all be trying to modify the same values in the database. Because Convex provides strong transactions, they will never overwrite each other, so you don't have to worry about the rate limiter succeeding more often than it should. However, when there is high contention for these values, it causes [optimistic concurrency control conflicts](https://stack.convex.dev/how-convex-works#read-and-write-sets). Convex automatically retries these a number of times with backoff, but it's still best to avoid them.

Not to worry! To provide high throughput, we can use a technique called "sharding" where we break up the total capacity into individual buckets, or "shards". When we go to use some of that capacity, we check a random shard.[1](#power-of-two) While sometimes we'll get unlucky and get rate limited when there was capacity elsewhere, we'll never voilate the rate limit's upper bound.

```ts
const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Use sharding to increase throughput without compromising on correctness.
  llmTokens: { kind: "token bucket", rate: 40000, period: MINUTE, shards: 10 },
  llmRequests: { kind: "fixed window", rate: 1000, period: MINUTE, shards: 10 },
});
```

Here we're using 10 shards to handle 1,000 QPM. If you want some rough math to guess at how many shards to add, take the max queries per second you expect and divide by two. It's also useful for each shard to have five (ideally ten) or more capacity. In this case, we have ten (rate / shards) and don't expect normal traffic to exceed ~20 QPS.

**Tip**: If you want a rate like `{ rate: 100, period: SECOND }` and you are flexible in the overall period, then you can shard this by increasing the rate and period proportionally to get enough shards and capacity per shard: `{ shards: 50, rate: 250, period: 2.5 * SECOND }` or even better: `{ shards: 50, rate: 1000, period: 10 * SECOND }`.

#### Power of two[#](#power-of-two)

We're actually going one step further and checking two shards and using the one with more capacity, to keep them relatively balanced, based on the [power of two technique](https://www.eecs.harvard.edu/~michaelm/postscripts/tpds2001.pdf). We will also combine the capacity of the two shards if neither has enough on their own.

### Reserving capacity:[#](#reserving-capacity)

You can also allow it to `reserve` capacity to avoid starvation on larger requests.

When you reserve capacity ahead of time, the contract is that you can run your operation at the specified time (via the `retryAfter` field), at which point you don't have to re-check the rate limit. Your capacity has been "ear-marked".

With this, you can queue up many operations and they will be run at spaced-out intervals, maximizing the utilization of the rate limit.

Details in the [Stack post](https://stack.convex.dev/rate-limiting).

```ts
const myAction = internalAction({
  args: {
    //...
    skipCheck: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!args.skipCheck) {
      // Reserve future capacity instead of just failing now
      const status = await rateLimiter.limit(ctx, "llmRequests", {
        reserve: true,
      });
      if (status.retryAfter) {
        return ctx.scheduler.runAfter(
          status.retryAfter,
          internal.foo.myAction,
          {
            // When we run in the future, we can skip the rate limit check,
            // since we've just reserved that capacity.
            skipCheck: true,
          }
        );
      }
    }
    // do the operation
  },
});
```

### Adding jitter[#](#adding-jitter)

When too many users show up at once, it can cause network congestion, database contention, and consume other shared resources at an unnecessarily high rate. Instead we can return a random time within the next period to retry. Hopefully this is infrequent. This technique is referred to as adding "jitter."

A simple implementation could look like:

```ts
const retryAfter = status.retryAfter + Math.random() * period;
```

For the fixed window, we also introduce randomness by picking the start time of the window (from which all subsequent windows are based) randomly if config.start wasn't provided. This helps from all clients flooding requests at midnight and paging you.

## More resources[#](#more-resources)

[Check out a full example here](https://github.com/get-convex/rate-limiter/blob/main/example/convex/example.ts).

See [this article](https://stack.convex.dev/rate-limiting) for more information on usage and advanced patterns, for example:

- How the different rate limiting strategies work under the hood.
- Using multiple rate limits in a single transaction.
- Rate limiting anonymous users.

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

![](https://t.co/1/i/adsct?bci=4&dv=Asia%2FKarachi%26en-US%2Cen%26Google%20Inc.%26MacIntel%26127%261512%26982%2610%2630%261512%26944%260%26na&eci=3&event=%7B%7D&event_id=d692ec3f-386e-4c9c-a514-554f89b640ad&integration=advertiser&p_id=Twitter&p_user_id=0&pl_id=afe1ce52-f44c-4db5-a60c-13b1a7b9a43d&pt=Rate%20Limiter&tw_document_href=https%3A%2F%2Fwww.convex.dev%2Fcomponents%2Frate-limiter&tw_iframe_status=0&txn_id=omuhs&type=javascript&version=2.3.35)![](https://analytics.twitter.com/1/i/adsct?bci=4&dv=Asia%2FKarachi%26en-US%2Cen%26Google%20Inc.%26MacIntel%26127%261512%26982%2610%2630%261512%26944%260%26na&eci=3&event=%7B%7D&event_id=d692ec3f-386e-4c9c-a514-554f89b640ad&integration=advertiser&p_id=Twitter&p_user_id=0&pl_id=afe1ce52-f44c-4db5-a60c-13b1a7b9a43d&pt=Rate%20Limiter&tw_document_href=https%3A%2F%2Fwww.convex.dev%2Fcomponents%2Frate-limiter&tw_iframe_status=0&txn_id=omuhs&type=javascript&version=2.3.35)
