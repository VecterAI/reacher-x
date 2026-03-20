# Users & Sessions (/docs/users-and-sessions)

When building AI agents for multiple users, each user needs their own connections and context. This is represented through **users** and **sessions**.

> For a hands-on walkthrough, see the [quickstart](/docs/quickstart).

# Users

A user is an identifier from your app. When someone connects their Gmail or GitHub, that connection is stored under their user ID, so tools always run with the right authentication. Every tool execution and authorization uses the user ID to identify the context. Connections are fully isolated between user IDs.

**Best practices for User IDs**

    * **Recommended:** Database UUID or primary key (`user.id`)
    * **Acceptable:** Unique username (`user.username`)
    * **Avoid:** Email addresses (they can change)
    * **Never:** `default` in production (exposes other users' data)

A user can have multiple connections to the same toolkit.
Let's say you want to allow users to connect both their work and personal email. You can represent the user with the same user ID but differentiate between the two with the connected
account ID.

Here is a detailed guide on how to manage such connections:

- [Managing Multiple Connections](/docs/managing-multiple-connected-accounts): Handle multiple accounts per toolkit for a single user

Triggers are scoped to a connected account. When you create a trigger, it's tied to a specific user's connection:

- [Triggers](/docs/triggers): Event-driven payloads from connected apps

# Sessions

A session is an ephemeral configuration. You specify:

- Which user's authorization and data the agent will access
- What toolkits are enabled or disabled
- What authentication method, scopes, and credentials to use

## Creating a session

**Python:**

```python
session = composio.create(user_id="user_123")
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
const session = await composio.create("user_123");
```

## Session methods

Once created, a session provides methods to get tools and manage connections:

**Python:**

```python
# Get tools for your AI framework
tools = session.tools()

# Get MCP server URL
mcp_url = session.mcp.url

# Authenticate a user to a toolkit
connection_request = session.authorize("github")

# List available toolkits and their connection status
toolkits = session.toolkits()
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
const session = await composio.create("user_123");
// Get tools for your AI framework
const tools = await session.tools();

// Get MCP server URL
const mcpUrl = session.mcp.url;

// Authenticate a user to a toolkit
const connectionRequest = await session.authorize("github");

// List available toolkits and their connection status
const toolkits = await session.toolkits();
```

# How sessions behave

A session ties together a user, a set of available toolkits, auth configuration for those toolkits, and connected accounts. Call `create()` whenever you want to do a task. Each session is designed for a particular agentic task, and if you want to change the context of the task, create a new session.

You don't need to cache session IDs, manage session lifetimes, or worry about expiration. Sessions persist on the server and don't expire. Just call `create()` with what you need.

## Sessions are immutable

A session's configuration is fixed at creation. You cannot change the toolkits, auth configs, or connected accounts on an existing session.

This means the boundary for a new session isn't a new chat or a new request. It's when the contract changes. If a user starts with "search my personal Gmail" and then says "actually use my work email," that's a different session because the auth changed.

## Connected accounts persist across sessions

Connections are tied to the user ID, not the session. A user who connected Gmail in one session can access it in every future session without re-authenticating.

**When should I create a new session?**

Create a new session when the config changes: different toolkits, different auth config, or a different connected account. You don't need to store or manage session IDs. Just call `create()` each time.

# What to read next

- [Authentication](/docs/authentication): Connect Links, OAuth, API keys, and auth configs

- [Configuring Sessions](/docs/configuring-sessions): Enable toolkits, set auth configs, and select connected accounts

- [Workbench](/docs/workbench): Write and run code in a persistent sandbox

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
