# Polar

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

GitHub18,242 stars

](https://github.com/get-convex/convex-backend)[Log in](/login)[Start building](/start)

[Back to Components](/components)

# Polar

[![get-convex's avatar](/_next/image?url=https%3A%2F%2Favatars.githubusercontent.com%2Fu%2F81530787%3Fv%3D4&w=96&q=75)

get-convex/polar

View repo

](https://github.com/erquhart/convex-polar)[![GitHub logo](/\_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fnpm.bd053a67.svg&w=48&q=75)View package](https://www.npmjs.com/package/@convex-dev/polar)

### Category

[Payments](/components#payments 'Show all components in "Payments" category')

![Polar hero image](/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fpolar.ed42a65c.png&w=1536&q=75)

```bash
npm install @convex-dev/polar
```

# Convex Polar Component [![npm version](https://badge.fury.io/js/@convex-dev%2Fpolar.svg)](https://badge.fury.io/js/@convex-dev%2Fpolar)

Add subscriptions and billing to your Convex app with [Polar](https://polar.sh).

**Check out the [example app](https://github.com/erquhart/convex-polar/blob/main/example) for a complete example.**

```ts
// Get subscription details for the current user
// Note: getCurrentSubscription is for apps that only allow one active
// subscription per user. If you need to support multiple active
// subscriptions, use listUserSubscriptions instead.
const {
  productKey,
  status,
  currentPeriodEnd,
  currentPeriodStart,
  ...
} = await polar.getCurrentSubscription(ctx, {
  userId: user._id,
});

// Show available plans
<CheckoutLink
  polarApi={api.example}
  productIds={[products.premiumMonthly.id, products.premiumYearly.id]}
  // Optional: turn off embedding to link to a checkout page
  embed={false}
>
  Upgrade to Premium
</CheckoutLink>

// Manage existing subscriptions
<CustomerPortalLink polarApi={api.example}>
  Manage Subscription
</CustomerPortalLink>
```

## Prerequisites[#](#prerequisites)

### Convex App[#](#convex-app)

You'll need a Convex App to use the component. Follow any of the [Convex quickstarts](https://docs.convex.dev/home) to set one up.

### Polar Account[#](#polar-account)

- [Create a Polar account](https://polar.sh)
- Create an organization and generate an organization token with permissions:
  - `products:read`
  - `products:write`
  - `subscriptions:read`
  - `subscriptions:write`
  - `customers:read`
  - `customers:write`
  - `checkouts:read`
  - `checkouts:write`
  - `checkout_links:read`
  - `checkout_links:write`
  - `customer_portal:read`
  - `customer_portal:write`
  - `customer_sessions:write`

## Installation[#](#installation)

Install the component package:

```ts
npm install @convex-dev/polar
```

Create a `convex.config.ts` file in your app's `convex/` folder and install the component by calling `app.use`:

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import polar from "@convex-dev/polar/convex.config.js";

const app = defineApp();
app.use(polar);

export default app;
```

Set your Polar organization token:

```ts
npx convex env set POLAR_ORGANIZATION_TOKEN xxxxx
```

## Usage[#](#usage)

### Set up Polar webhooks[#](#set-up-polar-webhooks)

The Polar component uses webhooks to keep subscription data in sync. You'll need to:

1.  Create a webhook and webhook secret in the Polar dashboard, using your [Convex site URL](https://docs.convex.dev/production/environment-variables#system-environment-variables) + `/polar/events` as the webhook endpoint. It should look like this: `https://verb-noun-123.convex.site/polar/events`

    Enable the following events:
    - `product.created`
    - `product.updated`
    - `subscription.created`
    - `subscription.updated`

2.  Set the webhook secret in your Convex environment:

```ts
npx convex env set POLAR_WEBHOOK_SECRET xxxxx
```

3.  Register the webhook handler in your `convex/http.ts`:

```ts
import { httpRouter } from "convex/server";
import { polar } from "./example";

const http = httpRouter();

// Register the webhook handler at /polar/events
polar.registerRoutes(http as any);

export default http;
```

You can also provide callbacks for webhook events:

```ts
polar.registerRoutes(http, {
  // Optional custom path, default is "/polar/events"
  path: "/polar/events",
  // Optional callbacks for webhook events
  onSubscriptionUpdated: async (ctx, event) => {
    // Handle subscription updates, like cancellations.
    // Note that a cancelled subscription will not be deleted from the database,
    // so this information remains available without a hook, eg., via
    // `getCurrentSubscription()`.
    if (event.data.customerCancellationReason) {
      console.log("Customer cancelled:", event.data.customerCancellationReason);
    }
  },
  onSubscriptionCreated: async (ctx, event) => {
    // Handle new subscriptions
  },
  onProductCreated: async (ctx, event) => {
    // Handle new products
  },
  onProductUpdated: async (ctx, event) => {
    // Handle product updates
  },
});
```

4.  Be sure to run `npx convex dev` to start your Convex app with the Polar component enabled, which will deploy the webhook handler to your Convex instance.

### Create products in Polar[#](#create-products-in-polar)

Create a product in the Polar dashboard for each pricing plan that you want to offer. The product data will be synced to your Convex app automatically.

**Note:** You can have one price per plan, so a plan with monthly and yearly pricing requires two products in Polar.

**Note:** The Convex Polar component is currently built to support recurring subscriptions, and may not work as expected with one-time payments. Please [open an issue](https://github.com/convex-dev/polar/issues) or [reach out on Discord](https://discord.gg/convex) if you run into any issues.

Products created prior to using this component need to be synced with Convex using the `syncProducts` function.

### Initialize the Polar client[#](#initialize-the-polar-client)

Create a Polar client in your Convex backend:

```ts
// convex/example.ts
import { Polar } from "@convex-dev/polar";
import { api, components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";

export const polar = new Polar(components.polar, {
  // Required: provide a function the component can use to get the current user's ID and
  // email - this will be used for retrieving the correct subscription data for the
  // current user. The function should return an object with `userId` and `email`
  // properties.
  getUserInfo: async (ctx) => {
    const user = await ctx.runQuery(api.example.getCurrentUser);
    return {
      userId: user._id,
      email: user.email,
    };
  },
  // Optional: Configure static keys for referencing your products.
  // Alternatively you can use the `listAllProducts` function to get
  // the product data and sort it out in your UI however you like
  // (eg., by price, name, recurrence, etc.).
  // Map your product keys to Polar product IDs (you can also use env vars for this)
  // Replace these keys with whatever is useful for your app (eg., "pro", "proMonthly",
  // whatever you want), and replace the values with the actual product IDs from your
  // Polar dashboard
  products: {
    premiumMonthly: "product_id_from_polar",
    premiumYearly: "product_id_from_polar",
    premiumPlusMonthly: "product_id_from_polar",
    premiumPlusYearly: "product_id_from_polar",
  },
  // Optional: Set Polar configuration directly in code
  organizationToken: "your_organization_token", // Defaults to POLAR_ORGANIZATION_TOKEN env var
  webhookSecret: "your_webhook_secret", // Defaults to POLAR_WEBHOOK_SECRET env var
  server: "sandbox", // Optional: "sandbox" or "production", defaults to POLAR_SERVER env var
});

// Export API functions from the Polar client
export const {
  changeCurrentSubscription,
  cancelCurrentSubscription,
  getConfiguredProducts,
  listAllProducts,
  generateCheckoutLink,
  generateCustomerPortalUrl,
} = polar.api();
```

### Display products and prices[#](#display-products-and-prices)

Use the exported `getConfiguredProducts` or `listAllProducts`function to display your products and their prices:

#### `getConfiguredProducts`[#](#getconfiguredproducts)

```ts
// Simple example of displaying products and prices if you've configured
// products by key in the Polar constructor
function PricingTable() {
  const products = useQuery(api.example.getConfiguredProducts);
  if (!products) return null;

  return (
    <div>
      {products.premiumMonthly && (
        <div>
          <h3>{products.premiumMonthly.name}</h3>
          <p>
            ${(products.premiumMonthly.prices[0].priceAmount ?? 0) / 100}/month
          </p>
        </div>
      )}
      {products.premiumYearly && (
        <div>
          <h3>{products.premiumYearly.name}</h3>
          <p>
            ${(products.premiumYearly.prices[0].priceAmount ?? 0) / 100}/year
          </p>
        </div>
      )}
    </div>
  );
}
```

#### `listAllProducts`[#](#listallproducts)

```ts
// Simple example of displaying products and prices if you haven't configured
// products by key in the Polar constructor
function PricingTable() {
  const products = useQuery(api.example.listAllProducts);
  if (!products) return null;

  // You can sort through products in the client as below, or you can use
  // `polar.listAllProducts` in your own Convex query and return your desired
  // products to display in the UI.
  const proMonthly = products.find(
    (p) => p.prices[0].recurringInterval === "month",
  );
  const proYearly = products.find(
    (p) => p.prices[0].recurringInterval === "year",
  );
  return (
    <div>
      {proMonthly && (
        <div>
          <h3>{proMonthly.name}</h3>
          <p>
            ${(proMonthly.prices[0].priceAmount ?? 0) / 100}/
            {proMonthly.prices[0].recurringInterval}
          </p>
        </div>
      )}
      {proYearly && (
        <div>
          <h3>{proYearly.name}</h3>
          <p>${(proYearly.prices[0].priceAmount ?? 0) / 100}/year</p>
        </div>
      )}
    </div>
  );
}
```

Each product includes:

- `id`: The Polar product ID
- `name`: The product name
- `prices`: Array of prices with:
  - `priceAmount`: Price in cents
  - `priceCurrency`: Currency code (e.g., "USD")
  - `recurringInterval`: "month" or "year"

### Add subscription UI components[#](#add-subscription-ui-components)

Use the provided React components to add subscription functionality to your app:

```ts
import { CheckoutLink, CustomerPortalLink } from "@convex-dev/polar/react";
import { api } from "../convex/_generated/api";

// For new subscriptions
<CheckoutLink
  // For our example, the api.example object includes the generateCheckoutLink
  // function. You can also pass any object that includes this function.
  polarApi={api.example}
  productIds={[products.premiumMonthly.id, products.premiumYearly.id]}
  // Optional: turn off embedding to link to a checkout page
  embed={false}
>
  Upgrade to Premium
</CheckoutLink>

// For managing existing subscriptions
<CustomerPortalLink
  polarApi={{
    generateCustomerPortalUrl: api.example.generateCustomerPortalUrl,
  }}
>
  Manage Subscription
</CustomerPortalLink>
```

### Handle subscription changes[#](#handle-subscription-changes)

The Polar component provides functions to handle subscription changes for the current user.

**Note:** It is highly recommended to prompt the user for confirmation before changing their subscription this way!

```ts
// Change subscription
const changeSubscription = useAction(api.example.changeCurrentSubscription);
await changeSubscription({ productId: "new_product_id" });

// Cancel subscription
const cancelSubscription = useAction(api.example.cancelCurrentSubscription);
await cancelSubscription({ revokeImmediately: true });
```

### Access subscription data[#](#access-subscription-data)

Query subscription information in your app:

```ts
// convex/example.ts

// A query that returns a user with their subscription details
export const getCurrentUser = query({
  handler: async (ctx) => {
    const user = await ctx.db.query("users").first();
    if (!user) throw new Error("No user found");

    const subscription = await polar.getCurrentSubscription(ctx, {
      userId: user._id,
    });

    return {
      ...user,
      subscription,
      isFree: !subscription,
      isPremium:
        subscription?.productKey === "premiumMonthly" ||
        subscription?.productKey === "premiumYearly",
    };
  },
});
```

## API Reference[#](#api-reference)

### Polar Client[#](#polar-client)

The `Polar` class accepts a configuration object with:

- `getUserInfo`: Function to get the current user's ID and email
- `products`: (Optional) Map of arbitrarily named keys to Polar product IDs
- `organizationToken`: (Optional) Your Polar organization token. Falls back to `POLAR_ORGANIZATION_TOKEN` env var
- `webhookSecret`: (Optional) Your Polar webhook secret. Falls back to `POLAR_WEBHOOK_SECRET` env var
- `server`: (Optional) Polar server environment: "sandbox" or "production". Falls back to `POLAR_SERVER` env var

### React Components[#](#react-components)

#### CheckoutLink[#](#checkoutlink)

Props:

- `polarApi`: Object containing `generateCheckoutLink` function
- `productIds`: Array of product IDs to show in the checkout
- `children`: React children (button content)
- `embed`: (Optional) Whether to embed the checkout link. Defaults to `true`.
- `className`: (Optional) CSS class name
- `subscriptionId`: (Optional) ID of a subscription to upgrade. It must be on a free pricing.

#### CustomerPortalLink[#](#customerportallink)

Props:

- `polarApi`: Object containing `generateCustomerPortalUrl` function
- `children`: React children (button content)
- `className`: (Optional) CSS class name

### API Functions[#](#api-functions)

#### changeCurrentSubscription[#](#changecurrentsubscription)

Change an existing subscription to a new plan:

```ts
await changeSubscription({ productId: "new_product_id" });
```

#### cancelCurrentSubscription[#](#cancelcurrentsubscription)

Cancel an existing subscription:

```ts
await cancelSubscription({ revokeImmediately: true });
```

#### getCurrentSubscription[#](#getcurrentsubscription)

Get the current user's subscription details:

```ts
const subscription = await polar.getCurrentSubscription(ctx, { userId });
```

#### listUserSubscriptions[#](#listusersubscriptions)

For apps that support multiple active subscriptions per user, get all subscriptions for a user:

```ts
const subscriptions = await polar.listUserSubscriptions(ctx, { userId });
```

#### getProducts[#](#getproducts)

List all available products and their prices:

```ts
const products = await polar.listProducts(ctx);
```

#### registerRoutes[#](#registerroutes)

Register webhook handlers for the Polar component:

```ts
polar.registerRoutes(http, {
  // Optional: customize the webhook endpoint path (defaults to "/polar/events")
  path: "/custom/webhook/path",
});
```

The webhook handler uses the `webhookSecret` from the Polar client configuration or the `POLAR_WEBHOOK_SECRET` environment variable.

#### syncProducts[#](#syncproducts)

Sync existing products from Polar (must be run inside an action):

```ts
export const syncProducts = action({
  args: {},
  handler: async (ctx) => {
    await polar.syncProducts(ctx);
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

©2026 Convex, Inc.

![](https://t.co/1/i/adsct?bci=4&dv=Asia%2FKarachi%26en-US%2Cen%26Google%20Inc.%26MacIntel%26127%261512%26982%2610%2630%261512%26944%260%26na&eci=3&event=%7B%7D&event_id=16a74866-ea9c-46f2-b5da-4523679eae48&integration=advertiser&p_id=Twitter&p_user_id=0&pl_id=9d2bc79d-418a-4741-96ef-783d33df7328&pt=Polar&tw_document_href=https%3A%2F%2Fwww.convex.dev%2Fcomponents%2Fpolar&tw_iframe_status=0&txn_id=omuhs&type=javascript&version=2.3.35)![](https://analytics.twitter.com/1/i/adsct?bci=4&dv=Asia%2FKarachi%26en-US%2Cen%26Google%20Inc.%26MacIntel%26127%261512%26982%2610%2630%261512%26944%260%26na&eci=3&event=%7B%7D&event_id=16a74866-ea9c-46f2-b5da-4523679eae48&integration=advertiser&p_id=Twitter&p_user_id=0&pl_id=9d2bc79d-418a-4741-96ef-783d33df7328&pt=Polar&tw_document_href=https%3A%2F%2Fwww.convex.dev%2Fcomponents%2Fpolar&tw_iframe_status=0&txn_id=omuhs&type=javascript&version=2.3.35)
