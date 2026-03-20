# Tools & Toolkits (/docs/troubleshooting/tools)

# Tool execution failures (401/403 errors)

Authentication and permission errors typically occur due to:

## Missing scopes

The tool you're calling may require OAuth scopes that weren't granted when the user authenticated. Re-authenticate the user with the required scopes, or check the toolkit's documentation for which scopes each tool needs.

## Insufficient permissions

Verify the connected account has necessary permissions:

- **Admin requirements**: Some tools require admin-level access
- **Paid accounts**: Certain toolkits need paid subscriptions
  - Example: MS Teams requires Microsoft 365 account + Azure AD tenant

# API returning fewer tools than expected

If the Get Tools API (`GET /api/v3/tools`) returns fewer tools than what's shown on the [platform UI](https://platform.composio.dev), you likely need to specify a toolkit version.

When `toolkit_versions` is not provided, the API defaults to the base version (`00000000_00`), which only includes tools from the initial release. Tools added in later versions won't appear.

To get all available tools, pass `toolkit_versions=latest`:

```bash
curl 'https://backend.composio.dev/api/v3/tools?toolkit_slug=googledrive&toolkit_versions=latest' \
  -H 'x-api-key: YOUR_API_KEY'
```

See [Toolkit versioning](/docs/tools-direct/toolkit-versioning) for more details.

# Tool not working

- Check [tool-specific documentation](/toolkits) for requirements
- Verify the connected account is active and properly authenticated
- Test with the latest SDK version

# Reporting tool issues

When reporting to support, provide:

- **Error message**: Complete error details. For example:

```json
{
  "data": {
    "message": "{\n  \"error\": {\n    \"code\": 404,\n    \"message\": \"Requested entity was not found.\",\n    \"errors\": [\n      {\n        \"message\": \"Requested entity was not found.\",\n        \"domain\": \"global\",\n        \"reason\": \"notFound\"\n      }\n    ],\n    \"status\": \"NOT_FOUND\"\n  }\n}\n",
    "status_code": 404
  },
  "successful": false,
  "error": "404 Client Error: Not Found for url: https://gmail.googleapis.com/gmail/v1/users/me/messages/123456?format=full",
  "log_id": "log_tVqomBgg11-t"
}
```

- **Log ID**: From the error response (`log_id` field), or find it in the dashboard Logs page:

![Example tool execution log showing log_id in the Composio dashboard](/images/troubleshooting/troubleshooting-tool-log-id.png)

- **Tool name**: Exact tool slug being executed (for example, `GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID`)

- **Connected account ID**: Account used for execution (for example, `ca_xxx`)

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
