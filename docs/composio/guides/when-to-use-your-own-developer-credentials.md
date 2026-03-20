# When to use your own developer credentials (/docs/custom-app-vs-managed-app)

Composio supports two ways to authenticate users with toolkits.

- **Composio managed apps**: Composio registers and maintains OAuth apps for popular toolkits (GitHub, Gmail, Slack, etc.). Zero setup, works out of the box.
- **Your own OAuth apps**: You register an OAuth app in the toolkit's developer portal and tell Composio to use your credentials instead.

# When to use Composio managed apps

Managed apps are the default. Every toolkit that supports OAuth has a Composio managed app ready to go. Use them when:

- **You're building and iterating.** No OAuth app registration, no credentials to manage. Create a session and start testing immediately.
- **Default scopes cover your needs.** Composio requests sensible defaults for each toolkit.
- **Branding on consent screens doesn't matter yet.** Users will see "Composio wants to access your account" during OAuth. Fine for internal tools, prototypes, and development. You can still [white-label the Connect Link page](/docs/white-labeling-authentication#customizing-the-connect-link) with your logo and app title without needing your own OAuth app.

# When to use your own OAuth app

Bring your own credentials when any of these apply:

- **Your users see OAuth consent screens.** In production, users should see your app name, not "Composio." This is the most common reason to switch.
- **You need custom scopes.** Composio's default scopes may not include everything you need (e.g., write access to a specific Google API).
- **You're hitting rate limits.** Managed apps share quota across all Composio users. Your own app gets a dedicated quota.
- **You need faster polling triggers.** Managed auth enforces a 15-minute minimum polling interval; your own app can use shorter polling intervals where supported.
- **You're connecting to a custom instance.** Self-hosted or regional variants (e.g., a private Salesforce subdomain) need their own OAuth app.
- **Enterprise customers require your branding end-to-end.**

#### Register an OAuth app with the toolkit

Go to the toolkit's developer portal and register a new OAuth app. You'll need to set the authorized redirect URI to:

```
https://backend.composio.dev/api/v3/toolkits/auth/callback
```

Once registered, copy your **Client ID** and **Client Secret**.

Step-by-step guides for popular toolkits: [Google](https://composio.dev/auth/googleapps) | [GitHub](https://composio.dev/auth/github) | [Slack](https://composio.dev/auth/slack) | [HubSpot](https://composio.dev/auth/hubspot) | [All toolkits](https://composio.dev/auth)

#### Create a custom auth config in Composio

In the [Composio dashboard](https://platform.composio.dev):

    1. Go to **Authentication management** and click **Create Auth Config**
    2. Select the toolkit (e.g., GitHub)
    3. Choose the **OAuth2** scheme
    4. Toggle on **Use your own developer credentials**
    5. Enter your **Client ID** and **Client Secret**
    6. Click **Create**

Copy the auth config ID (e.g., `ac_1234abcd`).

#### Pass the auth config ID in your session

**Python:**

```python
from composio import Composio

composio = Composio()
session = composio.create(
    user_id="user_123",
    auth_configs={
        "github": "ac_your_github_config",
        # toolkits not listed here still use Composio managed auth
    },
)
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";

const composio = new Composio();
const session = await composio.create("user_123", {
  authConfigs: {
    github: "ac_your_github_config",
    // toolkits not listed here still use Composio managed auth
  },
});
```

# Mixing per toolkit

You don't have to pick one approach for all toolkits. Use your own credentials for toolkits where users see consent screens (GitHub, Google, Slack) and Composio managed auth for the rest. Each toolkit gets its own auth config independently.

**Python:**

```python
session = composio.create(
    user_id="user_123",
    auth_configs={
        "github": "ac_your_github_config",
        "google": "ac_your_google_config",
        # everything else uses Composio managed auth automatically
    },
)
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio();
const session = await composio.create("user_123", {
  authConfigs: {
    github: "ac_your_github_config",
    google: "ac_your_google_config",
    // everything else uses Composio managed auth automatically
  },
});
```

## Moving from managed to custom

Start with managed apps during development. When you're ready for production, register your own OAuth apps for the toolkits that matter and add the `auth_configs` parameter. No other code changes needed.

If your users already have connections through Composio managed auth, you can import their existing tokens into your new auth config. See [Importing existing connections](/docs/importing-existing-connections).

## Toolkits without managed auth

Some toolkits don't have Composio managed auth. For these, you must create a custom auth config with your own credentials. You can check whether a toolkit has managed auth by calling the API:

```bash
curl 'https://backend.composio.dev/api/v3/toolkits/posthog' \
  -H 'x-api-key: YOUR_API_KEY'
```

If the `composio_managed_auth_schemes` array is empty, you'll need to provide your own credentials. Browse the full list on the [managed auth page](/toolkits/managed-auth) or check individual toolkit pages on the [toolkits page](/toolkits). See [Using custom auth configuration](/docs/using-custom-auth-configuration) for a step-by-step walkthrough.

# What to read next

- [Custom auth configs](/docs/auth-configuration/custom-auth-configs): Detailed setup for custom OAuth apps, API keys, and other auth types

- [White-labeling authentication](/docs/white-labeling-authentication): Remove all Composio branding from your auth flows

- [Programmatic auth configs](/docs/auth-configuration/programmatic-auth-configs): Create and manage auth configs via the SDK

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
