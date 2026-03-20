# Enable and disable toolkits (/docs/toolkits/enable-and-disable-toolkits)

When creating a session, you can control which toolkits are available to your agent. By default, all 1000+ toolkits are discoverable, but you can restrict or exclude specific ones.

# Enabling specific toolkits

To limit your session to only specific toolkits, pass an array of toolkit slugs:

**Python:**

```python
from composio import Composio

composio = Composio()

# Only GitHub and Gmail will be available
session = composio.create(
    user_id="user_123",
    toolkits=["github", "gmail"]
)

# Or use the explicit enable syntax
session = composio.create(
    user_id="user_123",
    toolkits={"enable": ["github", "gmail"]}
)
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
// Only GitHub and Gmail will be available
const session = await composio.create("user_123", {
  toolkits: ["github", "gmail"],
});

// Or use the explicit enable syntax
const session2 = await composio.create("user_123", {
  toolkits: { enable: ["github", "gmail"] },
});
```

# Disabling specific toolkits

To make all toolkits available except certain ones, use the `disable` syntax:

**Python:**

```python
# All toolkits available except Linear and Jira
session = composio.create(
    user_id="user_123",
    toolkits={"disable": ["linear", "jira"]}
)
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
// All toolkits available except Linear and Jira
const session = await composio.create("user_123", {
  toolkits: { disable: ["linear", "jira"] },
});
```

# Enabling or disabling specific tools

You can also control which individual tools are available within a toolkit using the `tools` configuration. The key is the toolkit slug and the value specifies which tools to enable or disable.

## Enable specific tools

**Python:**

```python
session = composio.create(
    user_id="user_123",
    tools={
        # Only these Gmail tools will be available
        "gmail": {"enable": ["GMAIL_SEND_EMAIL", "GMAIL_FETCH_EMAILS"]},
        # Only issue-related GitHub tools
        "github": {"enable": ["GITHUB_CREATE_ISSUE", "GITHUB_GET_ISSUE"]}
    }
)
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
const session = await composio.create("user_123", {
  tools: {
    // Only these Gmail tools will be available
    gmail: { enable: ["GMAIL_SEND_EMAIL", "GMAIL_FETCH_EMAILS"] },
    // Only issue-related GitHub tools
    github: { enable: ["GITHUB_CREATE_ISSUE", "GITHUB_GET_ISSUE"] },
  },
});
```

You can also use the shorthand array syntax which is equivalent to `enable`:

**Python:**

```python
session = composio.create(
    user_id="user_123",
    tools={
        "gmail": ["GMAIL_SEND_EMAIL", "GMAIL_FETCH_EMAILS"],
        "github": ["GITHUB_CREATE_ISSUE", "GITHUB_GET_ISSUE"]
    }
)
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
const session = await composio.create("user_123", {
  tools: {
    gmail: ["GMAIL_SEND_EMAIL", "GMAIL_FETCH_EMAILS"],
    github: ["GITHUB_CREATE_ISSUE", "GITHUB_GET_ISSUE"],
  },
});
```

## Disable specific tools

**Python:**

```python
session = composio.create(
    user_id="user_123",
    tools={
        # All Slack tools except delete
        "slack": {"disable": ["SLACK_DELETE_MESSAGE"]},
        # All GitHub tools except destructive ones
        "github": {"disable": ["GITHUB_DELETE_REPO", "GITHUB_DELETE_BRANCH"]}
    }
)
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
const session = await composio.create("user_123", {
  tools: {
    // All Slack tools except delete
    slack: { disable: ["SLACK_DELETE_MESSAGE"] },
    // All GitHub tools except destructive ones
    github: { disable: ["GITHUB_DELETE_REPO", "GITHUB_DELETE_BRANCH"] },
  },
});
```

# Filtering tools by tags

Tools can be filtered by their behavior tags. Available tags are:

| Tag               | Description                                 |
| ----------------- | ------------------------------------------- |
| `readOnlyHint`    | Tools that only read data                   |
| `destructiveHint` | Tools that modify or delete data            |
| `idempotentHint`  | Tools that can be safely retried            |
| `openWorldHint`   | Tools that operate in an open world context |

## Global tag filtering

Apply tag filters to all toolkits:

**Python:**

```python
# Only include read-only and idempotent tools
session = composio.create(
    user_id="user_123",
    tags=["readOnlyHint", "idempotentHint"]
)

# Enable some tags, disable others
session = composio.create(
    user_id="user_123",
    tags={
        "enable": ["readOnlyHint"],
        "disable": ["destructiveHint"]
    }
)
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
// Only include read-only and idempotent tools
const session = await composio.create("user_123", {
  tags: ["readOnlyHint", "idempotentHint"],
});

// Enable some tags, disable others
const sessionWithTagConfig = await composio.create("user_123", {
  tags: {
    enable: ["readOnlyHint"],
    disable: ["destructiveHint"],
  },
});
```

## Per-toolkit tag filtering

Override global tags for specific toolkits:

**Python:**

```python
session = composio.create(
    user_id="user_123",
    # Global: only read-only tools
    tags=["readOnlyHint"],
    tools={
        # Override for GitHub: allow all tools except destructive
        "github": {"tags": {"disable": ["destructiveHint"]}},
        # Override for Gmail: only read-only tools (explicit)
        "gmail": {"tags": ["readOnlyHint"]}
    }
)
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
const session = await composio.create("user_123", {
  // Global: only read-only tools
  tags: ["readOnlyHint"],
  tools: {
    // Override for GitHub: allow all tools except destructive
    github: { tags: { disable: ["destructiveHint"] } },
    // Override for Gmail: only read-only tools (explicit)
    gmail: { tags: ["readOnlyHint"] },
  },
});
```

# What to read next

- [Fetching tools and toolkits](/docs/toolkits/fetching-tools-and-toolkits): List enabled toolkits, get meta tools, and browse the catalog

- [Configuring sessions](/docs/configuring-sessions): Auth configs, connected accounts, and other session options

- [Tools and toolkits](/docs/tools-and-toolkits): How meta tools discover, authenticate, and execute tools at runtime

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
