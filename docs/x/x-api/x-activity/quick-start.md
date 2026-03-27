> ## Documentation Index
>
> Fetch the complete documentation index at: https://docs.x.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Quickstart

export const Button = ({href, children}) => {
return <div className="not-prose group">
<a href={href}>
<button className="flex items-center space-x-2.5 py-1 px-4 bg-primary-dark dark:bg-white text-white dark:text-gray-950 rounded-full group-hover:opacity-[0.9] font-medium">
<span>
{children}
</span>
<svg width="3" height="24" viewBox="0 -9 3 24" class="h-6 rotate-0 overflow-visible"><path d="M0 0L3 3L0 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg>
</button>
</a>

  </div>;
};

This guide explains how to subscribe for and receive events using the X Activity API endpoints. There generally 3 steps involved:

1. Identify the User ID for the User who's events you want to filter on
2. Create a subscription for the type of event you want to filter for that User
3. Receive the events using webhook or persistent http stream connection

<Note>
  **Prerequisites**

Before you begin, you'll need:

- A [developer account](https://developer.x.com/en/portal/petition/essential/basic-info) with an approved App
- Your App's [Bearer Token](/resources/fundamentals/authentication)
  </Note>

---

## Getting User IDs

Before creating subscriptions, you'll need to know the user ID of the account you want to filter on. In this example, we will use the XDevelopers handle. You can look up user IDs in a few of ways including:

**Look up a user's ID by username:**

```bash theme={null}
curl -H "Authorization: Bearer YOUR_BEARER_TOKEN" "https://api.x.com/2/users/by/username/xdevelopers"
```

**Get your own user ID:**

```bash theme={null}
curl -H "Authorization: Bearer YOUR_BEARER_TOKEN" https://api.x.com/2/users/me
```

Both endpoints return user information including the `id` field, which you can use in subscription filters. Example json response is shown below:

```json theme={null}
{
  "data": {
    "id": "2244994945",
    "name": "Developers",
    "username": "XDevelopers"
  }
}
```

---

## Creating a Subscription

Next step is to create a subscription. In this example, we will subscribe to XDevelopers's bio updates. In order to do so, we will pass the `user_id` and `event_type` in the JSON body. In this case, the `event_type` is `profile.update.bio`.

We'll pass X Developer's user ID: `2244994945`, and an optional tag:

```json theme={null}
{
  "event_type": "profile.update.bio",
  "filter": {
    "user_id": "2244994945"
  },
  "tag": "Xdevelopers' bio updates"
}
```

We'll use our [bearer token](https://docs.x.com/fundamentals/authentication/oauth-2-0/overview#bearer-token-also-known-as-app-only) (from the developer portal) for authorization for all endpoints related to XAA:

```bash theme={null}
curl -H "Authorization: Bearer YOUR_BEARER_TOKEN" \
  https://api.x.com/2/activity/subscriptions \
  -X POST \
  -d '{
    "event_type": "profile.update.bio",
    "filter": {
      "user_id": "2244994945"
    },
    "tag": "Xdevelopers' bio updates"
  }'
```

Upon successful request, your subscription will be created:

```json theme={null}
{
  "data": [
    {
      "created_at": "2025-10-09T16:35:08.000Z",
      "event_type": "profile.update.bio",
      "filter": {
        "user_id": "2244994945"
      },
      "subscription_id": "1976325569252868096",
      "tag": "Xdevelopers' bio updates",
      "updated_at": "2025-10-09T16:35:08.000Z"
    }
  ],
  "meta": {
    "total_subscriptions": 1
  }
}
```

---

## Getting the events

Once we have created the subscription, we can receive the events via [webhooks](https://docs.x.com/x-api/webhooks/introduction) or a persistent HTTP stream. In this example, we will open the persistent HTTP stream:

```bash theme={null}
curl -H "Authorization: Bearer YOUR_BEARER_TOKEN" https://api.x.com/2/activity/stream
```

When Xdevelopers account updates their profile bio, the event will be delivered through the stream:

```json theme={null}
{
  "data": {
    "filter": {
      "user_id": "2244994945"
    },
    "event_type": "profile.update.bio",
    "tag": "Xdevelopers' bio updates",
    "payload": {
      "before": "Mars & Cars",
      "after": "Mars, Cars & AI"
    }
  }
}
```

---

## Subscription Management

The X Activity API provides endpoints to manage your subscriptions through standard CRUD operations.

### Create Subscription

Create a new subscription to receive events:

```bash theme={null}
curl -H "Authorization: Bearer YOUR_BEARER_TOKEN" \
  -X POST \
  https://api.x.com/2/activity/subscriptions \
  -d '{
    "event_type": "profile.update.bio",
    "filter": {
      "user_id": "123456789"
    },
    "tag": "my bio updates",
    "webhook_id": "1976325569252868099"
  }'
```

<Note>
  * The `tag` field is optional. This can be used to help identify events on delivery.
  * The `webhook_id` field is also optional. See our [webhook docs](https://docs.x.com/x-api/webhooks/introduction) for help setting up a webhook. If a `webhook_id` is specified, the event will be delivered to the provided webhook, in addition to the stream if it is open.
</Note>

**Response:**

```json theme={null}
{
  "data": {
    "subscription_id": "1976325569252868096",
    "event_type": "profile.update.bio",
    "filter": {
      "user_id": "123456789"
    },
    "created_at": "2025-10-09T16:35:08.000Z",
    "updated_at": "2025-10-09T16:35:08.000Z",
    "tag": "my bio updates",
    "webhook_id": "1976325569252868099"
  }
}
```

### List Subscriptions

Retrieve all active subscriptions for your application:

```bash theme={null}
curl -H "Authorization: Bearer YOUR_BEARER_TOKEN" \
  https://api.x.com/2/activity/subscriptions
```

**Response:**

```json theme={null}
{
  "data": [
    {
      "subscription_id": "1976325569252868096",
      "event_type": "profile.update.bio",
      "filter": {
        "user_id": "123456789"
      },
      "created_at": "2025-10-09T16:35:08.000Z",
      "updated_at": "2025-10-10T03:50:59.000Z"
    },
    {
      "subscription_id": "1976325569252868097",
      "event_type": "profile.update.profile_picture",
      "filter": {
        "user_id": "987654321"
      },
      "created_at": "2025-10-08T14:35:08.000Z",
      "updated_at": "2025-10-08T14:35:08.000Z"
    }
  ],
  "meta": {
    "total_subscriptions": 2
  }
}
```

### Delete Subscription

Remove a subscription:

```bash theme={null}
curl -H "Authorization: Bearer YOUR_BEARER_TOKEN" \
  -X DELETE \
  https://api.x.com/2/activity/subscriptions/1976325569252868096
```

**Response:**

```json theme={null}
{
  "data": {
    "deleted": true
  },
  "meta": {
    "total_subscriptions": 0
  }
}
```

`total_subscriptions` shows the remaining number of subscriptions associated with your app after the delete operation.

### Update Subscription

The PUT endpoint allows you to update a subscription's delivery method or tag.

Updating the `filter` or `event_type` requires deleting the existing subscription and adding a new one.

```bash theme={null}
curl -H "Authorization: Bearer YOUR_BEARER_TOKEN" \
  -X PUT \
  https://api.x.com/2/activity/subscriptions/1976325569252868096 \
  -d '{
    "tag": "my new tag",
    "webhook_id": "192846273860294839"
  }'
```

**Response:**

```json theme={null}
{
  "data": {
    "subscription_id": "1976325569252868096",
    "event_type": "profile.update.bio",
    "filter": {
      "user_id": "123456789"
    },
    "created_at": "2025-10-09T16:35:08.000Z",
    "updated_at": "2025-10-10T17:10:58.000Z",
    "tag": "my new tag",
    "webhook_id": "192846273860294839"
  },
  "meta": {
    "total_subscriptions": 1
  }
}
```

---

## Next steps

<CardGroup cols={2}>
  <Card title="API Reference" icon="code" href="/x-api/activity/activity-stream">
    Full endpoint documentation
  </Card>

  <Card title="Webhooks" icon="webhook" href="/x-api/webhooks/introduction">
    Set up webhook delivery
  </Card>
</CardGroup>
