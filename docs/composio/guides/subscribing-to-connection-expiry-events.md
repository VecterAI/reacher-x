# Subscribing to connection expiry events (/docs/subscribing-to-connection-expiry-events)

Composio automatically refreshes OAuth tokens before they expire. But when a refresh token is revoked or expires, the connection enters an `EXPIRED` state and the user must re-authenticate.

You can detect this proactively using the `composio.connected_account.expired` webhook event instead of waiting for a tool execution to fail.

> This event is only available with [V3 webhook payloads](/docs/webhook-verification#webhook-payload-versions). New organizations use V3 by default.

# Subscribe to expiry events

Add `composio.connected_account.expired` to your webhook subscription's `enabled_events`:

```bash
curl -X POST https://backend.composio.dev/api/v3/webhook_subscriptions \
  -H "X-API-KEY: <your-composio-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook_url": "https://example.com/webhook",
    "enabled_events": [
      "composio.trigger.message",
      "composio.connected_account.expired"
    ]
  }'
```

# Handle the event

When a connection expires, Composio sends a webhook with the connected account details:

```json
{
  "id": "evt_847cdfcd-d219-4f18-a6dd-91acd42ca94a",
  "type": "composio.connected_account.expired",
  "metadata": {
    "project_id": "pr_your-project-id",
    "org_id": "ok_your-org-id"
  },
  "data": {
    "id": "ca_your-connected-account-id",
    "toolkit": { "slug": "gmail" },
    "auth_config": {
      "id": "ac_your-auth-config-id",
      "auth_scheme": "OAUTH2"
    },
    "status": "EXPIRED",
    "status_reason": "OAuth refresh token expired"
  },
  "timestamp": "2026-02-06T12:00:00.000Z"
}
```

Route on `type` to handle expiry alongside trigger events:

**Python:**

```python
from composio import Composio, WebhookEventType

composio = Composio()

@app.post("/webhook")
async def webhook_handler(request: Request):
    payload = await request.json()
    event_type = payload.get("type")

    if event_type == WebhookEventType.CONNECTION_EXPIRED:
        account_id = payload["data"]["id"]
        toolkit = payload["data"]["toolkit"]["slug"]

        # Look up the user and send them a re-auth link
        session = composio.create(user_id=lookup_user(account_id))
        connection_request = session.authorize(toolkit)
        notify_user(connection_request.redirect_url)

    elif event_type == WebhookEventType.TRIGGER_MESSAGE:
        # Handle trigger events
        pass

    return {"status": "ok"}
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio();
type NextApiRequest = { body: any };
type NextApiResponse = {
  status: (code: number) => { json: (data: any) => void };
};
declare function lookupUser(accountId: string): string;
declare function notifyUser(url: string): void;
export default async function webhookHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const payload = req.body;

  if (payload.type === "composio.connected_account.expired") {
    const accountId = payload.data.id;
    const toolkit = payload.data.toolkit.slug;

    // Look up the user and send them a re-auth link
    const session = await composio.create(lookupUser(accountId));
    const connectionRequest = await session.authorize(toolkit);
    if (connectionRequest.redirectUrl) {
      notifyUser(connectionRequest.redirectUrl);
    }
  } else if (payload.type === "composio.trigger.message") {
    // Handle trigger events
  }

  res.status(200).json({ status: "ok" });
}
```

# Re-authenticate the user

Use `session.authorize()` to generate a new Connect Link for the expired toolkit. The user completes OAuth again, and the connected account returns to `ACTIVE` status.

**Python:**

```python
from composio import Composio

composio = Composio()

session = composio.create(user_id="user_123")
connection_request = session.authorize("gmail")

# Send this URL to the user (email, in-app notification, etc.)
print(connection_request.redirect_url)

# Optionally wait for completion
connected_account = connection_request.wait_for_connection(60000)
print(f"Re-connected: {connected_account.id}")
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";

const composio = new Composio();

const session = await composio.create("user_123");
const connectionRequest = await session.authorize("gmail");

// Send this URL to the user (email, in-app notification, etc.)
console.log(connectionRequest.redirectUrl);

// Optionally wait for completion
const connectedAccount = await connectionRequest.waitForConnection(60000);
console.log(`Re-connected: ${connectedAccount.id}`);
```

> Always [verify webhook signatures](/docs/webhook-verification) before processing events in production.

# What to read next

- [Verifying webhooks](/docs/webhook-verification): Validate webhook signatures to ensure payloads are authentic

- [Subscribing to events](/docs/setting-up-triggers/subscribing-to-events): Set up webhooks and SDK subscriptions to receive trigger events

- [Authentication overview](/docs/authentication): How Composio manages OAuth, token refresh, and connected accounts

---

📚 **More documentation:** [View all docs](https://docs.composio.dev/llms.txt) | [Glossary](https://docs.composio.dev/llms.mdx/docs/glossary) | [Cookbooks](https://docs.composio.dev/llms.mdx/cookbooks) | [API Reference](https://docs.composio.dev/llms.mdx/reference)

---

# Composio SDK — Instructions for AI Code Generators

**Purpose:** Enforce only the **current** and **correct** patterns for integrating [Composio](https://composio.dev/) tools into AI agents.
**Scope:** All AI-generated code using Composio must follow these guardrails.

---

## 1. Correct Composio Integration

Composio supports two integration modes: **Native Tools** (with a provider package) and **MCP** (no provider package needed).

### Native Tools

```python
# ✅ CORRECT — Python (defaults to OpenAI)
from composio import Composio

composio = Composio()
session = composio.create(user_id="user_123")
tools = session.tools()
# Pass tools to your agent/LLM framework
```

```typescript
// ✅ CORRECT — TypeScript (defaults to OpenAI)
import { Composio } from "@composio/core";

const composio = new Composio();
const session = await composio.create("user_123");
const tools = await session.tools();
// Pass tools to your agent/LLM framework
```

For other providers, pass the provider explicitly. Provider packages follow the naming convention: `composio_<provider>` for Python, `@composio/<provider>` for TypeScript.

### MCP

Use `session.mcp.url` and `session.mcp.headers` with any MCP-compatible client (Claude Desktop, Cursor, OpenAI Agents, etc.). No provider package needed.

---

## 2. CRITICAL INSTRUCTIONS FOR AI MODELS

### 2.1 — ALWAYS DO THE FOLLOWING

1. **Use `composio.create(user_id)`** to create a session — this is the entry point for all Composio integrations.
2. **Use `session.tools()`** for native tool integration or **`session.mcp.url`** for MCP integration.
3. **Import** from the correct provider package (`composio_<provider>` for Python, `@composio/<provider>` for TypeScript).
4. **Pass `user_id` to `composio.create()`**, not to individual tool calls.

### 2.2 — NEVER DO THE FOLLOWING

1. **Do not** instruct users to manually create auth configs or connected accounts before running.
2. **Do not** import from `composio_openai` / `@composio/openai` when using OpenAI Agents SDK — use `composio_openai_agents` / `@composio/openai-agents` instead.

### 2.3 — DISCOURAGED (do not use unless user explicitly asks)

Do **not** generate `composio.tools.get()`, `composio.tools.execute()`, or `composio.provider.handle_tool_calls()` unless the user explicitly requests direct tool execution. These are a supported but **not recommended** low-level interface.

---

## Terminology Migration (old → current)

If you encounter these terms in error messages, old documentation, or user prompts, translate them to the current equivalents. **Do not use the old terms in generated code or explanations.**

| Old term (v1/v2)                | Current term (v3)                | In code                                 |
| ------------------------------- | -------------------------------- | --------------------------------------- |
| entity ID                       | user ID                          | `user_id` parameter                     |
| actions                         | tools                            | e.g., `GITHUB_CREATE_ISSUE` is a _tool_ |
| apps / appType                  | toolkits                         | e.g., `github` is a _toolkit_           |
| integration / integration ID    | auth config / auth config ID     | `auth_config_id` parameter              |
| connection                      | connected account                | `connected_accounts` namespace          |
| ComposioToolSet / OpenAIToolSet | `Composio` class with a provider | `Composio(provider=...)`                |
| toolset                         | provider                         | e.g., `OpenAIProvider`                  |

If a user says "entity ID", they mean `user_id`. If they say "integration", they mean "auth config". Always respond using the current terminology.
