# Welcome (/docs)

Composio powers 1000+ toolkits, tool search, context management, authentication, and a sandboxed workbench to help you build AI agents that turn intent into action.

- [Tutorial: Build a chat app](/cookbooks/chat-app): Build a Next.js chat app where your agent can discover and use tools across 1000+ apps.

- [How Composio works](/docs/how-composio-works): See what happens under the hood when your agent searches, authenticates, and executes a tool.

# Get Started

### For AI tools

**Skills:**

```bash
npx skills add composiohq/skills
```

[Skills.sh](https://skills.sh/composiohq/skills/composio) · [GitHub](https://github.com/composiohq/skills)

**CLI:**

```bash
curl -fsSL https://composio.dev/install | bash
```

[CLI Reference](/docs/cli)

**Context:**

- [llms.txt](/llms.txt) — Documentation index with links
- [llms-full.txt](/llms-full.txt) — Complete documentation in one file

- [Quickstart](/docs/quickstart): Install the SDK, connect an app, and run your first tool call in 5 minutes.

# Explore

- [Toolkits](/toolkits): Browse 1000+ toolkits across GitHub, Gmail, Slack, Notion, and more.

- [Playground](https://platform.composio.dev/auth?next_page=%2Ftool-router): Try Composio in your browser without writing any code.

# Providers

Composio works with any AI framework. Pick your preferred SDK:

- [Claude Agent SDK](/docs/providers/claude-agent-sdk) (Python, TypeScript)

- [Anthropic](/docs/providers/anthropic) (Python, TypeScript)

- [OpenAI Agents](/docs/providers/openai-agents) (Python, TypeScript)

- [OpenAI](/docs/providers/openai) (Python, TypeScript)

- [Google Gemini](/docs/providers/google) (Python, TypeScript)

- [Vercel AI SDK](/docs/providers/vercel) (TypeScript)

- [LangChain](/docs/providers/langchain) (Python, TypeScript)

- [LangGraph](/docs/providers/langgraph) (Python)

- [CrewAI](/docs/providers/crewai) (Python)

- [LlamaIndex](/docs/providers/llamaindex) (Python, TypeScript)

- [Mastra](/docs/providers/mastra) (TypeScript)

- [Build your own](/docs/providers/custom-providers) (Python, TypeScript)

# Features

- [Authentication](/docs/authentication): OAuth, API keys, and custom auth flows

- [Triggers](/docs/triggers): Subscribe to external events and trigger workflows

- [CLI](/docs/cli): Manage toolkits, execute tools, and generate type-safe code from the terminal

- [White Labeling](/docs/white-labeling-authentication): Customize auth screens with your branding

# Community

Join our [Discord](https://discord.gg/composio) community!

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
