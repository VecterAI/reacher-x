# Authentication (/docs/troubleshooting/authentication)

# Using Composio's default OAuth app

When using our default OAuth configuration:

- **Don't add additional scopes** - They may not be approved in our OAuth app
- Use only the pre-configured scopes provided

# Using custom OAuth apps

Ensure your OAuth app is configured correctly:

- **Redirect URL**: Must match exactly what's configured in your OAuth provider
- **Scopes**: Auth config scopes must match your OAuth app configuration
- **Credentials**: Verify client ID and secret are correct

For setup guides by toolkit: [OAuth Configuration Guides](https://composio.dev/oauth)

# Switching to a custom OAuth app

If you're moving from Composio-managed auth to your own OAuth app, existing connections are not affected. New connections will use your custom auth config. To fully migrate users, delete their old connected accounts and have them re-authenticate.

- **Sessions:** Pass `authConfigs` when calling `composio.create()`. See [Switching auth configs (sessions)](/docs/white-labeling-authentication#switching-from-composio-managed-to-your-own-oauth-app).
- **Direct tool execution:** Pass the new `authConfigId` when calling `initiate()`. See [Switching auth configs (direct)](/docs/auth-configuration/white-labeling#switching-from-composio-managed-to-your-own-oauth-app).

# Common authentication issues

- **Invalid redirect URI**: Check the callback URL matches exactly
- **Scope mismatch**: Ensure requested scopes are configured in both auth config and OAuth app
- **Expired tokens**: Try refreshing the connection
- **Rate limits**: Some providers limit authentication attempts
- **Credentials showing as `REDACTED`**: The "Mask Connected Account Secrets" setting is enabled on your account, which redacts all sensitive credential data. Navigate to **Settings → Project Settings → Project Configuration** and disable "Mask Connected Account Secrets" to view actual values

# Reporting authentication issues

When reporting to support, provide:

- **Error message**: Complete error details and screenshots. For example:

![Example: This app is blocked error screen shown by Google when un-verified sensitive scopes are configured](/images/troubleshooting/troubleshooting-auth-app-blocked.png)

- **Auth config and account IDs**: Include the `authConfigId` used for the request and, if a connection already exists, the `connected_account_id`

![Finding authConfigId and connected account ID in the Composio dashboard](/images/troubleshooting/troubleshooting-auth-config-id.png)

- **OAuth provider**: Which service you're trying to connect

# Getting help

- **Email**: [support@composio.dev](mailto:support@composio.dev)
- **Discord**: [#support-form](https://discord.com/channels/1170785031560646836/1268871288156323901)

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
