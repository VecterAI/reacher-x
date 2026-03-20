# Fetching tools and schemas (/docs/tools-direct/fetching-tools)

> If you're building an agent, we recommend using [sessions](/docs/configuring-sessions) instead. See [Tools and toolkits](/docs/tools-and-toolkits) for how sessions discover and fetch tools automatically.

Fetch specific tools, filter by permissions or search, and inspect schemas for type information. Tools are automatically formatted for your provider.

# Basic usage

**Python:**

```python
tools = composio.tools.get(
    user_id,
    toolkits=["GITHUB"]
)
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
const userId = "user-123";
const tools = await composio.tools.get(userId, {
  toolkits: ["GITHUB"],
});
```

Returns top 20 tools by default. Tools require a `user_id` because they're scoped to authenticated accounts. See [User management](/docs/users-and-sessions) and [Authentication](/docs/tools-direct/authenticating-tools).

# Tool schemas

Inspect tool parameters and types without a user_id:

**Python:**

```python
tool = composio.tools.get_raw_composio_tool_by_slug("GMAIL_SEND_EMAIL")
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
const tool = await composio.tools.getRawComposioToolBySlug("GMAIL_SEND_EMAIL");
```

Generate type-safe code for direct SDK execution with [`composio generate`](/docs/cli#generate-type-definitions). This creates TypeScript or Python types from tool schemas.

> View tool parameters and schemas visually in the [Composio platform](https://platform.composio.dev). Navigate to any toolkit and select a tool to see its input/output parameters.

# Filtering tools

## By toolkit

Get tools from specific apps. Returns top 20 tools by default.

**Python:**

```python
# Fetch with limit for a specific user
tools = composio.tools.get(
    user_id,
    toolkits=["GITHUB"],
    limit=5  # Get top 5 tools
)

# Same filter but without user_id (for schemas)
raw_tools = composio.tools.get_raw_composio_tools(
    toolkits=["GITHUB"],
    limit=5
)
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
const userId = "user-123";
// Fetch with limit for a specific user
const limitedTools = await composio.tools.get(userId, {
  toolkits: ["GITHUB"],
  limit: 5, // Get top 5 tools
});

// Same filter but without userId (for schemas)
const rawTools = await composio.tools.getRawComposioTools({
  toolkits: ["GITHUB"],
  limit: 5,
});
```

## By name

Fetch specific tools when you know their names.

**Python:**

```python
# Fetch specific tools by name
tools = composio.tools.get(
    user_id,
    tools=["GITHUB_CREATE_ISSUE", "GITHUB_CREATE_PULL_REQUEST"]
)

# Get schemas without user_id
raw_tools = composio.tools.get_raw_composio_tools(
    tools=["GITHUB_CREATE_ISSUE", "GITHUB_CREATE_PULL_REQUEST"]
)
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
const userId = "user-123";
// Fetch specific tools by name
const specificTools = await composio.tools.get(userId, {
  tools: [
    "GITHUB_LIST_STARGAZERS",
    "GITHUB_STAR_A_REPOSITORY_FOR_THE_AUTHENTICATED_USER",
  ],
});

// Get schemas without userId
const specificRawTools = await composio.tools.getRawComposioTools({
  tools: [
    "GITHUB_LIST_STARGAZERS",
    "GITHUB_STAR_A_REPOSITORY_FOR_THE_AUTHENTICATED_USER",
  ],
});
```

## By scopes

Filter OAuth tools by permission level. Only works with a single toolkit.

**Python:**

```python
# Filter by OAuth scopes (single toolkit only)
tools = composio.tools.get(
    user_id,
    toolkits=["GITHUB"],
    scopes=["write:org"]
)
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
const userId = "user-123";
// Filter by OAuth scopes (single toolkit only)
const scopedTools = await composio.tools.get(userId, {
  toolkits: ["GITHUB"],
  scopes: ["write:org"],
});
```

## By search (experimental)

Find tools semantically.

**Python:**

```python
# Search tools semantically
tools = composio.tools.get(
    user_id,
    search="create calendar event"
)

# Search schemas without user_id
raw_tools = composio.tools.get_raw_composio_tools(
    search="create calendar event"
)

# Search within a specific toolkit
tools = composio.tools.get(
    user_id,
    search="issues",
    toolkits=["GITHUB"],
)

# Search toolkit schemas without user_id
raw_tools = composio.tools.get_raw_composio_tools(
    search="issues",
    toolkits=["GITHUB"]
)
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
const userId = "user-123";
// Search tools semantically
const searchResults = await composio.tools.get(userId, {
  search: "create google calendar event",
});

// Search schemas without userId
const searchRawTools = await composio.tools.getRawComposioTools({
  search: "create google calendar event",
});

// Search within a specific toolkit
const toolkitSearch = await composio.tools.get(userId, {
  search: "star a repository",
  toolkits: ["GITHUB"],
});

// Search toolkit schemas without userId
const toolkitSearchRaw = await composio.tools.getRawComposioTools({
  search: "star a repository",
  toolkits: ["GITHUB"],
});
```

> When no toolkit version is specified, the API returns tools from the base version (`00000000_00`), which may be fewer than what's available. Pass `toolkit_versions="latest"` or a specific version to get all tools. Never use `latest` in production. See [toolkit versioning](/docs/tools-direct/toolkit-versioning).

# What to read next

- [Executing tools](/docs/tools-direct/executing-tools): Run tools with providers, agentic frameworks, or direct execution

- [Authenticating tools](/docs/tools-direct/authenticating-tools): Create auth configs and connect user accounts

- [Toolkit versioning](/docs/tools-direct/toolkit-versioning): Pin specific tool versions for consistent behavior in production

---

📚 **More documentation:** [View all docs](https://docs.composio.dev/llms.txt) | [Glossary](https://docs.composio.dev/llms.mdx/docs/glossary) | [Cookbooks](https://docs.composio.dev/llms.mdx/cookbooks) | [API Reference](https://docs.composio.dev/llms.mdx/reference)

---

# Composio SDK — Instructions for AI Code Generators

**Context:** This page documents the **direct tool execution API**. For most applications, the session-based pattern (`composio.create(user_id)` + `session.tools()`) is simpler — but if the user is here, they likely want direct execution.

---

## Key Patterns

### Authenticating Users

Create an **Auth Config** on [platform.composio.dev](https://platform.composio.dev), then use the auth config ID to generate a hosted auth URL:

```python
from composio import Composio

composio = Composio()
connection = composio.connected_accounts.link(
    user_id="user_123",
    auth_config_id="ac_...",  # from platform dashboard
)
print(connection.redirect_url)  # send user here to authenticate
```

```typescript
import { Composio } from "@composio/core";

const composio = new Composio();
const connection = await composio.connectedAccounts.link("user_123", "ac_...", {
  callbackUrl: "https://your-app.com/callback",
});
console.log(connection.redirectUrl); // send user here to authenticate
```

### Executing Tools

```python
tools = composio.tools.get("user_123", tools=["GITHUB_CREATE_ISSUE"])

result = composio.tools.execute(
    "GITHUB_CREATE_ISSUE",
    {"owner": "org", "repo": "repo", "title": "Bug report"},
    user_id="user_123",
)
```

```typescript
const tools = await composio.tools.get("user_123", {
  tools: ["GITHUB_CREATE_ISSUE"],
});

const result = await composio.tools.execute("GITHUB_CREATE_ISSUE", {
  userId: "user_123",
  arguments: { owner: "org", repo: "repo", title: "Bug report" },
});
```

---

## Rules

1. **`user_id` is required** — pass it to `tools.get()`, `tools.execute()`, and `provider.handle_tool_calls()`.
2. **`tools.execute()` signature** — Python: `execute(slug, arguments_dict, *, user_id=...)` (arguments is the second positional param). TypeScript: `execute(slug, { userId, arguments })`.
3. **Provider at init** — `Composio(provider=OpenAIProvider())` in Python, `new Composio({ provider: new OpenAIProvider() })` in TypeScript. Defaults to OpenAI if omitted.
4. **Correct provider imports** — `composio_<provider>` for Python, `@composio/<provider>` for TypeScript. For OpenAI Agents SDK use `composio_openai_agents` / `@composio/openai-agents`.

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
