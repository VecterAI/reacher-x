# Toolkit Versioning (/docs/tools-direct/toolkit-versioning)

> If you're building an agent, we recommend using [sessions](/docs/configuring-sessions) instead. Sessions handle toolkit versions automatically so you don't have to manage them yourself.

Toolkit versioning ensures your tools behave consistently across deployments. You can pin specific versions in production, test new releases in development, and roll back when needed.

To view available versions, go to [Dashboard](https://platform.composio.dev) > **All Toolkits** > select a toolkit. The version dropdown shows the latest and all available versions:

<img alt="Toolkit version selector on the Composio dashboard" src={__img0} placeholder="blur" />

You can also find the latest version for each toolkit on the [Toolkits](/toolkits) page in the docs. Select a toolkit to see its current version and available tools.

> Starting from Python SDK v0.9.0 and TypeScript SDK v0.2.0, specifying versions is required for manual tool execution.

# Default version behavior

> When no version is specified, the API defaults to the base version (`00000000_00`), **not** the latest version. This means the response may contain fewer tools than what's shown on the [platform UI](https://platform.composio.dev). To get all available tools including ones added in newer versions, explicitly set `toolkit_versions` to `"latest"` or a specific version.

This applies to both the SDK and direct REST API calls:

```bash
# Without version — returns only tools from the base version
curl 'https://backend.composio.dev/api/v3/tools?toolkit_slug=googledrive' \
  -H 'x-api-key: YOUR_API_KEY'

# With version=latest — returns all tools including newer ones
curl 'https://backend.composio.dev/api/v3/tools?toolkit_slug=googledrive&toolkit_versions=latest' \
  -H 'x-api-key: YOUR_API_KEY'
```

# Configuration methods

Configure toolkit versions using one of three methods:

## SDK initialization

**Python:**

```python
from composio import Composio

# Pin specific versions for each toolkit
composio = Composio(
    api_key="YOUR_API_KEY",
    toolkit_versions={
        "github": "20251027_00",
        "slack": "20251027_00",
        "gmail": "20251027_00"
    }
)
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";

// Pin specific versions for each toolkit
const composio = new Composio({
  apiKey: "YOUR_API_KEY",
  toolkitVersions: {
    github: "20251027_00",
    slack: "20251027_00",
    gmail: "20251027_00",
  },
});
```

## Environment variables

```bash
# Set versions for specific toolkits
export COMPOSIO_TOOLKIT_VERSION_GITHUB="20251027_00"
export COMPOSIO_TOOLKIT_VERSION_SLACK="20251027_00"
export COMPOSIO_TOOLKIT_VERSION_GMAIL="20251027_00"
```

## Per-execution override

**Python:**

```python
from composio import Composio

composio = Composio(api_key="YOUR_API_KEY")

# Specify version directly in execute call
result = composio.tools.execute(
    "GITHUB_LIST_STARGAZERS",
    arguments={
        "owner": "ComposioHQ",
        "repo": "composio"
    },
    user_id="user-k7334",
    version="20251027_00"  # Override version for this execution
)
print(result)
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";

const composio = new Composio({ apiKey: "YOUR_API_KEY" });

// Specify version directly in execute call
const result = await composio.tools.execute("GITHUB_LIST_STARGAZERS", {
  userId: "user-k7334",
  arguments: {
    owner: "ComposioHQ",
    repo: "composio",
  },
  version: "20251027_00", // Override version for this execution
});
console.log(result);
```

# Version format

Versions follow the format `YYYYMMDD_NN`:

- `YYYYMMDD`: Release date
- `NN`: Sequential release number

```python
# Production — pin to a specific version
toolkit_versions = {"github": "20251027_00"}

# Development — always use the newest tools
toolkit_versions = {"github": "latest"}
```

> Never use `latest` in production. It can introduce breaking changes. Pin to a specific version instead.

# Version resolution order

1. Per-execution version (highest priority)
2. SDK initialization version
3. Environment variable (toolkit-specific)

# Managing versions

Check available versions using:

**Python:**

```python
# Get toolkit information including available versions
toolkit = composio.toolkits.get(slug="github")

# Extract and print version information
print(f"Toolkit: {toolkit.name}")
print(f"Current Version: {toolkit.meta.version}")
print(f"Available Versions: {toolkit.meta.available_versions}")
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
// Get toolkit information including available versions
const toolkit = await composio.toolkits.get("github");

// Extract and print version information
console.log("Toolkit:", toolkit.name);
console.log("Available Versions:", toolkit.meta.availableVersions);
console.log("Latest Version:", toolkit.meta.availableVersions?.[0]);
```

# What to read next

- [Fetching tools](/docs/tools-direct/fetching-tools): Fetch and filter tools, inspect schemas, and search semantically

- [Executing tools](/docs/tools-direct/executing-tools): Run tools with providers, agentic frameworks, or direct execution

- [CLI](/docs/cli): Generate type-safe code from tool schemas with the Composio CLI

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
