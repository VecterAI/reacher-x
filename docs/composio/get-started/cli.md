# CLI (/docs/cli)

The Composio CLI lets you manage toolkits, execute tools, handle auth, inspect logs, and generate type-safe code from the terminal.

# Installation

```bash
curl -fsSL https://composio.dev/install | bash
```

# Getting started

```bash
# Authenticate with Composio
composio login

# Initialize a project in the current directory
composio init

# Check your account
composio whoami
```

# Search and execute a tool

```bash
# Connect your GitHub account
composio connected-accounts link github

# Search for tools
composio tools search "star a github repo"

# Look up a tool's input schema
composio tools info GITHUB_STAR_A_REPOSITORY_FOR_THE_AUTHENTICATED_USER

# Execute a tool (star the Composio repo!)
composio tools execute GITHUB_STAR_A_REPOSITORY_FOR_THE_AUTHENTICATED_USER -d '{"owner":"composiohq","repo":"composio"}'
```

# Set up and listen to triggers

```bash
# Find your connected account ID
composio connected-accounts list --toolkits github

# Create a trigger for star events on your repo
composio triggers create GITHUB_STAR_ADDED_EVENT --connected-account-id your-connected-account-id --trigger-config '{"owner":"your-username","repo":"your-repo"}'

# Listen to all GitHub trigger events on your account in real time
composio triggers listen --toolkits github --table
```

# Available commands

Run `composio <command> --help` for detailed usage and flags.

| Command                       | Subcommands                                                                 | Description                                            |
| ----------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------ |
| `composio login`              |                                                                             | Authenticate with your Composio account                |
| `composio logout`             |                                                                             | Remove stored authentication                           |
| `composio whoami`             |                                                                             | Display your account information                       |
| `composio init`               |                                                                             | Initialize a Composio project in the current directory |
| `composio toolkits`           | `list`, `search`, `info`, `version`                                         | Discover and inspect toolkits                          |
| `composio tools`              | `list`, `search`, `info`, `execute`                                         | Discover, inspect, and execute tools                   |
| `composio connected-accounts` | `list`, `info`, `whoami`, `link`, `delete`                                  | Manage connected accounts                              |
| `composio auth-configs`       | `list`, `info`, `create`, `delete`                                          | Manage auth configurations                             |
| `composio triggers`           | `list`, `info`, `create`, `status`, `listen`, `enable`, `disable`, `delete` | Subscribe to events and manage trigger instances       |
| `composio logs`               | `tools`, `triggers`                                                         | Inspect tool and trigger execution logs                |
| `composio generate`           |                                                                             | Generate type stubs (auto-detects language)            |
| `composio ts`                 | `generate`                                                                  | Generate TypeScript type stubs                         |
| `composio py`                 | `generate`                                                                  | Generate Python type stubs                             |
| `composio upgrade`            |                                                                             | Upgrade CLI to the latest version                      |
| `composio version`            |                                                                             | Display the current CLI version                        |

# Global flags

| Flag                  | Description                                               |
| --------------------- | --------------------------------------------------------- |
| `--log-level <level>` | Set log level: `silent`, `error`, `warn`, `info`, `debug` |
| `--help`              | Show help for any command                                 |

# Environment variables

| Variable                             | Description                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `COMPOSIO_API_KEY`                   | Your Composio API key                                                         |
| `COMPOSIO_BASE_URL`                  | Custom API base URL                                                           |
| `COMPOSIO_LOG_LEVEL`                 | Logging level: `silent`, `error`, `warn`, `info`, `debug`                     |
| `COMPOSIO_DISABLE_TELEMETRY`         | Set to `"true"` to disable telemetry                                          |
| `COMPOSIO_TOOLKIT_VERSION_{TOOLKIT}` | Override toolkit version (e.g., `COMPOSIO_TOOLKIT_VERSION_GMAIL=20250901_00`) |
| `COMPOSIO_WEBHOOK_SECRET`            | Signing secret for trigger webhook forwarding                                 |

# Generate type definitions

> Type generation is only useful if you're using [direct tool execution](/docs/tools-direct/executing-tools). If you're using sessions with meta tools, you don't need this.

Generate TypeScript or Python type definitions for Composio tools. These types provide autocomplete and type safety when using direct tool execution (`composio.tools.execute()`).

```bash
composio generate
```

The CLI auto-detects your project language. For explicit control, use `composio ts generate` or `composio py generate`.

**TypeScript:**

```bash
composio ts generate
```

| Flag                       | Description                                      |
| -------------------------- | ------------------------------------------------ |
| `-o`, `--output-dir <dir>` | Output directory                                 |
| `--compact`                | Emit a single TypeScript file                    |
| `--transpiled`             | Emit transpiled JavaScript alongside TypeScript  |
| `--type-tools`             | Generate typed schemas for each tool (slower)    |
| `--toolkits <names>`       | Only generate for specific toolkits (repeatable) |

**Python:**

```bash
composio py generate
```

| Flag                       | Description                                      |
| -------------------------- | ------------------------------------------------ |
| `-o`, `--output-dir <dir>` | Output directory                                 |
| `--toolkits <names>`       | Only generate for specific toolkits (repeatable) |

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
