# Connected Accounts (/docs/auth-configuration/connected-accounts)

> If you're building an agent, we recommend using [sessions](/docs/configuring-sessions) instead. See [Managing multiple connected accounts](/docs/managing-multiple-connected-accounts) for how sessions handle account selection automatically.

Connected accounts are authenticated connections between your users and toolkits. After users authenticate (see [Authenticating tools](/docs/tools-direct/authenticating-tools)), you can manage these accounts throughout their lifecycle.

Composio automatically handles token refresh and credential management. This guide covers manual operations: listing, retrieving, refreshing, enabling, disabling, and deleting accounts.

# List accounts

Retrieve all connected accounts with optional filters:

**Python:**

```python
# List all accounts for a user
accounts = composio.connected_accounts.list(
    user_ids=[user_id]
)

# Filter by status
active_accounts = composio.connected_accounts.list(
    user_ids=[user_id],
    statuses=["ACTIVE"]
)
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
const userId = "user_123";
// List all accounts for a user
const accounts = await composio.connectedAccounts.list({
  userIds: [userId],
});

// Filter by status
const activeAccounts = await composio.connectedAccounts.list({
  userIds: [userId],
  statuses: ["ACTIVE"],
});
```

# Get account details

Retrieve a connected account by ID:

**Python:**

```python
account = composio.connected_accounts.get(connected_account_id)

print(f"Status: {account.status}")
print(f"Toolkit: {account.toolkit.slug}")
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
const connectedAccountId = "ca_123";
const account = await composio.connectedAccounts.get(connectedAccountId);

console.log("Status:", account.status);
console.log("Toolkit:", account.toolkit.slug);
```

## Get account credentials

Get account credentials for use with your own tools:

**Python:**

```python
# Get the connected account's authentication state
if account.state:
    # The state contains the auth scheme and credentials
    auth_scheme = account.state.auth_scheme
    credentials = account.state.val

    print(f"Auth scheme: {auth_scheme}")
    print(f"Credentials: {credentials}")
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
const account = await composio.connectedAccounts.get("ca_123");
// Get the connected account's authentication state
if (account.state) {
  // The state contains the auth scheme and credentials
  const authScheme = account.state.authScheme;
  const credentials = account.state.val;

  console.log("Auth scheme:", authScheme);
  console.log("Credentials:", credentials);
}
```

# Refresh credentials

Manually refresh credentials for a connected account:

**Python:**

```python
try:
    refreshed = composio.connected_accounts.refresh(connected_account_id)
    print(f"Redirect URL: {refreshed.redirect_url}")

    # Wait for the connection to be established
    composio.connected_accounts.wait_for_connection(refreshed.id)
except Exception as e:
    print(f"Failed to refresh tokens: {e}")
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
const connectedAccountId = "ca_123";
try {
  const refreshed =
    await composio.connectedAccounts.refresh(connectedAccountId);
  console.log("Redirect URL:", refreshed.redirect_url);

  // Wait for the connection to be established
  await composio.connectedAccounts.waitForConnection(refreshed.id);
} catch (error) {
  console.error("Failed to refresh tokens:", error);
}
```

# Enable and disable accounts

Change account status without deleting. Set to INACTIVE to pause access, or ACTIVE to restore. Useful for:

- Pausing access during subscription lapses
- Temporary disconnection

**Python:**

```python
# Disable an account
disabled = composio.connected_accounts.disable(connected_account_id)
print(f"Account disabled status: {disabled.success}")

# Re-enable when needed
enabled = composio.connected_accounts.enable(connected_account_id)
print(f"Account enabled status: {enabled.success}")
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
const connectedAccountId = "ca_123";
// Disable an account
const disabled = await composio.connectedAccounts.disable(connectedAccountId);
console.log("Account disabled status:", disabled.success);

// Re-enable when needed
const enabled = await composio.connectedAccounts.enable(connectedAccountId);
console.log("Account enabled status:", enabled.success);
```

> INACTIVE accounts cannot execute tools. Tool execution will fail until the status is changed.

# Delete accounts

Permanently remove a connected account and revoke all credentials:

**Python:**

```python
# Delete a connected account
composio.connected_accounts.delete(connected_account_id)
print("Account deleted successfully")
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
const connectedAccountId = "ca_123";
// Delete a connected account
await composio.connectedAccounts.delete(connectedAccountId);
console.log("Account deleted successfully");
```

> Deletion is permanent. Users must re-authenticate to reconnect.

