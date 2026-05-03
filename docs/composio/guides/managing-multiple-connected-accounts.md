# Managing multiple connected accounts (/docs/managing-multiple-connected-accounts)

Users can connect multiple accounts for the same toolkit (e.g., personal and work Gmail accounts). This is useful when users need to manage different email accounts, GitHub organizations, or separate work and personal contexts. This guide explains how to connect, select, and manage multiple accounts. For background on how users, sessions, and connected accounts relate, see [Users & Sessions](/docs/users-and-sessions).

# Default account behavior

When multiple accounts are connected for the same toolkit:

- Each session can only use **one account per toolkit** at a time
- Sessions use the **most recently connected account** by default
- You can override this by explicitly selecting an account
- Each account maintains its own authentication and permissions

# Connecting multiple accounts

Call `session.authorize()` multiple times for the same toolkit. Each authorization creates a separate connected account with its own ID. The most recently connected account becomes the active one for that session. New sessions will also use the most recent account unless you [explicitly select a different one](#selecting-a-specific-account-for-a-session).

**Python:**

```python
session = composio.create(user_id="user_123")

# Connect first account (work)
work_auth = session.authorize("gmail")
print(f"Connect work Gmail: {work_auth.redirect_url}")
work_connection = work_auth.wait_for_connection()
print(f"Work account connected: {work_connection.id}")

# Connect second account (personal)
personal_auth = session.authorize("gmail")
print(f"Connect personal Gmail: {personal_auth.redirect_url}")
personal_connection = personal_auth.wait_for_connection()
print(f"Personal account connected: {personal_connection.id}")
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
const session = await composio.create("user_123");

// Connect first account (work)
const workAuth = await session.authorize("gmail");
console.log(`Connect work Gmail: ${workAuth.redirectUrl}`);
const workConnection = await workAuth.waitForConnection();
console.log(`Work account connected: ${workConnection.id}`);

// Connect second account (personal)
const personalAuth = await session.authorize("gmail");
console.log(`Connect personal Gmail: ${personalAuth.redirectUrl}`);
const personalConnection = await personalAuth.waitForConnection();
console.log(`Personal account connected: ${personalConnection.id}`);
```

> Store the account IDs returned after connection to explicitly select accounts later.

# Selecting a specific account for a session

Each session can only use one account per toolkit at a time. To use a specific account in a session, pass it in the session config:

**Python:**

```python
# This session will use a specific Gmail account
session = composio.create(
    user_id="user_123",
    connected_accounts={
        "gmail": "ca_specific_account_id",  # Connected account ID
    },
)

# To switch accounts, create a new session with a different account ID
session2 = composio.create(
    user_id="user_123",
    connected_accounts={
        "gmail": "ca_different_account_id",  # Different account
    },
)
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
// This session will use a specific Gmail account
const session = await composio.create("user_123", {
  connectedAccounts: {
    gmail: "ca_specific_account_id", // Connected account ID
  },
});

// To switch accounts, create a new session with a different account ID
const session2 = await composio.create("user_123", {
  connectedAccounts: {
    gmail: "ca_different_account_id", // Different account
  },
});
```

# Listing all user accounts

To list all accounts a user has connected (not just the active one), see [List accounts](/docs/auth-configuration/connected-accounts#list-accounts).

# Viewing session's active account

Use `session.toolkits()` to see which account is currently active in the session:

**Python:**

```python
toolkits = session.toolkits()

for toolkit in toolkits.items:
    if toolkit.connection.connected_account:
        print(f"{toolkit.name}: {toolkit.connection.connected_account.id}")
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
const session = await composio.create("user_123");
const toolkits = await session.toolkits();

for (const toolkit of toolkits.items) {
  if (toolkit.connection?.connectedAccount) {
    console.log(`${toolkit.name}: ${toolkit.connection.connectedAccount.id}`);
  }
}
```

# What to read next

- [Configuring sessions](/docs/configuring-sessions): Pass connectedAccounts, auth configs, and toolkit restrictions to sessions

- [Manual authentication](/docs/authenticating-users/manually-authenticating): Pre-authenticate users with session.authorize() and Connect Links

- [Authentication overview](/docs/authentication): Connect Links, OAuth, API keys, and how Composio manages auth

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
