# Native Tools vs MCP (/docs/native-tools-vs-mcp)

**Native tools** give your LLM tool schemas as function definitions. Composio formats them for your specific framework (OpenAI, Anthropic, Vercel AI, etc.) through [provider packages](/docs/providers).

**MCP** exposes tools through the [Model Context Protocol](https://modelcontextprotocol.io). Any MCP-compatible client can connect to a Composio MCP server URL. No provider packages needed.

|                             | Native tools                                                  | MCP                                                                   |
| --------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Setup**                   | [Provider package](/docs/providers) for your framework        | SDK or just a URL                                                     |
| **Intercepting tool calls** | Yes, you can log, retry, or require approval before each call | Limited, depends on what the MCP client supports                      |
| **Context window**          | You control what's loaded                                     | Client loads all tools the server exposes                             |
| **Latency**                 | SDK calls Composio API directly                               | MCP protocol adds overhead for tool list discovery and each execution |

With native tools, you choose exactly which schemas enter your LLM's context. With MCP, the client pulls the full tool list from the server. A [5-server setup can consume \~55K tokens](https://www.anthropic.com/engineering/advanced-tool-use) before the conversation starts. If you're working with many tools, native tools give you more control over that cost.

# Native tools

**Python:**

```python
from composio import Composio
from composio_openai import OpenAIProvider

composio = Composio(provider=OpenAIProvider())
session = composio.create(user_id="user_123")
tools = session.tools()
# Returns meta tools (COMPOSIO_SEARCH_TOOLS, COMPOSIO_MANAGE_CONNECTIONS, etc.)
# Agent discovers and executes tools at runtime
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
import { OpenAIProvider } from "@composio/openai";

const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
  provider: new OpenAIProvider(),
});
const session = await composio.create("user_123");
const tools = await session.tools();
// Returns meta tools (COMPOSIO_SEARCH_TOOLS, COMPOSIO_MANAGE_CONNECTIONS, etc.)
```

# MCP

**Python:**

```python
from composio import Composio

composio = Composio()
session = composio.create(user_id="user_123")

mcp_url = session.mcp.url
mcp_headers = session.mcp.headers
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";

const composio = new Composio();
const session = await composio.create("user_123");

const mcpUrl = session.mcp.url;
const mcpHeaders = session.mcp.headers;
```

Then pass `session.mcp.url` and `session.mcp.headers` to your framework:

**OpenAI Agents (Python):**

```python
from agents import Agent, HostedMCPTool

agent = Agent(
    name="Assistant",
    tools=[
        HostedMCPTool(
            tool_config={
                "type": "mcp",
                "server_label": "composio",
                "server_url": session.mcp.url,
                "headers": session.mcp.headers,
                "require_approval": "never",
            }
        )
    ],
)
```

**Claude Agent SDK (Python):**

```python
from claude_agent_sdk import ClaudeAgentOptions

options = ClaudeAgentOptions(
    mcp_servers={
        "composio": {
            "type": "http",
            "url": session.mcp.url,
            "headers": session.mcp.headers,
        }
    },
)
```

**Vercel AI SDK (TypeScript):**

```typescript
import { Composio } from "@composio/core";
import { createMCPClient } from "@ai-sdk/mcp";

const composio = new Composio();
const { mcp } = await composio.create("user_123");

const client = await createMCPClient({
  transport: {
    type: "http",
    url: mcp.url,
    headers: mcp.headers,
  },
});
const tools = await client.tools();
```

See the [quickstart](/docs/quickstart) for full working examples.

# Next steps

- [Quickstart](/docs/quickstart): Build an agent with sessions

- [Providers](/docs/providers): OpenAI, Anthropic, Vercel AI, LangChain

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