# Credential masking

By default, sensitive fields in connected account responses are partially masked for security. This affects fields like `access_token`, `refresh_token`, `api_key`, `bearer_token`, `password`, and other secrets.

Instead of returning full values, the API returns the first 4 characters followed by `...`:

```json
{
  "access_token": "gho_...",
  "refresh_token": "ghr_...",
  "api_key": "sk-l..."
}
```

Values shorter than 4 characters are replaced with `REDACTED`.

This applies to the Get Connected Account and List Connected Accounts endpoints.

## Disabling masking

If you need full credential values (e.g., to use tokens in your own API calls), disable masking via either:

1. **Dashboard**: Go to **Settings → Project Settings → Project Configuration** and turn off "Mask Connected Account Secrets"
2. **API**:

```bash
curl -X PATCH https://backend.composio.dev/api/v3/org/project/config \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"mask_secret_keys_in_connected_account": false}'
```

> Disabling masking exposes full credentials in API responses. Only disable this if your application needs direct access to tokens and you have appropriate security measures in place.

# Multiple accounts

Users can connect multiple accounts for the same toolkit (e.g., personal and work Gmail).

> Use `link()` for creating accounts, as it provides hosted authentication and allows multiple accounts by default. See [Connect Link authentication](/docs/tools-direct/authenticating-tools#hosted-authentication-connect-link).

**Python:**

```python
# First account
try:
    first_account = composio.connected_accounts.initiate(
        user_id=user_id,
        auth_config_id=auth_config_id
    )
    print(f"First account redirect URL: {first_account.redirect_url}")
    connected_first_account = first_account.wait_for_connection()
    print(f"First account status: {connected_first_account.status}")
except Exception as e:
    print(f"Error initiating first account: {e}")

# Second account - must explicitly allow multiple
try:
    second_account = composio.connected_accounts.initiate(
        user_id=user_id,
        auth_config_id=auth_config_id,
        allow_multiple=True  # Required for additional accounts
    )
    print(f"Second account redirect URL: {second_account.redirect_url}")
    connected_second_account = second_account.wait_for_connection()
    print(f"Second account status: {connected_second_account.status}")
except Exception as e:
    print(f"Error initiating second account: {e}")
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
const userId = "user_123";
const authConfigId = "ac_123";
// First account
try {
  const firstAccount = await composio.connectedAccounts.initiate(
    userId,
    authConfigId
  );
  console.log("First account redirect URL:", firstAccount.redirectUrl);
  const connectedFirstAccount = await firstAccount.waitForConnection();
  console.log("First account status:", connectedFirstAccount.status);
} catch (error) {
  console.error("Error initiating first account:", error);
}

// Second account - must explicitly allow multiple
try {
  const secondAccount = await composio.connectedAccounts.initiate(
    userId,
    authConfigId,
    {
      allowMultiple: true, // Required for additional accounts
    }
  );
  console.log("Second account redirect URL:", secondAccount.redirectUrl);
  const connectedSecondAccount = await secondAccount.waitForConnection();
  console.log("Second account status:", connectedSecondAccount.status);
} catch (error) {
  console.error("Error initiating second account:", error);
}
```

> For session-based apps, see [Managing multiple connected accounts](/docs/managing-multiple-connected-accounts) for how to pass a specific account to a session.

## Execute with a specific account

When you have multiple accounts, specify which one to use with `connected_account_id`:

**Python:**

```python
# Execute tool with a specific connected account
result = composio.tools.execute(
    "GMAIL_GET_PROFILE",
    user_id=user_id,
    connected_account_id=connected_account_id,  # Specify which account to use
    version="20251111_00",
    arguments={}
)
print(f"Tool executed: {result}")
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
const userId = "user_123";
const connectedAccountId = "ca_123";
// Execute tool with a specific connected account
const result = await composio.tools.execute("GMAIL_GET_PROFILE", {
  userId: userId,
  connectedAccountId: connectedAccountId, // Specify which account to use
  version: "20251111_00",
  arguments: {},
});
console.log("Tool executed:", result);
```

# What to read next

- [Authenticating tools](/docs/tools-direct/authenticating-tools): Create auth configs and connect user accounts

- [Custom auth configs](/docs/auth-configuration/custom-auth-configs): Use your own OAuth apps for white-labeled authentication

- [Programmatic auth configs](/docs/auth-configuration/programmatic-auth-configs): Create auth configs programmatically via the SDK

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
