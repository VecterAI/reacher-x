# Verifying webhooks (/docs/webhook-verification)

Composio signs every webhook request. Always verify signatures in production to ensure payloads are authentic.

# SDK verification

The SDK handles signature verification, payload parsing, and version detection (V1, V2, V3).

> Your webhook secret is returned **only once**: when you [create a webhook subscription](/reference/api-reference/webhooks/postWebhookSubscriptions) or [rotate the secret](/reference/api-reference/webhooks/postWebhookSubscriptionsByIdRotateSecret). If you didn't copy it at creation time, rotate it to get a new one. Store it securely as `COMPOSIO_WEBHOOK_SECRET`.

**Python:**

```python
try:
    result = composio.triggers.verify_webhook(
        id=request.headers.get("webhook-id", ""),
        payload=request.get_data(as_text=True),
        signature=request.headers.get("webhook-signature", ""),
        timestamp=request.headers.get("webhook-timestamp", ""),
        secret=os.getenv("COMPOSIO_WEBHOOK_SECRET", ""),
    )
    # result.version, result.payload, result.raw_payload
except Exception:
    return {"error": "Invalid signature"}, 401
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio();
const req = { headers: {} as Record<string, string>, body: "" };
try {
  const result = await composio.triggers.verifyWebhook({
    id: req.headers["webhook-id"],
    payload: req.body,
    signature: req.headers["webhook-signature"],
    timestamp: req.headers["webhook-timestamp"],
    secret: process.env.COMPOSIO_WEBHOOK_SECRET!,
  });
  // result.version, result.payload, result.rawPayload
} catch (error) {
  // Return 401
}
```

> An optional `tolerance` parameter (default: `300` seconds) controls how old a webhook can be before verification fails. Set to `0` to disable timestamp validation.

# Manual verification

If you are not using the Composio SDK and want to verify signatures manually.

> Your webhook secret is returned **only once**: when you [create a webhook subscription](/reference/api-reference/webhooks/postWebhookSubscriptions) or [rotate the secret](/reference/api-reference/webhooks/postWebhookSubscriptionsByIdRotateSecret). If you didn't copy it at creation time, rotate it to get a new one. Store it securely as `COMPOSIO_WEBHOOK_SECRET`.

Every webhook request includes three headers: `webhook-signature`, `webhook-id`, and `webhook-timestamp`. Use these along with the raw request body to verify the signature:

**Python:**

```python
import hmac
import hashlib
import base64
import json
import os

def verify_webhook(webhook_id: str, webhook_timestamp: str, body: str, signature: str) -> dict:
    secret = os.getenv("COMPOSIO_WEBHOOK_SECRET", "")
    signing_string = f"{webhook_id}.{webhook_timestamp}.{body}"
    expected = base64.b64encode(
        hmac.new(secret.encode(), signing_string.encode(), hashlib.sha256).digest()
    ).decode()
    received = signature.split(",", 1)[1] if "," in signature else signature
    if not hmac.compare_digest(expected, received):
        raise ValueError("Invalid webhook signature")

    payload = json.loads(body)
    # V3 payload
    return {
        "trigger_slug": payload["metadata"]["trigger_slug"],
        "data": payload["data"],
    }
```

**TypeScript:**

```typescript
import crypto from "crypto";
function verifyWebhook(
  webhookId: string,
  webhookTimestamp: string,
  body: string,
  signature: string
) {
  const secret = process.env.COMPOSIO_WEBHOOK_SECRET ?? "";
  const signingString = `${webhookId}.${webhookTimestamp}.${body}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(signingString)
    .digest("base64");
  const received = signature.split(",")[1] ?? signature;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))) {
    throw new Error("Invalid webhook signature");
  }

  const payload = JSON.parse(body);
  // V3 payload
  return {
    triggerSlug: payload.metadata.trigger_slug,
    data: payload.data,
  };
}
```

# Webhook payload versions

`verifyWebhook()` auto-detects the version. If you process payloads manually, here are the formats:

**V3 (default):**

Metadata is separated from event data. New organizations receive V3 payloads by default.

```json
{
  "id": "msg_abc123",
  "type": "composio.trigger.message",
  "metadata": {
    "log_id": "log_abc123",
    "trigger_slug": "GITHUB_COMMIT_EVENT",
    "trigger_id": "ti_xyz789",
    "connected_account_id": "ca_def456",
    "auth_config_id": "ac_xyz789",
    "user_id": "user-id-123435"
  },
  "data": {
    "commit_sha": "a1b2c3d",
    "message": "fix: resolve null pointer",
    "author": "jane"
  },
  "timestamp": "2026-01-15T10:30:00Z"
}
```

**V2 (legacy):**

Metadata fields are mixed into the `data` object alongside event data.

```json
{
  "type": "github_commit_event",
  "data": {
    "commit_sha": "a1b2c3d",
    "message": "fix: resolve null pointer",
    "author": "jane",
    "connection_id": "ca_def456",
    "connection_nano_id": "cn_abc123",
    "trigger_nano_id": "tn_xyz789",
    "trigger_id": "ti_xyz789",
    "user_id": "user-id-123435"
  },
  "timestamp": "2026-01-15T10:30:00Z",
  "log_id": "log_abc123"
}
```

**V1 (legacy):**

```json
{
  "trigger_name": "github_commit_event",
  "trigger_id": "ti_xyz789",
  "connection_id": "ca_def456",
  "payload": {
    "commit_sha": "a1b2c3d",
    "message": "fix: resolve null pointer",
    "author": "jane"
  },
  "log_id": "log_abc123"
}
```

# What to read next

- [Subscribing to events](/docs/setting-up-triggers/subscribing-to-events): Set up webhooks and SDK subscriptions to receive trigger events

- [Triggers overview](/docs/triggers): How Composio delivers event data from connected apps

- [Connection expiry events](/docs/subscribing-to-connection-expiry-events): Detect when OAuth connections expire and prompt re-authentication

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
