# Importing existing connections (/docs/importing-existing-connections)

If your users have already authenticated with a service and you have their credentials (API keys, bearer tokens, etc.), you can pass those directly into Composio. No re-authentication required.

This is useful when:

- Your app already stores API keys or tokens for users
- You're adopting Composio and want to onboard existing users without disrupting them
- Another platform already holds credentials for your users' accounts

# How it works

Instead of asking users to authenticate again, you pass their existing credentials to `connectedAccounts.initiate()` using the `AuthScheme` helpers. Composio creates a connected account directly from those credentials.

```mermaid
graph LR
    A[Your existing credentials] --> B[connectedAccounts.initiate]
    B --> C[Connected account in Composio]
    C --> D[Execute tools immediately]
```

# Prerequisites

1. **An auth config** for the toolkit you're importing into
2. **The existing credentials** for each user (API keys, bearer tokens, username/password, etc.)
3. **A user ID** for each user, any string that uniquely identifies them in your system

> Importing existing OAuth tokens (access tokens, refresh tokens) is **not currently supported**. For OAuth-based services (Google, GitHub, Slack, etc.), users must authenticate through the standard [OAuth flow](/docs/tools-direct/authenticating-tools). This page covers importing non-OAuth credentials like API keys, bearer tokens, and basic auth.

# API keys

For services that use API key authentication (e.g., SendGrid, Tavily, PostHog):

**Python:**

```python
from composio import Composio
from composio.types import auth_scheme

composio = Composio(api_key="your-api-key")

connection = composio.connected_accounts.initiate(
    user_id="user_123",
    auth_config_id="ac_your_auth_config",
    config=auth_scheme.api_key({
        "api_key": "sg-existing-sendgrid-key",
    }),
)

# API key connections are immediately active
print(f"Connected: {connection.id}")
```

**TypeScript:**

```typescript
import { Composio, AuthScheme } from "@composio/core";

const composio = new Composio({ apiKey: "your-api-key" });

const connection = await composio.connectedAccounts.initiate(
  "user_123",
  "ac_your_auth_config",
  {
    config: AuthScheme.APIKey({
      api_key: "sg-existing-sendgrid-key",
    }),
  }
);

// API key connections are immediately active
console.log("Connected:", connection.id);
```

# Bearer tokens

**Python:**

```python
from composio import Composio
from composio.types import auth_scheme

composio = Composio(api_key="your-api-key")

connection = composio.connected_accounts.initiate(
    user_id="user_123",
    auth_config_id="ac_your_auth_config",
    config=auth_scheme.bearer_token({
        "token": "existing-bearer-token",
    }),
)

# Bearer token connections are immediately active
print(f"Connected: {connection.id}")
```

**TypeScript:**

```typescript
import { Composio, AuthScheme } from "@composio/core";

const composio = new Composio({ apiKey: "your-api-key" });

const connection = await composio.connectedAccounts.initiate(
  "user_123",
  "ac_your_auth_config",
  {
    config: AuthScheme.BearerToken({
      token: "existing-bearer-token",
    }),
  }
);

// Bearer token connections are immediately active
console.log("Connected:", connection.id);
```

# Basic auth

**Python:**

```python
from composio import Composio
from composio.types import auth_scheme

composio = Composio(api_key="your-api-key")

connection = composio.connected_accounts.initiate(
    user_id="user_123",
    auth_config_id="ac_your_auth_config",
    config=auth_scheme.basic({
        "username": "user@example.com",
        "password": "existing-password",
    }),
)

# Basic auth connections are immediately active
print(f"Connected: {connection.id}")
```

**TypeScript:**

```typescript
import { Composio, AuthScheme } from "@composio/core";

const composio = new Composio({ apiKey: "your-api-key" });

const connection = await composio.connectedAccounts.initiate(
  "user_123",
  "ac_your_auth_config",
  {
    config: AuthScheme.Basic({
      username: "user@example.com",
      password: "existing-password",
    }),
  }
);

// Basic auth connections are immediately active
console.log("Connected:", connection.id);
```

# What to read next

- [Custom auth configs](/docs/using-custom-auth-configuration): Set up auth configs with your own OAuth credentials

- [Connected accounts](/docs/auth-configuration/connected-accounts): Manage connected accounts after importing

- [White-labeling](/docs/white-labeling-authentication): Use your own branding on OAuth consent screens

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
