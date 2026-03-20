# Triggers (/docs/triggers)

When events occur in apps, like a new Slack message, a GitHub commit, or an incoming email, triggers send event data to your application as structured payloads.

![Triggers flow: Connected apps send events to Composio, which delivers them to your webhook endpoint via HTTP POST](/images/triggers-flow.svg)
_How triggers deliver events from apps to your application_

There are two delivery types:

- **Webhook triggers**: Apps like GitHub and Slack push events to Composio in real time. When an event fires, Composio forwards the payload to your webhook endpoint.
- **Polling triggers**: For apps that don't support outgoing webhooks (e.g., Gmail), Composio polls for new data on a schedule. For Composio managed auth, polling intervals have a minimum of 15 minutes. Expect delays between the source event and delivery.

# Working with triggers

1. **Configure** your webhook endpoint so Composio knows where to deliver events
2. **Discover** available trigger types for a toolkit (e.g., `GITHUB_COMMIT_EVENT`)
3. **Create** an active trigger scoped to a user's connected account
4. **Receive events**: Composio sends payloads to your endpoint
5. **Manage**: enable, disable, or delete triggers as needed

**What is a trigger type?**

A trigger type is a template that defines what event to listen for and what configuration is required. For example, `GITHUB_COMMIT_EVENT` requires an `owner` and `repo`. Each toolkit exposes its own set of trigger types.

**What happens when you create an active trigger?**

When you create a trigger from a type, it's scoped to a specific [user and connected account](/docs/users-and-sessions). For example, creating a `GITHUB_COMMIT_EVENT` trigger for user `alice` on the `composio` repo produces a trigger with its own ID.

> Triggers are scoped to a connected account. If you haven't set up authentication yet, see [Authentication](/docs/authentication).

# Next steps

- [Creating triggers](/docs/setting-up-triggers/creating-triggers): Create trigger instances via the dashboard or SDK

- [Subscribing to events](/docs/setting-up-triggers/subscribing-to-events): Receive trigger events via webhooks or SDK subscriptions

- [Verifying webhooks](/docs/webhook-verification): Verify webhook signatures and understand payload versions

- [Managing triggers](/docs/setting-up-triggers/managing-triggers): Discover, list, enable, disable, and delete triggers

- [Example: Gmail labeler](/cookbooks/gmail-labeler): Build an automated email labeling agent using triggers

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
