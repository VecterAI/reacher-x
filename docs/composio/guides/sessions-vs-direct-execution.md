# Sessions vs Direct Execution (/docs/sessions-vs-direct-execution)

**Sessions** give your agent [meta tools](/docs/tools-and-toolkits#meta-tools). The agent discovers which app tools to use, authenticates users, and executes tools at runtime through these meta tools.

**Direct execution** gives your code specific tool schemas. You decide which tools to fetch, manage auth yourself, and call `tools.execute()` directly.

Use sessions unless you need full control over which tools are available and when they run.

|                                  | Sessions                                                                                                                                                                                | Direct execution                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Discovery**                    | Agent finds tools at runtime and resolves dependencies automatically (e.g., if a tool needs an ID from another API, the agent finds that tool, runs it, and continues)                  | You select all tools upfront and need to account for any dependencies between them    |
| **Context cost**                 | Only meta tools in context, app tools loaded on demand                                                                                                                                  | Every tool schema you select is loaded upfront                                        |
| **Guidance**                     | Search returns recommended steps and common pitfalls alongside schemas                                                                                                                  | You get tool schemas only                                                             |
| **Memory**                       | Meta tools share context across calls, storing discovered IDs and relationships                                                                                                         | You manage state between calls                                                        |
| **Auth**                         | [In-chat](/docs/authenticating-users/in-chat-authentication): agent prompts the user to connect when needed. Also supports [manual](/docs/authenticating-users/manually-authenticating) | You build the auth flow with [connect links](/docs/tools-direct/authenticating-tools) |
| **[Workbench](/docs/workbench)** | Built in, large responses offloaded automatically                                                                                                                                       | Not available                                                                         |
| **Human approval**               | You configure approval rules on the session. Harder to intercept individual calls since tools are discovered dynamically                                                                | You intercept before each call in your code                                           |
| **Latency**                      | Multiple LLM turns (search, then execute)                                                                                                                                               | Single call                                                                           |

Sessions are configurable. You can [enable or disable specific toolkits](/docs/toolkits/enable-and-disable-toolkits), set [auth configs](/docs/auth-configuration/custom-auth-configs) for white-labeled OAuth, and pin specific [connected accounts](/docs/configuring-sessions#account-selection). See [Configuring Sessions](/docs/configuring-sessions) for the full list.

# Sessions

`composio.create()` returns [meta tools](/docs/tools-and-toolkits#meta-tools):

**Python:**

```python
from composio import Composio
from composio_openai import OpenAIProvider

composio = Composio(provider=OpenAIProvider())
session = composio.create(user_id="user_123")
tools = session.tools()
# Returns meta tools like COMPOSIO_SEARCH_TOOLS, COMPOSIO_MANAGE_CONNECTIONS,
# COMPOSIO_MULTI_EXECUTE_TOOL, COMPOSIO_REMOTE_WORKBENCH, etc.
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
// Returns meta tools like COMPOSIO_SEARCH_TOOLS, COMPOSIO_MANAGE_CONNECTIONS,
// COMPOSIO_MULTI_EXECUTE_TOOL, COMPOSIO_REMOTE_WORKBENCH, etc.
```

The agent discovers app tools through `COMPOSIO_SEARCH_TOOLS`:

```
User: "Create a GitHub issue for the login bug"

> Agent calls COMPOSIO_SEARCH_TOOLS({ query: "create github issue" })
  Returns: GITHUB_CREATE_ISSUE schema + connection status

> Agent calls COMPOSIO_MANAGE_CONNECTIONS({ toolkits: ["github"] })
  Returns: confirms connected (or auth link if not)

> Agent calls COMPOSIO_MULTI_EXECUTE_TOOL({ tool: "GITHUB_CREATE_ISSUE", args: {...} })
  Returns: issue details

Agent: "Created issue #42 on your-org/your-repo"
```

> `session.tools()` returns **meta tools** (COMPOSIO_SEARCH_TOOLS, etc.), not app tools (GMAIL_SEND_EMAIL, etc.). The agent discovers app tools at runtime through search. For app tools directly, use direct execution.

## Configuration

Restrict toolkits, set auth configs, pin connected accounts:

**Python:**

```python
session = composio.create(
    user_id="user_123",
    toolkits=["github", "gmail"],
    auth_configs={"github": "ac_my_config"},
    connected_accounts={"gmail": "ca_work"},
)
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
const session = await composio.create("user_123", {
  toolkits: ["github", "gmail"],
  authConfigs: { github: "ac_my_config" },
  connectedAccounts: { gmail: "ca_work" },
});
```

See [Configuring Sessions](/docs/configuring-sessions) for details.

# Direct execution

Fetch tools by slug or toolkit. Pass them to your LLM or call `tools.execute()` without one.

**Python:**

```python
from composio import Composio
from composio_openai import OpenAIProvider

composio = Composio(provider=OpenAIProvider())

# Fetch specific tools
tools = composio.tools.get(
    user_id="user_123",
    tools=["GITHUB_CREATE_ISSUE", "GITHUB_LIST_ISSUES"]
)

# Or by toolkit
tools = composio.tools.get(
    user_id="user_123",
    toolkits=["github"],
    limit=50
)

# Execute without an LLM
result = composio.tools.execute(
    "GITHUB_CREATE_ISSUE",
    user_id="user_123",
    arguments={"owner": "my-org", "repo": "my-repo", "title": "Fix login bug"}
)
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
import { OpenAIProvider } from "@composio/openai";

const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
  provider: new OpenAIProvider(),
});

// Fetch specific tools
const tools = await composio.tools.get("user_123", {
  tools: ["GITHUB_CREATE_ISSUE", "GITHUB_LIST_ISSUES"],
});

// Or by toolkit
const allTools = await composio.tools.get("user_123", {
  toolkits: ["github"],
  limit: 50,
});

// Execute without an LLM
const result = await composio.tools.execute("GITHUB_CREATE_ISSUE", {
  userId: "user_123",
  arguments: { owner: "my-org", repo: "my-repo", title: "Fix login bug" },
});
```

> `tools.get()` returns 20 tools by default. When fetching from multiple toolkits (e.g., `toolkits=["gmail", "github", "tavily"]`), the limit may cut off tools from later toolkits. Increase `limit` or fetch each toolkit separately.

With direct execution, you manage [auth configs](/docs/auth-configuration/custom-auth-configs), [connect links](/docs/tools-direct/authenticating-tools), and [toolkit versioning](/docs/tools-direct/toolkit-versioning) yourself.

# Migrating

See the [migration guide](/docs/migration-guide/direct-to-sessions). Auth configs and connected accounts carry over.

# Next steps

- [Quickstart](/docs/quickstart): Build an agent with sessions

- [Configuring Sessions](/docs/configuring-sessions): Toolkits, auth configs, and connected accounts

- [Direct Tool Execution](/docs/tools-direct/executing-tools): Fetch and execute specific tools

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
